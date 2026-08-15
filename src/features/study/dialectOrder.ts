// Ehemals: Nutzer-wählbare Reihenfolge der 4 Dialektgruppen im "Arabische
// Dialekte"-Bonus-Kurs (data/dialects.json: Maghrebinisch, Levantinisch,
// Golf-Arabisch, Ägyptisch, je 7 Lektionen als fester Block in Datei-
// Reihenfolge). Der Kurs ist bewusst nonSequential (siehe courses.ts) - eine
// sequenzielle Sperre zwischen den Gruppen wäre pädagogisch falsch.
//
// User-Feedback (Audit 2026-07-20): die Reorder-UI im Kurs-Screen
// (app/study/[course]/index.tsx) wurde entfernt - da im Dialekt-Kurs ohnehin
// nichts gesperrt ist, war die manuelle Umsortierung unnötiges Bedienelement
// oben im Screen; die Lektionen werden dort jetzt einfach in natürlicher
// Datei-Reihenfolge angezeigt, rein scrollbar, ohne persistierte
// Nutzer-Reihenfolge. sortDialectLessons/moveDialectGroup sind DAHER VON DER
// UI AUS NICHT MEHR AUFGERUFEN - sie bleiben hier nur als getestete
// Utility-Funktionen erhalten (dialectOrder.test.ts) und weil das
// Settings-Feld `dialectGroupOrder` (features/settings/types.ts) weiterhin
// den Typ DialectGroupId/DEFAULT_DIALECT_GROUP_ORDER referenziert. Neuer
// Code sollte diese Sortierfunktionen nicht mehr verwenden.
import type { Lesson } from '@/features/learn/curriculum';

export type DialectGroupId = 'maghrebi' | 'levantine' | 'gulf' | 'egyptian';

/** Datei-Reihenfolge in data/dialects.json = Default, falls der Nutzer nichts einstellt. */
export const DEFAULT_DIALECT_GROUP_ORDER: DialectGroupId[] = [
  'maghrebi',
  'levantine',
  'gulf',
  'egyptian',
];

/** Jede Gruppe hat exakt 7 Lektionen (Begrüßung, Zahlen, Fragen, Familie, Essen, Gefühle, Redewendungen). */
const LESSONS_PER_GROUP = 7;

/**
 * Zerlegt die flache Lektionsliste aus dialects.json in ihre 4 Gruppen-Blöcke.
 * Die Lektionen INNERHALB einer Gruppe bleiben dabei immer in Datei-
 * Reihenfolge - nur die Reihenfolge der Gruppen selbst ist wählbar.
 */
function groupDialectLessons(lessons: readonly Lesson[]): Record<DialectGroupId, Lesson[]> {
  const groups = {} as Record<DialectGroupId, Lesson[]>;
  DEFAULT_DIALECT_GROUP_ORDER.forEach((groupId, i) => {
    groups[groupId] = lessons.slice(i * LESSONS_PER_GROUP, (i + 1) * LESSONS_PER_GROUP);
  });
  return groups;
}

/**
 * Sortiert die Dialekte-Lektionen nach der (persistierten) Gruppen-
 * Reihenfolge. Fehlt eine Gruppe in `order` (z. B. altes/korruptes Storage-
 * Format), wird sie in Default-Reihenfolge angehängt - so gehen nie
 * Lektionen verloren, selbst bei unvollständigen Einstellungen.
 */
export function sortDialectLessons(
  lessons: readonly Lesson[],
  order: readonly DialectGroupId[],
): Lesson[] {
  const groups = groupDialectLessons(lessons);
  const seen = new Set<DialectGroupId>();
  const result: Lesson[] = [];
  for (const groupId of order) {
    if (groups[groupId] && !seen.has(groupId)) {
      result.push(...groups[groupId]);
      seen.add(groupId);
    }
  }
  for (const groupId of DEFAULT_DIALECT_GROUP_ORDER) {
    if (!seen.has(groupId)) {
      result.push(...groups[groupId]);
      seen.add(groupId);
    }
  }
  return result;
}

/**
 * Verschiebt eine Gruppe um eine Position nach oben/unten. Am Rand (erste
 * Gruppe + "up", letzte Gruppe + "down") bleibt die Reihenfolge unverändert.
 */
export function moveDialectGroup(
  order: readonly DialectGroupId[],
  groupId: DialectGroupId,
  direction: 'up' | 'down',
): DialectGroupId[] {
  const index = order.indexOf(groupId);
  if (index === -1) return [...order];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) return [...order];
  const next = [...order];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
