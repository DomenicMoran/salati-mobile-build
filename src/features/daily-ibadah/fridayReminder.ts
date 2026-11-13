import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PREFIX = 'salatibox-friday-kahf-';
const HORIZON = 4;

const TEXT: Record<string, { title: string; body: string }> = {
  de: {
    title: 'Jumuʿa — Sure al-Kahf',
    body: 'Heute: Sure al-Kahf lesen und Salawat auf den Propheten ﷺ senden (lokal geplant).',
  },
  en: {
    title: "Jumu'a — Surah al-Kahf",
    body: 'Today: read Surah al-Kahf and send salawat (scheduled locally).',
  },
};

export function fridayReminderCopy(locale: string): { title: string; body: string } {
  return TEXT[locale] ?? TEXT.en;
}

function nextFridays(from: Date, count: number): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  while (out.length < count) {
    const day = d.getDay();
    if (day === 5 && d.getTime() > from.getTime()) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export async function syncFridayKahfReminders(enabled: boolean, locale: string): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
  if (!enabled) return;
  const copy = fridayReminderCopy(locale);
  const dates = nextFridays(new Date(), HORIZON);
  await Promise.all(
    dates.map((date) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${date.toISOString().slice(0, 10)}`,
        content: { title: copy.title, body: copy.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      }),
    ),
  );
}
