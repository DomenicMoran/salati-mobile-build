import * as Notifications from 'expo-notifications';

import type { ReviewReminderHour } from '@/features/settings/types';

// Tägliche Erinnerung an fällige Wiederholungen (Spaced-Repetition-System in
// review.ts). Bewusst ein eigener, fester Notification-Identifier statt
// cancelAllScheduledNotificationsAsync() wie bei den Gebetszeiten-Notifications
// (prayer-times/notifications.ts) — sonst würde jede Neuplanung dieser
// Erinnerung alle bereits geplanten Gebetszeiten-Notifications mit löschen
// und umgekehrt. Reines Umschalten (cancel + optional neu planen), kein
// dynamischer Fälligkeits-Zähler im Text — der würde beim Planen im Voraus
// (DAILY-Trigger feuert danach jeden Tag mit demselben, einmal festgelegten
// Text) ohnehin sofort veralten. Der NAME der nächstfälligen Lektion ist
// dagegen unkritisch: rescheduleReviewReminder() wird bei jeder Neuplanung
// (App-Start/Foreground, siehe app/study/index.tsx) neu mit dem aktuellen
// Aufrufer-Kontext aufgerufen, plant also ohnehin komplett neu — der
// Lektionsname ist zu diesem Zeitpunkt taufrisch und wird bis zur nächsten
// Neuplanung (nicht bis zum nächsten Feuern) beibehalten.
export const REVIEW_REMINDER_NOTIFICATION_ID = 'salatibox-review-reminder';

/** Generischer Text ohne bekanntes fälliges Thema (z. B. keine Lektion fällig). */
const REVIEW_REMINDER_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Zeit für deine Wiederholung', body: 'Deine fälligen Lektionen warten — kurz auffrischen?' },
  en: { title: 'Time to review', body: 'Your due lessons are waiting — quick refresh?' },
  tr: { title: 'Tekrar zamanı', body: 'Vadesi gelen dersler seni bekliyor — kısa bir tekrar yapalım mı?' },
  ar: { title: 'حان وقت المراجعة', body: 'دروسك المستحقة بانتظارك — مراجعة سريعة؟' },
  es: { title: 'Hora de repasar', body: 'Tus lecciones pendientes te esperan — ¿un repaso rápido?' },
  fr: { title: 'C’est l’heure de réviser', body: 'Tes leçons dues t’attendent — une petite révision ?' },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten in beiden Tabellen und
  // fielen über `?? ....de` auf DEUTSCH zurück — hier vollständig.
  id: { title: 'Waktunya mengulang', body: 'Pelajaran yang jatuh tempo menunggumu — mau menyegarkan sebentar?' },
  ms: { title: 'Masa untuk mengulang kaji', body: 'Pelajaran yang perlu diulang menunggumu — mahu ulang sebentar?' },
  bn: { title: 'পুনরাবৃত্তির সময়', body: 'আপনার নির্ধারিত পাঠ অপেক্ষা করছে — একটু ঝালিয়ে নেবেন?' },
  ur: { title: 'دہرانے کا وقت', body: 'آپ کے واجب سبق منتظر ہیں — تھوڑا دہرا لیں؟' },
  fa: { title: 'وقت مرور است', body: 'درس‌های سررسیده‌ات منتظرند — یک مرور کوتاه؟' },
  ru: { title: 'Пора повторить', body: 'Уроки к повторению ждут — быстро освежим?' },
  sw: { title: 'Wakati wa kurudia', body: 'Masomo yaliyofika muda wake yanakusubiri — turudie kidogo?' },
  ps: { title: 'د تکرار وخت', body: 'ستا رارسېدلي درسونه انتظار کوي — یو لنډ تکرار؟' },
};

/** Text mit Platzhalter {topic} — genutzt sobald der Name der nächstfälligen Lektion bekannt ist. */
const REVIEW_REMINDER_TEXT_WITH_TOPIC: Record<string, { title: string; body: string }> = {
  de: { title: 'Zeit für deine Wiederholung', body: 'Deine {topic}-Lektion wartet — kurz auffrischen?' },
  en: { title: 'Time to review', body: 'Your {topic} lesson is waiting — quick refresh?' },
  tr: { title: 'Tekrar zamanı', body: '"{topic}" dersin seni bekliyor — kısa bir tekrar yapalım mı?' },
  ar: { title: 'حان وقت المراجعة', body: 'درسك في "{topic}" بانتظارك — مراجعة سريعة؟' },
  es: { title: 'Hora de repasar', body: 'Tu lección de {topic} te espera — ¿un repaso rápido?' },
  fr: { title: 'C’est l’heure de réviser', body: 'Ta leçon de {topic} t’attend — une petite révision ?' },
  id: { title: 'Waktunya mengulang', body: 'Pelajaran "{topic}"-mu menunggu — mau menyegarkan sebentar?' },
  ms: { title: 'Masa untuk mengulang kaji', body: 'Pelajaran "{topic}" kamu menunggu — mahu ulang sebentar?' },
  bn: { title: 'পুনরাবৃত্তির সময়', body: 'আপনার "{topic}" পাঠ অপেক্ষা করছে — একটু ঝালিয়ে নেবেন?' },
  ur: { title: 'دہرانے کا وقت', body: 'آپ کا "{topic}" کا سبق منتظر ہے — تھوڑا دہرا لیں؟' },
  fa: { title: 'وقت مرور است', body: 'درس «{topic}» تو منتظر است — یک مرور کوتاه؟' },
  ru: { title: 'Пора повторить', body: 'Урок «{topic}» ждёт — быстро освежим?' },
  sw: { title: 'Wakati wa kurudia', body: 'Somo lako la "{topic}" linakusubiri — turudie kidogo?' },
  ps: { title: 'د تکرار وخت', body: 'ستا د «{topic}» درس انتظار کوي — یو لنډ تکرار؟' },
};

/**
 * Baut Titel/Text der Erinnerung. Reine Funktion (ohne Notifications-API),
 * daher separat testbar. Mit topicName → konkreter Lektionsname im Text
 * ({topic}-Platzhalter per String-Replace), ohne (bzw. bei leerem/nur
 * Whitespace-String) → generischer Fallback-Text.
 */
export function buildReviewReminderContent(
  locale: string,
  topicName?: string,
): { title: string; body: string } {
  const trimmedTopic = topicName?.trim();
  if (trimmedTopic) {
    const text = REVIEW_REMINDER_TEXT_WITH_TOPIC[locale] ?? REVIEW_REMINDER_TEXT_WITH_TOPIC.de;
    return { title: text.title, body: text.body.replace('{topic}', trimmedTopic) };
  }
  const text = REVIEW_REMINDER_TEXT[locale] ?? REVIEW_REMINDER_TEXT.de;
  return { title: text.title, body: text.body };
}

/**
 * Plant (bzw. entfernt) die tägliche Wiederholungs-Erinnerung. Muss nach
 * jeder Einstellungsänderung (enabled/hour) erneut aufgerufen werden —
 * plant unter demselben Identifier neu, ersetzt also die alte Planung.
 *
 * topicName: Name der nächstfälligen Lektion/des nächstfälligen Themas
 * (z. B. via dueCandidates() + lessonTitle() ermittelt vom Aufrufer). Wird
 * in den Text eingesetzt, damit die Erinnerung bei jeder Neuplanung
 * konkreten statt generischen Inhalt zeigt (siehe Kommentar oben).
 */
export async function rescheduleReviewReminder(
  enabled: boolean,
  hour: ReviewReminderHour,
  locale: string = 'de',
  topicName?: string,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REVIEW_REMINDER_NOTIFICATION_ID);
  if (!enabled) return;

  const text = buildReviewReminderContent(locale, topicName);
  await Notifications.scheduleNotificationAsync({
    identifier: REVIEW_REMINDER_NOTIFICATION_ID,
    content: {
      title: text.title,
      body: text.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}
