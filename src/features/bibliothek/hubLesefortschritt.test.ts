import { pickHubContinueReading } from './hubLesefortschritt';
import type { PdfLesefortschrittStore } from './pdfLesefortschritt';

describe('pickHubContinueReading', () => {
  it('bevorzugt neueren PDF-Fortschritt gegenüber Tafsir', () => {
    const store: PdfLesefortschrittStore = {
      'salati-islam-lernwerk': {
        bookId: 'salati-islam-lernwerk',
        chapterSlug: 'einstieg',
        chapterTitle: 'Einstieg',
        page: 12,
        updatedAt: '2026-11-10T20:00:00.000Z',
      },
    };
  const picked = pickHubContinueReading({ surah: 1, block: 0 }, '2026-11-09T12:00:00.000Z', store);
    expect(picked?.kind).toBe('pdf');
    if (picked?.kind === 'pdf') {
      expect(picked.page).toBe(12);
      expect(picked.bookId).toBe('salati-islam-lernwerk');
    }
  });

  it('fällt auf Tafsir zurück ohne PDF', () => {
    const picked = pickHubContinueReading({ surah: 2, block: 3 }, '2026-11-10T12:00:00.000Z', {});
    expect(picked).toEqual({
      kind: 'tafsir',
      surah: 2,
      block: 3,
      updatedAt: '2026-11-10T12:00:00.000Z',
      labelKey: 'bibliothek.continueReading',
    });
  });
});
