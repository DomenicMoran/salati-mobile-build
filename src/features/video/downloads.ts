import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { hapticSuccess } from '@/lib/haptics';
import type { VideoEpisode } from './data';

// Offline-Downloads fuer Lernvideos: laedt die mp4 (+ optional das Cover) ins
// Dokumentverzeichnis, damit Folgen ohne Netz abspielbar sind. 1:1 uebernommen
// vom Podcast-Download (features/podcast/downloads.ts): ein Modul-Singleton, der
// UNABHAENGIG vom startenden Screen weiterlaeuft (Zurueck-Navigieren bricht den
// Download nicht ab) und den mehrere Screens (Liste, Player, Speicher-
// verwaltung) gleichzeitig mit-beobachten koennen. Web hat kein Dateisystem —
// dort ist das Feature aus (wie offline-audio.ts / podcast/downloads.ts).

const INDEX_KEY = 'salatibox:video-downloads';

export type VideoDownloadState = 'none' | 'downloading' | 'done';

export interface VideoDownloadStatus {
  state: VideoDownloadState;
  /** 0..1 — nur waehrend `downloading` aussagekraeftig. */
  progress: number;
}

export interface DownloadedVideoMeta {
  episodeNo: number;
  title: string;
  series?: string;
  /** Belegte Bytes (Video + optionales Cover). */
  bytes: number;
  hasCover: boolean;
}

// AsyncStorage-Index (Metadaten fuer die Anzeige offline). Die Datei-Existenz
// bleibt die eigentliche Wahrheit ueber „heruntergeladen" (isVideoDownloaded).
type DownloadIndex = Record<string, Omit<DownloadedVideoMeta, 'episodeNo'>>;

export function videoDownloadsSupported(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

export function videoDir(): string {
  return `${FileSystem.documentDirectory}video/`;
}

export function localVideoUri(episodeNo: number): string {
  return `${videoDir()}${episodeNo}.mp4`;
}

// Cover-Container-Name fest .jpg: die nativen Bild-Decoder (expo-image) erkennen
// das Format am Inhalt, nicht an der Endung — daher genuegt EIN Dateiname,
// unabhaengig davon, ob die Quelle jpg/png/webp ist.
export function localVideoCoverUri(episodeNo: number): string {
  return `${videoDir()}${episodeNo}-cover.jpg`;
}

async function readIndex(): Promise<DownloadIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as DownloadIndex) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: DownloadIndex): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)).catch(() => {});
}

/** true, wenn die Videodatei der Folge lokal existiert (Datei ist die Wahrheit). */
export async function isVideoDownloaded(episodeNo: number): Promise<boolean> {
  if (!videoDownloadsSupported()) return false;
  const info = await FileSystem.getInfoAsync(localVideoUri(episodeNo)).catch(() => null);
  return !!info && info.exists && (info.size ?? 0) > 0;
}

/** Video-URL der Folge: lokale Datei wenn heruntergeladen, sonst Remote-URL.
 *  Lokaler Pfad hat Vorrang (Offline-Wiedergabe). */
export async function resolveVideoUri(episode: VideoEpisode): Promise<string> {
  if (await isVideoDownloaded(episode.episode_no)) return localVideoUri(episode.episode_no);
  return episode.video_url;
}

// --- Singleton-Zustand: laufende Downloads + Abonnenten je episode_no ---

const subscribers = new Map<number, Set<(s: VideoDownloadStatus) => void>>();

interface ActiveDownload {
  resumable: ReturnType<typeof FileSystem.createDownloadResumable>;
  progress: number;
}
const active = new Map<number, ActiveDownload>();

function emit(episodeNo: number, status: VideoDownloadStatus): void {
  const subs = subscribers.get(episodeNo);
  if (!subs) return;
  for (const cb of subs) {
    try {
      cb(status);
    } catch {
      // Screen evtl. unmounted — egal, Download laeuft weiter.
    }
  }
}

/** Abonniert Status-Updates einer Folge (Download-Fortschritt, fertig, entfernt).
 *  Gibt die Abmelde-Funktion zurueck. */
export function subscribeVideoDownload(
  episodeNo: number,
  cb: (s: VideoDownloadStatus) => void,
): () => void {
  let set = subscribers.get(episodeNo);
  if (!set) {
    set = new Set();
    subscribers.set(episodeNo, set);
  }
  set.add(cb);
  return () => {
    const s = subscribers.get(episodeNo);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subscribers.delete(episodeNo);
  };
}

export function isVideoDownloading(episodeNo: number): boolean {
  return active.has(episodeNo);
}

export function videoDownloadProgress(episodeNo: number): number | null {
  return active.get(episodeNo)?.progress ?? null;
}

/**
 * Laedt eine Folge (mp4 + optionales Cover) persistent herunter. Laeuft schon
 * ein Download derselben Folge, passiert nichts (kein Neustart). Ein
 * abgebrochener/fehlerhafter Download wird entfernt und als Fehler gemeldet
 * (nicht als „fertig").
 */
export async function downloadVideo(episode: VideoEpisode): Promise<void> {
  if (!videoDownloadsSupported()) return;
  const no = episode.episode_no;
  if (active.has(no)) return;

  await FileSystem.makeDirectoryAsync(videoDir(), { intermediates: true }).catch(() => {});
  const videoDest = localVideoUri(no);

  const resumable = FileSystem.createDownloadResumable(episode.video_url, videoDest, {}, (d) => {
    const total = d.totalBytesExpectedToWrite > 0 ? d.totalBytesExpectedToWrite : 0;
    const ratio = total > 0 ? Math.min(1, d.totalBytesWritten / total) : 0;
    const entry = active.get(no);
    if (entry) entry.progress = ratio;
    emit(no, { state: 'downloading', progress: ratio });
  });

  active.set(no, { resumable, progress: 0 });
  emit(no, { state: 'downloading', progress: 0 });

  try {
    const result = await resumable.downloadAsync();
    if (!result || result.status !== 200) {
      await FileSystem.deleteAsync(videoDest, { idempotent: true }).catch(() => {});
      throw new Error(`video_download_${result?.status ?? 'unknown'}`);
    }
    const info = await FileSystem.getInfoAsync(videoDest);
    if (!info.exists || (info.size ?? 0) <= 0) {
      await FileSystem.deleteAsync(videoDest, { idempotent: true }).catch(() => {});
      throw new Error('video_download_empty');
    }

    // Cover ist optional: ein Fehler beim Cover-Laden macht die Folge trotzdem
    // offline abspielbar.
    let hasCover = false;
    let coverBytes = 0;
    if (episode.cover_url) {
      try {
        const coverDest = localVideoCoverUri(no);
        const cres = await FileSystem.downloadAsync(episode.cover_url, coverDest);
        if (cres.status === 200) {
          const cinfo = await FileSystem.getInfoAsync(coverDest);
          if (cinfo.exists && (cinfo.size ?? 0) > 0) {
            hasCover = true;
            coverBytes = cinfo.size ?? 0;
          }
        }
      } catch {
        // Cover optional — ignorieren.
      }
    }

    const index = await readIndex();
    index[String(no)] = {
      title: episode.title,
      series: episode.series,
      bytes: (info.size ?? 0) + coverBytes,
      hasCover,
    };
    await writeIndex(index);

    hapticSuccess();
    emit(no, { state: 'done', progress: 1 });
  } catch (e) {
    // Nur melden, wenn nicht bereits per cancel() zurueckgesetzt.
    if (active.has(no)) emit(no, { state: 'none', progress: 0 });
    throw e;
  } finally {
    active.delete(no);
  }
}

/** Bricht einen laufenden Download ab und entfernt die Teil-Datei. */
export async function cancelVideoDownload(episodeNo: number): Promise<void> {
  const entry = active.get(episodeNo);
  if (!entry) return;
  active.delete(episodeNo);
  try {
    await entry.resumable.cancelAsync();
  } catch {
    // egal
  }
  await FileSystem.deleteAsync(localVideoUri(episodeNo), { idempotent: true }).catch(() => {});
  emit(episodeNo, { state: 'none', progress: 0 });
}

/** Loescht eine heruntergeladene Folge (Video + Cover + Index-Eintrag). */
export async function deleteVideoDownload(episodeNo: number): Promise<void> {
  await FileSystem.deleteAsync(localVideoUri(episodeNo), { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(localVideoCoverUri(episodeNo), { idempotent: true }).catch(() => {});
  const index = await readIndex();
  if (index[String(episodeNo)]) {
    delete index[String(episodeNo)];
    await writeIndex(index);
  }
  emit(episodeNo, { state: 'none', progress: 0 });
}

/** Loescht ALLE heruntergeladenen Folgen auf einmal. */
export async function deleteAllVideoDownloads(): Promise<void> {
  await FileSystem.deleteAsync(videoDir(), { idempotent: true }).catch(() => {});
  await AsyncStorage.removeItem(INDEX_KEY).catch(() => {});
  for (const episodeNo of subscribers.keys()) emit(episodeNo, { state: 'none', progress: 0 });
}

/** Liste aller heruntergeladenen Folgen mit frischer Byte-Groesse von der Platte.
 *  Verwaiste Index-Eintraege (Datei extern geloescht) werden uebersprungen. */
export async function listDownloadedVideos(): Promise<DownloadedVideoMeta[]> {
  if (!videoDownloadsSupported()) return [];
  const index = await readIndex();
  const out: DownloadedVideoMeta[] = [];
  for (const [key, meta] of Object.entries(index)) {
    const no = Number(key);
    if (!Number.isFinite(no)) continue;
    const videoInfo = await FileSystem.getInfoAsync(localVideoUri(no)).catch(() => null);
    if (!videoInfo || !videoInfo.exists) continue;
    let bytes = videoInfo.size ?? 0;
    if (meta.hasCover) {
      const coverInfo = await FileSystem.getInfoAsync(localVideoCoverUri(no)).catch(() => null);
      if (coverInfo?.exists) bytes += coverInfo.size ?? 0;
    }
    out.push({ episodeNo: no, title: meta.title, series: meta.series, bytes, hasCover: meta.hasCover });
  }
  return out.sort((a, b) => a.episodeNo - b.episodeNo);
}

/** Aktueller Status einer Folge (async, damit der Hook nie synchron im
 *  Effekt-Body setState aufruft — react-hooks/set-state-in-effect). */
async function resolveVideoStatus(episodeNo: number | undefined): Promise<VideoDownloadStatus> {
  if (episodeNo == null) return { state: 'none', progress: 0 };
  if (isVideoDownloading(episodeNo)) {
    return { state: 'downloading', progress: videoDownloadProgress(episodeNo) ?? 0 };
  }
  const downloaded = await isVideoDownloaded(episodeNo);
  return { state: downloaded ? 'done' : 'none', progress: downloaded ? 1 : 0 };
}

/**
 * React-Hook: beobachtet den Download-Status EINER Folge (Liste, Player) und
 * stellt Aktionen bereit. Uebernimmt beim Betreten einen bereits laufenden
 * Download (Singleton) und liefert bei fertigen Folgen die lokalen Datei-URIs.
 */
export function useVideoDownload(episode: VideoEpisode | undefined) {
  const supported = videoDownloadsSupported();
  const episodeNo = episode?.episode_no;
  const [status, setStatus] = useState<VideoDownloadStatus>({ state: 'none', progress: 0 });
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const activeNo = supported ? episodeNo : undefined;
    // Alle setState-Aufrufe laufen in async-Callbacks (nie synchron im
    // Effekt-Body), s. resolveVideoStatus.
    resolveVideoStatus(activeNo).then((s) => {
      if (!cancelled) setStatus(s);
    });
    if (activeNo == null) {
      return () => {
        cancelled = true;
      };
    }
    const unsub = subscribeVideoDownload(activeNo, (s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supported, episodeNo]);

  // Lokales Cover aufloesen, sobald die Folge fertig ist (Offline-Cover in
  // Liste + Player).
  useEffect(() => {
    let cancelled = false;
    if (!supported || episodeNo == null || status.state !== 'done') {
      // Reset im Microtask statt synchron im Effekt-Body.
      Promise.resolve().then(() => {
        if (!cancelled) setLocalCoverUri(null);
      });
      return () => {
        cancelled = true;
      };
    }
    const uri = localVideoCoverUri(episodeNo);
    FileSystem.getInfoAsync(uri)
      .then((info) => {
        if (!cancelled) setLocalCoverUri(info.exists ? uri : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supported, episodeNo, status.state]);

  const download = useCallback(() => {
    if (!episode) return;
    void downloadVideo(episode).catch(() => {});
  }, [episode]);

  const cancel = useCallback(() => {
    if (episodeNo == null) return;
    void cancelVideoDownload(episodeNo);
  }, [episodeNo]);

  const remove = useCallback(async () => {
    if (episodeNo == null) return;
    await deleteVideoDownload(episodeNo);
  }, [episodeNo]);

  return {
    supported,
    state: status.state,
    progress: status.progress,
    localCoverUri,
    download,
    cancel,
    remove,
  };
}
