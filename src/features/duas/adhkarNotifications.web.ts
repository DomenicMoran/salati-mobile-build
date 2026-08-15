// Web-No-op ohne expo-notifications-Import (siehe
// prayer-times/notifications.web.ts — der Import allein warf eine Warnung).
export const ADHKAR_MORNING_ID = 'salatibox-adhkar-morning';
export const ADHKAR_EVENING_ID = 'salatibox-adhkar-evening';

export async function rescheduleAdhkarReminders(_opts: {
  morningEnabled: boolean;
  morningHour: number;
  eveningEnabled: boolean;
  eveningHour: number;
  locale: string;
}): Promise<void> {
  // Web: keine lokalen Notifications.
}
