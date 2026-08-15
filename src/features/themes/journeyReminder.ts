// Tägliche Erinnerung für aktive Themen-Leseplaene (journeys.ts): EINE
// wiederkehrende Notification (DAILY-Trigger, wie adhkarNotifications.ts),
// solange mindestens eine Reise aktiv und noch nicht abgeschlossen ist.
// Anders als bei Khatmah/Zakat (Datums-Trigger für ein einzelnes Ereignis)
// gibt es hier potenziell mehrere aktive Reisen gleichzeitig - die Erinnerung
// bleibt bewusst generisch ("du hast eine Reise offen") statt pro Reise eine
// eigene Notification zu belegen (iOS begrenzt die Zahl geplanter lokaler
// Notifications).
import { Platform } from 'react-native';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole (Push-Token-Listener) — Guard-require wie in app/_layout.tsx.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const JOURNEY_REMINDER_ID = 'salatibox-journey-reminder';

/** 19:00 lokale Zeit - Feierabend-Moment, analog zur Abend-Adhkar-Stunde. */
export const JOURNEY_REMINDER_HOUR = 19;

const JOURNEY_REMINDER_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Tages-Plan', body: 'Du hast heute noch einen Tag in deiner Vers-Reise offen.' },
  en: { title: 'Day plan', body: 'You still have a day open in your verse journey today.' },
  tr: { title: 'Günlük plan', body: 'Bugün ayet yolculuğunda henüz açık bir günün var.' },
  ar: { title: 'خطة اليوم', body: 'ما زال لديك يوم مفتوح في رحلة الآيات اليوم.' },
  es: { title: 'Plan diario', body: 'Todavía tienes un día pendiente en tu recorrido de versículos.' },
  fr: { title: 'Plan du jour', body: 'Il te reste un jour à faire dans ton parcours de versets aujourd’hui.' },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und fielen über
  // `?? JOURNEY_REMINDER_TEXT.de` auf DEUTSCH zurück — hier vollständig.
  id: { title: 'Rencana harian', body: 'Masih ada satu hari yang terbuka dalam perjalanan ayatmu hari ini.' },
  ms: { title: 'Rancangan harian', body: 'Masih ada satu hari yang terbuka dalam perjalanan ayatmu hari ini.' },
  bn: { title: 'দিনের পরিকল্পনা', body: 'আজ আপনার আয়াত-যাত্রায় একটি দিন এখনও বাকি আছে।' },
  ur: { title: 'آج کا منصوبہ', body: 'آج آپ کے آیات کے سفر میں ایک دن ابھی باقی ہے۔' },
  fa: { title: 'برنامهٔ امروز', body: 'امروز هنوز یک روز از سفر آیات تو باقی مانده است.' },
  ru: { title: 'План на день', body: 'Сегодня в твоём пути по аятам остался незакрытый день.' },
  sw: { title: 'Mpango wa siku', body: 'Bado una siku ambayo haijakamilika katika safari yako ya aya leo.' },
  ps: { title: 'د ورځې پلان', body: 'نن ستا د آیتونو په سفر کې لا یوه ورځ پاتې ده.' },
};

/**
 * Plant (bzw. entfernt) die tägliche Reise-Erinnerung. Muss nach jeder
 * Änderung an Start/Fortschritt/Abschluss einer Reise sowie bei jedem
 * Screen-Fokus erneut aufgerufen werden (kein Server, keine Background-
 * Task - Selbstheilung beim nächsten App-Besuch, gleiches Muster wie
 * zakat/reminder.ts und prayer-times/notifications.ts).
 */
/** Titel/Text der Reise-Erinnerung — reine Funktion, separat testbar. */
export function buildJourneyReminderContent(locale: string): { title: string; body: string } {
  return JOURNEY_REMINDER_TEXT[locale] ?? JOURNEY_REMINDER_TEXT.de;
}

export async function rescheduleJourneyReminder(
  hasActiveIncompleteJourney: boolean,
  enabled: boolean,
  locale: string = 'de',
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return; // kein Scheduling-Support, s. prayer-times/notifications.ts
  await Notifications.cancelScheduledNotificationAsync(JOURNEY_REMINDER_ID).catch(() => {});
  if (!enabled || !hasActiveIncompleteJourney) return;

  const text = buildJourneyReminderContent(locale);
  await Notifications.scheduleNotificationAsync({
    identifier: JOURNEY_REMINDER_ID,
    content: { title: text.title, body: text.body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: JOURNEY_REMINDER_HOUR,
      minute: 0,
    },
  });
}
