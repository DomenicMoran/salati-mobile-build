/**
 * Grob-relative Zeitangabe ("vor 5 Min." / "Gestern" / "vor 3 Tagen") für den
 * Leseverlauf. Bewusst ohne Intl.RelativeTimeFormat: dessen Locale-Tags
 * decken sich nicht 1:1 mit unseren App-Locale-Codes (z. B. ps, sw), die
 * Übersetzung läuft stattdessen wie überall sonst über translate()/locales/*.json.
 */
export function formatRelativeTime(t: (key: string) => string, at: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - at);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('quran.history.justNow');
  if (minutes < 60) return t('quran.history.minutesAgo').replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('quran.history.hoursAgo').replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  if (days < 2) return t('quran.history.yesterday');
  return t('quran.history.daysAgo').replace('{n}', String(days));
}
