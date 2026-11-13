import shippedBooksManifest from '@/features/bibliothek/manifest/shipped-books.manifest.json';
import bundledBuildJson from '@/features/bibliothek/allinone/bundled/salati-islam-lernwerk-draft.build.json';
import {
  SALATI_ISLAM_LERNWERK_ID,
  canonicalBibliothekReaderBookId,
} from '@/features/bibliothek/allinone/constants';
import { chapterTocFromBuildManifest } from '@/features/bibliothek/allinone/chapterToc';
import { parseAllInOneBuildManifest } from '@/features/bibliothek/allinone/buildToc';
import type { AllInOneBuildManifest, ReaderChapterTocEntry } from '@/features/bibliothek/allinone/types';
import { HANDOUT_BASE } from '@/features/handouts/data';

const HANDOUT_PDF_BASE = `${HANDOUT_BASE}/`;

/** R2-Verlags-PDF (Schluessel `handouts/salati-islam-lernwerk.pdf`). */
const SALATI_ISLAM_LERNWERK_PDF_URL = `${HANDOUT_PDF_BASE}salati-islam-lernwerk.pdf`;

export type ReaderBookConfig = {
  bookId: string;
  title: string;
  pdfUrl: string;
  chapters: ReaderChapterTocEntry[];
};

type ShippedItem = {
  id: string;
  title: string;
  pdf_url?: string;
  visible?: boolean;
};

function shippedItem(bookId: string): ShippedItem | undefined {
  const items = shippedBooksManifest.items as ShippedItem[];
  return items.find((i) => i.id === bookId.trim());
}

function manifestForBook(bookId: string): AllInOneBuildManifest | null {
  if (bookId === SALATI_ISLAM_LERNWERK_ID) {
    return parseAllInOneBuildManifest(bundledBuildJson) ?? null;
  }
  return null;
}

function defaultPdfUrl(bookId: string, shipped: ShippedItem | undefined): string | null {
  if (typeof shipped?.pdf_url === 'string' && shipped.pdf_url.trim()) {
    return shipped.pdf_url.trim();
  }
  if (bookId === SALATI_ISLAM_LERNWERK_ID) {
    return SALATI_ISLAM_LERNWERK_PDF_URL;
  }
  return null;
}

/**
 * Statische Reader-Konfiguration aus shipped-books + gebündeltem build.json.
 * `pdfUrlOverride` fuer QA (z. B. Deep-Link mit alternativer URL).
 */
export function resolveReaderBook(
  bookId: string,
  pdfUrlOverride?: string | null,
): ReaderBookConfig | null {
  const id = canonicalBibliothekReaderBookId(bookId);
  if (!id) return null;

  const shipped = shippedItem(id);
  const title = shipped?.title ?? id;
  const pdfUrl = pdfUrlOverride?.trim() || defaultPdfUrl(id, shipped);
  if (!pdfUrl) return null;

  const manifest = manifestForBook(id);
  let chapters = manifest ? chapterTocFromBuildManifest(manifest) : [];

  if (chapters.length === 0) return null;

  return { bookId: id, title, pdfUrl, chapters };
}
