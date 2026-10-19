import fs from 'fs';
import path from 'path';

/** Paritaet der nativen iOS-Berechtigungstexte (InfoPlist.strings via Expo `locales`). */
const ROOT = path.join(__dirname, '..', '..');
const CATALOG = path.join(ROOT, 'ios-locales', 'catalog.json');
const LOCALE_DIR = path.join(ROOT, 'ios-locales');

describe('ios-info-plist-locales', () => {
  it('hat fuer jede App-Sprache dieselben UsageDescription-Schluessel', () => {
    const { keys, languages } = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as {
      keys: string[];
      languages: Record<string, Record<string, string>>;
    };

    const langs = Object.keys(languages).sort();
    expect(langs).toEqual(
      ['ar', 'bn', 'de', 'en', 'es', 'fa', 'fr', 'id', 'ms', 'ps', 'ru', 'sw', 'tr', 'ur'].sort(),
    );

    for (const lang of langs) {
      const filePath = path.join(LOCALE_DIR, `${lang}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { ios?: Record<string, string> };
      const ios: Record<string, string> = parsed.ios ?? (parsed as Record<string, string>);
      for (const key of keys) {
        expect(typeof ios[key]).toBe('string');
        expect(ios[key]!.trim().length).toBeGreaterThan(0);
        expect(ios[key]).toBe(languages[lang]![key]);
      }
      expect(Object.keys(ios).sort()).toEqual([...keys].sort());
    }
  });
});
