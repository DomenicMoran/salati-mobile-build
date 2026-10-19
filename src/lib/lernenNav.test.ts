import { LERNEN_NAV } from './lernenNav';
import { translate } from './i18n';

const previousRoutes = [
  '/media', '/learn', '/hifz', '/study', '/handouts', '/gebet-gemeinsam', '/lexikon',
  '/analyse-uebung', '/quiz', '/hadith', '/wisdom', '/names', '/radio', '/getting-started',
];

describe('Lernen-Einstiege', () => {
  it('behält sämtliche bisherigen Funktionen auffindbar und setzt Pflichtwissen auf den direkten Ein-Tap-Einstieg', () => {
    const routes = LERNEN_NAV.map((item) => item.href);
    for (const route of previousRoutes) expect(routes).toContain(route);
    expect(routes).toContain('/audiobooks/pflichtwissen');
    expect(LERNEN_NAV.find((item) => item.href === '/audiobooks/pflichtwissen')?.group).toBe('hoerinhalte');
  });

  it('sortiert Praxis in sinnvolle Gruppen statt sachfremde Quiz-/Lexikonüberschriften zu verwenden', () => {
    expect(LERNEN_NAV.find((item) => item.href === '/gebet-gemeinsam')?.group).toBe('lernen');
    expect(LERNEN_NAV.find((item) => item.href === '/getting-started')?.group).toBe('lernen');
    expect(LERNEN_NAV.find((item) => item.href === '/analyse-uebung')?.group).toBe('uebung');
    expect(LERNEN_NAV.find((item) => item.href === '/hadith')?.group).toBe('nachschlagen');
    for (const locale of ['ar', 'bn', 'de', 'en', 'es', 'fa', 'fr', 'id', 'ms', 'ps', 'ru', 'sw', 'tr', 'ur'] as const) {
      for (const key of ['learnGroup', 'audioGroup', 'referenceGroup', 'practiceGroup']) {
        expect(translate(locale, `nav.${key}`)).not.toBe(`nav.${key}`);
      }
      for (const key of ['rationaleLabel', 'rationaleHide']) {
        expect(translate(locale, `quran.wortAnalyse.${key}`)).not.toBe(`quran.wortAnalyse.${key}`);
      }
    }
  });
});
