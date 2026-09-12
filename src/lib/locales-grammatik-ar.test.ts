/**
 * Absicherung für die Zusage "arabische Fachbegriffe laufen überall mit"
 * (Auftraggeber, Lexikon-Ausbau 2026-09-05): jeder Eintrag im
 * `grammatik`-Teilbaum, der ein `ar`-Feld führt (Wortarten, Merkmale samt
 * ihrer `werte`/`formen`-Unterobjekte, POS-Tags, Relationen, …), muss dieses
 * Feld in JEDER der 14 Sprachen tragen — nicht-leer und mit mindestens einem
 * arabischen Schriftzeichen. Fehlt es in einer Sprache still (z. B. weil ein
 * künftiger Eintrag ohne `ar` ergänzt wird), fiele die Zusage lautlos weg,
 * ohne dass ein Test das meldet — genau das verhindert dieser Test.
 *
 * Gleicher Stil wie locales.test.ts (Struktur-Parität gegen de.json als
 * Referenz), aber auf das `ar`-Feld zugeschnitten statt auf alle Blattwerte.
 */
import de from '@/locales/de.json';
import { SUPPORTED_LOCALES } from './locale-detect';

const ARABIC_CHAR = /[؀-ۿ]/;

/** Sammelt die Pfade aller Objekte innerhalb `node`, die selbst ein
 *  String-Feld `ar` tragen — rekursiv, damit auch `werte.<wert>.ar` und
 *  `formen.<n>.ar` erfasst werden. */
function collectArPaths(node: unknown, prefix: string, out: Set<string>): Set<string> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  const obj = node as Record<string, unknown>;
  if (typeof obj.ar === 'string') out.add(prefix);
  for (const [key, value] of Object.entries(obj)) {
    collectArPaths(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function getAtPath(root: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((cur, segment) => {
    if (cur && typeof cur === 'object' && segment in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[segment];
    }
    return undefined;
  }, root);
}

const dePaths = collectArPaths(de.grammatik, 'grammatik', new Set());

describe('grammatik-Teilbaum: das "ar"-Feld ist ueberall vorhanden und gefuellt', () => {
  it('de.json fuehrt mindestens ein ar-Feld im grammatik-Teilbaum (sonst prueft dieser Test nichts)', () => {
    expect(dePaths.size).toBeGreaterThan(0);
  });

  for (const locale of SUPPORTED_LOCALES) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad, kein statischer Import moeglich
    const dict = locale === 'de' ? de : require(`@/locales/${locale}.json`);

    it(`${locale}.json hat an genau denselben Stellen ein ar-Feld wie de.json`, () => {
      const localePaths = collectArPaths(dict.grammatik, 'grammatik', new Set());
      expect([...localePaths].sort()).toEqual([...dePaths].sort());
    });

    it(`${locale}.json: jedes ar-Feld im grammatik-Teilbaum ist nicht-leer und enthaelt arabische Schrift`, () => {
      const fehlerhaft = [...dePaths].filter((p) => {
        const node = getAtPath(dict, p) as { ar?: unknown } | undefined;
        const wert = typeof node?.ar === 'string' ? node.ar : '';
        return wert.trim() === '' || !ARABIC_CHAR.test(wert);
      });
      expect(fehlerhaft).toEqual([]);
    });

    if (locale !== 'de') {
      it(`${locale}.json: jedes ar-Feld ist wortgleich mit de.json (sprachunabhaengiger Fachbegriff)`, () => {
        const abweichend = [...dePaths].filter((p) => {
          const hier = (getAtPath(dict, p) as { ar?: unknown } | undefined)?.ar;
          const de_ = (getAtPath(de, p) as { ar?: unknown } | undefined)?.ar;
          return hier !== de_;
        });
        expect(abweichend).toEqual([]);
      });
    }
  }
});
