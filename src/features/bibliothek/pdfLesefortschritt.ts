import { canonicalBibliothekReaderBookId } from '@/features/bibliothek/allinone/constants';

export type PdfLesefortschritt = {
  bookId: string;
  chapterSlug: string;
  chapterTitle: string;
  page: number;
  updatedAt: string;
};

export const PDF_LESEFORTSCHRITT_STORAGE_KEY = 'salati.bibliothek.pdf-progress.v1';

export type PdfLesefortschrittStore = Record<string, PdfLesefortschritt>;

function isPdfLesefortschritt(raw: unknown): raw is PdfLesefortschritt {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.bookId === 'string' &&
    typeof o.chapterSlug === 'string' &&
    typeof o.chapterTitle === 'string' &&
    typeof o.page === 'number' &&
    typeof o.updatedAt === 'string' &&
    Number.isInteger(o.page) &&
    o.page >= 1 &&
    o.bookId.trim().length > 0
  );
}

export function parsePdfLesefortschrittStore(raw: string | null): PdfLesefortschrittStore {
  if (raw == null || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: PdfLesefortschrittStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPdfLesefortschritt(value) && value.bookId === key) {
        out[key] = value;
      }
    }
    return migratePdfLesefortschrittStore(out);
  } catch {
    return {};
  }
}

/** Verschiebt Legacy-`salati-lernbuch`-Fortschritt auf das kanonische Lernwerk. */
export function migratePdfLesefortschrittStore(store: PdfLesefortschrittStore): PdfLesefortschrittStore {
  const next: PdfLesefortschrittStore = { ...store };
  for (const [key, entry] of Object.entries(store)) {
    const canonical = canonicalBibliothekReaderBookId(key);
    if (canonical === key) continue;
    const existing = next[canonical];
    if (!existing || entry.updatedAt > existing.updatedAt) {
      next[canonical] = { ...entry, bookId: canonical };
    }
    delete next[key];
  }
  return next;
}

export function serializePdfLesefortschrittStore(store: PdfLesefortschrittStore): string {
  return JSON.stringify(store);
}

export function upsertPdfLesefortschritt(
  store: PdfLesefortschrittStore,
  entry: PdfLesefortschritt,
): PdfLesefortschrittStore {
  const bookId = canonicalBibliothekReaderBookId(entry.bookId);
  const normalized: PdfLesefortschritt = { ...entry, bookId };
  return migratePdfLesefortschrittStore({ ...store, [bookId]: normalized });
}
