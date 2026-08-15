import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Lesezeichen + letzte Leseposition, lokal persistiert. Bewusst ohne eigenen
// Provider: die Screens laden bei Fokus neu (useFocusEffect), damit Reader und
// Suren-Liste ohne geteilten Context konsistent bleiben.

/** Sammlungen für Lesezeichen (Konkurrenz-Parität: Quran.com-Collections). */
export type BookmarkLabel = 'favorite' | 'memorize' | 'reflect';

export const BOOKMARK_LABELS: BookmarkLabel[] = ['favorite', 'memorize', 'reflect'];

export interface QuranBookmark {
  surah: number;
  ayah: number;
  createdAt: number;
  /** Optionale Sammlung; alte Lesezeichen (ohne Feld) bleiben unsortiert. */
  label?: BookmarkLabel;
}

export interface LastRead {
  surah: number;
  ayah: number;
  updatedAt: number;
}

/** Persönliche Notiz zu einem einzelnen Vers (Konkurrenz-Feature-Parität, z. B. Al Quran-App). */
export interface QuranNote {
  surah: number;
  ayah: number;
  text: string;
  updatedAt: number;
}

/** Ein Eintrag im Leseverlauf — pro Sure nur der zuletzt gelesene Vers. */
export interface ReadHistoryEntry {
  surah: number;
  ayah: number;
  at: number;
}

/** Verlauf deckelt bei 15 Suren — genug für die "Zuletzt gelesen"-Chips. */
export const READ_HISTORY_MAX = 15;

export interface QuranProgress {
  bookmarks: QuranBookmark[];
  lastRead: LastRead | null;
  notes: QuranNote[];
  history: ReadHistoryEntry[];
}

export const QURAN_PROGRESS_STORAGE_KEY = 'salatibox:quran-progress';

const EMPTY: QuranProgress = { bookmarks: [], lastRead: null, notes: [], history: [] };

/**
 * Sure nach vorn schieben (neuester zuerst), Ayah aktualisieren — jede Sure
 * höchstens einmal im Verlauf, Deckel bei READ_HISTORY_MAX Einträgen.
 */
export function pushHistory(
  history: ReadHistoryEntry[],
  surah: number,
  ayah: number,
  now: number = Date.now(),
): ReadHistoryEntry[] {
  const withoutSurah = history.filter((h) => h.surah !== surah);
  return [{ surah, ayah, at: now }, ...withoutSurah].slice(0, READ_HISTORY_MAX);
}

export function isBookmarked(bookmarks: QuranBookmark[], surah: number, ayah: number): boolean {
  return bookmarks.some((b) => b.surah === surah && b.ayah === ayah);
}

export function getNoteText(notes: QuranNote[], surah: number, ayah: number): string {
  return notes.find((n) => n.surah === surah && n.ayah === ayah)?.text ?? '';
}

/** Leerer/nur-Leerzeichen-Text löscht die Notiz, sonst wird sie angelegt/aktualisiert. */
export function setNoteText(
  notes: QuranNote[],
  surah: number,
  ayah: number,
  text: string,
  now: number = Date.now(),
): QuranNote[] {
  const trimmed = text.trim();
  const withoutExisting = notes.filter((n) => !(n.surah === surah && n.ayah === ayah));
  if (trimmed === '') return withoutExisting;
  return [{ surah, ayah, text, updatedAt: now }, ...withoutExisting];
}

/** Entfernt das Lesezeichen falls vorhanden, sonst wird es (vorne) hinzugefügt. */
export function toggleBookmark(
  bookmarks: QuranBookmark[],
  surah: number,
  ayah: number,
  now: number = Date.now(),
): QuranBookmark[] {
  if (isBookmarked(bookmarks, surah, ayah)) {
    return bookmarks.filter((b) => !(b.surah === surah && b.ayah === ayah));
  }
  return [{ surah, ayah, createdAt: now }, ...bookmarks];
}

/** Setzt/entfernt die Sammlung eines Lesezeichens (null = keine Sammlung). */
export function setBookmarkLabel(
  bookmarks: QuranBookmark[],
  surah: number,
  ayah: number,
  label: BookmarkLabel | null,
): QuranBookmark[] {
  return bookmarks.map((b) => {
    if (b.surah !== surah || b.ayah !== ayah) return b;
    if (label === null) {
      const { label: _drop, ...rest } = b;
      return rest;
    }
    return { ...b, label };
  });
}

export function parseProgress(raw: string | null): QuranProgress {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<QuranProgress>;
    return {
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      lastRead: parsed.lastRead ?? null,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return EMPTY;
  }
}

export async function loadProgress(): Promise<QuranProgress> {
  return parseProgress(await AsyncStorage.getItem(QURAN_PROGRESS_STORAGE_KEY));
}

async function saveProgress(progress: QuranProgress): Promise<void> {
  await AsyncStorage.setItem(QURAN_PROGRESS_STORAGE_KEY, JSON.stringify(progress)).catch(() => {});
}

export function useQuranProgress() {
  const [progress, setProgress] = useState<QuranProgress>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadProgress().then((p) => {
        if (!cancelled) setProgress(p);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const toggle = useCallback((surah: number, ayah: number) => {
    setProgress((prev) => {
      const next = { ...prev, bookmarks: toggleBookmark(prev.bookmarks, surah, ayah) };
      saveProgress(next);
      return next;
    });
  }, []);

  const setLabel = useCallback((surah: number, ayah: number, label: BookmarkLabel | null) => {
    setProgress((prev) => {
      const next = { ...prev, bookmarks: setBookmarkLabel(prev.bookmarks, surah, ayah, label) };
      saveProgress(next);
      return next;
    });
  }, []);

  const setLastRead = useCallback((surah: number, ayah: number) => {
    setProgress((prev) => {
      const now = Date.now();
      const next: QuranProgress = {
        ...prev,
        lastRead: { surah, ayah, updatedAt: now },
        history: pushHistory(prev.history, surah, ayah, now),
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const saveNote = useCallback((surah: number, ayah: number, text: string) => {
    setProgress((prev) => {
      const next: QuranProgress = { ...prev, notes: setNoteText(prev.notes, surah, ayah, text) };
      saveProgress(next);
      return next;
    });
  }, []);

  return { ...progress, toggle, setLabel, setLastRead, saveNote };
}
