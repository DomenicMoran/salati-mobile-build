import type { ReaderChapterTocEntry } from '@/features/bibliothek/allinone/types';

/** Filtert Kapitel-TOC nach Titel (Diakritika-/Case-insensitiv). */
export function filterChaptersByQuery(
  chapters: ReaderChapterTocEntry[],
  query: string,
): ReaderChapterTocEntry[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return chapters;
  return chapters.filter((c) => c.title.toLocaleLowerCase().includes(q));
}
