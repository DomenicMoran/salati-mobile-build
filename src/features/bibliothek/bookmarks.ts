export type BibliothekPdfBookmark = {
  id: string;
  bookId: string;
  title: string;
  chapterSlug?: string;
  page?: number;
  createdAt: string;
};

export const BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY = 'salati.bibliothek.pdf-bookmarks.v1';

export type BibliothekPdfBookmarkStore = Record<string, BibliothekPdfBookmark[]>;

function isBookmark(raw: unknown): raw is BibliothekPdfBookmark {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.bookId === 'string' &&
    typeof o.title === 'string' &&
    typeof o.createdAt === 'string' &&
    o.id.trim().length > 0 &&
    o.bookId.trim().length > 0
  );
}

export function parseBibliothekPdfBookmarkStore(raw: string | null): BibliothekPdfBookmarkStore {
  if (raw == null || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: BibliothekPdfBookmarkStore = {};
    for (const [bookId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const rows = value.filter(isBookmark).filter((b) => b.bookId === bookId);
      if (rows.length > 0) out[bookId] = rows;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeBibliothekPdfBookmarkStore(store: BibliothekPdfBookmarkStore): string {
  return JSON.stringify(store);
}

export function listBookmarksForBook(
  store: BibliothekPdfBookmarkStore,
  bookId: string,
): BibliothekPdfBookmark[] {
  return store[bookId] ?? [];
}

export function addBookmarkToStore(
  store: BibliothekPdfBookmarkStore,
  bookmark: BibliothekPdfBookmark,
): BibliothekPdfBookmarkStore {
  const existing = store[bookmark.bookId] ?? [];
  if (existing.some((b) => b.id === bookmark.id)) return store;
  return {
    ...store,
    [bookmark.bookId]: [bookmark, ...existing],
  };
}

export function newBookmarkId(): string {
  return `bm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
