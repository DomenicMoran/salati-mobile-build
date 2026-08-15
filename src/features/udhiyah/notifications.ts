// Saisonale Udhiyah/Qurbani-Erinnerung: einmalige lokale Notification ein
// paar Tage vor Eid al-Adha (Datums-Herleitung s. eidAdha.ts), damit das
// Opfertier rechtzeitig organisiert werden kann. Anders als die tägliche
// Vers/Hadith-Erinnerung (verseOfDay/notifications.ts) kein rollierendes
// Mehrtage-Fenster nötig — es gibt nur einen Termin pro Hijri-Jahr, fester
// Notification-Identifier + Neuplanen genügt (analog zu
// weeklySummary/notifications.ts). Default AUS (Opt-in wie alle anderen
// optionalen Erinnerungen), da nicht jeder Nutzer Udhiyah verrichtet.
import { Platform } from 'react-native';

import { udhiyahReminderDate } from './eidAdha';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole (Push-Token-Listener) — Guard-require wie in verseOfDay/notifications.ts.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const UDHIYAH_NOTIFICATION_ID = 'salatibox-udhiyah-reminder';

const UDHIYAH_TEXT: Record<string, { title: string; body: string }> = {
  de: {
    title: 'Udhiyah / Qurbani',
    body: 'Eid al-Adha steht bevor — jetzt ein gutes Zeitfenster, das Opfertier zu organisieren.',
  },
  en: {
    title: 'Udhiyah / Qurbani',
    body: 'Eid al-Adha is approaching — a good time to arrange your sacrifice (udhiyah).',
  },
  tr: {
    title: 'Udhiyye / Kurban',
    body: 'Kurban Bayramı yaklaşıyor — kurbanlığınızı ayarlamak için iyi bir zaman.',
  },
  ar: {
    title: 'الأضحية / القربان',
    body: 'يقترب عيد الأضحى — وقت مناسب لترتيب أضحيتك.',
  },
  es: {
    title: 'Udhiyah / Qurbani',
    body: 'Se acerca el Eid al-Adha — buen momento para organizar tu sacrificio (udhiyah).',
  },
  fr: {
    title: 'Udhiyah / Qurbani',
    body: "L'Aïd al-Adha approche — un bon moment pour organiser ton sacrifice (udhiyah).",
  },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und fielen über
  // `?? UDHIYAH_TEXT.de` auf DEUTSCH zurück — hier vollständig.
  id: {
    title: 'Udhiyah / Kurban',
    body: 'Iduladha sudah dekat — saat yang baik untuk mengatur hewan kurbanmu.',
  },
  ms: {
    title: 'Udhiyah / Korban',
    body: 'Aidiladha semakin hampir — masa yang baik untuk menguruskan haiwan korbanmu.',
  },
  bn: {
    title: 'উদহিয়া / কুরবানি',
    body: 'ঈদুল আজহা ঘনিয়ে আসছে — কুরবানির পশুর ব্যবস্থা করার উপযুক্ত সময়।',
  },
  ur: {
    title: 'اضحیہ / قربانی',
    body: 'عید الاضحیٰ قریب ہے — قربانی کا جانور بندوبست کرنے کا اچھا وقت ہے۔',
  },
  fa: {
    title: 'اضحیه / قربانی',
    body: 'عید قربان نزدیک است — فرصت خوبی برای تدارک قربانی‌ات.',
  },
  ru: {
    title: 'Удхия / курбан',
    body: 'Приближается Ид аль-Адха — подходящее время позаботиться о жертвенном животном.',
  },
  sw: {
    title: 'Udhiyah / Qurbani',
    body: 'Idd al-Adha inakaribia — wakati mzuri wa kupanga kafara yako (udhiyah).',
  },
  ps: {
    title: 'اضحیه / قرباني',
    body: 'د لوی اختر ورځې نږدې دي — د قرباني د څاروي د برابرولو ښه وخت دی.',
  },
};

/**
 * Baut Titel/Text der Udhiyah-Erinnerung — reine Funktion (kein
 * Notifications-Zugriff), daher separat testbar.
 */
export function buildUdhiyahNotificationContent(locale: string): { title: string; body: string } {
  return UDHIYAH_TEXT[locale] ?? UDHIYAH_TEXT.de;
}

/**
 * Plant (bzw. entfernt) die einmalige Udhiyah/Qurbani-Erinnerung vor dem
 * nächsten Eid al-Adha. Muss nach jeder Einstellungsänderung sowie
 * regelmäßig bei App-Besuch neu aufgerufen werden (Selbstheilung, analog zu
 * den anderen optionalen Erinnerungen) — sobald das aktuelle Eid al-Adha
 * vorbei ist, plant der nächste Aufruf automatisch für das kommende Jahr.
 */
export async function rescheduleUdhiyahReminder(
  enabled: boolean,
  locale: string = 'de',
  now: Date = new Date(),
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return; // kein Scheduling-Support, s. prayer-times/notifications.ts

  await Notifications.cancelScheduledNotificationAsync(UDHIYAH_NOTIFICATION_ID).catch(() => {});
  if (!enabled) return;

  const reminderDate = udhiyahReminderDate(now);
  if (!reminderDate) return;

  const { title, body } = buildUdhiyahNotificationContent(locale);

  await Notifications.scheduleNotificationAsync({
    identifier: UDHIYAH_NOTIFICATION_ID,
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
  });
}
