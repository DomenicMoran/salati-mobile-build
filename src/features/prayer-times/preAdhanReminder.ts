// Zusätzliche, konfigurierbare Erinnerung X Minuten VOR der eigentlichen
// Gebetszeit-Notification (rescheduleNotifications in notifications.ts) —
// z. B. um sich rechtzeitig für die Gebetswaschung (Wudu) oder den Weg zur
// Moschee bereitzumachen. Opt-in (Default AUS): wer die normale Gebetszeit-
// Notification schon aktiv hat, bekommt sonst automatisch eine zweite pro
// Gebet — bewusst nicht Standard, s. "nicht nerven"-Philosophie der App.
//
// Nutzt dieselben, bereits geladenen Gebetszeiten (DayTimings-Fenster) und
// respektiert die pro-Gebet-Toggles aus notificationsEnabled: eine Vor-
// Erinnerung für ein Gebet, dessen Hauptbenachrichtigung der Nutzer
// deaktiviert hat, wäre widersprüchlich.
import { Platform } from 'react-native';

import type { NotificationToggles, PreAdhanOffsetMinutes } from '@/features/settings/types';
import type { DayTimings } from './notifications';
import { formatHHMM, parseTimeOn, PRAYERS, type Prayer, type TimeFormat } from './next-prayer';
// Audit 2026-07-27 (O1): eigene ar-only-Kopie der Gebetsnamen entfernt — sie
// setzte in ur/fa/ps die lateinische Umschrift in den RTL-Satz. Gemeinsame
// Quelle, damit Vor-Adhan- und Adhan-Benachrichtigung nie auseinanderlaufen.
// Rein statische Tabelle, kein expo-notifications-Import — Web bleibt sauber.
import { prayerName } from './prayerNames';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole (Push-Token-Listener) — Guard-require wie in zakat/reminder.ts.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const PRE_ADHAN_REMINDER_PREFIX = 'preadhan-';

const PRE_ADHAN_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Gleich {p}', body: 'In {min} Minuten ist {p} ({time}).' },
  en: { title: 'Almost {p}', body: '{p} is in {min} minutes ({time}).' },
  tr: { title: 'Az sonra {p}', body: '{p} vaktine {min} dakika kaldı ({time}).' },
  ar: { title: 'اقترب وقت {p}', body: 'بعد {min} دقيقة يحين وقت {p} ({time}).' },
  es: { title: 'Ya casi {p}', body: 'Faltan {min} minutos para {p} ({time}).' },
  fr: { title: 'Bientôt {p}', body: '{p} dans {min} minutes ({time}).' },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und fielen über
  // `?? PRE_ADHAN_TEXT.de` auf DEUTSCH zurück — hier vollständig.
  id: { title: 'Sebentar lagi {p}', body: '{min} menit lagi masuk waktu {p} ({time}).' },
  ms: { title: 'Sebentar lagi {p}', body: '{min} minit lagi masuk waktu {p} ({time}).' },
  bn: { title: 'একটু পরেই {p}', body: '{min} মিনিট পর {p} ({time})।' },
  ur: { title: '{p} قریب ہے', body: '{min} منٹ بعد {p} کا وقت ہے ({time})۔' },
  fa: { title: '{p} نزدیک است', body: '{min} دقیقه دیگر وقت {p} است ({time}).' },
  ru: { title: 'Скоро {p}', body: 'Через {min} минут наступит {p} ({time}).' },
  sw: { title: 'Karibu {p}', body: 'Baada ya dakika {min} ni {p} ({time}).' },
  ps: { title: '{p} نږدې دی', body: 'تر {min} دقیقو وروسته د {p} وخت دی ({time}).' },
};

/**
 * Baut Titel/Text der Pre-Adhan-Erinnerung — reine Funktion, separat testbar.
 */
export function buildPreAdhanReminderContent(
  prayer: Prayer,
  displayTime: string,
  offsetMinutes: PreAdhanOffsetMinutes,
  locale: string,
): { title: string; body: string } {
  const text = PRE_ADHAN_TEXT[locale] ?? PRE_ADHAN_TEXT.de;
  const name = prayerName(prayer, locale);
  return {
    title: text.title.replace('{p}', name),
    body: text.body.replace('{p}', name).replace('{min}', String(offsetMinutes)).replace('{time}', displayTime),
  };
}

/** Zeitpunkt der Pre-Adhan-Erinnerung: `offsetMinutes` vor der Gebetszeit. */
export function computePreAdhanReminderTime(prayerTime: Date, offsetMinutes: PreAdhanOffsetMinutes): Date {
  return new Date(prayerTime.getTime() - offsetMinutes * 60_000);
}

/**
 * Plant (bzw. entfernt) die Pre-Adhan-Erinnerungen für die übergebenen Tage.
 * Löscht ausschließlich eigene (preadhan-*) Planungen. Nur Gebete, die auch
 * in `enabledPrayers` aktiv sind, bekommen eine Vor-Erinnerung (s. Datei-
 * Kommentar).
 */
export async function reschedulePreAdhanReminders(
  days: DayTimings[],
  enabled: boolean,
  enabledPrayers: NotificationToggles,
  offsetMinutes: PreAdhanOffsetMinutes,
  now: Date = new Date(),
  locale: string = 'de',
  timeFormat: TimeFormat = '24h',
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return; // kein Scheduling-Support, s. prayer-times/notifications.ts

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith(PRE_ADHAN_REMINDER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
  if (!enabled) return;

  for (const day of days) {
    for (const prayer of PRAYERS) {
      if (!enabledPrayers[prayer.toLowerCase() as keyof NotificationToggles]) continue;
      const time = day.timings[prayer];
      if (!time) continue;
      const prayerTime = parseTimeOn(time, day.date);
      const reminderTime = computePreAdhanReminderTime(prayerTime, offsetMinutes);
      if (reminderTime.getTime() <= now.getTime()) continue;

      const displayTime = formatHHMM(time, timeFormat);
      const { title, body } = buildPreAdhanReminderContent(prayer, displayTime, offsetMinutes, locale);

      await Notifications.scheduleNotificationAsync({
        identifier: `${PRE_ADHAN_REMINDER_PREFIX}${reminderTime.toISOString().slice(0, 10)}-${prayer}`,
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
      });
    }
  }
}
