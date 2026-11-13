import type { ReaderChapterTocEntry } from '@/features/bibliothek/allinone/types';

/** Kapitel anhand der 1-basierten PDF-Seite (TOC-Sprung / Fortschritt). */
export function chapterForPage(
  chapters: ReaderChapterTocEntry[],
  page: number,
): ReaderChapterTocEntry | undefined {
  if (!Number.isFinite(page) || page < 1) return undefined;
  const p = Math.floor(page);
  return chapters.find((c) => p >= c.startPage && p <= c.endPage);
}
