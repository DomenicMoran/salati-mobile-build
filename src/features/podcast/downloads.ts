import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { hapticSuccess } from '@/lib/haptics';
import type { PodcastEpisode } from './data';

// Offline-Downloads für Podcast-Folgen: lädt die mp3 (+ optional das Cover) ins
// Dokumentverzeichnis, damit Folgen ohne Netz hörbar sind. Muster übernommen
// vom Whisper-Modell-Download (features/hifz/whisperModel.ts): ein Modul-
// Singleton, der UNABHÄNGIG vom startenden Screen weiterläuft (Zurück-
// Navigieren bricht den Download nicht ab) und den mehrere Screens (Liste,
// Voll-Player, Speicherverwaltung) gleichzeitig mit-beobachten können.
// Web hat kein Dateisystem — dort ist das Feature aus (wie offline-audio.ts).

const INDEX_KEY = 'salatibox:podcast-downloads';

export type PodcastDownloadState = 'none' | 'downloading' | 'done';

export interface PodcastDownloadStatus {
  state: PodcastDownloadState;
  /** 0..1 — nur während `downloading` aussagekräftig. */
  progress: number;
}

export interface DownloadedEpisodeMeta {
  episodeNo: number;
  title: string;
  series?: string;
  /** Belegte Bytes (Audio + optionales Cover). */
  bytes: number;
  hasCover: boolean;
}

// AsyncStorage-Index (Metadaten für die Anzeige offline). Die Datei-Existenz
// bleibt die eigentliche Wahrheit über „heruntergeladen" (istEpisodeHeruntergeladen).
type DownloadIndex = Record<string, Omit<DownloadedEpisodeMeta, 'episodeNo'>>;

export function podcastDownloadsSupported(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

export function podcastDir(): string {
  return `${FileSystem.documentDirectory}podcast/`;
}

export function localEpisodeAudioUri(episodeNo: number): string {
  return `${podcastDir()}${episodeNo}.mp3`;
}

// Cover-Container-Name fest .jpg: die nativen Bild-Decoder (expo-image) erkennen
// das Format am Inhalt, nicht an der Endung — daher genügt EIN Dateiname,
// unabhängig davon, ob die Quelle jpg/png/webp ist.
export function localEpisodeCoverUri(episodeNo: number): string {
  return `${podcastDir()}${episodeNo}-cover.jpg`;
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

/** true, wenn die Audiodatei der Folge lokal existiert (Datei ist die Wahrheit). */
export async function isEpisodeDownloaded(episodeNo: number): Promise<boolean> {
  if (!podcastDownloadsSupported()) return false;
  const info = await FileSystem.getInfoAsync(localEpisodeAudioUri(episodeNo)).catch(() => null);
  return !!info && info.exists && (info.size ?? 0) > 0;
}

/** Audio-URL der Folge: lokale Datei wenn heruntergeladen, sonst Remote-URL.
 *  Lokaler Pfad hat Vorrang (Offline-Wiedergabe). */
export async function resolveEpisodeAudioUri(episode: PodcastEpisode): Promise<string> {
  if (await isEpisodeDownloaded(episode.episode_no)) return localEpisodeAudioUri(episode.episode_no);
  return episode.audio_url;
}

// --- Singleton-Zustand: laufende Downloads + Abonnenten je episode_no ---

const subscribers = new Map<number, Set<(s: PodcastDownloadStatus) => void>>();

interface ActiveDownload {
  resumable: ReturnType<typeof FileSystem.createDownloadResumable>;
  progress: number;
}
const active = new Map<number, ActiveDownload>();

function emit(episodeNo: number, status: PodcastDownloadStatus): void {
  const subs = subscribers.get(episodeNo);
  if (!subs) return;
  for (const cb of subs) {
    try {
      cb(status);
    } catch {
      // Screen evtl. unmounted — egal, Download läuft weiter.
    }
  }
}

/** Abonniert Status-Updates einer Folge (Download-Fortschritt, fertig, entfernt).
 *  Gibt die Abmelde-Funktion zurück. */
export function subscribePodcastDownload(
  episodeNo: number,
  cb: (s: PodcastDownloadStatus) => void,
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

export function isEpisodeDownloading(episodeNo: number): boolean {
  return active.has(episodeNo);
}

export function podcastDownloadProgress(episodeNo: number): number | null {
  return active.get(episodeNo)?.progress ?? null;
}

/**
 * Lädt eine Folge (mp3 + optionales Cover) persistent herunter. Läuft schon ein
 * Download derselben Folge, passiert nichts (kein Neustart). Ein abgebrochener/
 * fehlerhafter Download wird entfernt und als Fehler gemeldet (nicht als „fertig").
 */
export async function downloadEpisode(episode: PodcastEpisode): Promise<void> {
  if (!podcastDownloadsSupported()) return;
  const no = episode.episode_no;
  if (active.has(no)) return;

  await FileSystem.makeDirectoryAsync(podcastDir(), { intermediates: true }).catch(() => {});
  const audioDest = localEpisodeAudioUri(no);

  const resumable = FileSystem.createDownloadResumable(episode.audio_url, audioDest, {}, (d) => {
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
      await FileSystem.deleteAsync(audioDest, { idempotent: true }).catch(() => {});
      throw new Error(`podcast_download_${result?.status ?? 'unknown'}`);
    }
    const info = await FileSystem.getInfoAsync(audioDest);
    if (!info.exists || (info.size ?? 0) <= 0) {
      await FileSystem.deleteAsync(audioDest, { idempotent: true }).catch(() => {});
      throw new Error('podcast_download_empty');
    }

    // Cover ist optional: ein Fehler beim Cover-Laden macht die Folge trotzdem
    // offline hörbar.
    let hasCover = false;
    let coverBytes = 0;
    if (episode.cover_url) {
      try {
        const coverDest = localEpisodeCoverUri(no);
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
    // Nur melden, wenn nicht bereits per cancel() zurückgesetzt.
    if (active.has(no)) emit(no, { state: 'none', progress: 0 });
    throw e;
  } finally {
    active.delete(no);
  }
}

/** Bricht einen laufenden Download ab und entfernt die Teil-Datei. */
export async function cancelEpisodeDownload(episodeNo: number): Promise<void> {
  const entry = active.get(episodeNo);
  if (!entry) return;
  active.delete(episodeNo);
  try {
    await entry.resumable.cancelAsync();
  } catch {
    // egal
  }
  await FileSystem.deleteAsync(localEpisodeAudioUri(episodeNo), { idempotent: true }).catch(() => {});
  emit(episodeNo, { state: 'none', progress: 0 });
}

/** Löscht eine heruntergeladene Folge (Audio + Cover + Index-Eintrag). */
export async function deleteEpisodeDownload(episodeNo: number): Promise<void> {
  await FileSystem.deleteAsync(localEpisodeAudioUri(episodeNo), { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(localEpisodeCoverUri(episodeNo), { idempotent: true }).catch(() => {});
  const index = await readIndex();
  if (index[String(episodeNo)]) {
    delete index[String(episodeNo)];
    await writeIndex(index);
  }
  emit(episodeNo, { state: 'none', progress: 0 });
}

/** Löscht ALLE heruntergeladenen Folgen auf einmal. */
export async function deleteAllPodcastDownloads(): Promise<void> {
  await FileSystem.deleteAsync(podcastDir(), { idempotent: true }).catch(() => {});
  await AsyncStorage.removeItem(INDEX_KEY).catch(() => {});
  for (const episodeNo of subscribers.keys()) emit(episodeNo, { state: 'none', progress: 0 });
}

/** Liste aller heruntergeladenen Folgen mit frischer Byte-Größe von der Platte.
 *  Verwaiste Index-Einträge (Datei extern gelöscht) werden übersprungen. */
export async function listDownloadedEpisodes(): Promise<DownloadedEpisodeMeta[]> {
  if (!podcastDownloadsSupported()) return [];
  const index = await readIndex();
  const out: DownloadedEpisodeMeta[] = [];
  for (const [key, meta] of Object.entries(index)) {
    const no = Number(key);
    if (!Number.isFinite(no)) continue;
    const audioInfo = await FileSystem.getInfoAsync(localEpisodeAudioUri(no)).catch(() => null);
    if (!audioInfo || !audioInfo.exists) continue;
    let bytes = audioInfo.size ?? 0;
    if (meta.hasCover) {
      const coverInfo = await FileSystem.getInfoAsync(localEpisodeCoverUri(no)).catch(() => null);
      if (coverInfo?.exists) bytes += coverInfo.size ?? 0;
    }
    out.push({ episodeNo: no, title: meta.title, series: meta.series, bytes, hasCover: meta.hasCover });
  }
  return out.sort((a, b) => a.episodeNo - b.episodeNo);
}

/** Aktueller Status einer Folge (async, damit der Hook nie synchron im
 *  Effekt-Body setState aufruft — react-hooks/set-state-in-effect). */
async function resolvePodcastStatus(episodeNo: number | undefined): Promise<PodcastDownloadStatus> {
  if (episodeNo == null) return { state: 'none', progress: 0 };
  if (isEpisodeDownloading(episodeNo)) {
    return { state: 'downloading', progress: podcastDownloadProgress(episodeNo) ?? 0 };
  }
  const downloaded = await isEpisodeDownloaded(episodeNo);
  return { state: downloaded ? 'done' : 'none', progress: downloaded ? 1 : 0 };
}

/**
 * React-Hook: beobachtet den Download-Status EINER Folge (Liste, Voll-Player)
 * und stellt Aktionen bereit. Übernimmt beim Betreten einen bereits laufenden
 * Download (Singleton) und liefert bei fertigen Folgen die lokalen Datei-URIs.
 */
export function usePodcastDownload(episode: PodcastEpisode | undefined) {
  const supported = podcastDownloadsSupported();
  const episodeNo = episode?.episode_no;
  const [status, setStatus] = useState<PodcastDownloadStatus>({ state: 'none', progress: 0 });
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const activeNo = supported ? episodeNo : undefined;
    // Alle setState-Aufrufe laufen in async-Callbacks (nie synchron im
    // Effekt-Body), s. resolvePodcastStatus.
    resolvePodcastStatus(activeNo).then((s) => {
      if (!cancelled) setStatus(s);
    });
    if (activeNo == null) {
      return () => {
        cancelled = true;
      };
    }
    const unsub = subscribePodcastDownload(activeNo, (s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supported, episodeNo]);

  // Lokales Cover auflösen, sobald die Folge fertig ist (Offline-Cover in
  // Liste + Voll-Player).
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
    const uri = localEpisodeCoverUri(episodeNo);
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
    void downloadEpisode(episode).catch(() => {});
  }, [episode]);

  const cancel = useCallback(() => {
    if (episodeNo == null) return;
    void cancelEpisodeDownload(episodeNo);
  }, [episodeNo]);

  const remove = useCallback(async () => {
    if (episodeNo == null) return;
    await deleteEpisodeDownload(episodeNo);
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
