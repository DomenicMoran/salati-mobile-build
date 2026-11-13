import { SALATI_ISLAM_LERNWERK_ID } from './allinone/constants';
import { SALATI_LERNBUCH_ID } from './catalog';
import { resolveReaderBook } from './readerBook';

describe('resolveReaderBook', () => {
  it('liefert Kapitel-TOC fuer All-in-One Entwurf', () => {
    const book = resolveReaderBook(SALATI_ISLAM_LERNWERK_ID);
    expect(book?.bookId).toBe(SALATI_ISLAM_LERNWERK_ID);
    expect(book?.chapters.length).toBeGreaterThan(5);
    expect(book?.chapters.some((c) => c.slug === 'aqida')).toBe(true);
    expect(book?.pdfUrl).toContain('salati-islam-lernwerk.pdf');
  });

  it('leitet salati-lernbuch auf Lernwerk-TOC um', () => {
    const book = resolveReaderBook(SALATI_LERNBUCH_ID);
    expect(book?.bookId).toBe(SALATI_ISLAM_LERNWERK_ID);
    expect(book?.chapters.length).toBeGreaterThan(5);
    expect(book?.pdfUrl).toContain('salati-islam-lernwerk.pdf');
  });

  it('respektiert pdfUrl-Override', () => {
    const override = 'https://example.test/custom.pdf';
    const book = resolveReaderBook(SALATI_ISLAM_LERNWERK_ID, override);
    expect(book?.pdfUrl).toBe(override);
  });
});
