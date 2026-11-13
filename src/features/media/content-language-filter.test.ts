import {
  filterByContentLanguage,
  handoutsForLocale,
  normalizeContentLanguage,
  resolveHandoutsForLocale,
} from './content-language';

describe('filterByContentLanguage (hard filter)', () => {
  type Chapter = { id: string; lang?: string; title: string };
  const chapters: Chapter[] = [
    { id: 'de-only', lang: 'de', title: 'Deutsch' },
    { id: 'es-only', lang: 'es', title: 'Español' },
    { id: 'implicit-de', title: 'Ohne lang' },
  ];

  it('ES UI sieht keine DE-only Kapitel', () => {
    const es = filterByContentLanguage(chapters, 'es');
    expect(es.map((c) => c.id)).toEqual(['es-only']);
  });

  it('DE UI sieht DE und fehlendes lang (Default de)', () => {
    const de = filterByContentLanguage(chapters, 'de');
    expect(de.map((c) => c.id)).toEqual(['de-only', 'implicit-de']);
  });

  it('blendet fremdsprachige Handouts ohne CTA aus (VP-A-008)', () => {
    const deOnly = [{ id: 'de-only', lang: 'de' }];
    expect(handoutsForLocale(deOnly, 'en').map((item) => item.id)).toEqual([]);
    expect(handoutsForLocale(chapters, 'es').map((item) => item.id)).toEqual(['es-only']);
  });
});

describe('resolveHandoutsForLocale (empty + CTA)', () => {
  const deOnly = [{ id: 'de-a', lang: 'de' }, { id: 'de-b', lang: 'de' }];

  it('EN ohne Fallback: leerer Zustand + deutsch verfuegbar', () => {
    const ohne = resolveHandoutsForLocale(deOnly, 'en', false);
    expect(ohne.list).toEqual([]);
    expect(ohne.showLocaleEmpty).toBe(true);
    expect(ohne.germanFallbackAvailable).toBe(true);
  });

  it('EN mit Fallback: deutsche Liste', () => {
    const mit = resolveHandoutsForLocale(deOnly, 'en', true);
    expect(mit.list.map((h) => h.id)).toEqual(['de-a', 'de-b']);
    expect(mit.showLocaleEmpty).toBe(false);
  });

  it('DE Oberflaeche: normale Liste', () => {
    const de = resolveHandoutsForLocale(deOnly, 'de', false);
    expect(de.list.map((h) => h.id)).toEqual(['de-a', 'de-b']);
    expect(de.showLocaleEmpty).toBe(false);
  });

  it('normalisiert Regionalcodes in UI und Inhalt gleich', () => {
    const item = [{ lang: 'de-DE' }];
    expect(filterByContentLanguage(item, 'de-AT')).toHaveLength(1);
    expect(normalizeContentLanguage('de-AT')).toBe('de');
  });
});
