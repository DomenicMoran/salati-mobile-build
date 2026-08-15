// Tägliche "Vers/Hadith des Tages"-Erinnerung: rotierender, kuratierter Inhalt
// (pool.ts) statt fester Text — anders als zakat/reminder.ts, journeyReminder.ts
// & Co. kann eine native DAILY-Trigger-Notification den Text NICHT täglich
// wechseln (der Inhalt wird beim Planen einmal fest im OS hinterlegt). Deshalb
// hier dasselbe rollierende Mehrtage-Fenster wie bei den Gebetszeiten
// (prayer-times/notifications.ts): mehrere einzelne DATE-Trigger im Voraus,
// mit Prefix-Identifier für sauberes Neuplanen. Fensterbreite bewusst klein
// (3 Tage statt 7 wie bei den Gebeten) — jeder Tag braucht 1-2 Netzwerk-
// Requests (Vers-/Hadith-Text laden, s. content.ts), ein 7-Tage-Fenster wäre
// unnötig netzwerklastig für eine Notification pro Tag. Selbstheilung: wird
// bei jedem Besuch des Start-Tabs (prayer-times-screen.tsx, analog zu den
// Gebets-Notifications) und bei jeder Einstellungsänderung neu geplant.
import { Platform } from 'react-native';

import type { HadithLang } from '@/features/hadith/api';
import { truncateForShareCard } from '@/features/share/shareCardText';
import { resolveVerseOfDayContent, type VerseOfDayContent } from './content';
import { pickVerseOfDayRef, VERSE_OF_DAY_POOL, type VerseOfDayRef } from './pool';
import { parseTimeOn } from '@/features/prayer-times/next-prayer';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole (Push-Token-Listener) — Guard-require wie in app/_layout.tsx.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const VERSE_OF_DAY_NOTIFICATION_PREFIX = 'salatibox-verse-of-day-';
// Fensterbreite bewusst klein (3 Tage statt der 7 bei den Gebeten) — jeder Tag
// braucht 1-2 Netzwerk-Requests (Vers-/Hadith-Text laden, s. content.ts), ein
// 7-Tage-Fenster wäre unnötig netzwerklastig für eine Notification pro Tag.
export const VERSE_OF_DAY_WINDOW_DAYS = 3;

const NOTIFICATION_TITLE: Record<string, { verse: string; hadith: string }> = {
  de: { verse: 'Vers des Tages', hadith: 'Hadith des Tages' },
  en: { verse: 'Verse of the day', hadith: 'Hadith of the day' },
  tr: { verse: 'Günün ayeti', hadith: 'Günün hadisi' },
  ar: { verse: 'آية اليوم', hadith: 'حديث اليوم' },
  es: { verse: 'Versículo del día', hadith: 'Hadiz del día' },
  fr: { verse: 'Verset du jour', hadith: 'Hadith du jour' },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und fielen über
  // `?? NOTIFICATION_TITLE.de` auf DEUTSCH zurück — hier vollständig.
  id: { verse: 'Ayat hari ini', hadith: 'Hadis hari ini' },
  ms: { verse: 'Ayat hari ini', hadith: 'Hadis hari ini' },
  bn: { verse: 'আজকের আয়াত', hadith: 'আজকের হাদিস' },
  ur: { verse: 'آج کی آیت', hadith: 'آج کی حدیث' },
  fa: { verse: 'آیهٔ روز', hadith: 'حدیث روز' },
  ru: { verse: 'Аят дня', hadith: 'Хадис дня' },
  sw: { verse: 'Aya ya leo', hadith: 'Hadithi ya leo' },
  ps: { verse: 'د ورځې آیت', hadith: 'د ورځې حدیث' },
};

// Notification-Vorschau braucht eine kürzere Grenze als die Bild-Karte
// (share-card.tsx MAX_TRANSLATION_CHARS=260) — Systemleisten kappen lange
// Texte ohnehin, eine engere Grenze vermeidet, dass die Quelle ("— Sure...")
// am Ende abgeschnitten wird.
const MAX_BODY_CHARS = 160;

/**
 * Baut Titel/Text/Deep-Link-Payload einer Vers/Hadith-Notification aus
 * bereits aufgelöstem Inhalt (content.ts) — reine Funktion, daher separat
 * testbar ohne Netzwerk-Mock.
 */
export function buildVerseOfDayNotificationContent(
  ref: VerseOfDayRef,
  content: VerseOfDayContent,
  locale: string,
): { title: string; body: string; data: { deepLink: string } } {
  const text = NOTIFICATION_TITLE[locale] ?? NOTIFICATION_TITLE.de;
  const title = ref.kind === 'verse' ? text.verse : text.hadith;
  const body = `${truncateForShareCard(content.translation, MAX_BODY_CHARS)} — ${content.source}`;
  return { title, body, data: { deepLink: content.deepLink } };
}

/**
 * Plant (bzw. entfernt) die tägliche Vers/Hadith-Erinnerung für die nächsten
 * VERSE_OF_DAY_WINDOW_DAYS Tage. Muss nach jeder Einstellungsänderung
 * (enabled/hour/Sprache) sowie bei jedem Besuch des Start-Tabs erneut
 * aufgerufen werden — kein Server, keine Background-Task (s. Datei-Kommentar).
 * Ein Netzwerkfehler an einem einzelnen Tag lässt NUR diesen Tag aus (statt
 * die ganze Planung abzubrechen) — der nächste App-Besuch heilt die Lücke.
 */
export async function rescheduleVerseOfDayReminder(
  enabled: boolean,
  hour: number,
  locale: string,
  hadithLang: HadithLang,
  now: Date = new Date(),
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return; // kein Scheduling-Support, s. prayer-times/notifications.ts

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith(VERSE_OF_DAY_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
  if (!enabled) return;

  for (let i = 0; i < VERSE_OF_DAY_WINDOW_DAYS; i++) {
    const tag = new Date(now);
    tag.setDate(tag.getDate() + i);
    // parseTimeOn statt setHours: an Tagen mit Zeitumstellung gibt es eine
    // Wanduhr-Stunde, die nicht existiert — setHours sprang dort still eine
    // volle Stunde weiter (s. prayer-times/next-prayer.ts).
    const date = parseTimeOn(`${String(hour).padStart(2, '0')}:00`, tag);
    if (date.getTime() <= now.getTime()) continue; // heute schon vorbei — nicht planen

    const ref = pickVerseOfDayRef(date, VERSE_OF_DAY_POOL);
    let resolved: VerseOfDayContent;
    try {
      resolved = await resolveVerseOfDayContent(ref, locale, hadithLang);
    } catch {
      continue; // z. B. offline — dieser Tag bleibt aus, nächster Reschedule holt ihn nach
    }
    const { title, body, data } = buildVerseOfDayNotificationContent(ref, resolved, locale);

    await Notifications.scheduleNotificationAsync({
      identifier: `${VERSE_OF_DAY_NOTIFICATION_PREFIX}${date.toISOString().slice(0, 10)}`,
      content: { title, body, sound: true, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}
