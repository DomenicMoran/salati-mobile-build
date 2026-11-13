import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatOngoingCountdownText } from '@/features/prayer-times/notifications';
import type { NextPrayerResult, TimeFormat } from '@/features/prayer-times/next-prayer';

export const DAILY_IBADAH_ONGOING_ID = 'salatibox-daily-ibadah-ongoing';
const CHANNEL_ID = 'salati-daily-ibadah';

async function ensureChannel(): Promise<string> {
  if (Platform.OS !== 'android') return CHANNEL_ID;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily Ibadah',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
  });
  return CHANNEL_ID;
}

/** Getrennt vom Adhan-FGS und vom allgemeinen ongoingCountdown-Opt-in. */
export async function updateDailyIbadahOngoing(
  enabled: boolean,
  next: NextPrayerResult | null,
  locale: string,
  timeFormat: TimeFormat,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!enabled || !next) {
    await Notifications.dismissNotificationAsync(DAILY_IBADAH_ONGOING_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(DAILY_IBADAH_ONGOING_ID).catch(() => {});
    return;
  }
  const channelId = await ensureChannel();
  const text = formatOngoingCountdownText(next, locale, timeFormat);
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_IBADAH_ONGOING_ID,
    content: {
      title: text.title,
      body: text.body,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(), channelId },
  });
}
