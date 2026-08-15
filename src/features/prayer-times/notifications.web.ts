// Web-Variante: expo-notifications hat auf Web weder Scheduling-Support noch
// Push-Token-Handling — schon der IMPORT des Moduls warf auf jeder Seite eine
// Konsolen-Warnung ("Listening to push token changes..."). Daher hier ein
// import-freier No-op mit identischer Signatur (Metro-Platform-Split).
import type { Timings } from './api';
import type { NextPrayerResult, TimeFormat } from './next-prayer';
import type { AzanChoice, AzanPerPrayer, NotificationPrefs, NotificationToggles } from '@/features/settings/types';

export interface DayTimings {
  date: Date;
  timings: Timings;
}

export function prayerChannelId(prefs: NotificationPrefs, azan: AzanChoice = 'default'): string {
  const base = `prayer-s${prefs.sound ? 1 : 0}v${prefs.vibrate ? 1 : 0}h${prefs.headsUp ? 1 : 0}`;
  return azan === 'default' ? base : `${base}-${azan}`;
}

export function effectiveAzan(prefs: NotificationPrefs, azanEnabled: boolean, choice: AzanChoice): AzanChoice {
  if (!prefs.sound || !azanEnabled) return 'default';
  return choice;
}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function notificationPermissionBlocked(): Promise<boolean> {
  // Web plant keine lokalen Notifications — es gibt daher auch keine
  // dauerhaft verweigerte Berechtigung, die man in Systemeinstellungen
  // reparieren müsste.
  return false;
}

export async function rescheduleNotifications(
  _days: DayTimings[],
  _enabled: NotificationToggles,
  _prefs: NotificationPrefs,
  _now: Date = new Date(),
  _locale: string = 'de',
  _timeFormat: TimeFormat = '24h',
  _azan: { enabled: boolean; choices: AzanPerPrayer } = {
    enabled: false,
    choices: { fajr: 'default', dhuhr: 'default', asr: 'default', maghrib: 'default', isha: 'default' },
  },
): Promise<void> {
  // Web: keine lokalen Notifications — bewusst leer.
}

export async function updateOngoingCountdown(
  _next: NextPrayerResult,
  _prefs: NotificationPrefs,
  _locale: string,
  _timeFormat: TimeFormat,
): Promise<void> {
  // Web: kein Ongoing-Notification-Äquivalent — bewusst leer.
}
