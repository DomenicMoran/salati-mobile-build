import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

import { merkeGelesen } from '@/features/challenges/quranLog';
import {
  type BookmarkLabel,
  type QuranProgress,
  QURAN_PROGRESS_STORAGE_KEY,
  parseProgress,
  pushHistory,
  setBookmarkLabel,
  setNoteText,
  toggleBookmark,
} from '@/features/quran/progress';

const EMPTY: QuranProgress = { bookmarks: [], lastRead: null, notes: [], history: [] };

let snapshot: QuranProgress = EMPTY;
let loadGeneration = 0;
let hydrated = false;
let loading: Promise<void> | null = null;
let pendingWrites: Array<(prev: QuranProgress) => QuranProgress> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const READ_FLUSH_MS = 2000;

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

async function persist(progress: QuranProgress): Promise<void> {
  await AsyncStorage.setItem(QURAN_PROGRESS_STORAGE_KEY, JSON.stringify(progress)).catch(() => {});
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void persist(snapshot);
  }, READ_FLUSH_MS);
}

function applyMutation(mutate: (prev: QuranProgress) => QuranProgress): void {
  if (!hydrated) {
    pendingWrites.push(mutate);
    void ensureQuranProgressLoaded().then(() => {
      while (pendingWrites.length > 0) {
        const fn = pendingWrites.shift();
        if (fn) snapshot = fn(snapshot);
      }
      emit();
      scheduleFlush();
    });
    return;
  }
  snapshot = mutate(snapshot);
  emit();
  scheduleFlush();
}

export async function ensureQuranProgressLoaded(): Promise<QuranProgress> {
  if (hydrated) return snapshot;
  if (loading) {
    await loading;
    return snapshot;
  }
  const gen = ++loadGeneration;
  loading = (async () => {
    const raw = await AsyncStorage.getItem(QURAN_PROGRESS_STORAGE_KEY).catch(() => null);
    if (gen !== loadGeneration) return;
    snapshot = parseProgress(raw);
    hydrated = true;
    emit();
  })();
  await loading;
  loading = null;
  return snapshot;
}

export async function flushQuranProgressNow(): Promise<void> {
  if (!hydrated) await ensureQuranProgressLoaded();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await persist(snapshot);
}

export function getQuranProgressSnapshot(): QuranProgress {
  return snapshot;
}

export function subscribeQuranProgress(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function quranProgressToggleBookmark(surah: number, ayah: number, now = Date.now()): void {
  applyMutation((prev) => ({ ...prev, bookmarks: toggleBookmark(prev.bookmarks, surah, ayah, now) }));
}

export function quranProgressSetBookmarkLabel(
  surah: number,
  ayah: number,
  label: BookmarkLabel | null,
): void {
  applyMutation((prev) => ({
    ...prev,
    bookmarks: setBookmarkLabel(prev.bookmarks, surah, ayah, label),
  }));
}

export function quranProgressSetLastRead(surah: number, ayah: number, now = Date.now()): void {
  merkeGelesen(surah);
  applyMutation((prev) => ({
    ...prev,
    lastRead: { surah, ayah, updatedAt: now },
    history: pushHistory(prev.history, surah, ayah, now),
  }));
}

export function quranProgressSaveNote(surah: number, ayah: number, text: string, now = Date.now()): void {
  applyMutation((prev) => ({
    ...prev,
    notes: setNoteText(prev.notes, surah, ayah, text, now),
  }));
}

export function useQuranProgressStore(): QuranProgress & {
  toggle: (surah: number, ayah: number) => void;
  setLabel: (surah: number, ayah: number, label: BookmarkLabel | null) => void;
  setLastRead: (surah: number, ayah: number) => void;
  saveNote: (surah: number, ayah: number, text: string) => void;
} {
  const progress = useSyncExternalStore(subscribeQuranProgress, getQuranProgressSnapshot, getQuranProgressSnapshot);

  const toggle = useCallback((surah: number, ayah: number) => {
    quranProgressToggleBookmark(surah, ayah);
  }, []);
  const setLabel = useCallback((surah: number, ayah: number, label: BookmarkLabel | null) => {
    quranProgressSetBookmarkLabel(surah, ayah, label);
  }, []);
  const setLastRead = useCallback((surah: number, ayah: number) => {
    quranProgressSetLastRead(surah, ayah);
  }, []);
  const saveNote = useCallback((surah: number, ayah: number, text: string) => {
    quranProgressSaveNote(surah, ayah, text);
  }, []);

  return { ...progress, toggle, setLabel, setLastRead, saveNote };
}
