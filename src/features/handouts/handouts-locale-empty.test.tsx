import en from '@/locales/en.json';
import { resolveHandoutsForLocale } from '@/features/media/content-language';

const deOnly = [
  { id: 'salati-lernbuch', lang: 'de', title: 'Salati book' },
  { id: 'grammatik', lang: 'de', title: 'Grammar' },
];

describe('handouts locale empty (VP-A-008)', () => {
  it('EN ohne CTA: leerer Zustand, deutsche Unterlagen verfuegbar', () => {
    const res = resolveHandoutsForLocale(deOnly, 'en', false);
    expect(res.showLocaleEmpty).toBe(true);
    expect(res.germanFallbackAvailable).toBe(true);
    expect(res.list).toHaveLength(0);
  });

  it('nach CTA (showGermanFallback): deutsche Liste sichtbar', () => {
    const res = resolveHandoutsForLocale(deOnly, 'en', true);
    expect(res.list.map((h) => h.id)).toEqual(['salati-lernbuch', 'grammatik']);
    expect(res.showLocaleEmpty).toBe(false);
  });

  it('i18n-Keys fuer EmptyState und CTA in EN vorhanden', () => {
    expect(en.handouts.localeEmptyTitle).toBeTruthy();
    expect(en.handouts.localeEmptyText).toContain('German');
    expect(en.handouts.showGerman).toContain('German');
  });
});
