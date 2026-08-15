import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { hapticSuccess } from '@/lib/haptics';
import type { Handout } from './data';

// Offline-Downloads fuer Handout-PDFs: laedt die PDF ins Dokumentverzeichnis,
// damit Unterlagen ohne Netz gelesen werden koennen. Muster 1:1 vom Video-
// Download (features/video/downloads.ts): ein Modul-Singleton, der UNABHAENGIG
// vom startenden Screen weiterlaeuft und den mehrere Screens (Liste, Viewer)
// gleichzeitig beobachten koennen. Handouts sind nach `id` (String) verschluesselt
// statt nach Folgennummer. Web hat kein Dateisystem — dort ist das Feature aus.

const INDEX_KEY = 'salatibox:handout-downloads';

export type HandoutDownloadState = 'none' | 'downloading' | 'done';

export interface HandoutDownloadStatus {
  state: HandoutDownloadState;
  /** 0..1 — nur waehrend `downloading` aussagekraeftig. */
  progress: number;
}

// AsyncStorage-Index (Metadaten fuer die Anzeige offline). Die Datei-Existenz
// bleibt die eigentliche Wahrheit ueber „heruntergeladen" (isHandoutDownloaded).
type DownloadIndex = Record<string, { title: string; bytes: number }>;

export function handoutDownloadsSupported(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

export function handoutDir(): string {
  return `${FileSystem.documentDirectory}handouts/`;
}

// Dateiname aus der Handout-id — nur alphanumerisch/Bindestrich zulassen, damit
// keine ungueltigen Pfadzeichen entstehen (ids sind Slug-artig, aber defensiv).
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function localHandoutUri(id: string): string {
  return `${handoutDir()}${safeId(id)}.pdf`;
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

/** true, wenn die PDF-Datei der Unterlage lokal existiert (Datei ist die Wahrheit). */
export async function isHandoutDownloaded(id: string): Promise<boolean> {
  if (!handoutDownloadsSupported()) return false;
  const info = await FileSystem.getInfoAsync(localHandoutUri(id)).catch(() => null);
  return !!info && info.exists && (info.size ?? 0) > 0;
}

// --- Singleton-Zustand: laufende Downloads + Abonnenten je id ---

const subscribers = new Map<string, Set<(s: HandoutDownloadStatus) => void>>();

interface ActiveDownload {
  resumable: ReturnType<typeof FileSystem.createDownloadResumable>;
  progress: number;
}
const active = new Map<string, ActiveDownload>();

function emit(id: string, status: HandoutDownloadStatus): void {
  const subs = subscribers.get(id);
  if (!subs) return;
  for (const cb of subs) {
    try {
      cb(status);
    } catch {
      // Screen evtl. unmounted — egal, Download laeuft weiter.
    }
  }
}

/** Abonniert Status-Updates einer Unterlage. Gibt die Abmelde-Funktion zurueck. */
export function subscribeHandoutDownload(
  id: string,
  cb: (s: HandoutDownloadStatus) => void,
): () => void {
  let set = subscribers.get(id);
  if (!set) {
    set = new Set();
    subscribers.set(id, set);
  }
  set.add(cb);
  return () => {
    const s = subscribers.get(id);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subscribers.delete(id);
  };
}

export function isHandoutDownloading(id: string): boolean {
  return active.has(id);
}

export function handoutDownloadProgress(id: string): number | null {
  return active.get(id)?.progress ?? null;
}

/**
 * Laedt eine Unterlage (PDF) persistent herunter. Laeuft schon ein Download
 * derselben Unterlage, passiert nichts (kein Neustart). Ein abgebrochener/
 * fehlerhafter Download wird entfernt und als Fehler gemeldet (nicht als „fertig").
 */
export async function downloadHandout(handout: Handout): Promise<void> {
  if (!handoutDownloadsSupported()) return;
  const id = handout.id;
  if (active.has(id)) return;

  await FileSystem.makeDirectoryAsync(handoutDir(), { intermediates: true }).catch(() => {});
  const dest = localHandoutUri(id);

  const resumable = FileSystem.createDownloadResumable(handout.pdf_url, dest, {}, (d) => {
    const total = d.totalBytesExpectedToWrite > 0 ? d.totalBytesExpectedToWrite : 0;
    const ratio = total > 0 ? Math.min(1, d.totalBytesWritten / total) : 0;
    const entry = active.get(id);
    if (entry) entry.progress = ratio;
    emit(id, { state: 'downloading', progress: ratio });
  });

  active.set(id, { resumable, progress: 0 });
  emit(id, { state: 'downloading', progress: 0 });

  try {
    const result = await resumable.downloadAsync();
    if (!result || result.status !== 200) {
      await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
      throw new Error(`handout_download_${result?.status ?? 'unknown'}`);
    }
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists || (info.size ?? 0) <= 0) {
      await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
      throw new Error('handout_download_empty');
    }

    const index = await readIndex();
    index[id] = { title: handout.title, bytes: info.size ?? 0 };
    await writeIndex(index);

    hapticSuccess();
    emit(id, { state: 'done', progress: 1 });
  } catch (e) {
    // Nur melden, wenn nicht bereits per cancel() zurueckgesetzt.
    if (active.has(id)) emit(id, { state: 'none', progress: 0 });
    throw e;
  } finally {
    active.delete(id);
  }
}

/** Bricht einen laufenden Download ab und entfernt die Teil-Datei. */
export async function cancelHandoutDownload(id: string): Promise<void> {
  const entry = active.get(id);
  if (!entry) return;
  active.delete(id);
  try {
    await entry.resumable.cancelAsync();
  } catch {
    // egal
  }
  await FileSystem.deleteAsync(localHandoutUri(id), { idempotent: true }).catch(() => {});
  emit(id, { state: 'none', progress: 0 });
}

/** Loescht eine heruntergeladene Unterlage (PDF + Index-Eintrag). */
export async function deleteHandoutDownload(id: string): Promise<void> {
  await FileSystem.deleteAsync(localHandoutUri(id), { idempotent: true }).catch(() => {});
  const index = await readIndex();
  if (index[id]) {
    delete index[id];
    await writeIndex(index);
  }
  emit(id, { state: 'none', progress: 0 });
}

/** Aktueller Status einer Unterlage (async, damit der Hook nie synchron im
 *  Effekt-Body setState aufruft — react-hooks/set-state-in-effect). */
async function resolveHandoutStatus(id: string | undefined): Promise<HandoutDownloadStatus> {
  if (id == null) return { state: 'none', progress: 0 };
  if (isHandoutDownloading(id)) {
    return { state: 'downloading', progress: handoutDownloadProgress(id) ?? 0 };
  }
  const downloaded = await isHandoutDownloaded(id);
  return { state: downloaded ? 'done' : 'none', progress: downloaded ? 1 : 0 };
}

/**
 * React-Hook: beobachtet den Download-Status EINER Unterlage (Liste, Viewer)
 * und stellt Aktionen bereit. Uebernimmt beim Betreten einen bereits laufenden
 * Download (Singleton).
 */
export function useHandoutDownload(handout: Handout | undefined) {
  const supported = handoutDownloadsSupported();
  const id = handout?.id;
  const [status, setStatus] = useState<HandoutDownloadStatus>({ state: 'none', progress: 0 });

  useEffect(() => {
    let cancelled = false;
    const activeId = supported ? id : undefined;
    // Alle setState-Aufrufe laufen in async-Callbacks (nie synchron im
    // Effekt-Body), s. resolveHandoutStatus.
    resolveHandoutStatus(activeId).then((s) => {
      if (!cancelled) setStatus(s);
    });
    if (activeId == null) {
      return () => {
        cancelled = true;
      };
    }
    const unsub = subscribeHandoutDownload(activeId, (s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supported, id]);

  const download = useCallback(() => {
    if (!handout) return;
    void downloadHandout(handout).catch(() => {});
  }, [handout]);

  const cancel = useCallback(() => {
    if (id == null) return;
    void cancelHandoutDownload(id);
  }, [id]);

  const remove = useCallback(async () => {
    if (id == null) return;
    await deleteHandoutDownload(id);
  }, [id]);

  return {
    supported,
    state: status.state,
    progress: status.progress,
    download,
    cancel,
    remove,
  };
}
