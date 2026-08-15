import * as Notifications from 'expo-notifications';

// Tägliche Morgen-/Abend-Adhkar-Erinnerungen — eigene, feste Identifier
// (siehe Kommentar in study/reviewNotifications.ts: niemals cancelAll).
// DAILY-Trigger wiederholen sich selbst und belegen je genau 1 iOS-Slot.
export const ADHKAR_MORNING_ID = 'salatibox-adhkar-morning';
export const ADHKAR_EVENING_ID = 'salatibox-adhkar-evening';

// ALLE 14 App-Sprachen (SUPPORTED_LOCALES, s. lib/locale-detect.ts) — die
// Tabelle deckte bis zum Audit 2026-07-27 nur 6 ab, die restlichen 8
// (id/bn/fa/ms/ur/ru/sw/ps) bekamen über den `?? TEXT.de`-Fallback eine
// DEUTSCHE Benachrichtigung. Neue Sprachen müssen hier mit ergänzt werden;
// adhkarNotifications.test.ts erzwingt das.
const TEXT: Record<string, { morning: { title: string; body: string }; evening: { title: string; body: string } }> = {
  de: {
    morning: { title: 'Morgen-Adhkar', body: 'Beginne deinen Tag mit den Morgen-Bittgebeten.' },
    evening: { title: 'Abend-Adhkar', body: 'Schließe deinen Tag mit den Abend-Bittgebeten ab.' },
  },
  en: {
    morning: { title: 'Morning adhkar', body: 'Start your day with the morning supplications.' },
    evening: { title: 'Evening adhkar', body: 'End your day with the evening supplications.' },
  },
  tr: {
    morning: { title: 'Sabah zikirleri', body: 'Güne sabah zikirleriyle başla.' },
    evening: { title: 'Akşam zikirleri', body: 'Günü akşam zikirleriyle tamamla.' },
  },
  ar: {
    morning: { title: 'أذكار الصباح', body: 'ابدأ يومك بأذكار الصباح.' },
    evening: { title: 'أذكار المساء', body: 'اختم يومك بأذكار المساء.' },
  },
  es: {
    morning: { title: 'Adhkar de la mañana', body: 'Comienza tu día con las súplicas de la mañana.' },
    evening: { title: 'Adhkar de la tarde', body: 'Termina tu día con las súplicas de la tarde.' },
  },
  fr: {
    morning: { title: 'Adhkar du matin', body: 'Commence ta journée avec les invocations du matin.' },
    evening: { title: 'Adhkar du soir', body: 'Termine ta journée avec les invocations du soir.' },
  },
  id: {
    morning: { title: 'Dzikir pagi', body: 'Awali harimu dengan dzikir pagi.' },
    evening: { title: 'Dzikir petang', body: 'Akhiri harimu dengan dzikir petang.' },
  },
  ms: {
    morning: { title: 'Zikir pagi', body: 'Mulakan harimu dengan zikir pagi.' },
    evening: { title: 'Zikir petang', body: 'Akhiri harimu dengan zikir petang.' },
  },
  bn: {
    morning: { title: 'সকালের যিকির', body: 'সকালের দোয়া দিয়ে আপনার দিন শুরু করুন।' },
    evening: { title: 'সন্ধ্যার যিকির', body: 'সন্ধ্যার দোয়া দিয়ে আপনার দিন শেষ করুন।' },
  },
  ur: {
    morning: { title: 'صبح کے اذکار', body: 'اپنے دن کا آغاز صبح کی دعاؤں سے کریں۔' },
    evening: { title: 'شام کے اذکار', body: 'اپنے دن کا اختتام شام کی دعاؤں سے کریں۔' },
  },
  fa: {
    morning: { title: 'اذکار صبح', body: 'روزت را با اذکار صبح آغاز کن.' },
    evening: { title: 'اذکار شام', body: 'روزت را با اذکار شام به پایان برسان.' },
  },
  ru: {
    morning: { title: 'Утренние азкары', body: 'Начни день с утренних поминаний.' },
    evening: { title: 'Вечерние азкары', body: 'Заверши день вечерними поминаниями.' },
  },
  sw: {
    morning: { title: 'Adhkari za asubuhi', body: 'Anza siku yako kwa dua za asubuhi.' },
    evening: { title: 'Adhkari za jioni', body: 'Maliza siku yako kwa dua za jioni.' },
  },
  ps: {
    morning: { title: 'د سهار اذکار', body: 'خپله ورځ د سهار په دعاګانو پیل کړه.' },
    evening: { title: 'د ماښام اذکار', body: 'خپله ورځ د ماښام په دعاګانو پای ته ورسوه.' },
  },
};

/**
 * Titel/Text beider Adhkar-Erinnerungen in der App-Sprache — reine Funktion
 * (kein Notifications-Zugriff), daher separat testbar (gleiches Muster wie
 * buildJumuahReminderContent/buildUdhiyahNotificationContent).
 */
export function buildAdhkarReminderContent(locale: string): {
  morning: { title: string; body: string };
  evening: { title: string; body: string };
} {
  return TEXT[locale] ?? TEXT.de;
}

async function rescheduleOne(
  id: string,
  enabled: boolean,
  hour: number,
  text: { title: string; body: string },
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title: text.title, body: text.body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}

/** Beide Adhkar-Erinnerungen entsprechend den Einstellungen neu planen. */
export async function rescheduleAdhkarReminders(opts: {
  morningEnabled: boolean;
  morningHour: number;
  eveningEnabled: boolean;
  eveningHour: number;
  locale: string;
}): Promise<void> {
  const text = buildAdhkarReminderContent(opts.locale);
  await rescheduleOne(ADHKAR_MORNING_ID, opts.morningEnabled, opts.morningHour, text.morning);
  await rescheduleOne(ADHKAR_EVENING_ID, opts.eveningEnabled, opts.eveningHour, text.evening);
}
