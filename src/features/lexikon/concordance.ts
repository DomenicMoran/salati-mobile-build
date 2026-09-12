// Reine Suchlogik für die Konkordanz (Reiter "Konkordanz" + die
// Wurzel-/Wortschatz-Treffer der universellen Kopf-Suche): durchsucht die
// Wurzel- (roots.json) und Lemma-Konkordanz (lemmas.json) diakritika-
// unempfindlich (arabicSearch.ts) und liefert Treffer inklusive ihrer
// Belegstellen. Bewusst ohne React-Abhängigkeit — siehe hooks.ts für das
// Laden der beiden Dateien.
import type { LemmataDatei, MorphVorkommen, WurzelnDatei } from '@/features/quran/morphologieTypen';

import { normalizeForSearch, searchMatches } from './arabicSearch';

export interface ConcordanceMatch {
  kind: 'root' | 'lemma';
  /** Wurzelbuchstaben (ohne Diakritika) bzw. Lemma (mit Diakritika), wie im
   *  Korpus geschrieben — NICHT normalisiert (Anzeige-Text). */
  text: string;
  count: number;
  occurrences: readonly MorphVorkommen[];
}

/**
 * Durchsucht Wurzeln UND Lemmata nach `query` (diakritika-/schreibvarianten-
 * unempfindlich). Leere Anfrage liefert bewusst keine Treffer statt der
 * kompletten Liste. Sortierung: normalisiert exakte Treffer zuerst, danach
 * nach Häufigkeit absteigend — die relevantesten/bekanntesten Treffer zuerst,
 * statt der Objekt-Reihenfolge der JSON-Datei.
 */
export function searchConcordance(query: string, roots: WurzelnDatei, lemmas: LemmataDatei): ConcordanceMatch[] {
  const q = normalizeForSearch(query);
  if (!q) return [];

  const results: ConcordanceMatch[] = [];
  for (const [root, entry] of Object.entries(roots)) {
    if (searchMatches(root, query)) {
      results.push({ kind: 'root', text: root, count: entry.count, occurrences: entry.occurrences });
    }
  }
  for (const [lemma, entry] of Object.entries(lemmas)) {
    if (searchMatches(lemma, query)) {
      results.push({ kind: 'lemma', text: lemma, count: entry.count, occurrences: entry.occurrences });
    }
  }

  results.sort((a, b) => {
    const aExact = normalizeForSearch(a.text) === q ? 1 : 0;
    const bExact = normalizeForSearch(b.text) === q ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return b.count - a.count;
  });
  return results;
}
