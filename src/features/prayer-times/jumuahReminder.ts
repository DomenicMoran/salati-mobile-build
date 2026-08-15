// Freitags-Erinnerung ans Jumu'ah-Gebet + Sunnah-Hinweis, Sure Al-Kahf zu
// lesen (Zeitfenster dafür ist eigentlich Donnerstag-Maghrib bis Freitag-
// Maghrib, aber ein Vormittags-/Vor-Dhuhr-Impuls trifft die meisten Nutzer
// noch rechtzeitig vor dem Gebet selbst). Zeitpunkt bewusst RELATIV zu
// Dhuhr (nicht eine feste Uhrzeit wie z. B. bei den Adhkar-Erinnerungen):
// Dhuhr verschiebt sich übers Jahr um bis zu ~1h, eine feste Uhrzeit würde
// mal deutlich zu früh, mal zu knapp vor dem Gebet liegen. 90 Minuten
// Vorlauf geben genug Zeit für Ghusl/den Weg zur Moschee UND noch die
// Al-Kahf-Lektüre davor.
//
// Eigener, fester Notification-Identifier (kein Prefix-Mehrtage-Fenster wie
// bei den Gebetszeiten) — es gibt nur einen einzigen anstehenden Freitag zu
// planen, das rollierende Mehrtage-Fenster wäre hier unnötige Komplexität.
// Selbstheilung: wird zusammen mit den Gebetszeiten-Notifications bei jedem
// Besuch des Start-Tabs neu geplant (s. prayer-times-screen.tsx), findet
// dabei den nächsten Freitag im ohnehin schon geladenen 7-Tage-Fenster.
import { Platform } from 'react-native';

import { quranAyahDeepLink } from '@/lib/deepLinks';
import type { DayTimings } from './notifications';
import { formatHHMM, parseTimeOn, type TimeFormat } from './next-prayer';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole (Push-Token-Listener) — Guard-require wie in zakat/reminder.ts.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const JUMUAH_REMINDER_NOTIFICATION_ID = 'salatibox-jumuah-reminder';

/** Vorlauf vor Dhuhr (Freitag) in Minuten — Begründung s. Datei-Kommentar. */
export const JUMUAH_REMINDER_OFFSET_MINUTES = 90;

/** Sure Al-Kahf (18), Deep-Link öffnet den Reader am ersten Vers. */
export const AL_KAHF_SURAH = 18;

const JUMUAH_REMINDER_TEXT: Record<string, { title: string; body: string }> = {
  de: {
    title: 'Jumu’ah heute',
    body: 'Dhuhr (Jumu’ah) ist um {time} — eine gute Gelegenheit, vorher Sure Al-Kahf zu lesen (Sunnah am Freitag).',
  },
  en: {
    title: 'Jumu’ah today',
    body: 'Dhuhr (Jumu’ah) is at {time} — a good moment to read Surah Al-Kahf beforehand (a Friday sunnah).',
  },
  tr: {
    title: 'Bugün Cuma',
    body: 'Öğle (Cuma) namazı saat {time} — öncesinde Kehf sûresini okumak için güzel bir fırsat (Cuma sünneti).',
  },
  ar: {
    title: 'الجمعة اليوم',
    body: 'صلاة الظهر (الجمعة) الساعة {time} — فرصة جيدة لقراءة سورة الكهف قبلها (سنة يوم الجمعة).',
  },
  es: {
    title: 'Yumu’ah hoy',
    body: 'El Duhr (Yumu’ah) es a las {time} — un buen momento para leer la Sura Al-Kahf antes (sunna del viernes).',
  },
  fr: {
    title: 'Joumou’ah aujourd’hui',
    body: 'Le Dhouhr (Joumou’ah) est à {time} — un bon moment pour lire la sourate Al-Kahf avant (sunna du vendredi).',
  },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und bekamen über
  // `?? JUMUAH_REMINDER_TEXT.de` eine DEUTSCHE Erinnerung — hier vollständig.
  id: {
    title: 'Jumat hari ini',
    body: 'Zuhur (Jumat) pukul {time} — saat yang baik untuk membaca Surah Al-Kahf sebelumnya (sunnah hari Jumat).',
  },
  ms: {
    title: 'Jumaat hari ini',
    body: 'Zohor (Jumaat) pukul {time} — masa yang baik untuk membaca Surah Al-Kahf sebelumnya (sunnah hari Jumaat).',
  },
  bn: {
    title: 'আজ জুমুআ',
    body: 'জোহর (জুমুআ) {time}-এ — এর আগে সূরা আল-কাহফ পড়ার উত্তম সময় (শুক্রবারের সুন্নত)।',
  },
  ur: {
    title: 'آج جمعہ ہے',
    body: 'ظہر (جمعہ) {time} بجے ہے — اس سے پہلے سورہ الکہف پڑھنے کا اچھا موقع ہے (جمعہ کی سنت)۔',
  },
  fa: {
    title: 'امروز جمعه است',
    body: 'ظهر (جمعه) ساعت {time} است — فرصت خوبی برای خواندن سوره کهف پیش از آن (سنت روز جمعه).',
  },
  ru: {
    title: 'Сегодня джума',
    body: 'Зухр (джума) в {time} — хороший момент, чтобы перед этим прочитать суру «Аль-Кахф» (пятничная сунна).',
  },
  sw: {
    title: 'Ijumaa leo',
    body: 'Adhuhuri (Ijumaa) ni saa {time} — wakati mzuri wa kusoma Sura Al-Kahf kabla yake (sunna ya Ijumaa).',
  },
  ps: {
    title: 'نن جمعه ده',
    body: 'ماسپښین (جمعه) په {time} دی — تر هغه مخکې د الکهف سورت لوستلو ښه فرصت دی (د جمعې سنت).',
  },
};

/**
 * Baut Titel/Text der Jumu'ah-Erinnerung — reine Funktion, separat testbar.
 */
export function buildJumuahReminderContent(
  locale: string,
  displayTime: string,
): { title: string; body: string; data: { deepLink: string } } {
  const text = JUMUAH_REMINDER_TEXT[locale] ?? JUMUAH_REMINDER_TEXT.de;
  return {
    title: text.title,
    body: text.body.replace('{time}', displayTime),
    data: { deepLink: quranAyahDeepLink(AL_KAHF_SURAH, 1) },
  };
}

/**
 * Zeitpunkt der Erinnerung: `JUMUAH_REMINDER_OFFSET_MINUTES` vor Dhuhr am
 * gegebenen Freitag. Reine Funktion (kein Notifications-Zugriff).
 */
export function computeJumuahReminderTime(dhuhrHHMM: string, friday: Date): Date {
  const dhuhr = parseTimeOn(dhuhrHHMM, friday);
  return new Date(dhuhr.getTime() - JUMUAH_REMINDER_OFFSET_MINUTES * 60_000);
}

/**
 * Sucht in `days` den nächsten Freitag, dessen Erinnerungszeitpunkt noch in
 * der Zukunft liegt (strikt nach `now`). `getDay() === 5` ist JS-Standard
 * (Sonntag = 0 ... Freitag = 5), unabhängig von Locale/Gebietsschema.
 */
export function findNextJumuah(days: DayTimings[], now: Date): DayTimings | null {
  return (
    days.find((d) => {
      if (d.date.getDay() !== 5) return false;
      if (!d.timings.Dhuhr) return false;
      return computeJumuahReminderTime(d.timings.Dhuhr, d.date).getTime() > now.getTime();
    }) ?? null
  );
}

/**
 * Plant (bzw. entfernt) die Jumu'ah-Erinnerung. Muss nach jeder Einstellungs-
 * änderung sowie bei jedem Besuch des Start-Tabs erneut aufgerufen werden
 * (gleiches Selbstheil-Muster wie die übrigen prayer-times-Erinnerungen).
 */
export async function rescheduleJumuahReminder(
  days: DayTimings[],
  enabled: boolean,
  now: Date = new Date(),
  locale: string = 'de',
  timeFormat: TimeFormat = '24h',
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return; // kein Scheduling-Support, s. prayer-times/notifications.ts
  await Notifications.cancelScheduledNotificationAsync(JUMUAH_REMINDER_NOTIFICATION_ID).catch(() => {});
  if (!enabled) return;

  const friday = findNextJumuah(days, now);
  if (!friday) return;

  const displayTime = formatHHMM(friday.timings.Dhuhr, timeFormat);
  const { title, body, data } = buildJumuahReminderContent(locale, displayTime);
  const date = computeJumuahReminderTime(friday.timings.Dhuhr, friday.date);

  await Notifications.scheduleNotificationAsync({
    identifier: JUMUAH_REMINDER_NOTIFICATION_ID,
    content: { title, body, sound: true, data },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}
