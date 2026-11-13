import type { AllInOneBuildManifest, ReaderChapterTocEntry } from './types';

/**
 * Kapitel-TOC für den Concat-Entwurf — nutzt `chapters` aus build.json (B2+).
 * Fallback: ein Kapitel je Segment, wenn nur `segments` vorliegen (B1).
 */
export function chapterTocFromBuildManifest(
  manifest: AllInOneBuildManifest | null | undefined,
): ReaderChapterTocEntry[] {
  if (!manifest) return [];
  if (manifest.chapters?.length) {
    return manifest.chapters
      .filter((c) => !c.pending && c.startPage != null && c.endPage != null)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        startPage: c.startPage as number,
        endPage: c.endPage as number,
        pageCount: c.pageCount,
      }));
  }
  const segs = manifest.segments ?? [];
  return segs.map((s) => ({
    slug: s.id,
    title: s.id,
    startPage: s.startPage,
    pageCount: s.pageCount,
    endPage: s.endPage,
  }));
}

export function chapterAtPage(
  toc: readonly ReaderChapterTocEntry[],
  page: number,
): ReaderChapterTocEntry | null {
  if (!Number.isFinite(page) || page < 1) return null;
  for (const ch of toc) {
    if (ch.startPage == null || ch.endPage == null) continue;
    if (page >= ch.startPage && page <= ch.endPage) return ch;
  }
  return null;
}
