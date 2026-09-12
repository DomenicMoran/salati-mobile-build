// Zugriff auf die Fachbegriffe des `grammatik`-Teilbaums der Locale-Dateien
// (439 Einträge je Sprache: Wortarten, Ism-/Verb-Eigenschaften mit ihren
// `werte`, Fragmentrollen, QAC-POS-Tags, Relationslabels, Herkunft,
// Nomen-Flexibilität, schwache Verben — siehe grammatik.ts im Quran-Feature
// für die zugehörige reine Logik). Jeder Eintrag hat die Form
// `{name, ar, info}` (Merkmale zusätzlich verschachtelt unter `werte`/
// `formen`) — `ar` ist sprachunabhängig identisch in allen 14 Dateien
// (siehe locales-grammatik-ar.test.ts).
//
// `translate()` (lib/translate.ts) löst nur bis zu einem String-Blattwert
// auf — für ein ganzes {name, ar, info}-Objekt reicht das nicht. Deshalb
// direkter Zugriff über `getLocaleDict()` (lib/translate.ts), mit derselben
// Fallback-Kette (aktive Sprache → en → de) wie `translate()`.
import de from '@/locales/de.json';
import { getLocaleDict, type Locale, useTranslation } from '@/lib/i18n';

import { normalizeForSearch, searchMatches } from './arabicSearch';

export interface Term {
  name: string;
  ar: string;
  info?: string;
}

function isTerm(value: unknown): value is Term {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.ar === 'string';
}

function getAtPath(root: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((cur, segment) => {
    if (cur && typeof cur === 'object' && segment in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[segment];
    }
    return undefined;
  }, root);
}

/** Alle Pfade (relativ zu `grammatik`, z. B. "wortarten.ism" oder
 *  "ismEigenschaften.genus.werte.m") unterhalb derer ein {name, ar}-Objekt
 *  steht — einmalig aus der statisch gebündelten de.json ermittelt (Struktur
 *  ist über alle 14 Sprachen identisch, siehe locales.test.ts). */
const GRAMMATIK_PATHS: readonly string[] = (() => {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string) => {
    if (!node || typeof node !== 'object') return;
    if (isTerm(node)) out.push(prefix);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, prefix ? `${prefix}.${key}` : key);
    }
  };
  walk(de.grammatik, '');
  return out;
})();

export function grammatikLeafPaths(): readonly string[] {
  return GRAMMATIK_PATHS;
}

/**
 * Löst einen {name, ar[, info]}-Objekt-Pfad (voller Pfad ab Dateiwurzel,
 * z. B. "lexikon.roots.sortByFrequency" oder "grammatik.wortarten.ism")
 * gegen eine Sprache auf, mit derselben Fallback-Kette wie `translate()`
 * (Sprache → en → de). `null`, wenn der Pfad in keiner der drei Sprachen ein
 * solches Objekt ergibt (praktisch nur bei einem Tippfehler im Pfad, da en/de
 * immer geladen sind).
 */
export function localeTerm(locale: Locale, fullPath: string): Term | null {
  for (const candidate of [locale, 'en' as Locale, 'de' as Locale]) {
    const dict = getLocaleDict(candidate);
    if (!dict) continue;
    const node = getAtPath(dict, fullPath);
    if (isTerm(node)) return node;
  }
  return null;
}

/** Wie `localeTerm()`, aber an die aktive App-Sprache gebunden und reagiert
 *  auf das Nachladen der Sprachdatei (über `useTranslation()`s
 *  `useSyncExternalStore`-Abo). */
export function useLocaleTerm(fullPath: string): Term | null {
  const { locale } = useTranslation();
  return localeTerm(locale, fullPath);
}

/** Löst einen Fachbegriff-Pfad RELATIV zu `grammatik` auf — dünner Wrapper
 *  um `localeTerm()`/`useLocaleTerm()` für den häufigsten Fall. */
export function grammatikTerm(locale: Locale, path: string): Term | null {
  return localeTerm(locale, `grammatik.${path}`);
}

export function useGrammatikTerm(path: string): Term | null {
  const { locale } = useTranslation();
  return grammatikTerm(locale, path);
}

export interface GrammatikMatch {
  path: string;
  term: Term;
}

/** Durchsucht alle Fachbegriffe (Name, arabischer Begriff, Erklärtext) einer
 *  Sprache nach `query` — diakritika-/schreibvarianten-unempfindlich über
 *  `searchMatches`. Leere Anfrage liefert bewusst keine Treffer. */
export function searchGrammatikTerms(locale: Locale, query: string): GrammatikMatch[] {
  if (!normalizeForSearch(query)) return [];
  const results: GrammatikMatch[] = [];
  for (const path of GRAMMATIK_PATHS) {
    const term = grammatikTerm(locale, path);
    if (!term) continue;
    if (searchMatches(term.name, query) || searchMatches(term.ar, query) || (term.info && searchMatches(term.info, query))) {
      results.push({ path, term });
    }
  }
  return results;
}
