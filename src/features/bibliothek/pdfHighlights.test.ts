import {
  BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY,
  addHighlightToStore,
  attachNoteToHighlight,
  parseBibliothekPdfHighlightStore,
} from './pdfHighlights';

describe('pdfHighlights', () => {
  it('storage key stabil', () => {
    expect(BIBLIOTHEK_PDF_HIGHLIGHTS_STORAGE_KEY).toBe('salati.bibliothek.pdf-highlights.v1');
  });

  it('parse + note merge', () => {
    const raw = JSON.stringify({
      buch: [
        {
          id: 'h1',
          bookId: 'buch',
          page: 3,
          text: 'Salaam',
          createdAt: '2026-11-10T00:00:00.000Z',
        },
      ],
    });
    const store = parseBibliothekPdfHighlightStore(raw);
    const withHl = addHighlightToStore(store, {
      id: 'h2',
      bookId: 'buch',
      page: 7,
      text: 'Test',
      createdAt: '2026-11-10T01:00:00.000Z',
    });
    const noted = attachNoteToHighlight(withHl, 'buch', 'h2', 'Notiz');
    expect(noted.buch?.find((h) => h.id === 'h2')?.note).toBe('Notiz');
  });
});
