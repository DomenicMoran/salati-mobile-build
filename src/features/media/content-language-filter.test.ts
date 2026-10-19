import { filterByContentLanguage, handoutsForLocale, normalizeContentLanguage } from './content-language';

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

  it('zeigt deutschsprachige Handouts, wenn die Oberflaeche keine eigenen hat', () => {
    const deOnly = [{ id: 'de-only', lang: 'de' }];
    expect(handoutsForLocale(deOnly, 'en').map((item) => item.id)).toEqual(['de-only']);
    expect(handoutsForLocale(chapters, 'es').map((item) => item.id)).toEqual(['es-only']);
  });

  it('normalisiert Regionalcodes in UI und Inhalt gleich', () => {
    const item = [{ lang: 'de-DE' }];
    expect(filterByContentLanguage(item, 'de-AT')).toHaveLength(1);
    expect(normalizeContentLanguage('de-AT')).toBe('de');
  });
});
