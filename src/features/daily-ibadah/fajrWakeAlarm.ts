/**
 * Fajr-Wecker mit Aufgabe — eigener Kanal/Präfix, getrennt vom Adhan-Service.
 */
import { Platform } from 'react-native';


const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const FAJR_WAKE_CHANNEL_ID = 'fajr-wake-alarm';
export const FAJR_WAKE_PREFIX = 'fajr-wake-';
export const FAJR_WAKE_SNOOZE_PREFIX = 'fajr-wake-snooze-';
export const MAX_SNOOZE_COUNT = 2;
export const SNOOZE_MINUTES = 5;

const COPY: Record<string, { title: string; body: string }> = {
  de: { title: 'Fajr-Wecker', body: 'Zeit für Fajr — Aufgabe im App öffnen, um den Wecker zu beenden.' },
  en: { title: 'Fajr wake alarm', body: 'Fajr time — open the task in the app to dismiss.' },
};

export type FajrWakeTaskKind = 'math' | 'dua';

export function fajrWakeNotificationId(dayKey: string, snooze = 0): string {
  return snooze > 0 ? `${FAJR_WAKE_SNOOZE_PREFIX}${dayKey}-${snooze}` : `${FAJR_WAKE_PREFIX}${dayKey}`;
}

export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildFajrWakeMathTask(seed: number): { question: string; answer: number } {
  const a = (seed % 7) + 3;
  const b = ((seed >> 3) % 9) + 2;
  return { question: `${a} × ${b}`, answer: a * b };
}

export function buildFajrWakeDuaTask(locale: string): string {
  if (locale === 'de') return 'Bismillah';
  return 'Bismillah';
}

export async function ensureFajrWakeChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(FAJR_WAKE_CHANNEL_ID, {
    name: 'Fajr-Wecker',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
  });
}

export async function cancelFajrWakeAlarms(): Promise<void> {
  if (!Notifications) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const mine = all.filter((n) => n.identifier.startsWith(FAJR_WAKE_PREFIX) || n.identifier.startsWith(FAJR_WAKE_SNOOZE_PREFIX));
  await Promise.all(mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleFajrWakeAlarm(at: Date, locale: string, dayKey: string): Promise<void> {
  if (!Notifications || at.getTime() <= Date.now()) return;
  await ensureFajrWakeChannel();
  const copy = COPY[locale] ?? COPY.en;
  await Notifications.scheduleNotificationAsync({
    identifier: fajrWakeNotificationId(dayKey),
    content: {
      title: copy.title,
      body: copy.body,
      sound: true,
      data: { type: 'fajrWake', dayKey, snooze: 0 },
      ...(Platform.OS === 'android' ? { channelId: FAJR_WAKE_CHANNEL_ID } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function scheduleFajrWakeSnooze(from: Date, locale: string, dayKey: string, snoozeIndex: number): Promise<void> {
  if (!Notifications || snoozeIndex > MAX_SNOOZE_COUNT) return;
  const at = new Date(from.getTime() + SNOOZE_MINUTES * 60_000);
  const copy = COPY[locale] ?? COPY.en;
  await Notifications.scheduleNotificationAsync({
    identifier: fajrWakeNotificationId(dayKey, snoozeIndex),
    content: {
      title: copy.title,
      body: `${copy.body} (${snoozeIndex}/${MAX_SNOOZE_COUNT})`,
      sound: true,
      data: { type: 'fajrWake', dayKey, snooze: snoozeIndex },
      ...(Platform.OS === 'android' ? { channelId: FAJR_WAKE_CHANNEL_ID } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}
