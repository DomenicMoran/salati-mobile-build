import { TAFSIR_SURAH_COUNT } from './constants';
import type { TafsirTocEntry } from './types';

export function isValidTafsirSurah(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= TAFSIR_SURAH_COUNT;
}

/** Inhaltsverzeichnis — 114 Suren, keine Textmutation. */
export function buildTafsirToc(count = TAFSIR_SURAH_COUNT): TafsirTocEntry[] {
  const safe = Math.min(Math.max(1, Math.floor(count)), TAFSIR_SURAH_COUNT);
  return Array.from({ length: safe }, (_, i) => ({ surah: i + 1 }));
}

export function adjacentTafsirSurah(surah: number): { prev: number | null; next: number | null } {
  if (!isValidTafsirSurah(surah)) return { prev: null, next: null };
  return {
    prev: surah > 1 ? surah - 1 : null,
    next: surah < TAFSIR_SURAH_COUNT ? surah + 1 : null,
  };
}
