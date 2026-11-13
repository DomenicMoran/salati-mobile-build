import type {
  AllInOneBuildManifest,
  AllInOneBuildSegment,
  AllInOneChapterTocEntry,
} from './types';

function isSegment(raw: unknown): raw is AllInOneBuildSegment {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.file === 'string' &&
    typeof s.startPage === 'number' &&
    typeof s.pageCount === 'number' &&
    typeof s.endPage === 'number' &&
    Number.isInteger(s.startPage) &&
    Number.isInteger(s.pageCount) &&
    Number.isInteger(s.endPage) &&
    s.startPage >= 1 &&
    s.pageCount >= 1 &&
    s.endPage >= s.startPage
  );
}

/** Parse build.json payload from fetch or bundled asset (no I/O). */
export function parseAllInOneBuildManifest(raw: unknown): AllInOneBuildManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.built !== 'string' || typeof o.output !== 'string') return null;
  if (typeof o.outputId !== 'string') return null;
  if (typeof o.totalPages !== 'number' || !Number.isInteger(o.totalPages) || o.totalPages < 1) {
    return null;
  }
  if (!Array.isArray(o.segments) || o.segments.length === 0) return null;
  if (!o.segments.every(isSegment)) return null;
  const excludedPdfIds = Array.isArray(o.excludedPdfIds)
    ? o.excludedPdfIds.filter((x): x is string => typeof x === 'string')
    : undefined;
  const tocSchema = typeof o.tocSchema === 'number' ? o.tocSchema : undefined;
  return {
    built: o.built,
    output: o.output,
    totalPages: o.totalPages,
    segments: o.segments,
    excludedPdfIds,
    tocSchema,
    outputId: o.outputId,
  };
}

/** Chapter list for reader TOC (1-based PDF pages). */
export function chapterTocFromBuild(manifest: AllInOneBuildManifest): AllInOneChapterTocEntry[] {
  return manifest.segments.map((s) => ({
    id: s.id,
    startPage: s.startPage,
    endPage: s.endPage,
    pageCount: s.pageCount,
  }));
}

/** 1-based start page for a handout segment id, or null. */
export function chapterStartOffset(manifest: AllInOneBuildManifest, chapterId: string): number | null {
  const id = chapterId.trim();
  if (!id) return null;
  const seg = manifest.segments.find((s) => s.id === id);
  return seg?.startPage ?? null;
}

/** Segment containing `page` (1-based), or null. */
export function segmentForPage(manifest: AllInOneBuildManifest, page: number): AllInOneBuildSegment | null {
  if (!Number.isInteger(page) || page < 1 || page > manifest.totalPages) return null;
  return manifest.segments.find((s) => page >= s.startPage && page <= s.endPage) ?? null;
}
