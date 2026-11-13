/** Letztes Drittel der Nacht zwischen Maghrib und Fajr (lokale Schätzung). */
export function tahajjudWindow(
  maghribAt: Date,
  fajrAt: Date,
): { start: Date; end: Date; thirdStart: Date } {
  const nightMs = Math.max(0, fajrAt.getTime() - maghribAt.getTime());
  const third = nightMs / 3;
  const thirdStart = new Date(maghribAt.getTime() + 2 * third);
  const start = new Date(maghribAt.getTime() + third);
  return { start, end: fajrAt, thirdStart };
}
