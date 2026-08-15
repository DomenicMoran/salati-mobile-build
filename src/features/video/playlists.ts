import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Eigene Video-Playlists (rein lokal, AsyncStorage — kein Server/Konto noetig).
// Eine Playlist ist eine geordnete Liste von episode_no. Bewusst plattform-
// unabhaengig (AsyncStorage ist auf Web localStorage-basiert), damit Playlists
// auch im Web-Export funktionieren. Ein Modul-Singleton mit Abonnenten haelt
// alle Screens (Uebersicht, Player, „zu Playlist hinzufuegen"-Sheet) synchron —
// gleiche Idee wie der Download-Singleton (downloads.ts), nur fuer EINE
// gemeinsame Liste statt pro Folge.

const KEY = 'salatibox:video-playlists';

export interface VideoPlaylist {
  id: string;
  name: string;
  /** Geordnete Folgen-Nummern (Reihenfolge = Wiedergabereihenfolge). */
  episodeNos: number[];
  createdAt: number;
  updatedAt: number;
}

// --- Singleton-Zustand: die geladene Liste + Abonnenten ---

let cache: VideoPlaylist[] | null = null;
let loaded = false;
const subscribers = new Set<(p: VideoPlaylist[]) => void>();

function emit(): void {
  const snapshot = cache ?? [];
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch {
      // Screen evtl. unmounted — egal.
    }
  }
}

async function ensureLoaded(): Promise<VideoPlaylist[]> {
  if (loaded && cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as VideoPlaylist[]) : [];
    cache = Array.isArray(parsed) ? parsed.filter(isValidPlaylist) : [];
  } catch {
    cache = [];
  }
  loaded = true;
  return cache;
}

function isValidPlaylist(p: unknown): p is VideoPlaylist {
  return (
    !!p &&
    typeof p === 'object' &&
    typeof (p as VideoPlaylist).id === 'string' &&
    typeof (p as VideoPlaylist).name === 'string' &&
    Array.isArray((p as VideoPlaylist).episodeNos)
  );
}

async function persist(next: VideoPlaylist[]): Promise<void> {
  cache = next;
  loaded = true;
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  emit();
}

function newId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Alle Playlists (nach zuletzt geaendert absteigend). */
export async function listPlaylists(): Promise<VideoPlaylist[]> {
  const all = await ensureLoaded();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Erstellt eine Playlist (leerer/getrimmter Name -> Fallback „Playlist"). */
export async function createPlaylist(name: string): Promise<VideoPlaylist> {
  const all = await ensureLoaded();
  const now = Date.now();
  const pl: VideoPlaylist = {
    id: newId(),
    name: name.trim() || 'Playlist',
    episodeNos: [],
    createdAt: now,
    updatedAt: now,
  };
  await persist([pl, ...all]);
  return pl;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const all = await ensureLoaded();
  const next = all.map((p) =>
    p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p,
  );
  await persist(next);
}

export async function deletePlaylist(id: string): Promise<void> {
  const all = await ensureLoaded();
  await persist(all.filter((p) => p.id !== id));
}

/** Fuegt eine Folge ans Ende hinzu (Duplikate werden ignoriert). */
export async function addToPlaylist(id: string, episodeNo: number): Promise<void> {
  const all = await ensureLoaded();
  const next = all.map((p) =>
    p.id === id && !p.episodeNos.includes(episodeNo)
      ? { ...p, episodeNos: [...p.episodeNos, episodeNo], updatedAt: Date.now() }
      : p,
  );
  await persist(next);
}

export async function removeFromPlaylist(id: string, episodeNo: number): Promise<void> {
  const all = await ensureLoaded();
  const next = all.map((p) =>
    p.id === id
      ? { ...p, episodeNos: p.episodeNos.filter((n) => n !== episodeNo), updatedAt: Date.now() }
      : p,
  );
  await persist(next);
}

export function subscribePlaylists(cb: (p: VideoPlaylist[]) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/**
 * React-Hook: die (geordnete) Playlist-Liste + Aktionen. Laedt einmal aus dem
 * Singleton und abonniert Aenderungen, sodass alle Screens synchron bleiben.
 */
export function useVideoPlaylists() {
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>(cache ?? []);
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    let cancelled = false;
    const sorted = (list: VideoPlaylist[]) =>
      [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    listPlaylists().then((list) => {
      if (!cancelled) {
        setPlaylists(list);
        setReady(true);
      }
    });
    const unsub = subscribePlaylists((list) => {
      if (!cancelled) setPlaylists(sorted(list));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return {
    playlists,
    ready,
    create: useCallback((name: string) => createPlaylist(name), []),
    rename: useCallback((id: string, name: string) => renamePlaylist(id, name), []),
    remove: useCallback((id: string) => deletePlaylist(id), []),
    add: useCallback((id: string, episodeNo: number) => addToPlaylist(id, episodeNo), []),
    removeVideo: useCallback(
      (id: string, episodeNo: number) => removeFromPlaylist(id, episodeNo),
      [],
    ),
  };
}
