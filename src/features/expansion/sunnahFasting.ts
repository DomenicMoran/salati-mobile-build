import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { gregorianToHijriOffline } from '@/features/calendar/offline';

const PREFIX = 'salatibox-sunnah-fast-';
const HORIZON = 8;
const EVENING_HOUR = 19;

export type SunnahFastingPrefs = {
  monThu: boolean;
  whiteDays: boolean;
  arafah: boolean;
  ashura: boolean;
  shawwal6: boolean;
};

export const DEFAULT_SUNNAH_FASTING: SunnahFastingPrefs = {
  monThu: true,
  whiteDays: false,
  arafah: true,
  ashura: true,
  shawwal6: false,
};

const COPY: Record<string, { title: string; body: string }> = {
  de: {
    title: 'Sunnah-Fastentag',
    body: 'Morgen ist ein empfohlener Fastentag — lokal geplant, keine Cloud.',
  },
  en: {
    title: 'Sunnah fasting day',
    body: 'Tomorrow is a recommended fasting day — scheduled on-device only.',
  },
};

function copy(locale: string) {
  return COPY[locale] ?? COPY.en;
}

function atEveningBefore(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  d.setHours(EVENING_HOUR, 0, 0, 0);
  return d;
}

function nextWeekday(from: Date, weekday: number, count: number): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  while (out.length < count) {
    if (d.getDay() === weekday && d.getTime() > from.getTime()) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function nextHijriDays(from: Date, matches: (h: { month: number; day: number }) => boolean, count: number): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < 400 && out.length < count; i++) {
    const probe = new Date(cursor);
    probe.setDate(probe.getDate() + i);
    const h = gregorianToHijriOffline(probe);
    const month = Number(h.month);
    const day = Number(h.day);
    if (matches({ month, day }) && atEveningBefore(probe).getTime() > from.getTime()) {
      out.push(probe);
    }
  }
  return out;
}

export function plannedSunnahFastEvenings(from: Date, prefs: SunnahFastingPrefs): Date[] {
  const triggers: Date[] = [];
  if (prefs.monThu) {
    for (const wd of [1, 4]) triggers.push(...nextWeekday(from, wd, HORIZON).map((d) => atEveningBefore(d)));
  }
  if (prefs.whiteDays) {
    triggers.push(
      ...nextHijriDays(from, ({ month, day }) => month % 2 === 1 && day >= 13 && day <= 15, HORIZON).map((d) =>
        atEveningBefore(d),
      ),
    );
  }
  if (prefs.arafah) {
    triggers.push(...nextHijriDays(from, ({ month, day }) => month === 12 && day === 9, 2).map((d) => atEveningBefore(d)));
  }
  if (prefs.ashura) {
    triggers.push(...nextHijriDays(from, ({ month, day }) => month === 1 && day === 10, 2).map((d) => atEveningBefore(d)));
  }
  if (prefs.shawwal6) {
    triggers.push(
      ...nextHijriDays(from, ({ month, day }) => month === 10 && day >= 2 && day <= 7, 2).map((d) => atEveningBefore(d)),
    );
  }
  const uniq = new Map<string, Date>();
  for (const t of triggers) {
    if (t.getTime() > from.getTime()) uniq.set(t.toISOString().slice(0, 16), t);
  }
  return [...uniq.values()].sort((a, b) => a.getTime() - b.getTime()).slice(0, 24);
}

export async function syncSunnahFastingReminders(
  masterOn: boolean,
  prefs: SunnahFastingPrefs,
  locale: string,
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
  if (!masterOn) return;
  const anyOn = Object.values(prefs).some(Boolean);
  if (!anyOn) return;
  const c = copy(locale);
  const dates = plannedSunnahFastEvenings(new Date(), prefs);
  await Promise.all(
    dates.map((date) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${date.toISOString()}`,
        content: { title: c.title, body: c.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      }),
    ),
  );
}
