import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PdfReaderTheme, PdfScrollMode } from '@/features/bibliothek/pdfjs/bridge';

export type PdfReaderPreferences = {
  theme: PdfReaderTheme;
  zoom: number;
  scrollMode: PdfScrollMode;
  /** 0 = aus, 0.45 = stark abgedunkelt (R19). */
  dimLevel: number;
};

export const PDF_READER_PREFS_STORAGE_KEY = 'salati.bibliothek.pdf-reader-prefs.v1';
const STORAGE_KEY = PDF_READER_PREFS_STORAGE_KEY;
const DEFAULT: PdfReaderPreferences = { theme: 'day', zoom: 1.15, scrollMode: 'page', dimLevel: 0 };

function isTheme(value: unknown): value is PdfReaderTheme {
  return value === 'day' || value === 'night' || value === 'sepia';
}

export function parsePdfReaderPreferences(raw: string | null): PdfReaderPreferences {
  if (raw == null || raw.trim() === '') return DEFAULT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT;
    const o = parsed as Record<string, unknown>;
    const zoom = typeof o.zoom === 'number' && o.zoom >= 0.6 && o.zoom <= 3.5 ? o.zoom : DEFAULT.zoom;
    const theme = isTheme(o.theme) ? o.theme : DEFAULT.theme;
    const scrollMode = o.scrollMode === 'scroll' ? 'scroll' : 'page';
    const dimRaw = typeof o.dimLevel === 'number' ? o.dimLevel : DEFAULT.dimLevel;
    const dimLevel = Math.min(0.55, Math.max(0, dimRaw));
    return { theme, zoom, scrollMode, dimLevel };
  } catch {
    return DEFAULT;
  }
}

export async function loadPdfReaderPreferences(bookId?: string): Promise<PdfReaderPreferences> {
  const key = bookId?.trim() ? `${STORAGE_KEY}:${bookId.trim()}` : STORAGE_KEY;
  const raw = await AsyncStorage.getItem(key).catch(() => null);
  return parsePdfReaderPreferences(raw);
}

export async function savePdfReaderPreferences(
  prefs: PdfReaderPreferences,
  bookId?: string,
): Promise<void> {
  const key = bookId?.trim() ? `${STORAGE_KEY}:${bookId.trim()}` : STORAGE_KEY;
  await AsyncStorage.setItem(key, JSON.stringify(prefs)).catch(() => {});
}
