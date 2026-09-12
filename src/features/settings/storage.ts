import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { deleteAllHandoutDownloads, handoutDir } from '@/features/handouts/downloads';
import { MODELL_GROESSE_BYTES, modellLoeschen, modellPfad } from '@/features/ki/model';
import { korpusCacheLoeschen, korpusDatenVerzeichnis } from '@/features/ki/korpusCache';
import { aktuelleModellGroesse, whisperModellLoeschen, whisperModellPfad } from '@/features/hifz/whisperModel';
import { morphologieCacheLoeschen, morphologieDatenVerzeichnis } from '@/features/quran/morphologie';
import { listDownloadedReciters, reciterDir, QURAN_SURAH_COUNT, type DownloadedReciterPack } from '@/features/quran/offline-audio';
import { wbwCacheLoeschen, wbwDatenVerzeichnis } from '@/features/quran/wbw';
import { wortlisteCacheLoeschen, wortlisteDatenVerzeichnis } from '@/features/quran/wortliste';
import { courseCacheDir, deleteCourseCache } from '@/features/study/courseSync';
import { listDownloadedEpisodes, podcastDir, type DownloadedEpisodeMeta } from '@/features/podcast/downloads';
import { listDownloadedVideos, videoDir, type DownloadedVideoMeta } from '@/features/video/downloads';
import { queryClient, queryPersister, QUERY_CACHE_STORAGE_KEY } from '@/lib/queryClient';

// Zentrale Speicherverwaltung (app/storage.tsx): bündelt die Byte-Größen
// aller relevanten lokalen Verbraucher - Rezitator-Audio, die beiden
// herunterladbaren GGUF/GGML-Modelle (KI-Chat + Hifz-Präzisionsmodus) und den
// react-query-Persist-Cache + sonstige Dateien im OS-Cache-Verzeichnis.
// Löschfunktionen für Rezitator-Audio existieren bereits in offline-audio.ts
// und werden hier NICHT dupliziert, nur die Größenberechnung kommt neu dazu.
//
// VOLLSTÄNDIGKEIT IST HIER DIE EIGENTLICHE ANFORDERUNG (Prüfung 2026-09-07):
// die Übersicht zählte lange nur die Bestände, an die beim Bau jemand gedacht
// hat - die Datei-Zwischenspeicher für Morphologie, Wort-für-Wort und
// Wortliste (allein Sure 2: 1,08 MB) fehlten ebenso wie Unterlagen-PDFs,
// KI-Korpus und Kursdaten. Eine zu kleine Zahl ist keine harmlose Ungenauig-
// keit, sondern eine falsche Auskunft über das Gerät des Nutzers, und wer
// Platz schaffen will, findet die größten Brocken gar nicht.
//
// Deshalb wird die Summe nicht mehr allein aus einer Liste bekannter Posten
// gebildet: `sonstige Dateien` ist die GEMESSENE Restgröße des Dokument-
// verzeichnisses abzüglich aller ausgewiesenen Posten (s.
// baueDatenBestaende). Ein künftiger, hier vergessener Ordner taucht damit
// automatisch in der Gesamtsumme auf, statt unsichtbar zu bleiben.

/** Formatiert Bytes menschenlesbar in KB/MB/GB - reine Funktion, siehe storage.test.ts. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / KB))} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/**
 * UTF-8-Byte-Länge eines Strings - AsyncStorage/JS-String.length zählt UTF-16-
 * Code-Units, nicht Bytes; für die Cache-Größenanzeige wird die tatsächliche
 * auf der Platte belegte Byte-Zahl gebraucht (arabische/kyrillische/etc.
 * Zeichen im persistierten Query-Cache sind 2-4 statt 1 Byte groß).
 */
export function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    if (code === undefined) continue;
    if (code > 0xffff) i++; // zweite UTF-16-Einheit eines Surrogatpaars überspringen
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * Rekursive Verzeichnisgröße - die legacy expo-file-system-API liefert für
 * Verzeichnisse selbst keine (rekursive) Größe über getInfoAsync, daher hier
 * per Hand: Dateien direkt aufsummieren, Unterverzeichnisse rekursiv besuchen.
 */
export async function getDirectorySize(uri: string): Promise<number> {
  if (!uri) return 0;
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!info || !info.exists) return 0;
  if (!info.isDirectory) return info.size ?? 0;

  const base = uri.endsWith('/') ? uri : `${uri}/`;
  const entries = await FileSystem.readDirectoryAsync(uri).catch(() => [] as string[]);
  let total = 0;
  for (const entry of entries) {
    total += await getDirectorySize(`${base}${entry}`);
  }
  return total;
}

export interface ReciterStorageEntry extends DownloadedReciterPack {
  bytes: number;
}

/** Rezitator-Downloads mit tatsächlicher Verzeichnisgröße pro Rezitator - Liste selbst kommt aus offline-audio.ts. */
export async function getReciterAudioSizes(): Promise<ReciterStorageEntry[]> {
  const packs = await listDownloadedReciters();
  return Promise.all(
    packs.map(async (pack) => ({
      ...pack,
      bytes: await getDirectorySize(reciterDir(pack.reciter)),
    })),
  );
}

/** Byte-Größe des persistierten react-query-Caches (AsyncStorage, ein einzelner JSON-String unter einem festen Key). */
export async function getQueryCacheBytes(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY).catch(() => null);
  return raw ? utf8ByteLength(raw) : 0;
}

export interface OfflineQuranInfo {
  /** Serialisierte Byte-Größe aller offline vorliegenden Sure-Text-/Übersetzungs-Einträge im Query-Cache. */
  bytes: number;
  /** Anzahl VERSCHIEDENER Suren (1..114), deren Text ODER Übersetzung offline im Cache liegt. */
  surahCount: number;
}

/**
 * Offline verfügbarer Koran-TEXT (nicht Audio): der "Offline verfügbar
 * machen"-Download (app/settings.tsx downloadOfflinePack) und die
 * Übersetzungs-Vorabladung (lib/queryClient.ts prefetchTranslationOffline)
 * legen die Sure-Texte/-Übersetzungen als Einträge im persistierten
 * react-query-Cache ab - EIN gemeinsamer JSON-Blob unter QUERY_CACHE_STORAGE_KEY.
 * Diese reine Funktion parst den Blob und summiert gezielt die Koran-Lese-
 * Einträge (queryKey ['quran','surah',n,…] und ['quran','translation2',surah,…]),
 * damit die Speicherverwaltung sie als eigene Kategorie ausweisen kann statt
 * sie im allgemeinen "Cache" zu verstecken (User-Wunsch: heruntergeladene
 * Suren sollen sichtbar sein). Byte-Wert ist die serialisierte Größe des
 * jeweiligen Eintrags - eine ehrliche Näherung seines Anteils am Blob, ohne
 * das interne Persist-Format nachzubauen.
 */
export function parseOfflineQuranCache(raw: string | null): OfflineQuranInfo {
  if (!raw) return { bytes: 0, surahCount: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { bytes: 0, surahCount: 0 };
  }
  const queries = (parsed as { clientState?: { queries?: unknown } })?.clientState?.queries;
  if (!Array.isArray(queries)) return { bytes: 0, surahCount: 0 };

  const surahs = new Set<number>();
  let bytes = 0;
  for (const q of queries) {
    const key = (q as { queryKey?: unknown })?.queryKey;
    if (!Array.isArray(key) || key[0] !== 'quran') continue;
    if (key[1] !== 'surah' && key[1] !== 'translation2') continue;
    const surah = key[2];
    if (typeof surah !== 'number' || !Number.isInteger(surah) || surah < 1 || surah > QURAN_SURAH_COUNT) {
      continue;
    }
    surahs.add(surah);
    bytes += utf8ByteLength(JSON.stringify(q));
  }
  return { bytes, surahCount: surahs.size };
}

/**
 * Ordnernamen im Dokumentverzeichnis, die NICHT der App-Ablage gehören:
 * AsyncStorage legt seinen Speicher auf iOS genau dort ab
 * (RNCAsyncStorage.mm: `RCTAsyncLocalStorage_V1`, unter Expo
 * `RCTAsyncLocalStorage`, beides unter NSDocumentDirectory). Sein Inhalt wird
 * bereits als Query-Cache/Offline-Koran gezählt - ohne diese Ausnahme stünde
 * er in der Restgröße ein zweites Mal. Auf Android liegt AsyncStorage in einer
 * SQLite-Datei außerhalb des Dokumentverzeichnisses; dort läuft die Liste
 * schlicht ins Leere.
 */
const ASYNC_STORAGE_ORDNER = ['RCTAsyncLocalStorage_V1', 'RCTAsyncLocalStorage'];

/**
 * Erster Pfadabschnitt eines Ablageorts unterhalb des Dokumentverzeichnisses:
 * aus `file:///doc/wbw/v2/` wird `wbw`. Damit lässt sich die Größe, die der
 * eine Durchlauf von getDocumentEntrySizes() ohnehin ermittelt hat, dem
 * Verzeichnis zuordnen, das eine Funktion wie wbwDatenVerzeichnis() nennt -
 * ohne den Namen hier ein zweites Mal hinzuschreiben. Leerer String, wenn der
 * Pfad NICHT im Dokumentverzeichnis liegt (Android legt das KI-Modell per
 * DownloadManager in die App-External-Files).
 */
export function dokumentOrdnerName(uri: string): string {
  const dir = FileSystem.documentDirectory;
  if (!dir || !uri.startsWith(dir)) return '';
  return uri.slice(dir.length).split('/')[0] ?? '';
}

/**
 * Größe JEDES Eintrags im Dokumentverzeichnis (Name → Bytes), in EINEM
 * Durchlauf und ohne den AsyncStorage-Ordner (s. ASYNC_STORAGE_ORDNER).
 *
 * Bewusst ein gemeinsamer Durchlauf statt eines getDirectorySize()-Aufrufs je
 * Kategorie: bei einem vollständigen Mushaf liegen über 6000 MP3-Dateien im
 * Dokumentverzeichnis, und jede Datei kostet ein getInfoAsync(). Jede
 * Kategorie einzeln zu vermessen UND danach fürs Gesamtbild noch einmal alles
 * abzulaufen, würde die Wartezeit des Speicher-Bildschirms verdoppeln.
 */
export async function getDocumentEntrySizes(): Promise<Map<string, number>> {
  const dir = FileSystem.documentDirectory;
  const sizes = new Map<string, number>();
  if (!dir) return sizes;
  const base = dir.endsWith('/') ? dir : `${dir}/`;
  const entries = await FileSystem.readDirectoryAsync(base).catch(() => [] as string[]);
  for (const entry of entries) {
    if (ASYNC_STORAGE_ORDNER.includes(entry)) continue;
    sizes.set(entry, await getDirectorySize(`${base}${entry}`));
  }
  return sizes;
}

/** Größe eines Ablageorts aus dem bereits gemessenen Dokumentverzeichnis. */
function ordnerBytes(sizes: Map<string, number>, verzeichnis: string): number {
  return sizes.get(dokumentOrdnerName(verzeichnis)) ?? 0;
}

/** Bestände, die vor dieser Prüfung gar nicht gezählt wurden - jeder mit
 *  eigener Zeile und eigenem Lösch-Knopf in app/storage.tsx. */
export type DataStoreKey = 'quranWords' | 'handouts' | 'kiCorpus' | 'courses' | 'other';

/** Alles außer `other` lässt sich gefahrlos löschen (verlustfrei nachladbar). */
export type DeletableDataStoreKey = Exclude<DataStoreKey, 'other'>;

export interface DataStoreEntry {
  key: DataStoreKey;
  bytes: number;
  /**
   * false nur für `other`: der Restposten hat keinen bekannten Besitzer und
   * kann Dateien enthalten, die gerade gebraucht werden (z. B.
   * dm-download-id.txt, die Wiederfindung eines laufenden 1,1-GB-Modell-
   * Downloads). Ein Sammel-Löschknopf darauf wäre gefährlich.
   */
  deletable: boolean;
}

export interface DatenBestandGroessen {
  /** Morphologie + Wort-für-Wort + Wortliste (alle drei sind Lese-Hilfsdaten zum Koran). */
  quranWords: number;
  handouts: number;
  kiCorpus: number;
  courses: number;
  /** Gemessene Gesamtgröße des Dokumentverzeichnisses (ohne AsyncStorage-Ordner). */
  documentTotal: number;
  /**
   * Summe der Posten, die AUCH im Dokumentverzeichnis liegen, aber schon in
   * einer eigenen Kategorie der Übersicht stehen (Rezitator-Audio, Podcast,
   * Video, Modelle). Sie dürfen im Restposten nicht ein zweites Mal auftauchen.
   */
  anderweitigGezaehlt: number;
}

/**
 * Reine Rechnung für die neuen Bestände - siehe storage.test.ts.
 *
 * Der Restposten `other` ist der Kern der Sache: gemessenes Dokument-
 * verzeichnis MINUS alles, was die Übersicht namentlich kennt. Damit ist die
 * Gesamtsumme auch dann vollständig, wenn ein künftiger Ordner hier vergessen
 * wird - er landet dann eben unbenannt im Rest statt aus der Summe zu fallen.
 * `Math.max(0, …)` fängt den Fall ab, dass ein Posten außerhalb des
 * Dokumentverzeichnisses liegt (Android-DownloadManager legt das KI-Modell in
 * die App-External-Files, s. features/ki/model.ts).
 *
 * Einträge ohne Inhalt fallen raus (kein "0 KB"-Rauschen), der Rest steht
 * absteigend nach Größe - wer Platz schaffen will, sieht den größten Brocken
 * oben.
 */
export function baueDatenBestaende(g: DatenBestandGroessen): { bytes: number; entries: DataStoreEntry[] } {
  const benannt = g.quranWords + g.handouts + g.kiCorpus + g.courses;
  const other = Math.max(0, g.documentTotal - benannt - g.anderweitigGezaehlt);
  const entries: DataStoreEntry[] = [
    { key: 'quranWords' as const, bytes: g.quranWords, deletable: true },
    { key: 'handouts' as const, bytes: g.handouts, deletable: true },
    { key: 'kiCorpus' as const, bytes: g.kiCorpus, deletable: true },
    { key: 'courses' as const, bytes: g.courses, deletable: true },
    { key: 'other' as const, bytes: other, deletable: false },
  ]
    .filter((e) => e.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  return { bytes: benannt + other, entries };
}

export interface StorageOverview {
  /** false auf Web - dort gibt es weder Dateisystem-Downloads noch ein sinnvoll messbares Cache-Verzeichnis. */
  supported: boolean;
  reciterAudio: { bytes: number; reciters: ReciterStorageEntry[] };
  offlineQuran: OfflineQuranInfo;
  podcast: { bytes: number; episodes: DownloadedEpisodeMeta[] };
  video: { bytes: number; episodes: DownloadedVideoMeta[] };
  kiModel: { bytes: number; downloaded: boolean };
  whisperModel: { bytes: number; downloaded: boolean };
  /** Datei-Bestände, die bis 2026-09 gar nicht gezählt wurden (s. Kopf-Kommentar). */
  otherData: { bytes: number; entries: DataStoreEntry[] };
  cache: { bytes: number };
  totalBytes: number;
}

const EMPTY_OVERVIEW: StorageOverview = {
  supported: false,
  reciterAudio: { bytes: 0, reciters: [] },
  offlineQuran: { bytes: 0, surahCount: 0 },
  podcast: { bytes: 0, episodes: [] },
  video: { bytes: 0, episodes: [] },
  kiModel: { bytes: 0, downloaded: false },
  whisperModel: { bytes: 0, downloaded: false },
  otherData: { bytes: 0, entries: [] },
  cache: { bytes: 0 },
  totalBytes: 0,
};

/** Sammelt alle Speicherverbraucher zu einer Übersicht - Basis für app/storage.tsx. */
export async function getStorageOverview(): Promise<StorageOverview> {
  if (Platform.OS === 'web') return EMPTY_OVERVIEW;

  const [
    reciters,
    podcastEpisodes,
    videoEpisodes,
    kiInfo,
    whisperInfo,
    cacheDirBytes,
    rawQueryCache,
    dokumentGroessen,
  ] = await Promise.all([
    getReciterAudioSizes(),
    listDownloadedEpisodes(),
    listDownloadedVideos(),
    FileSystem.getInfoAsync(modellPfad()),
    FileSystem.getInfoAsync(whisperModellPfad()),
    getDirectorySize(FileSystem.cacheDirectory ?? ''),
    AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY).catch(() => null),
    getDocumentEntrySizes(),
  ]);

  // Alle Verzeichnis-Größen kommen aus dem EINEN Durchlauf oben - die Pfade
  // selbst bleiben Sache der jeweiligen Feature-Datei (podcastDir(),
  // wbwDatenVerzeichnis(), …), hier steht kein Ordnername ein zweites Mal.
  const podcastBytes = ordnerBytes(dokumentGroessen, podcastDir());
  const videoBytes = ordnerBytes(dokumentGroessen, videoDir());
  const morphologieBytes = ordnerBytes(dokumentGroessen, morphologieDatenVerzeichnis());
  const wbwBytes = ordnerBytes(dokumentGroessen, wbwDatenVerzeichnis());
  const wortlisteBytes = ordnerBytes(dokumentGroessen, wortlisteDatenVerzeichnis());
  const handoutBytes = ordnerBytes(dokumentGroessen, handoutDir());
  const kiKorpusBytes = ordnerBytes(dokumentGroessen, korpusDatenVerzeichnis());
  const courseBytes = ordnerBytes(dokumentGroessen, courseCacheDir());
  const documentTotal = [...dokumentGroessen.values()].reduce((sum, b) => sum + b, 0);

  const reciterAudioBytes = reciters.reduce((sum, r) => sum + r.bytes, 0);
  const kiBytes = kiInfo.exists ? (kiInfo.size ?? 0) : 0;
  const whisperBytes = whisperInfo.exists ? (whisperInfo.size ?? 0) : 0;

  // Offline-Koran-Text als eigene Kategorie aus dem Query-Cache herauslösen und
  // aus dem "Cache"-Rest herausrechnen, damit die Gesamtsumme unverändert
  // bleibt (keine Doppelzählung): Cache = OS-Cache-Verzeichnis + restlicher
  // Query-Cache ohne die Koran-Lese-Einträge.
  const totalQueryCacheBytes = rawQueryCache ? utf8ByteLength(rawQueryCache) : 0;
  const offlineQuran = parseOfflineQuranCache(rawQueryCache);
  const cacheBytes = cacheDirBytes + Math.max(0, totalQueryCacheBytes - offlineQuran.bytes);

  // Das KI-Modell zählt nur dann als "schon anderweitig gezählt", wenn es
  // tatsächlich IM Dokumentverzeichnis liegt: auf Android mit
  // System-DownloadManager liegt es in den App-External-Files (modellPfad()),
  // die getDocumentEntrySizes() gar nicht erfasst - dort abgezogen würde es
  // den Restposten fälschlich schrumpfen.
  const kiImDokumentVerzeichnis = dokumentOrdnerName(modellPfad()) !== '';
  const otherData = baueDatenBestaende({
    quranWords: morphologieBytes + wbwBytes + wortlisteBytes,
    handouts: handoutBytes,
    kiCorpus: kiKorpusBytes,
    courses: courseBytes,
    documentTotal,
    anderweitigGezaehlt:
      reciterAudioBytes + podcastBytes + videoBytes + whisperBytes + (kiImDokumentVerzeichnis ? kiBytes : 0),
  });

  return {
    supported: true,
    reciterAudio: { bytes: reciterAudioBytes, reciters },
    offlineQuran,
    podcast: { bytes: podcastBytes, episodes: podcastEpisodes },
    video: { bytes: videoBytes, episodes: videoEpisodes },
    kiModel: { bytes: kiBytes, downloaded: kiInfo.exists },
    whisperModel: { bytes: whisperBytes, downloaded: whisperInfo.exists },
    otherData,
    cache: { bytes: cacheBytes },
    totalBytes:
      reciterAudioBytes +
      offlineQuran.bytes +
      podcastBytes +
      videoBytes +
      kiBytes +
      whisperBytes +
      otherData.bytes +
      cacheBytes,
  };
}

/** Löscht das KI-Chat-Modell - ruft nur die bestehende Funktion aus features/ki/model.ts auf. */
export async function deleteKiModel(): Promise<void> {
  await modellLoeschen();
}

/** Löscht das Whisper-Modell (Hifz-Präzisionsmodus) - ruft nur die bestehende Funktion aus features/hifz/whisperModel.ts auf. */
export async function deleteWhisperModel(): Promise<void> {
  await whisperModellLoeschen();
}

export { MODELL_GROESSE_BYTES, aktuelleModellGroesse };

/**
 * Löscht einen der neu ausgewiesenen Bestände. Jeder Fall ist verlustfrei
 * nachladbar - deshalb gibt es hier überhaupt einen Lösch-Knopf:
 *  · quranWords: Morphologie/Wort-für-Wort kommen aus R2, die Wortliste von
 *    quran.com. Nach dem Löschen braucht die Wortanalyse wieder Netz, bis sie
 *    sich neu gefüllt hat.
 *  · handouts: heruntergeladene PDFs - erneut ladbar, offline aber weg
 *    (deshalb im UI mit Rückfrage).
 *  · kiCorpus: der deutsche Korpus ist gebündelt, die übrigen Sprachen laden
 *    beim nächsten Start nach.
 *  · courses: jeder Kurs ist gebündelt; der Cache ist nur eine neuere Fassung.
 *
 * Der Restposten `other` steht bewusst NICHT hier (s. DataStoreEntry.deletable).
 */
export async function deleteDataStore(key: DeletableDataStoreKey): Promise<void> {
  switch (key) {
    case 'quranWords':
      await Promise.all([morphologieCacheLoeschen(), wbwCacheLoeschen(), wortlisteCacheLoeschen()]);
      return;
    case 'handouts':
      await deleteAllHandoutDownloads();
      return;
    case 'kiCorpus':
      await korpusCacheLoeschen();
      return;
    case 'courses':
      await deleteCourseCache();
      return;
  }
}

/**
 * Leert den Cache: react-query-Persist-Cache (In-Memory + AsyncStorage) UND
 * verwaiste Dateien im OS-Cache-Verzeichnis (z. B. liegen gebliebene
 * Export-/Temp-Dateien nach einem Absturz). Rührt bewusst NICHT an
 * documentDirectory - Rezitator-Audio und Modelle bleiben unangetastet, das
 * sind eigene Kategorien mit eigenen Lösch-Buttons.
 */
export async function clearAppCache(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
  if (FileSystem.cacheDirectory) {
    const entries = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory).catch(() => [] as string[]);
    await Promise.all(
      entries.map((entry) =>
        FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${entry}`, { idempotent: true }).catch(() => {}),
      ),
    );
  }
}
