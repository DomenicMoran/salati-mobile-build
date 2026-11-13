import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { tahajjudWindow } from './tahajjud';

const ID = 'salatibox-tahajjud-reminder';

const TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Tahajjud-Zeit', body: 'Das letzte Drittel der Nacht hat begonnen (lokal berechnet).' },
  en: { title: 'Tahajjud time', body: 'The last third of the night has begun (calculated on device).' },
};

export async function syncTahajjudReminders(
  enabled: boolean,
  maghribAt: Date | undefined,
  fajrAt: Date | undefined,
  locale: string,
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  if (!enabled || !maghribAt || !fajrAt) return;
  const w = tahajjudWindow(maghribAt, fajrAt);
  const copy = TEXT[locale] ?? TEXT.en;
  if (w.thirdStart.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: copy.title, body: copy.body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.thirdStart },
  });
}
