// Wöchentliche Zusammenfassungs-Erinnerung: kurzer, motivierender Rückblick
// ("X Lektionen abgeschlossen", "Y Tage mit allen 5 Gebeten") aus den letzten
// 7 Tagen (stats.ts). Eigener, fester Notification-Identifier + WEEKLY-
// Trigger (kein rollierendes Mehrtage-Fenster wie bei den Gebetszeiten
// nötig — es gibt nur einen wiederkehrenden Termin pro Woche), analog zu
// reviewNotifications.ts (DAILY, fester Identifier statt cancelAll).
//
// Zeitpunkt: Sonntagabend 20 Uhr statt Montagmorgen — bewusste Wahl:
// 1) Die zugrunde liegenden 7-Tage-Fenster (computeWeeklyReview,
//    computeFullPrayerDays) sind rollierend und am Sonntagabend bereits
//    "voll" (die ganze zurückliegende Woche ist erfasst), ein Montagmorgen-
//    Termin würde denselben Inhalt zeigen, aber erst ~12h später.
// 2) Montagmorgen ist für die meisten Nutzer der hektischste Moment der
//    Woche (Arbeits-/Schulstart) — eine zusätzliche Notification dort
//    widerspricht der "nicht nerven"-Philosophie (s. reviewReminder/
//    verseOfDay: alle optionalen Erinnerungen sind bewusst Opt-in, Default
//    aus). Sonntagabend ist der ruhigere, rückblickende Moment.
//
// WEEKLY-Trigger legt den Text (wie bei DAILY) einmal beim Scheduling fest
// — Selbstheilung durch regelmäßiges Neuplanen bei App-Besuch (analog zu
// reviewReminder in app/study/index.tsx), s. Aufrufer in
// components/prayer-times-screen.tsx.
import * as Notifications from 'expo-notifications';

import { loadWeeklySummaryStats, type WeeklySummaryStats } from './stats';

export const WEEKLY_SUMMARY_NOTIFICATION_ID = 'salatibox-weekly-summary';

/** expo-notifications: Wochentage 1-7, 1 = Sonntag. */
export const WEEKLY_SUMMARY_WEEKDAY = 1;
export const WEEKLY_SUMMARY_HOUR = 20;

const WEEKLY_SUMMARY_TEXT: Record<
  string,
  { title: string; both: string; lessonsOnly: string; prayersOnly: string; empty: string }
> = {
  de: {
    title: 'Deine Woche im Rückblick',
    both: 'Diese Woche: {lessons} Lektionen abgeschlossen und {days} Tage mit allen 5 Gebeten. Weiter so!',
    lessonsOnly: 'Diese Woche hast du {lessons} Lektionen abgeschlossen. Weiter so!',
    prayersOnly: 'Diese Woche hattest du {days} Tage mit allen 5 Gebeten. Weiter so!',
    empty: 'Eine neue Woche beginnt — ein guter Moment für ein paar Lektionen oder Dhikr.',
  },
  en: {
    title: 'Your week in review',
    both: 'This week: {lessons} lessons completed and {days} days with all 5 prayers. Keep it up!',
    lessonsOnly: 'This week you completed {lessons} lessons. Keep it up!',
    prayersOnly: 'This week you had {days} days with all 5 prayers. Keep it up!',
    empty: 'A new week is starting — a good moment for a lesson or some dhikr.',
  },
  tr: {
    title: 'Haftanın özeti',
    both: 'Bu hafta: {lessons} ders tamamladın ve {days} gün 5 vakit namazı eksiksiz kıldın. Böyle devam!',
    lessonsOnly: 'Bu hafta {lessons} ders tamamladın. Böyle devam!',
    prayersOnly: 'Bu hafta {days} gün 5 vakit namazı eksiksiz kıldın. Böyle devam!',
    empty: 'Yeni bir hafta başlıyor — birkaç ders veya zikir için güzel bir an.',
  },
  ar: {
    title: 'ملخص أسبوعك',
    both: 'هذا الأسبوع: أتممت {lessons} دروس وحافظت على الصلوات الخمس في {days} أيام. واصل!',
    lessonsOnly: 'أتممت هذا الأسبوع {lessons} دروس. واصل!',
    prayersOnly: 'حافظت هذا الأسبوع على الصلوات الخمس في {days} أيام. واصل!',
    empty: 'أسبوع جديد يبدأ — لحظة مناسبة لدرس أو بعض الذكر.',
  },
  es: {
    title: 'Tu semana en resumen',
    both: 'Esta semana: {lessons} lecciones completadas y {days} días con las 5 oraciones. ¡Sigue así!',
    lessonsOnly: 'Esta semana completaste {lessons} lecciones. ¡Sigue así!',
    prayersOnly: 'Esta semana tuviste {days} días con las 5 oraciones. ¡Sigue así!',
    empty: 'Empieza una nueva semana — un buen momento para una lección o dhikr.',
  },
  fr: {
    title: 'Ta semaine en résumé',
    both: 'Cette semaine : {lessons} leçons terminées et {days} jours avec les 5 prières. Continue ainsi !',
    lessonsOnly: 'Cette semaine, tu as terminé {lessons} leçons. Continue ainsi !',
    prayersOnly: 'Cette semaine, tu as eu {days} jours avec les 5 prières. Continue ainsi !',
    empty: 'Une nouvelle semaine commence — un bon moment pour une leçon ou du dhikr.',
  },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und fielen über
  // `?? WEEKLY_SUMMARY_TEXT.de` auf DEUTSCH zurück — hier vollständig.
  id: {
    title: 'Ringkasan pekanmu',
    both: 'Pekan ini: {lessons} pelajaran selesai dan {days} hari dengan 5 waktu salat lengkap. Pertahankan!',
    lessonsOnly: 'Pekan ini kamu menyelesaikan {lessons} pelajaran. Pertahankan!',
    prayersOnly: 'Pekan ini kamu punya {days} hari dengan 5 waktu salat lengkap. Pertahankan!',
    empty: 'Pekan baru dimulai — saat yang baik untuk satu pelajaran atau berzikir.',
  },
  ms: {
    title: 'Ringkasan mingguanmu',
    both: 'Minggu ini: {lessons} pelajaran selesai dan {days} hari dengan 5 waktu solat lengkap. Teruskan!',
    lessonsOnly: 'Minggu ini kamu menyelesaikan {lessons} pelajaran. Teruskan!',
    prayersOnly: 'Minggu ini kamu ada {days} hari dengan 5 waktu solat lengkap. Teruskan!',
    empty: 'Minggu baharu bermula — masa yang baik untuk satu pelajaran atau berzikir.',
  },
  bn: {
    title: 'আপনার সপ্তাহের সারসংক্ষেপ',
    both: 'এই সপ্তাহে: {lessons}টি পাঠ শেষ এবং {days} দিন পাঁচ ওয়াক্ত নামাজ পূর্ণ। চালিয়ে যান!',
    lessonsOnly: 'এই সপ্তাহে আপনি {lessons}টি পাঠ শেষ করেছেন। চালিয়ে যান!',
    prayersOnly: 'এই সপ্তাহে {days} দিন আপনি পাঁচ ওয়াক্ত নামাজ পূর্ণ করেছেন। চালিয়ে যান!',
    empty: 'নতুন সপ্তাহ শুরু হচ্ছে — একটি পাঠ বা কিছু যিকিরের ভালো সময়।',
  },
  ur: {
    title: 'آپ کے ہفتے کا جائزہ',
    both: 'اس ہفتے: {lessons} اسباق مکمل اور {days} دن پانچوں نمازیں پوری۔ اسی طرح جاری رکھیں!',
    lessonsOnly: 'اس ہفتے آپ نے {lessons} اسباق مکمل کیے۔ اسی طرح جاری رکھیں!',
    prayersOnly: 'اس ہفتے آپ کے {days} دن پانچوں نمازوں کے ساتھ رہے۔ اسی طرح جاری رکھیں!',
    empty: 'نیا ہفتہ شروع ہو رہا ہے — ایک سبق یا کچھ ذکر کے لیے اچھا وقت۔',
  },
  fa: {
    title: 'مرور هفتهٔ تو',
    both: 'این هفته: {lessons} درس تمام شد و {days} روز هر پنج نماز کامل بود. همین‌طور ادامه بده!',
    lessonsOnly: 'این هفته {lessons} درس را تمام کردی. همین‌طور ادامه بده!',
    prayersOnly: 'این هفته {days} روز هر پنج نماز را کامل خواندی. همین‌طور ادامه بده!',
    empty: 'هفتهٔ تازه‌ای آغاز می‌شود — فرصت خوبی برای یک درس یا کمی ذکر.',
  },
  ru: {
    title: 'Итоги твоей недели',
    both: 'На этой неделе: {lessons} уроков пройдено и {days} дней со всеми 5 молитвами. Так держать!',
    lessonsOnly: 'На этой неделе ты прошёл {lessons} уроков. Так держать!',
    prayersOnly: 'На этой неделе у тебя {days} дней со всеми 5 молитвами. Так держать!',
    empty: 'Начинается новая неделя — хороший момент для урока или зикра.',
  },
  sw: {
    title: 'Muhtasari wa wiki yako',
    both: 'Wiki hii: masomo {lessons} yamekamilika na siku {days} zenye swala zote 5. Endelea hivyo!',
    lessonsOnly: 'Wiki hii umekamilisha masomo {lessons}. Endelea hivyo!',
    prayersOnly: 'Wiki hii ulikuwa na siku {days} zenye swala zote 5. Endelea hivyo!',
    empty: 'Wiki mpya inaanza — wakati mzuri wa somo au dhikri kidogo.',
  },
  ps: {
    title: 'ستا د اونۍ لنډیز',
    both: 'دا اونۍ: {lessons} درسونه بشپړ شول او {days} ورځې دې پنځه واړه لمونځونه ادا کړل. همداسې دوام ورکړه!',
    lessonsOnly: 'دا اونۍ دې {lessons} درسونه بشپړ کړل. همداسې دوام ورکړه!',
    prayersOnly: 'دا اونۍ دې {days} ورځې پنځه واړه لمونځونه ادا کړل. همداسې دوام ورکړه!',
    empty: 'نوې اونۍ پیلېږي — د یوه درس یا لږ ذکر لپاره ښه وخت.',
  },
};

/**
 * Baut Titel/Text der Wochenzusammenfassung — reine Funktion (kein
 * Notifications-Zugriff), daher separat testbar. Wählt je nachdem, was in
 * der Woche tatsächlich passiert ist, einen passenden Satz statt "0
 * Lektionen, 0 Tage" motivationslos anzuzeigen.
 */
export function buildWeeklySummaryContent(locale: string, stats: WeeklySummaryStats): { title: string; body: string } {
  const text = WEEKLY_SUMMARY_TEXT[locale] ?? WEEKLY_SUMMARY_TEXT.de;
  const { lessonsCompleted, fullPrayerDays } = stats;

  let body: string;
  if (lessonsCompleted > 0 && fullPrayerDays > 0) {
    body = text.both.replace('{lessons}', String(lessonsCompleted)).replace('{days}', String(fullPrayerDays));
  } else if (lessonsCompleted > 0) {
    body = text.lessonsOnly.replace('{lessons}', String(lessonsCompleted));
  } else if (fullPrayerDays > 0) {
    body = text.prayersOnly.replace('{days}', String(fullPrayerDays));
  } else {
    body = text.empty;
  }

  return { title: text.title, body };
}

/**
 * Plant (bzw. entfernt) die wöchentliche Zusammenfassungs-Erinnerung.
 * Lädt die aktuellen Kennzahlen selbst (stats.ts) — muss nach jeder
 * Einstellungsänderung sowie regelmäßig bei App-Besuch neu aufgerufen
 * werden, damit der eingebettete Text nicht veraltet (s. Datei-Kommentar).
 */
export async function rescheduleWeeklySummary(
  enabled: boolean,
  locale: string = 'de',
  now: Date = new Date(),
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_NOTIFICATION_ID).catch(() => {});
  if (!enabled) return;

  const stats = await loadWeeklySummaryStats(now);
  const { title, body } = buildWeeklySummaryContent(locale, stats);

  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_SUMMARY_NOTIFICATION_ID,
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: WEEKLY_SUMMARY_WEEKDAY,
      hour: WEEKLY_SUMMARY_HOUR,
      minute: 0,
    },
  });
}
