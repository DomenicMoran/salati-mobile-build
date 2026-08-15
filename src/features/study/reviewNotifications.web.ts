// Web-Variante ohne expo-notifications-Import (siehe Kommentar in
// prayer-times/notifications.web.ts) — No-op, Web plant keine lokalen
// Erinnerungen.
import type { ReviewReminderHour } from '@/features/settings/types';

export const REVIEW_REMINDER_NOTIFICATION_ID = 'salatibox-review-reminder';

export async function rescheduleReviewReminder(
  _enabled: boolean,
  _hour: ReviewReminderHour,
  _locale: string = 'de',
  _topicName?: string,
): Promise<void> {
  // Web: bewusst leer.
}
