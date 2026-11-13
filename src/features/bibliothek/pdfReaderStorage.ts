import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  type BibliothekPdfBookmark,
  type BibliothekPdfBookmarkStore,
  BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY,
  addBookmarkToStore,
  listBookmarksForBook,
  newBookmarkId,
  parseBibliothekPdfBookmarkStore,
  serializeBibliothekPdfBookmarkStore,
} from '@/features/bibliothek/bookmarks';
import {
  type BibliothekPdfHighlight,
  type BibliothekPdfHighlightStore,
  BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY,
  addHighlightToStore,
  attachNoteToHighlight,
  listHighlightsForBook,
  newHighlightId,
  parseBibliothekPdfHighlightStore,
  serializeBibliothekPdfHighlightStore,
} from '@/features/bibliothek/pdfHighlights';
import { canonicalBibliothekReaderBookId } from '@/features/bibliothek/allinone/constants';
import {
  type PdfLesefortschritt,
  type PdfLesefortschrittStore,
  PDF_LESEFORTSCHRITT_STORAGE_KEY,
  migratePdfLesefortschrittStore,
  parsePdfLesefortschrittStore,
  serializePdfLesefortschrittStore,
  upsertPdfLesefortschritt,
} from '@/features/bibliothek/pdfLesefortschritt';

async function loadProgressStore(): Promise<PdfLesefortschrittStore> {
  const raw = await AsyncStorage.getItem(PDF_LESEFORTSCHRITT_STORAGE_KEY).catch(() => null);
  const parsed = parsePdfLesefortschrittStore(raw);
  const migrated = migratePdfLesefortschrittStore(parsed);
  if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
    await AsyncStorage.setItem(
      PDF_LESEFORTSCHRITT_STORAGE_KEY,
      serializePdfLesefortschrittStore(migrated),
    ).catch(() => {});
  }
  return migrated;
}

export async function loadPdfLesefortschritt(bookId: string): Promise<PdfLesefortschritt | null> {
  const store = await loadProgressStore();
  const id = canonicalBibliothekReaderBookId(bookId);
  return store[id] ?? null;
}

export async function savePdfLesefortschritt(entry: PdfLesefortschritt): Promise<void> {
  const store = await loadProgressStore();
  const next = upsertPdfLesefortschritt(store, entry);
  await AsyncStorage.setItem(PDF_LESEFORTSCHRITT_STORAGE_KEY, serializePdfLesefortschrittStore(next)).catch(
    () => {},
  );
}

async function loadBookmarkStore(): Promise<BibliothekPdfBookmarkStore> {
  const raw = await AsyncStorage.getItem(BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY).catch(() => null);
  return parseBibliothekPdfBookmarkStore(raw);
}

export async function loadBibliothekPdfBookmarks(bookId: string): Promise<BibliothekPdfBookmark[]> {
  const store = await loadBookmarkStore();
  return listBookmarksForBook(store, canonicalBibliothekReaderBookId(bookId));
}

export async function addBibliothekPdfBookmark(
  input: Omit<BibliothekPdfBookmark, 'id' | 'createdAt'> & { id?: string },
): Promise<BibliothekPdfBookmark> {
  const bookmark: BibliothekPdfBookmark = {
    id: input.id ?? newBookmarkId(),
    bookId: input.bookId.trim(),
    title: input.title.trim() || input.bookId,
    chapterSlug: input.chapterSlug,
    page: input.page,
    createdAt: new Date().toISOString(),
  };
  const store = await loadBookmarkStore();
  const next = addBookmarkToStore(store, bookmark);
  await AsyncStorage.setItem(
    BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY,
    serializeBibliothekPdfBookmarkStore(next),
  ).catch(() => {});
  return bookmark;
}

async function loadHighlightStore(): Promise<BibliothekPdfHighlightStore> {
  const raw = await AsyncStorage.getItem(BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY).catch(() => null);
  return parseBibliothekPdfHighlightStore(raw);
}

export async function loadBibliothekPdfHighlights(bookId: string): Promise<BibliothekPdfHighlight[]> {
  const store = await loadHighlightStore();
  return listHighlightsForBook(store, canonicalBibliothekReaderBookId(bookId));
}

export async function addBibliothekPdfHighlight(input: {
  bookId: string;
  page: number;
  text: string;
  note?: string;
}): Promise<BibliothekPdfHighlight> {
  const highlight: BibliothekPdfHighlight = {
    id: newHighlightId(),
    bookId: canonicalBibliothekReaderBookId(input.bookId),
    page: input.page,
    text: input.text.trim().slice(0, 2000),
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  const store = await loadHighlightStore();
  const next = addHighlightToStore(store, highlight);
  await AsyncStorage.setItem(
    BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY,
    serializeBibliothekPdfHighlightStore(next),
  ).catch(() => {});
  return highlight;
}

export async function setBibliothekPdfHighlightNote(
  bookId: string,
  highlightId: string,
  note: string,
): Promise<void> {
  const id = canonicalBibliothekReaderBookId(bookId);
  const store = await loadHighlightStore();
  const next = attachNoteToHighlight(store, id, highlightId, note);
  await AsyncStorage.setItem(
    BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY,
    serializeBibliothekPdfHighlightStore(next),
  ).catch(() => {});
}
