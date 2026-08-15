// Web-Variante ohne expo-notifications-Import (siehe Kommentar in
// prayer-times/notifications.web.ts) — No-op, Web plant keine lokalen
// Erinnerungen.
export const WEEKLY_SUMMARY_NOTIFICATION_ID = 'salatibox-weekly-summary';

export async function rescheduleWeeklySummary(
  _enabled: boolean,
  _locale: string = 'de',
  _now: Date = new Date(),
): Promise<void> {
  // Web: bewusst leer.
}
