import { GUIDES, resolveText } from './hooks';
import { WISDOM_ENTRIES, resolveWisdomText, wisdomOfTheDay } from '../wisdom/hooks';

describe('guides data', () => {
  it('enthält die 7 Kern-Guides', () => {
    const ids = GUIDES.map((g) => g.id);
    for (const id of ['wudu', 'ghusl', 'tayammum', 'how-to-pray', 'rakat', 'witr', 'jumuah']) {
      expect(ids).toContain(id);
    }
  });

  it('jeder Schritt hat Titel+Text in de/en/tr/ar', () => {
    for (const guide of GUIDES) {
      expect(resolveText(guide.title, 'de')).toBeTruthy();
      expect(resolveText(guide.intro, 'ar')).toBeTruthy();
      expect(guide.steps.length).toBeGreaterThan(0);
      for (const step of guide.steps) {
        for (const locale of ['de', 'en', 'tr', 'ar'] as const) {
          expect(step.title[locale]).toBeTruthy();
          expect(step.text[locale]).toBeTruthy();
        }
      }
    }
  });

  it('jeder Schritt hat eigene Übersetzungen in es/fr (keine En-Fallbacks mehr)', () => {
    for (const guide of GUIDES) {
      for (const step of guide.steps) {
        for (const locale of ['es', 'fr'] as const) {
          expect(step.title[locale]).toBeTruthy();
          expect(step.text[locale]).toBeTruthy();
        }
      }
    }
  });

  it('Schritt-Texte sind auch in den 8 Phase-1-Sprachen befüllt', () => {
    for (const guide of GUIDES) {
      for (const step of guide.steps) {
        for (const locale of ['id', 'bn', 'fa', 'ms', 'ur', 'ru', 'sw', 'ps'] as const) {
          expect(step.text[locale]).toBeTruthy();
        }
      }
    }
  });

  it('jeder Guide hat eine Quellenangabe', () => {
    for (const guide of GUIDES) {
      expect(guide.source).toBeTruthy();
    }
  });
});

describe('wisdom data', () => {
  it('jeder Eintrag hat Text in de/en/tr/ar und eine Quelle', () => {
    expect(WISDOM_ENTRIES.length).toBeGreaterThanOrEqual(20);
    for (const entry of WISDOM_ENTRIES) {
      expect(entry.source).toBeTruthy();
      for (const locale of ['de', 'en', 'tr', 'ar'] as const) {
        expect(resolveWisdomText(entry.text, locale)).toBeTruthy();
      }
    }
  });

  it('IDs sind eindeutig', () => {
    expect(new Set(WISDOM_ENTRIES.map((e) => e.id)).size).toBe(WISDOM_ENTRIES.length);
  });

  it('Tages-Weisheit ist deterministisch pro Tag', () => {
    const day = new Date(2026, 6, 13, 10, 0);
    const sameDayLater = new Date(2026, 6, 13, 22, 0);
    expect(wisdomOfTheDay(day).id).toBe(wisdomOfTheDay(sameDayLater).id);
  });
});
