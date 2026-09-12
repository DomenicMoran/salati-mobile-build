/**
 * Regression: `LIZENZEN.CATEGORIES.ADHAN` erschien als roher Übersetzungs-
 * schlüssel in der Lizenzansicht statt als Text (Beleg:
 * abnahme/wegq-lizenzen-BUG-uebersetzungsschluessel.png). Ursache:
 * `lizenzen.tsx` ruft `t(`lizenzen.categories.${category.key}`)` — die
 * Kategorie `adhan` fehlte in ALLEN 14 `lizenzen.categories`-Blöcken, `translate()`
 * fällt dann mangels Treffer in de/en/gewählter Sprache auf den Key selbst
 * zurück (siehe lib/translate.ts).
 *
 * Der Test liest `CATEGORIES` NICHT über einen Import (der Screen zieht
 * React-Native-Komponenten nach, die hier nicht gerendert werden müssen),
 * sondern extrahiert die tatsächlich verwendeten `key: '...'`-Werte aus dem
 * Quelltext — so fällt künftig jede neu hinzugefügte Kategorie auf, für die
 * eine Sprache keinen Titel hat, ohne die Liste hier von Hand zu pflegen.
 */
import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

interface FsLike {
  readFileSync(file: string, encoding: 'utf8'): string;
}
interface PathLike {
  join(...parts: string[]): string;
}
declare const __dirname: string;

// Kein @types/node in dieser App (RN-Laufzeit hat kein Node-fs) — wie in
// route-affordances.test.ts holt sich dieser rein statische Test die beiden
// Node-Module typisiert über jest.requireActual.
const fs = jest.requireActual<FsLike>('fs');
const path = jest.requireActual<PathLike>('path');

const LIZENZEN_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'app', 'lizenzen.tsx'), 'utf8');

/**
 * Jede Kategorie in `CATEGORIES` beginnt mit `key: '...'`; die einzelnen
 * Lizenz-Einträge (`Entry`) tragen selbst kein `key`-Feld (nur name/license/
 * url/text) — die Regex trifft also ausschließlich die Kategorie-Schlüssel.
 */
const CATEGORY_KEYS = Array.from(LIZENZEN_SOURCE.matchAll(/\bkey:\s*'([^']+)'/g)).map((m) => m[1]);

describe('lizenzen.tsx: jede category.key hat in allen 14 Sprachen einen Titel', () => {
  it('findet die Kategorie-Schlüssel überhaupt (Schutz vor leerem Regex-Treffer)', () => {
    expect(CATEGORY_KEYS.length).toBeGreaterThanOrEqual(12);
    expect(CATEGORY_KEYS).toContain('adhan');
  });

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}.json: lizenzen.categories deckt jeden verwendeten Schlüssel nicht-leer ab`, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad, kein statischer Import möglich
      const dict = require(`@/locales/${locale}.json`);
      const categories: Record<string, string> = dict?.lizenzen?.categories ?? {};
      const missing = CATEGORY_KEYS.filter((key) => !categories[key]?.trim());
      expect(missing).toEqual([]);
    });
  }
});
