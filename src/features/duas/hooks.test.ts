import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

import { ALL_DUAS, DUA_CATEGORIES, categoryLabel, duaTranslation, duasForCategory } from './hooks';

// Datensatz-Integrität (Audit 2026-07-27). Die Duas sind statisch gebündelt und
// werden von Hand gepflegt — es gibt keine API, die einen Fehler später
// korrigieren würde. Eine Dua ohne Quellenangabe, ohne Umschrift oder mit
// fehlender Übersetzung ist ein sichtbarer Produktfehler in genau der Sprache,
// in der der Nutzer sie liest; deshalb wird der komplette Bestand geprüft,
// nicht nur ein Beispiel.
const ARABIC_LETTER_RE = /[؀-ۿ]/;

describe('Duas-Datensatz', () => {
  it('hat eindeutige IDs', () => {
    const ids = ALL_DUAS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ordnet jede Dua einer definierten Kategorie zu, und keine Kategorie ist leer', () => {
    const categoryIds = new Set(DUA_CATEGORIES.map((c) => c.id));
    for (const dua of ALL_DUAS) {
      expect(categoryIds.has(dua.category)).toBe(true);
    }
    for (const category of DUA_CATEGORIES) {
      expect(duasForCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it('hat je Dua arabischen Text, Umschrift und Quellenangabe', () => {
    for (const dua of ALL_DUAS) {
      expect(dua.arabic.trim()).not.toBe('');
      expect(dua.transliteration.trim()).not.toBe('');
      expect(dua.source.trim()).not.toBe('');
    }
  });

  it('vertauscht Umschrift und Arabisch nicht (Schriftsystem je Feld geprüft)', () => {
    // Klassischer Pflegefehler: Umschrift und arabischer Text rutschen beim
    // Einpflegen in die falsche Spalte. Das Schriftsystem entlarvt das sofort.
    for (const dua of ALL_DUAS) {
      expect(ARABIC_LETTER_RE.test(dua.arabic)).toBe(true);
      expect(ARABIC_LETTER_RE.test(dua.transliteration)).toBe(false);
    }
  });

  it('hat in allen 14 App-Sprachen eine Übersetzung', () => {
    for (const dua of ALL_DUAS) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(dua.translations[locale]?.trim() ?? '').not.toBe('');
      }
    }
  });

  it('beschriftet jede Kategorie in allen 14 App-Sprachen', () => {
    for (const category of DUA_CATEGORIES) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(category.labels[locale]?.trim() ?? '').not.toBe('');
        expect(categoryLabel(category.id, locale)).not.toBe(category.id);
      }
    }
  });
});

describe('duaTranslation', () => {
  it('blendet die Übersetzungszeile für Arabisch aus (der Text selbst ist arabisch)', () => {
    expect(duaTranslation(ALL_DUAS[0], 'ar')).toBeNull();
  });

  it('liefert für jede andere Sprache einen nicht-leeren Text', () => {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'ar') continue;
      expect(duaTranslation(ALL_DUAS[0], locale)?.trim()).toBeTruthy();
    }
  });
});
