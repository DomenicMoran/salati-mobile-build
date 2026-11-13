export type BibliothekPdfHighlight = {
  id: string;
  bookId: string;
  page: number;
  text: string;
  note?: string;
  createdAt: string;
};

export const BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY = 'salati.bibliothek.pdf-highlights.v1';

export type BibliothekPdfHighlightStore = Record<string, BibliothekPdfHighlight[]>;

function isHighlight(raw: unknown): raw is BibliothekPdfHighlight {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.bookId === 'string' &&
    typeof o.page === 'number' &&
    typeof o.text === 'string' &&
    typeof o.createdAt === 'string' &&
    Number.isInteger(o.page) &&
    o.page >= 1 &&
    o.id.trim().length > 0 &&
    o.bookId.trim().length > 0
  );
}

export function parseBibliothekPdfHighlightStore(raw: string | null): BibliothekPdfHighlightStore {
  if (raw == null || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: BibliothekPdfHighlightStore = {};
    for (const [bookId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const rows = value.filter(isHighlight).filter((h) => h.bookId === bookId);
      if (rows.length > 0) out[bookId] = rows;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeBibliothekPdfHighlightStore(store: BibliothekPdfHighlightStore): string {
  return JSON.stringify(store);
}

export function listHighlightsForBook(store: BibliothekPdfHighlightStore, bookId: string): BibliothekPdfHighlight[] {
  return store[bookId] ?? [];
}

export function addHighlightToStore(
  store: BibliothekPdfHighlightStore,
  highlight: BibliothekPdfHighlight,
): BibliothekPdfHighlightStore {
  const existing = store[highlight.bookId] ?? [];
  if (existing.some((h) => h.id === highlight.id)) return store;
  return {
    ...store,
    [highlight.bookId]: [highlight, ...existing],
  };
}

export function attachNoteToHighlight(
  store: BibliothekPdfHighlightStore,
  bookId: string,
  highlightId: string,
  note: string,
): BibliothekPdfHighlightStore {
  const rows = store[bookId];
  if (!rows?.length) return store;
  const trimmed = note.trim();
  const next = rows.map((h) => (h.id === highlightId ? { ...h, note: trimmed || undefined } : h));
  return { ...store, [bookId]: next };
}

export function newHighlightId(): string {
  return `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
