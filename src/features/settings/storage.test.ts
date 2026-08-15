import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { OFFLINE_AUDIO_INDEX_KEY } from '@/features/quran/offline-audio';
import { QUERY_CACHE_STORAGE_KEY, queryClient } from '@/lib/queryClient';

import {
  clearAppCache,
  formatBytes,
  getDirectorySize,
  getQueryCacheBytes,
  getReciterAudioSizes,
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
