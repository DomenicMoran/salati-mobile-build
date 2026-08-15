import de from '@/locales/de.json';
import { SUPPORTED_LOCALES } from './locale-detect';

/**
 * Strukturelle Vollständigkeit ist bei den Locale-JSONs kritisch: ein
 * fehlender/zusätzlicher Key oder eine andere Verschachtelung bricht
 * `translate()` still (Fallback auf Deutsch/Englisch verschleiert Lücken
 * im UI statt sie hier beim Build sichtbar zu machen).
 */
function collectEntries(node: unknown, prefix = '', out: Record<string, string> = {}) {
  if (typeof node !== 'object' || node === null) {
    out[prefix] = String(node);
    return out;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    collectEntries(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/**
 * Platzhalter wie `{n}`/`{location}` werden von den Screens per
 * `.replace('{n}', …)` ersetzt — geht einer beim Übersetzen verloren oder wird
 * er umbenannt, steht zur Laufzeit die rohe Klammer im UI (oder die Zahl fehlt
 * ganz). Reine Key-Parität (oben) fängt das nicht.
 */
const PLACEHOLDER = /\{[0-9a-zA-Z_]+\}/g;

describe('locale files match de.json key structure', () => {
  const deEntries = collectEntries(de);
  const deKeys = Object.keys(deEntries).sort();

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === 'de') continue;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad, kein statischer Import möglich
    const dict = require(`@/locales/${locale}.json`);
    const entries = collectEntries(dict);

    it(`${locale}.json has exactly the same keys as de.json`, () => {
      expect(Object.keys(entries).sort()).toEqual(deKeys);
    });

    it(`${locale}.json has no empty values`, () => {
      expect(Object.keys(entries).filter((key) => entries[key].trim() === '')).toEqual([]);
    });

    it(`${locale}.json keeps every placeholder of de.json`, () => {
      const mismatches = deKeys.filter((key) => {
        const expected = (deEntries[key].match(PLACEHOLDER) ?? []).slice().sort();
        const actual = ((entries[key] ?? '').match(PLACEHOLDER) ?? []).slice().sort();
        return expected.join(',') !== actual.join(',');
      });
      expect(mismatches).toEqual([]);
    });
  }
});
