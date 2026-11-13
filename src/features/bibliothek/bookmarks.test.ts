import {
  BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY,
  addBookmarkToStore,
  listBookmarksForBook,
  parseBibliothekPdfBookmarkStore,
  serializeBibliothekPdfBookmarkStore,
} from './bookmarks';

describe('BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY', () => {
  it('bleibt stabil', () => {
    expect(BIBLIOTHEK_PDF_BOOKMARKS_STORAGE_KEY).toBe('salati.bibliothek.pdf-bookmarks.v1');
  });
});

describe('bookmarks store', () => {
  const bookId = 'salati-lernbuch';

  it('parsed leere Liste', () => {
    expect(parseBibliothekPdfBookmarkStore(null)).toEqual({});
    expect(listBookmarksForBook({}, bookId)).toEqual([]);
  });

  it('roundtrip add + list', () => {
    const bm = {
      id: 'bm-1',
      bookId,
      title: 'Kapitel Test',
      chapterSlug: 'full',
      page: 12,
      createdAt: '2026-11-10T12:00:00.000Z',
    };
    const store = addBookmarkToStore({}, bm);
    const raw = serializeBibliothekPdfBookmarkStore(store);
    const loaded = parseBibliothekPdfBookmarkStore(raw);
    expect(listBookmarksForBook(loaded, bookId)).toHaveLength(1);
    expect(listBookmarksForBook(loaded, bookId)[0]?.title).toBe('Kapitel Test');
  });

  it('verhindert doppelte ids', () => {
    const bm = {
      id: 'bm-dup',
      bookId,
      title: 'A',
      createdAt: '2026-11-10',
    };
    const once = addBookmarkToStore({}, bm);
    const twice = addBookmarkToStore(once, bm);
    expect(listBookmarksForBook(twice, bookId)).toHaveLength(1);
  });
});
