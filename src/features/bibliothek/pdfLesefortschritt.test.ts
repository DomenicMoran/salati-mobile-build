import {
  PDF_LESEFORTSCHRITT_STORAGE_KEY,
  migratePdfLesefortschrittStore,
  parsePdfLesefortschrittStore,
  serializePdfLesefortschrittStore,
  upsertPdfLesefortschritt,
} from './pdfLesefortschritt';

describe('PDF_LESEFORTSCHRITT_STORAGE_KEY', () => {
  it('bleibt stabil fuer Geraete-Speicher', () => {
    expect(PDF_LESEFORTSCHRITT_STORAGE_KEY).toBe('salati.bibliothek.pdf-progress.v1');
  });
});

describe('parsePdfLesefortschrittStore', () => {
  it('lehnt ungueltiges JSON ab', () => {
    expect(parsePdfLesefortschrittStore('x')).toEqual({});
  });

  it('filtert Eintraege mit falschem bookId-Key', () => {
    const bad = JSON.stringify({
      'salati-lernbuch': {
        bookId: 'anderes',
        chapterSlug: 'a',
        chapterTitle: 'A',
        page: 1,
        updatedAt: '2026-11-10',
      },
    });
    expect(parsePdfLesefortschrittStore(bad)).toEqual({});
  });
});

describe('migratePdfLesefortschrittStore', () => {
  it('migriert salati-lernbuch auf salati-islam-lernwerk', () => {
    const legacy = {
      'salati-lernbuch': {
        bookId: 'salati-lernbuch',
        chapterSlug: 'full',
        chapterTitle: 'Das Salati-Lernbuch',
        page: 120,
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    };
    const migrated = migratePdfLesefortschrittStore(legacy);
    expect(migrated['salati-lernbuch']).toBeUndefined();
    expect(migrated['salati-islam-lernwerk']?.page).toBe(120);
    expect(migrated['salati-islam-lernwerk']?.bookId).toBe('salati-islam-lernwerk');
  });
});

describe('upsertPdfLesefortschritt', () => {
  it('speichert Legacy salati-lernbuch unter Lernwerk-Key', () => {
    const store = upsertPdfLesefortschritt(
      {},
      {
        bookId: 'salati-lernbuch',
        chapterSlug: 'full',
        chapterTitle: 'Das Salati-Lernbuch',
        page: 42,
        updatedAt: '2026-11-10T12:00:00.000Z',
      },
    );
    expect(store['salati-lernbuch']).toBeUndefined();
    expect(store['salati-islam-lernwerk']?.page).toBe(42);
    expect(store['salati-islam-lernwerk']?.bookId).toBe('salati-islam-lernwerk');
  });

  it('roundtrip pro Buch', () => {
    const entry = {
      bookId: 'salati-islam-lernwerk',
      chapterSlug: 'aqida',
      chapterTitle: 'Aqida',
      page: 543,
      updatedAt: '2026-11-10T12:00:00.000Z',
    };
    const store = upsertPdfLesefortschritt({}, entry);
    const raw = serializePdfLesefortschrittStore(store);
    expect(parsePdfLesefortschrittStore(raw)['salati-islam-lernwerk']).toEqual(entry);
  });
});
