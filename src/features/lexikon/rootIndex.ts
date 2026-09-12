// Reine Hilfsfunktionen auf der Wurzel-Konkordanz (roots.json, via
// `@/features/quran/morphologie`'s `ladeWurzeln()`) — Aufbau/Sortierung der
// 1.642-Einträge-Liste für den Reiter "Wurzeln & Wortschatz" sowie die
// Aufbereitung einer einzelnen Wurzel für die Detailansicht. Bewusst ohne
// React-/React-Query-Abhängigkeit (siehe hooks.ts für die Lade-Hooks) — gut
// isoliert testbar, wie grammatik.ts im Quran-Feature.
import type { Wortart } from '@/features/quran/grammatik';
import type { WurzelnDatei } from '@/features/quran/morphologieTypen';

export interface RootListItem {
  root: string;
  count: number;
  lemmaCount: number;
}

/** Baut die flache Liste aller Wurzeln aus roots.json — unsortiert (Reihenfolge
 *  der Objekt-Keys ist nicht spezifiziert). */
export function buildRootList(roots: WurzelnDatei): RootListItem[] {
  return Object.entries(roots).map(([root, entry]) => ({
    root,
    count: entry.count,
    lemmaCount: entry.lemmas.length,
  }));
}

export type RootSortMode = 'frequency' | 'alphabetical';

/** Sortiert eine Wurzel-Liste — 'frequency' absteigend nach Vorkommen (bei
 *  Gleichstand alphabetisch als stabiler Tie-Breaker, sonst würde die
 *  Reihenfolge bei jedem Neu-Laden zufällig wirken), 'alphabetical' nach dem
 *  arabischen Unicode-Codepoint der Wurzelbuchstaben (kollationsunabhängig —
 *  eine ICU-Locale-Sortierung ist auf allen Zielplattformen nicht garantiert
 *  verfügbar, Codepoint-Reihenfolge ist zumindest deterministisch). */
export function sortRoots(list: RootListItem[], mode: RootSortMode): RootListItem[] {
  const copy = [...list];
  if (mode === 'alphabetical') {
    copy.sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
  } else {
    copy.sort((a, b) => b.count - a.count || (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
  }
  return copy;
}

export interface RootWordform {
  lemma: string;
  count: number;
  /** `null` = Wortart über die Morphologiedaten (noch) nicht ermittelbar
   *  (z. B. während des Nachladens) — wird als eigene "Weitere Formen"-Gruppe
   *  angezeigt statt geraten. */
  wortart: Wortart | null;
}

/** Gruppiert abgeleitete Wortformen nach Wortart, für die Anzeige in der
 *  Wurzel-Detailansicht. Reihenfolge der Gruppen: ism, fiil, harf, dann
 *  unbekannt — innerhalb einer Gruppe nach Häufigkeit absteigend. */
export function groupWordformsByWortart(
  forms: RootWordform[],
): { wortart: Wortart | null; forms: RootWordform[] }[] {
  const order: (Wortart | null)[] = ['ism', 'fiil', 'harf', null];
  return order
    .map((wortart) => ({
      wortart,
      forms: forms.filter((f) => f.wortart === wortart).sort((a, b) => b.count - a.count),
    }))
    .filter((group) => group.forms.length > 0);
}

export interface RootOccurrence {
  surah: number;
  ayah: number;
  position: number;
}

/** Wandelt die roh gespeicherten `[sure, vers, wortposition]`-Tripel in
 *  benannte Objekte um — für lesbaren Zugriff in der UI (`occ.surah` statt
 *  `occ[0]`) und stabile React-Keys. */
export function toRootOccurrences(occurrences: readonly (readonly [number, number, number])[]): RootOccurrence[] {
  return occurrences.map(([surah, ayah, position]) => ({ surah, ayah, position }));
}
