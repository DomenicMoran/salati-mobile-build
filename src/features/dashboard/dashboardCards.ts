// Nutzer-eigene Reihenfolge/Sichtbarkeit der Karten auf dem Home-Dashboard
// (components/prayer-times-screen.tsx). Gleiches Auf/Ab-Pfeil-Muster wie die
// Kurs-Reihenfolge (features/study/courseOrder.ts) — bewusst KEIN Drag-and-
// Drop (auf Touch fehleranfälliger, siehe Kommentar dort).
//
// Anders als beim Kurs-Screen ist hier nicht nur die Reihenfolge, sondern
// zusätzlich die Sichtbarkeit einstellbar: die Hero-Karte (nächstes Gebet)
// und die Gebetszeiten-Tabelle sind der Kernzweck der App und daher in
// DASHBOARD_LOCKED_CARDS — nur umsortierbar, nicht deaktivierbar. Die
// Ramadan-Countdown-Karte und der Reise-Modus-Banner sind rein optionale
// Zusatzinfos und dürfen ausgeblendet werden.

export type DashboardCardId = 'hero' | 'ramadanCard' | 'travelBanner' | 'prayerTable';

/** Standard-Reihenfolge, falls der Nutzer nichts einstellt. */
export const DASHBOARD_CARD_IDS: DashboardCardId[] = ['hero', 'ramadanCard', 'travelBanner', 'prayerTable'];

/** Diese Karten sind Kernfunktion der App — nur umsortierbar, nicht ausblendbar. */
export const DASHBOARD_LOCKED_CARDS: DashboardCardId[] = ['hero', 'prayerTable'];

/**
 * Bringt eine (ggf. veraltete/unvollständige) gespeicherte Reihenfolge in
 * eine garantiert vollständige Form: fehlende Karten (z. B. neu hinzu-
 * gekommen seit dem letzten App-Update) werden in Standard-Reihenfolge
 * angehängt, unbekannte/doppelte IDs verworfen — so geht nie eine Karte
 * verloren und es gibt nie doppelte Einträge.
 */
export function normalizeDashboardCardOrder(order: readonly DashboardCardId[]): DashboardCardId[] {
  const seen = new Set<DashboardCardId>();
  const result: DashboardCardId[] = [];
  for (const id of order) {
    if (DASHBOARD_CARD_IDS.includes(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  for (const id of DASHBOARD_CARD_IDS) {
    if (!seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  return result;
}

/**
 * Verschiebt eine Karte um eine Position nach oben/unten. Am Rand (erste
 * Karte + "up", letzte Karte + "down") bleibt die Reihenfolge unverändert.
 */
export function moveDashboardCard(
  order: readonly DashboardCardId[],
  id: DashboardCardId,
  direction: 'up' | 'down',
): DashboardCardId[] {
  const index = order.indexOf(id);
  if (index === -1) return [...order];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) return [...order];
  const next = [...order];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

/** Ein- oder ausblenden — no-op für gesperrte (nicht deaktivierbare) Karten. */
export function toggleDashboardCardHidden(
  hidden: readonly DashboardCardId[],
  id: DashboardCardId,
): DashboardCardId[] {
  if (DASHBOARD_LOCKED_CARDS.includes(id)) return [...hidden];
  return hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
}
