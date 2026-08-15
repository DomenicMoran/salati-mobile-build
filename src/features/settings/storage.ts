import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { MODELL_GROESSE_BYTES, modellLoeschen, modellPfad } from '@/features/ki/model';
import { aktuelleModellGroesse, whisperModellLoeschen, whisperModellPfad } from '@/features/hifz/whisperModel';
import { listDownloadedReciters, reciterDir, QURAN_SURAH_COUNT, type DownloadedReciterPack } from '@/features/quran/offline-audio';
import { listDownloadedEpisodes, podcastDir, type DownloadedEpisodeMeta } from '@/features/podcast/downloads';
import { listDownloadedVideos, videoDir, type DownloadedVideoMeta } from '@/features/video/downloads';
import { queryClient, queryPersister, QUERY_CACHE_STORAGE_KEY } from '@/lib/queryClient';

// Zentrale Speicherverwaltung (app/storage.tsx): bündelt die Byte-Größen
// aller relevanten lokalen Verbraucher - Rezitator-Audio, die beiden
// herunterladbaren GGUF/GGML-Modelle (KI-Chat + Hifz-Präzisionsmodus) und den
// react-query-Persist-Cache + sonstige Dateien im OS-Cache-Verzeichnis.
// Löschfunktionen für Rezitator-Audio existieren bereits in offline-audio.ts
// und werden hier NICHT dupliziert, nur die Größenberechnung kommt neu dazu.

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

export interface StorageOverview {
  /** false auf Web - dort gibt es weder Dateisystem-Downloads noch ein sinnvoll messbares Cache-Verzeichnis. */
  supported: boolean;
  reciterAudio: { bytes: number; reciters: ReciterStorageEntry[] };
  offlineQuran: OfflineQuranInfo;
  podcast: { bytes: number; episodes: DownloadedEpisodeMeta[] };
  video: { bytes: number; episodes: DownloadedVideoMeta[] };
  kiModel: { bytes: number; downloaded: boolean };
  whisperModel: { bytes: number; downloaded: boolean };
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
  cache: { bytes: 0 },
  totalBytes: 0,
};

/** Sammelt alle Speicherverbraucher zu einer Übersicht - Basis für app/storage.tsx. */
export async function getStorageOverview(): Promise<StorageOverview> {
  if (Platform.OS === 'web') return EMPTY_OVERVIEW;

  const [
    reciters,
    podcastEpisodes,
    podcastBytes,
    videoEpisodes,
    videoBytes,
    kiInfo,
    whisperInfo,
    cacheDirBytes,
    rawQueryCache,
  ] = await Promise.all([
    getReciterAudioSizes(),
    listDownloadedEpisodes(),
    getDirectorySize(podcastDir()),
    listDownloadedVideos(),
    getDirectorySize(videoDir()),
    FileSystem.getInfoAsync(modellPfad()),
    FileSystem.getInfoAsync(whisperModellPfad()),
    getDirectorySize(FileSystem.cacheDirectory ?? ''),
    AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY).catch(() => null),
  ]);

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

  return {
    supported: true,
    reciterAudio: { bytes: reciterAudioBytes, reciters },
    offlineQuran,
    podcast: { bytes: podcastBytes, episodes: podcastEpisodes },
    video: { bytes: videoBytes, episodes: videoEpisodes },
    kiModel: { bytes: kiBytes, downloaded: kiInfo.exists },
    whisperModel: { bytes: whisperBytes, downloaded: whisperInfo.exists },
    cache: { bytes: cacheBytes },
    totalBytes:
      reciterAudioBytes +
      offlineQuran.bytes +
      podcastBytes +
      videoBytes +
      kiBytes +
      whisperBytes +
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
