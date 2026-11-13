import { router, type Href } from 'expo-router';
import { Linking } from 'react-native';

import { canonicalBibliothekReaderBookId } from '@/features/bibliothek/allinone/constants';

export type OpenBibliothekPdfInput = {
  pdfUrl: string;
  title: string;
  /** 1-based page for concat PDFs (pdf.js via Bridge). */
  page?: number;
  /** Optional Buch-ID für Fortschritt / Zoom-Profil. */
  bookId?: string;
};

export type OpenBibliothekHandoutInput = {
  id: string;
};

/** Handout aus dem Index — immer In-App-Viewer `/handouts/[id]`. */
export function openBibliothekHandout({ id }: OpenBibliothekHandoutInput): void {
  const trimmed = id.trim();
  if (!trimmed) return;
  router.push({ pathname: '/handouts/[id]', params: { id: trimmed } });
}

/** PDF ohne Handout-Eintrag (z. B. Hörbuch-Band) — In-App unter `/handouts/remote`. */
export function openBibliothekPdf({ pdfUrl, title, page, bookId }: OpenBibliothekPdfInput): void {
  const url = pdfUrl.trim();
  if (!url) return;
  const params: Record<string, string> = { url, title: title.trim() || 'PDF' };
  if (page != null && Number.isInteger(page) && page >= 1) {
    params.page = String(page);
  }
  const id = bookId?.trim();
  if (id) params.bookId = id;
  router.push({
    pathname: '/handouts/remote',
    params,
  } as unknown as Href);
}

export type OpenBibliothekReaderInput = {
  bookId: string;
  /** Optional QA override when draft PDF not on R2 yet. */
  pdfUrl?: string;
};

export function openBibliothekReader({ bookId, pdfUrl }: OpenBibliothekReaderInput): void {
  const id = canonicalBibliothekReaderBookId(bookId);
  if (!id) return;
  const params: Record<string, string> = { bookId: id };
  const url = pdfUrl?.trim();
  if (url) params.pdfUrl = url;
  router.push({
    pathname: '/bibliothek/reader/[bookId]',
    params,
  } as unknown as Href);
}

export type OpenBibliothekReaderViewInput = {
  bookId: string;
  page?: number;
  pdfUrl?: string;
};

/** Direkt in die pdf.js-Leseansicht (TOC überspringen). */
export function openBibliothekReaderView({ bookId, page, pdfUrl }: OpenBibliothekReaderViewInput): void {
  const id = canonicalBibliothekReaderBookId(bookId);
  if (!id) return;
  const params: Record<string, string> = { bookId: id };
  if (page != null && Number.isInteger(page) && page >= 1) params.page = String(page);
  const url = pdfUrl?.trim();
  if (url) params.pdfUrl = url;
  router.push({
    pathname: '/bibliothek/reader/[bookId]/view',
    params,
  } as unknown as Href);
}

/**
 * Normalfall: `openBibliothekPdf`. `forceBrowser` nur als dokumentierter
 * Fallback wenn WebView/gview nicht lädt (s. Handout-Viewer-Fehlerzweig).
 */
export function openBibliothekPdfWithFallback(
  input: OpenBibliothekPdfInput,
  options?: { forceBrowser?: boolean },
): void {
  if (options?.forceBrowser) {
    const url = input.pdfUrl.trim();
    if (url) void Linking.openURL(url).catch(() => {});
    return;
  }
  openBibliothekPdf(input);
}

export const TAFSIR_BOOK_EDITION = 'de-rassoul';

export function openTafsirBook(): void {
  router.push('/bibliothek/tafsir' as unknown as Href);
}

export function openTafsirSurah(surah: number, block = 0): void {
  if (!Number.isFinite(surah) || surah < 1 || surah > 114) return;
  const safeBlock = Number.isFinite(block) && block >= 0 ? Math.floor(block) : 0;
  router.push({
    pathname: '/bibliothek/tafsir/[surah]',
    params: { surah: String(surah), block: String(safeBlock) },
  } as unknown as Href);
}
