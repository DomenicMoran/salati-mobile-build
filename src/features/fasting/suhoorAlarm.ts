// Ramadan: Suhur-Wecker vor Fadschr und optionaler Iftar-Hinweis vor Maghrib.
//
// WARUM ÜBERHAUPT: `fastCountdown()` (store.ts) zeigt die Phase an, weckt aber
// niemanden — im Ramadan ist das Aufstehen zum Suhur genau der Moment, in dem
// eine Gebetszeiten-App ihren größten Nutzen hätte.
//
// ABGRENZUNG zu preAdhanReminder.ts: dieselbe Mechanik (Offset vor einer
// Gebetszeit), aber ein anderer Zweck und andere Grenzen — Vorlauf in
// halben/ganzen Stunden statt Minuten, nur im Ramadan, und auf Android über
// einen eigenen Channel mit AudioAttributes `ALARM`: nur damit läuft der Ton
// über die Wecker-Lautstärke und nicht über die (nachts oft stumme)
// Benachrichtigungs-Lautstärke.
//
// KEINE NEUE BERECHTIGUNG: die Planung läuft wie alle anderen Erinnerungen
// über expo-notifications. Exakte Alarme sind bereits gelöst — expo-notifications
// nutzt AlarmManager exakt, sobald SCHEDULE_EXACT_ALARM erteilt ist (in
// app.config.ts deklariert), und der Status ist über exact-alarm.ts abfragbar;
// die Einstellungen zeigen bei fehlender Berechtigung den vorhandenen Hinweis.
import { Platform } from 'react-native';

import type { HijriDate } from '@/features/prayer-times/api';
import type { DayTimings } from '@/features/prayer-times/notifications';
import { formatHHMM, parseTimeOn, type TimeFormat } from '@/features/prayer-times/next-prayer';
import { gregorianToHijriOffline } from '@/features/calendar/offline';
import { IFTAR_REMINDER_LEAD_MINUTES, type SuhoorLeadMinutes } from '@/features/settings/types';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole — Guard-require wie in preAdhanReminder.ts.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const SUHOOR_ALARM_PREFIX = 'suhoor-';
export const IFTAR_REMINDER_PREFIX = 'iftar-';
/** Eigener Android-Channel: Wecker-Lautstärke statt Benachrichtigungston. */
export const SUHOOR_CHANNEL_ID = 'ramadan-suhoor-alarm';
export const IFTAR_CHANNEL_ID = 'ramadan-iftar';

/** Ramadan ist der 9. Monat des Hijri-Kalenders. */
export const RAMADAN_MONTH = 9;

const SUHOOR_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Suhur · Aufstehen', body: 'Noch {min} Minuten bis Fadschr ({time}) — Zeit für den Suhur.' },
  en: { title: 'Suhoor · Time to get up', body: '{min} minutes until Fajr ({time}) — time for suhoor.' },
  tr: { title: 'Sahur · Kalkma vakti', body: 'İmsağa {min} dakika kaldı ({time}) — sahur vakti.' },
  ar: { title: 'السحور · حان وقت النهوض', body: 'بقيت {min} دقيقة على الفجر ({time}) — وقت السحور.' },
  es: { title: 'Suhur · Hora de levantarse', body: 'Faltan {min} minutos para el Fajr ({time}) — hora del suhur.' },
  fr: { title: 'Suhoor · Il est temps de se lever', body: '{min} minutes avant le Fajr ({time}) — c’est l’heure du suhoor.' },
  id: { title: 'Sahur · Waktunya bangun', body: '{min} menit lagi masuk Subuh ({time}) — waktunya sahur.' },
  ms: { title: 'Sahur · Masa untuk bangun', body: '{min} minit lagi masuk Subuh ({time}) — masa untuk bersahur.' },
  bn: { title: 'সেহরি · ওঠার সময়', body: 'ফজর ({time}) হতে আর {min} মিনিট বাকি — সেহরির সময়।' },
  ur: { title: 'سحری · اٹھنے کا وقت', body: 'فجر ({time}) میں {min} منٹ باقی ہیں — سحری کا وقت ہے۔' },
  fa: { title: 'سحری · وقت بیدار شدن', body: '{min} دقیقه تا اذان صبح ({time}) — وقت سحری است.' },
  ru: { title: 'Сухур · Пора вставать', body: 'До Фаджра ({time}) осталось {min} минут — время сухура.' },
  sw: { title: 'Daku · Wakati wa kuamka', body: 'Zimebaki dakika {min} hadi Alfajiri ({time}) — ni wakati wa daku.' },
  ps: { title: 'سحري · د پاڅېدو وخت', body: 'تر سهار لمانځه ({time}) پورې {min} دقیقې پاتې دي — د سحري وخت دی.' },
};

const IFTAR_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Gleich Iftar', body: 'In {min} Minuten ist Maghrib ({time}) — das Fasten endet.' },
  en: { title: 'Iftar soon', body: 'Maghrib is in {min} minutes ({time}) — the fast ends.' },
  tr: { title: 'İftara az kaldı', body: '{min} dakika sonra akşam ezanı ({time}) — oruç sona eriyor.' },
  ar: { title: 'اقترب الإفطار', body: 'بعد {min} دقيقة يحين المغرب ({time}) — ينتهي الصيام.' },
  es: { title: 'Iftar en breve', body: 'El Magrib es en {min} minutos ({time}) — termina el ayuno.' },
  fr: { title: 'Bientôt l’iftar', body: 'Le Maghrib est dans {min} minutes ({time}) — le jeûne se termine.' },
  id: { title: 'Sebentar lagi berbuka', body: 'Magrib {min} menit lagi ({time}) — puasa berakhir.' },
  ms: { title: 'Sebentar lagi berbuka', body: 'Maghrib {min} minit lagi ({time}) — puasa berakhir.' },
  bn: { title: 'ইফতার আসছে', body: '{min} মিনিট পর মাগরিব ({time}) — রোজা শেষ হচ্ছে।' },
  ur: { title: 'افطار قریب ہے', body: '{min} منٹ بعد مغرب ({time}) — روزہ ختم ہو رہا ہے۔' },
  fa: { title: 'افطار نزدیک است', body: '{min} دقیقه دیگر مغرب ({time}) — روزه به پایان می‌رسد.' },
  ru: { title: 'Скоро ифтар', body: 'Магриб через {min} минут ({time}) — пост завершается.' },
  sw: { title: 'Futari inakaribia', body: 'Magharibi baada ya dakika {min} ({time}) — saumu inaisha.' },
  ps: { title: 'افطار نږدې دی', body: 'تر {min} دقیقو وروسته ماښام ({time}) — روژه پای ته رسېږي.' },
};

/** 'YYYY-MM-DD' des LOKALEN Kalendertags (nicht UTC, s. Identifier unten). */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Kalendertag-Verschiebung (DST-sicher über setDate statt +86_400_000 ms). */
function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Versatz in Tagen zwischen dem tabellarischen Offline-Konverter und dem
 * Hijri-Datum, das die App tatsächlich anzeigt.
 *
 * Der Ramadan darf nicht aus einer zweiten, eigenen Kalender-Herleitung
 * kommen: sonst weckt die App am 30. Schaʿbān oder verpasst den ersten
 * Fastentag, während der Kalender-Screen daneben etwas anderes zeigt.
 * `gregorianToHijriOffline` weicht bauartbedingt um ±1 Tag von der
 * mondsichtungsbasierten Aladhan-Angabe ab (s. calendar/offline.ts) — deshalb
 * wird der Offline-Konverter hier einmal am angezeigten Hijri-Datum von heute
 * geeicht und danach für die restlichen Tage des Planungsfensters verwendet.
 * Ohne API-Datum (offline) bleibt es beim ungeeichten Konverter — dieselbe
 * Quelle, die der Kalender-Screen dann ebenfalls nutzt.
 */
export function hijriCalibrationShift(anchorDate: Date, anchorHijri: HijriDate | undefined): number {
  const month = Number(anchorHijri?.month?.number);
  const day = Number(anchorHijri?.day);
  if (!month || !day) return 0;
  // ±2 Tage decken jede bekannte Abweichung zwischen Tabellen- und
  // Sichtungskalender ab; 0 zuerst, damit der Normalfall nicht verschoben wird.
  for (const shift of [0, 1, -1, 2, -2]) {
    const probe = gregorianToHijriOffline(addDays(anchorDate, shift));
    if (probe.month === month && probe.day === day) return shift;
  }
  return 0;
}

/** Liegt dieser Kalendertag im Ramadan (nach dem geeichten Kalender)? */
export function isRamadanDay(date: Date, shift: number): boolean {
  return gregorianToHijriOffline(addDays(date, shift)).month === RAMADAN_MONTH;
}

/**
 * Weckzeit: `leadMinutes` echte Minuten vor Fadschr. Bewusst Millisekunden-
 * Arithmetik (wie preAdhanReminder.ts) statt Wanduhr-Feldern: der Wecker soll
 * dem Nutzer wirklich diese Zeitspanne zum Essen lassen, auch in der Nacht der
 * Zeitumstellung. Das Ergebnis kann auf dem VORTAG liegen (Fadschr kurz nach
 * Mitternacht in hohen Breiten) — deshalb dürfen Identifier und
 * Vergangenheitsprüfung nie vom Gebetstag ausgehen.
 */
export function computeSuhoorAlarmTime(fajrTime: Date, leadMinutes: number): Date {
  return new Date(fajrTime.getTime() - leadMinutes * 60_000);
}

export function buildSuhoorAlarmContent(
  fajrDisplayTime: string,
  leadMinutes: number,
  locale: string,
): { title: string; body: string } {
  const text = SUHOOR_TEXT[locale] ?? SUHOOR_TEXT.de;
  return {
    title: text.title,
    body: text.body.replace('{min}', String(leadMinutes)).replace('{time}', fajrDisplayTime),
  };
}

export function buildIftarReminderContent(
  maghribDisplayTime: string,
  locale: string,
): { title: string; body: string } {
  const text = IFTAR_TEXT[locale] ?? IFTAR_TEXT.de;
  return {
    title: text.title,
    body: text.body.replace('{min}', String(IFTAR_REMINDER_LEAD_MINUTES)).replace('{time}', maghribDisplayTime),
  };
}

export interface RamadanReminderOptions {
  suhoorEnabled: boolean;
  suhoorLead: SuhoorLeadMinutes;
  iftarEnabled: boolean;
}

async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync(SUHOOR_CHANNEL_ID, {
    name: 'Suhur-Wecker · Suhoor alarm',
    importance: Notifications.AndroidImportance.MAX,
    // Wecker-Kanal: über die Alarm-Lautstärke, sonst bleibt der Suhur-Wecker
    // in einem nachts stummgeschalteten Profil unhörbar — genau dann, wenn er
    // gebraucht wird. `bypassDnd` bleibt trotzdem aus: "Bitte nicht stören" zu
    // übergehen verlangt eine gesonderte Nutzerfreigabe, und ein Wecker, der
    // sich selbst dazu ermächtigt, wäre übergriffig.
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    enableVibrate: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(IFTAR_CHANNEL_ID, {
    name: 'Iftar-Hinweis · Iftar reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Plant Suhur-Wecker und Iftar-Hinweis für die Ramadan-Tage im übergebenen
 * Fenster (dieselben bereits geladenen Zeiten wie die übrigen Erinnerungen,
 * kein zusätzlicher Netz-Zugriff). Löscht ausschließlich eigene
 * (`suhoor-…`/`iftar-…`) Planungen — außerhalb des Ramadan bleibt danach nichts
 * übrig, die Funktion schaltet sich also von selbst ab.
 */
export async function rescheduleRamadanReminders(
  days: DayTimings[],
  options: RamadanReminderOptions,
  hijriToday: HijriDate | undefined,
  now: Date = new Date(),
  locale: string = 'de',
  timeFormat: TimeFormat = '24h',
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith(SUHOOR_ALARM_PREFIX) || n.identifier.startsWith(IFTAR_REMINDER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
  if (!options.suhoorEnabled && !options.iftarEnabled) return;

  const shift = hijriCalibrationShift(now, hijriToday);
  let channelsReady = false;

  for (const day of days) {
    if (!isRamadanDay(day.date, shift)) continue;

    if (options.suhoorEnabled && day.timings.Fajr) {
      const fajrTime = parseTimeOn(day.timings.Fajr, day.date);
      const alarmTime = computeSuhoorAlarmTime(fajrTime, options.suhoorLead);
      if (alarmTime.getTime() > now.getTime()) {
        if (!channelsReady) {
          await ensureChannels();
          channelsReady = true;
        }
        const { title, body } = buildSuhoorAlarmContent(
          formatHHMM(day.timings.Fajr, timeFormat),
          options.suhoorLead,
          locale,
        );
        await Notifications.scheduleNotificationAsync({
          // Schlüssel aus dem LOKALEN Tag des Weckers, nicht des Gebets: bei
          // großem Vorlauf oder sehr frühem Fadschr liegt er auf dem Vortag,
          // und zwei Tage dürfen sich nie denselben Identifier teilen.
          identifier: `${SUHOOR_ALARM_PREFIX}${localDayKey(alarmTime)}`,
          content: { title, body, sound: true, priority: Notifications.AndroidNotificationPriority.MAX },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: alarmTime,
            channelId: SUHOOR_CHANNEL_ID,
          },
        });
      }
    }

    if (options.iftarEnabled && day.timings.Maghrib) {
      const maghribTime = parseTimeOn(day.timings.Maghrib, day.date);
      const hintTime = new Date(maghribTime.getTime() - IFTAR_REMINDER_LEAD_MINUTES * 60_000);
      if (hintTime.getTime() > now.getTime()) {
        if (!channelsReady) {
          await ensureChannels();
          channelsReady = true;
        }
        const { title, body } = buildIftarReminderContent(formatHHMM(day.timings.Maghrib, timeFormat), locale);
        await Notifications.scheduleNotificationAsync({
          identifier: `${IFTAR_REMINDER_PREFIX}${localDayKey(hintTime)}`,
          content: { title, body, sound: true },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: hintTime,
            channelId: IFTAR_CHANNEL_ID,
          },
        });
      }
    }
  }
}
