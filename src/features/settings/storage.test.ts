import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { OFFLINE_AUDIO_INDEX_KEY } from '@/features/quran/offline-audio';
import { QUERY_CACHE_STORAGE_KEY, queryClient } from '@/lib/queryClient';

import {
  baueDatenBestaende,
  clearAppCache,
  deleteDataStore,
  formatBytes,
  getDirectorySize,
  dokumentOrdnerName,
  getDocumentEntrySizes,
  getQueryCacheBytes,
  getReciterAudioSizes,
  getStorageOverview,
  parseOfflineQuranCache,
  utf8ByteLength,
} from './storage';

// jest.mock-Aufrufe werden von babel-plugin-jest-hoist ohnehin vor die
// Imports gehoben - hier trotzdem nach den Imports notiert (analog
// offline-audio.test.ts), damit eslint(import/first) nicht meckert.
//
// Statt einzelner mockResolvedValueOnce-Ketten (fragil bei rekursiven
// Aufrufen mit unbekannter Reihenfolge) simuliert dieser Mock ein
// Miniatur-Dateisystem als zwei Maps (Dateien mit Größe, Verzeichnisse mit
// Kind-Namen) - getInfoAsync/readDirectoryAsync lesen daraus, __setFile/
// __setDir/__reset sind Test-Helfer zum Aufbauen des Baums pro Testfall.
jest.mock('expo-file-system/legacy', () => {
  // Trailing-Slash-unabhängig ablegen/nachschlagen - echtes FileSystem
  // unterscheidet beim stat()/readdir() nicht zwischen "…/1" und "…/1/",
  // die Produktionslogik hängt beim Rekursions-Abstieg aber keinen
  // Trailing-Slash an Kind-Pfade an (siehe getDirectorySize in storage.ts).
  function norm(uri: string): string {
    return uri.length > 1 && uri.endsWith('/') ? uri.slice(0, -1) : uri;
  }
  const files = new Map<string, number>();
  const dirs = new Map<string, string[]>();
  return {
    documentDirectory: 'file:///doc/',
    cacheDirectory: 'file:///cache/',
    __setFile: (uri: string, size: number) => files.set(norm(uri), size),
    __setDir: (uri: string, children: string[]) => dirs.set(norm(uri), children),
    __reset: () => {
      files.clear();
      dirs.clear();
    },
    getInfoAsync: jest.fn(async (uri: string) => {
      const key = norm(uri);
      if (dirs.has(key)) return { exists: true, isDirectory: true, uri };
      if (files.has(key)) return { exists: true, isDirectory: false, size: files.get(key), uri };
      return { exists: false, isDirectory: false, uri };
    }),
    readDirectoryAsync: jest.fn(async (uri: string) => dirs.get(norm(uri)) ?? []),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///doc/x' }),
  };
});

type FsMock = typeof FileSystem & {
  __setFile: (uri: string, size: number) => void;
  __setDir: (uri: string, children: string[]) => void;
  __reset: () => void;
};
const fsMock = FileSystem as FsMock;

describe('storage: formatBytes', () => {
  it('shows 0 KB for zero/negative/non-finite values', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(-5)).toBe('0 KB');
    expect(formatBytes(NaN)).toBe('0 KB');
  });

  it('rounds sub-KB values up to 1 KB instead of showing 0 KB for existing data', () => {
    expect(formatBytes(500)).toBe('1 KB');
  });

  it('formats KB range without decimals', () => {
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('formats MB range with one decimal', () => {
    expect(formatBytes(1_500_000)).toBe('1.4 MB');
  });

  it('formats GB range with two decimals', () => {
    expect(formatBytes(1_200_000_000)).toBe('1.12 GB');
  });
});

describe('storage: utf8ByteLength', () => {
  it('counts plain ASCII as 1 byte per character', () => {
    expect(utf8ByteLength('abc')).toBe(3);
  });

  it('counts 2-byte characters correctly (e.g. ä)', () => {
    expect(utf8ByteLength('ä')).toBe(2);
  });

  it('counts 3-byte characters correctly (e.g. あ)', () => {
    expect(utf8ByteLength('あ')).toBe(3);
  });

  it('counts 4-byte surrogate-pair characters correctly (e.g. 😀)', () => {
    expect(utf8ByteLength('😀')).toBe(4);
  });

  it('sums mixed strings correctly', () => {
    // "a" (1) + "ä" (2) + "😀" (4) = 7
    expect(utf8ByteLength('aä😀')).toBe(7);
  });
});

describe('storage: getDirectorySize', () => {
  beforeEach(() => {
    fsMock.__reset();
    jest.clearAllMocks();
  });

  it('returns 0 for a URI that does not exist', async () => {
    expect(await getDirectorySize('file:///doc/missing/')).toBe(0);
  });

  it('returns the file size directly for a single file', async () => {
    fsMock.__setFile('file:///doc/x.mp3', 1234);
    expect(await getDirectorySize('file:///doc/x.mp3')).toBe(1234);
  });

  it('sums file sizes recursively across nested subdirectories', async () => {
    fsMock.__setDir('file:///doc/quran-audio/ar.alafasy/', ['1', '2']);
    fsMock.__setDir('file:///doc/quran-audio/ar.alafasy/1/', ['1.mp3', '2.mp3']);
    fsMock.__setFile('file:///doc/quran-audio/ar.alafasy/1/1.mp3', 100);
    fsMock.__setFile('file:///doc/quran-audio/ar.alafasy/1/2.mp3', 200);
    fsMock.__setDir('file:///doc/quran-audio/ar.alafasy/2/', ['1.mp3']);
    fsMock.__setFile('file:///doc/quran-audio/ar.alafasy/2/1.mp3', 300);

    expect(await getDirectorySize('file:///doc/quran-audio/ar.alafasy/')).toBe(600);
  });

  it('returns 0 for an empty directory', async () => {
    fsMock.__setDir('file:///doc/empty/', []);
    expect(await getDirectorySize('file:///doc/empty/')).toBe(0);
  });
});

describe('storage: getReciterAudioSizes', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    fsMock.__reset();
    jest.clearAllMocks();
  });

  it('combines the reciter index with actual on-disk directory sizes', async () => {
    await AsyncStorage.setItem(
      OFFLINE_AUDIO_INDEX_KEY,
      JSON.stringify({ 'ar.alafasy|1': 7, 'ar.alafasy|2': 286 }),
    );
    const dir = `file:///doc/quran-audio/${encodeURIComponent('ar.alafasy')}/`;
    fsMock.__setDir(dir, ['1']);
    fsMock.__setDir(`${dir}1/`, ['1.mp3']);
    fsMock.__setFile(`${dir}1/1.mp3`, 999);

    const result = await getReciterAudioSizes();
    expect(result).toEqual([{ reciter: 'ar.alafasy', surahCount: 2, bytes: 999 }]);
  });

  it('returns an empty list when nothing is downloaded', async () => {
    expect(await getReciterAudioSizes()).toEqual([]);
  });
});

describe('storage: getQueryCacheBytes', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns 0 when no cache has been persisted yet', async () => {
    expect(await getQueryCacheBytes()).toBe(0);
  });

  it('measures the UTF-8 byte size of the persisted cache string', async () => {
    const raw = JSON.stringify({ clientState: { queries: [{ queryKey: ['a'] }] } });
    await AsyncStorage.setItem(QUERY_CACHE_STORAGE_KEY, raw);
    expect(await getQueryCacheBytes()).toBe(utf8ByteLength(raw));
  });
});

describe('storage: parseOfflineQuranCache', () => {
  function cache(queries: { queryKey: unknown[] }[]): string {
    return JSON.stringify({ clientState: { queries } });
  }

  it('returns zero for null or invalid JSON', () => {
    expect(parseOfflineQuranCache(null)).toEqual({ bytes: 0, surahCount: 0 });
    expect(parseOfflineQuranCache('{not json')).toEqual({ bytes: 0, surahCount: 0 });
  });

  it('returns zero when the persisted blob has no query list', () => {
    expect(parseOfflineQuranCache(JSON.stringify({ foo: 'bar' }))).toEqual({ bytes: 0, surahCount: 0 });
  });

  it('counts distinct surahs across surah-reading and translation entries', () => {
    const q1 = { queryKey: ['quran', 'surah', 1, 'de.aburida', 'ar.alafasy'] };
    const q2 = { queryKey: ['quran', 'translation2', 2, 'en.sahih'] };
    // gleiche Sure (1) über eine zweite Edition darf den Zähler NICHT erhöhen
    const q3 = { queryKey: ['quran', 'surah', 1, 'en.sahih', 'ar.alafasy'] };
    const result = parseOfflineQuranCache(cache([q1, q2, q3]));
    expect(result.surahCount).toBe(2);
    expect(result.bytes).toBe(
      utf8ByteLength(JSON.stringify(q1)) +
        utf8ByteLength(JSON.stringify(q2)) +
        utf8ByteLength(JSON.stringify(q3)),
    );
  });

  it('ignores non-quran queries and out-of-range surah numbers', () => {
    const result = parseOfflineQuranCache(
      cache([
        { queryKey: ['prayer', 'times', 5] },
        { queryKey: ['quran', 'audioEditions'] },
        { queryKey: ['quran', 'surah', 0] },
        { queryKey: ['quran', 'surah', 115] },
        { queryKey: ['quran', 'translation2', 'x'] },
      ]),
    );
    expect(result).toEqual({ bytes: 0, surahCount: 0 });
  });
});

describe('storage: clearAppCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    fsMock.__reset();
    jest.clearAllMocks();
  });

  it('clears the query client, removes the persisted cache key, and deletes stray cache files', async () => {
    await AsyncStorage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify({ some: 'data' }));
    fsMock.__setDir('file:///cache/', ['stray-export.ics', 'temp-audio.wav']);
    fsMock.__setFile('file:///cache/stray-export.ics', 10);
    fsMock.__setFile('file:///cache/temp-audio.wav', 20);
    const clearSpy = jest.spyOn(queryClient, 'clear');

    await clearAppCache();

    expect(clearSpy).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/stray-export.ics', { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/temp-audio.wav', { idempotent: true });
    clearSpy.mockRestore();
  });
});


describe('storage: baueDatenBestaende', () => {
  const NICHTS = { quranWords: 0, handouts: 0, kiCorpus: 0, courses: 0, documentTotal: 0, anderweitigGezaehlt: 0 };

  // Der Fall, der ANSCHLAGEN MUSS: im Dokumentverzeichnis liegen 500 Byte, die
  // keine Kategorie fuer sich beansprucht - genau die Lage, die die drei
  // vergessenen Ordner monatelang unsichtbar gemacht hat. Sie muessen als
  // Restposten auftauchen, sonst faellt die Differenz aus der Gesamtsumme.
  it('weist nicht zugeordnete Bytes des Dokumentverzeichnisses als Restposten aus', () => {
    const { bytes, entries } = baueDatenBestaende({
      ...NICHTS,
      quranWords: 300,
      anderweitigGezaehlt: 200,
      documentTotal: 1000,
    });
    expect(entries).toContainEqual({ key: 'other', bytes: 500, deletable: false });
    expect(bytes).toBe(800);
  });

  // Die Gegenprobe, die NICHT anschlagen darf: ist jedes Byte des
  // Dokumentverzeichnisses bereits benannt, darf kein Restposten erfunden
  // werden - sonst stuende dauerhaft ein Phantom-Eintrag in der Uebersicht.
  it('erfindet keinen Restposten, wenn das Dokumentverzeichnis vollstaendig erklaert ist', () => {
    const { bytes, entries } = baueDatenBestaende({
      ...NICHTS,
      quranWords: 300,
      anderweitigGezaehlt: 200,
      documentTotal: 500,
    });
    expect(entries.map((e) => e.key)).toEqual(['quranWords']);
    expect(bytes).toBe(300);
  });

  // Android mit System-DownloadManager: das 1,1-GB-Modell liegt AUSSERHALB des
  // Dokumentverzeichnisses. Die Subtraktion darf dann nicht ins Minus laufen.
  it('bleibt bei Posten ausserhalb des Dokumentverzeichnisses bei 0 statt negativ zu werden', () => {
    const { bytes, entries } = baueDatenBestaende({
      ...NICHTS,
      documentTotal: 100,
      anderweitigGezaehlt: 900,
    });
    expect(entries).toEqual([]);
    expect(bytes).toBe(0);
  });

  it('blendet leere Bestaende aus und sortiert den Rest absteigend nach Groesse', () => {
    const { entries } = baueDatenBestaende({
      ...NICHTS,
      quranWords: 10,
      kiCorpus: 30,
      courses: 20,
      documentTotal: 60,
    });
    expect(entries).toEqual([
      { key: 'kiCorpus', bytes: 30, deletable: true },
      { key: 'courses', bytes: 20, deletable: true },
      { key: 'quranWords', bytes: 10, deletable: true },
    ]);
  });
});

describe('storage: dokumentOrdnerName', () => {
  // MUSS greifen: der Wort-fuer-Wort-Cache liegt zwei Ebenen tief
  // (wbw/v2/<sprache>/) - gesucht ist der Eintrag, den das
  // Dokumentverzeichnis selbst kennt.
  it('nennt den ersten Abschnitt unterhalb des Dokumentverzeichnisses', () => {
    expect(dokumentOrdnerName('file:///doc/wbw/v2/ur/')).toBe('wbw');
    expect(dokumentOrdnerName('file:///doc/wortliste/')).toBe('wortliste');
  });

  // Darf NICHT greifen: der Android-DownloadManager legt das Modell ausserhalb
  // ab. Ein Treffer waere hier schlimmer als keiner - die Groesse wuerde vom
  // Restposten abgezogen, obwohl sie nie darin steckte.
  it('liefert nichts fuer Pfade ausserhalb des Dokumentverzeichnisses', () => {
    expect(dokumentOrdnerName('/storage/emulated/0/Android/data/app/files/modell.gguf')).toBe('');
    expect(dokumentOrdnerName('file:///cache/temp.wav')).toBe('');
  });
});

describe('storage: getDocumentEntrySizes', () => {
  beforeEach(() => {
    fsMock.__reset();
    jest.clearAllMocks();
  });

  it('misst jeden Eintrag des Dokumentverzeichnisses, laesst den AsyncStorage-Ordner aber aus', async () => {
    // RCTAsyncLocalStorage_V1 ist auf iOS der Speicher von AsyncStorage selbst
    // und liegt im Dokumentverzeichnis. Sein Inhalt zaehlt bereits als
    // Query-Cache/Offline-Koran - hier mitgezaehlt waere er doppelt.
    fsMock.__setDir('file:///doc/', ['morphologie', 'RCTAsyncLocalStorage_V1']);
    fsMock.__setDir('file:///doc/morphologie/', ['2.json']);
    fsMock.__setFile('file:///doc/morphologie/2.json', 700);
    fsMock.__setDir('file:///doc/RCTAsyncLocalStorage_V1/', ['manifest.json']);
    fsMock.__setFile('file:///doc/RCTAsyncLocalStorage_V1/manifest.json', 999_999);

    expect([...(await getDocumentEntrySizes())]).toEqual([['morphologie', 700]]);
  });

});

describe('storage: getStorageOverview zaehlt die Datei-Zwischenspeicher mit', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    fsMock.__reset();
    jest.clearAllMocks();
  });

  /** Legt eine Datei an und haengt sie in ihren (flachen) Elternordner ein. */
  function datei(ordner: string, name: string, bytes: number) {
    fsMock.__setDir(ordner, [name]);
    fsMock.__setFile(`${ordner}${name}`, bytes);
  }

  it('zaehlt Morphologie, Wort-fuer-Wort und Wortliste mit - sie fehlten bis 2026-09 vollstaendig', async () => {
    fsMock.__setDir('file:///doc/', [
      'morphologie',
      'wbw',
      'wortliste',
      'handouts',
      'ki-korpus',
      'study-courses',
      'dm-download-id.txt',
      'RCTAsyncLocalStorage_V1',
    ]);
    datei('file:///doc/morphologie/', '2.json', 300_000);
    fsMock.__setDir('file:///doc/wbw/', ['v2']);
    fsMock.__setDir('file:///doc/wbw/v2/', ['ur']);
    datei('file:///doc/wbw/v2/ur/', '2.json', 200_000);
    // Gemessener Ist-Wert vom Geraet: Sure 2 allein ist 1,08 MB gross.
    datei('file:///doc/wortliste/', '2.json', 1_080_000);
    datei('file:///doc/handouts/', 'ep01.pdf', 40_000);
    datei('file:///doc/ki-korpus/', 'korpus-tr.json', 1_600_000);
    datei('file:///doc/study-courses/', 'tajwid.json', 500_000);
    fsMock.__setFile('file:///doc/dm-download-id.txt', 5);
    datei('file:///doc/RCTAsyncLocalStorage_V1/', 'manifest.json', 999_999);

    const overview = await getStorageOverview();

    expect(overview.otherData.entries).toEqual([
      { key: 'kiCorpus', bytes: 1_600_000, deletable: true },
      { key: 'quranWords', bytes: 1_580_000, deletable: true },
      { key: 'courses', bytes: 500_000, deletable: true },
      { key: 'handouts', bytes: 40_000, deletable: true },
      // die uebrig gebliebene dm-download-id.txt - kein bekannter Bestand,
      // faellt aber trotzdem nicht mehr aus der Summe.
      { key: 'other', bytes: 5, deletable: false },
    ]);
    expect(overview.otherData.bytes).toBe(3_720_005);
    // Die Gesamtsumme traegt die neuen Bestaende - und NICHT den
    // AsyncStorage-Ordner (der zaehlt als Cache/Offline-Koran).
    expect(overview.totalBytes).toBe(3_720_005);
  });

  it('vermisst eine Datei genau einmal - sonst laeuft der Bildschirm doppelt ueber tausende Dateien', async () => {
    // Podcast-Folgen wurden bis zu diesem Umbau zweimal vermessen: einmal fuer
    // die eigene Kategorie, einmal fuer die Gesamtgroesse des
    // Dokumentverzeichnisses. Bei einem vollstaendigen Mushaf (ueber 6000
    // MP3-Dateien) ist das die doppelte Wartezeit vor der ersten Zahl.
    fsMock.__setDir('file:///doc/', ['podcast']);
    datei('file:///doc/podcast/', '1.mp3', 5_000);

    await getStorageOverview();

    const gelesen = (FileSystem.getInfoAsync as jest.Mock).mock.calls
      .map((c) => c[0] as string)
      .filter((uri) => uri === 'file:///doc/podcast/1.mp3');
    expect(gelesen).toHaveLength(1);
  });

  it('meldet keine Bestaende, wenn im Dokumentverzeichnis nichts liegt', async () => {
    fsMock.__setDir('file:///doc/', []);
    const overview = await getStorageOverview();
    expect(overview.otherData).toEqual({ bytes: 0, entries: [] });
    expect(overview.totalBytes).toBe(0);
  });
});

describe('storage: deleteDataStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    fsMock.__reset();
    jest.clearAllMocks();
  });

  it('loescht fuer die Koran-Wortdaten genau die drei Verzeichnisse', async () => {
    await deleteDataStore('quranWords');
    const geloescht = (FileSystem.deleteAsync as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(geloescht.sort()).toEqual([
      'file:///doc/morphologie/',
      'file:///doc/wbw/',
      'file:///doc/wortliste/',
    ]);
  });

  it('raeumt mit den Kursdaten auch die Versions-Schluessel weg (sonst laedt der Kurs nie wieder nach)', async () => {
    await AsyncStorage.setItem('salatibox:course-ver-tajwid', '7');
    await AsyncStorage.setItem('salatibox:bleibt', 'x');

    await deleteDataStore('courses');

    expect(await AsyncStorage.getItem('salatibox:course-ver-tajwid')).toBeNull();
    // Gegenprobe: fremde Schluessel bleiben unangetastet.
    expect(await AsyncStorage.getItem('salatibox:bleibt')).toBe('x');
  });
});
