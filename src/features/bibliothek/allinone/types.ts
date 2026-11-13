/** Segment page offsets from `salati-islam-lernwerk-draft.build.json` (Phase B concat). */
export type AllInOneBuildSegment = {
  file: string;
  id: string;
  startPage: number;
  pageCount: number;
  endPage: number;
};

export type AllInOneBuildChapter = {
  index: number;
  slug: string;
  title: string;
  startPage: number | null;
  pageCount: number;
  endPage: number | null;
  pending: boolean;
};

export type AllInOneBuildManifest = {
  built: string;
  output: string;
  totalPages: number;
  segments: AllInOneBuildSegment[];
  chapters?: AllInOneBuildChapter[];
  excludedPdfIds?: string[];
  tocSchema?: number;
  outputId: string;
};

/** Segment-TOC (B1) — id = handout segment slug. */
export type AllInOneChapterTocEntry = {
  id: string;
  startPage: number;
  endPage: number;
  pageCount: number;
};

/** Reader-TOC (B2) — title aus build.json chapters[]. */
export type ReaderChapterTocEntry = {
  slug: string;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
};
