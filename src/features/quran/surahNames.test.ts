import { surahNameTranslation } from './surahNames';

// Die deutschen Bedeutungs-Namen ersetzen die englischen API-Metadaten NUR in
// der deutschen UI. Zwei Fehlerbilder wären für den Nutzer sichtbar:
// eine Lücke in der Tabelle (englischer Name mitten in deutscher Liste) und
// ein Durchschlagen der deutschen Namen in andere Sprachen.

const EN = 'The Cow';

describe('surahNameTranslation — Deutsch', () => {
  it('übersetzt bekannte Suren', () => {
    expect(surahNameTranslation(1, 'de', 'The Opening')).toBe('Die Eröffnung');
    expect(surahNameTranslation(2, 'de', EN)).toBe('Die Kuh');
    expect(surahNameTranslation(112, 'de', 'Sincerity')).toBe('Die Aufrichtigkeit');
    expect(surahNameTranslation(114, 'de', 'Mankind')).toBe('Die Menschen');
  });

  it('hat für ALLE 114 Suren einen nichtleeren deutschen Namen', () => {
    for (let n = 1; n <= 114; n++) {
      const name = surahNameTranslation(n, 'de', EN);
      expect({ n, name }).not.toEqual({ n, name: EN });
      expect(name.trim()).not.toBe('');
    }
  });

  it('vergibt keinen Namen doppelt außer bei echten Namensgleichheiten', () => {
    // Doppelte Bedeutungen wären ein Copy-Paste-Fehler in der Tabelle.
    const names = Array.from({ length: 114 }, (_, i) => surahNameTranslation(i + 1, 'de', EN));
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
  });

  it('fällt außerhalb 1..114 auf den englischen Namen zurück', () => {
    expect(surahNameTranslation(0, 'de', EN)).toBe(EN);
    expect(surahNameTranslation(115, 'de', EN)).toBe(EN);
    expect(surahNameTranslation(-1, 'de', EN)).toBe(EN);
  });
});

describe('surahNameTranslation — alle anderen Sprachen', () => {
  it.each(['en', 'tr', 'ar', 'es', 'fr', 'id', 'bn', 'fa', 'ms', 'ur', 'ru', 'sw', 'ps'])(
    '%s nutzt die englische API-Bedeutung, nie die deutsche',
    (locale) => {
      for (const n of [1, 2, 55, 112, 114]) {
        expect(surahNameTranslation(n, locale, EN)).toBe(EN);
      }
    },
  );

  it('behandelt Regional-Codes wie de-DE NICHT als Deutsch (exakter Vergleich)', () => {
    // Dokumentiert das aktuelle Verhalten: settings.language liefert immer
    // einen reinen Sprachcode (s. lib/locale-detect.ts), Regionen kommen nicht vor.
    expect(surahNameTranslation(2, 'de-DE', EN)).toBe(EN);
  });
});
