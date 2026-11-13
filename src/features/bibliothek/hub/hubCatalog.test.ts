import type { Handout } from '@/features/handouts/data';

import {
  buildHubCatalogItems,
  filterHubCatalogItems,
  groupHubCatalogByCategory,
  hubCatalogCategories,
  hubShelfOfflineItems,
  hubShelfRecentlyAdded,
  sortHubCatalogItems,
} from './hubCatalog';

const shortcuts = {
  sectionTitle: 'Quick',
  quranTitle: 'Quran',
  quranNote: 'q',
  hadithTitle: 'Hadith',
  hadithNote: 'h',
  audioTitle: 'Audio',
  audioNote: 'a',
  tafsirTitle: 'Tafsir',
  tafsirNote: 't',
  allHandoutsTitle: 'All',
  allHandoutsNote: 'n',
};

function handout(partial: Partial<Handout> & Pick<Handout, 'id' | 'title'>): Handout {
  return {
    category: 'cat-a',
    category_title: 'Cat A',
    pdf_url: 'https://example.com/x.pdf',
    ...partial,
  };
}

describe('hubCatalog', () => {
  it('bevorzugt Lernwerk als einziges komplett-Item (via Input-Liste)', () => {
    const items = buildHubCatalogItems({
      handouts: [
        handout({ id: 'salati-islam-lernwerk', title: 'Lernwerk', category: 'komplett', category_title: 'Komplett' }),
      ],
      audiobooks: [],
      pdfProgress: {},
      downloadedIds: new Set(),
      shortcuts,
      audiobookSectionTitle: 'Audiobooks',
      audiobookLabels: {},
    });
    const handouts = items.filter((i) => i.openKind === 'handout');
    expect(handouts.map((h) => h.handoutId)).toEqual(['salati-islam-lernwerk']);
  });

  it('filtert Suche und Sprache, Shortcuts bleiben bei Sprachfilter', () => {
    const base = buildHubCatalogItems({
      handouts: [
        handout({ id: 'a', title: 'Alpha Arabisch', lang: 'de' }),
        handout({ id: 'b', title: 'Beta English', lang: 'en', category: 'cat-b', category_title: 'Cat B' }),
      ],
      audiobooks: [],
      pdfProgress: {},
      downloadedIds: new Set(),
      shortcuts,
      audiobookSectionTitle: 'Audiobooks',
      audiobookLabels: {},
    });
    const deOnly = filterHubCatalogItems(base, {
      lang: 'de',
      categoryKey: null,
      offlineOnly: false,
      read: 'all',
      query: '',
    });
    expect(deOnly.some((i) => i.id === 'shortcut:quran')).toBe(true);
    expect(deOnly.some((i) => i.handoutId === 'b')).toBe(false);

    const search = filterHubCatalogItems(base, {
      lang: null,
      categoryKey: null,
      offlineOnly: false,
      read: 'all',
      query: 'beta',
    });
    expect(search.map((i) => i.id)).toEqual(['handout:b']);
  });

  it('sortiert und gruppiert ohne leere Kategorien', () => {
    const items = buildHubCatalogItems({
      handouts: [
        handout({ id: 'z', title: 'Zebra' }),
        handout({ id: 'm', title: 'Mango', category: 'cat-b', category_title: 'Cat B' }),
      ],
      audiobooks: [],
      pdfProgress: {
        'salati-islam-lernwerk': {
          bookId: 'salati-islam-lernwerk',
          chapterSlug: 'x',
          chapterTitle: 'X',
          page: 10,
          updatedAt: '2026-11-10T12:00:00.000Z',
        },
      },
      downloadedIds: new Set(['z']),
      shortcuts,
      audiobookSectionTitle: 'Audiobooks',
      audiobookLabels: {},
    });
    const filtered = filterHubCatalogItems(items, {
      lang: null,
      categoryKey: null,
      offlineOnly: false,
      read: 'all',
      query: '',
    });
    const sorted = sortHubCatalogItems(
      filtered.filter((i) => i.openKind === 'handout'),
      'title',
    );
    expect(sorted.map((i) => i.title)).toEqual(['Mango', 'Zebra']);

    const order = hubCatalogCategories(items);
    const grouped = groupHubCatalogByCategory(
      filterHubCatalogItems(items, {
        lang: null,
        categoryKey: 'cat-b',
        offlineOnly: false,
        read: 'all',
        query: '',
      }),
      order,
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0].key).toBe('cat-b');
  });

  it('Regale: offline und zuletzt hinzugefügt', () => {
    const items = buildHubCatalogItems({
      handouts: [
        handout({ id: 'a', title: 'A', lang: 'de' }),
        handout({ id: 'b', title: 'B', lang: 'en' }),
      ],
      audiobooks: [],
      pdfProgress: {},
      downloadedIds: new Set(['a']),
      manifestReviewedAt: { a: '2026-11-09', b: '2026-11-10' },
      shortcuts,
      audiobookSectionTitle: 'Audiobooks',
      audiobookLabels: {},
    });
    expect(hubShelfOfflineItems(items).map((i) => i.handoutId)).toEqual(['a']);
    expect(hubShelfRecentlyAdded(items).map((i) => i.handoutId)).toEqual(['b', 'a']);
  });
});
