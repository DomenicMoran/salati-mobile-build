// Kalendertag-Arithmetik auf Tagesschluesseln ('YYYY-MM-DD').
//
// Warum UTC und nicht `new Date('YYYY-MM-DDT00:00:00')`:
// Ein Kalendertag hat LOKAL an DST-Umstellungstagen nur 23 bzw. 25 Stunden.
// Die Differenz zweier lokaler Mitternaechte ist dann kein exaktes Vielfaches
// von 86_400_000 ms mehr, und ein `Math.floor(diff / 86_400_000)` senkt den
// Tagesindex rund um die Umstellung (z. B. 2026-03-29 in DE) um 1 — ein
// stiller Off-by-one in jedem Leseplan-Fortschritt.
// Reine UTC-Kalenderarithmetik ist DST-frei und liefert exakte Vielfache.
//
// Diese Datei ist die EINE Quelle dieser Rechnung; `features/khatmah/plan.ts`
// und `features/themes/journeyProgress.ts` hatten sie zuvor getrennt (und nur
// khatmah DST-sicher) implementiert.

/** 'YYYY-MM-DD' → UTC-Millisekunden von Mitternacht dieses Kalendertags. */
export function dayKeyToUtcMs(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Ganzzahlige Anzahl Kalendertage von `fromKey` bis `toKey` (negativ, wenn
 * `toKey` frueher liegt). DST-frei, weil ueber UTC-Mitternachten gerechnet.
 */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dayKeyToUtcMs(toKey) - dayKeyToUtcMs(fromKey)) / 86_400_000);
}

/**
 * 0-basierter Tagesindex eines Plans, der an `startKey` beginnt und
 * `totalDays` Tage laeuft — geklemmt auf [0, totalDays - 1].
 */
export function dayIndexSince(startKey: string, todayKey: string, totalDays: number): number {
  const diff = daysBetween(startKey, todayKey);
  return Math.min(Math.max(diff, 0), Math.max(totalDays - 1, 0));
}
