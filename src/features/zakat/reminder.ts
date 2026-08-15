// Zakat-Stichtag-Erinnerung: Zakat ist nach einem vollen Hijri-(Mond-)Jahr
// ab dem Zeitpunkt fällig, an dem das Vermögen die Nisab-Schwelle erreicht
// hat - NICHT nach einem Gregorianischen Jahr (das native `YEARLY`-Trigger-
// Raster von expo-notifications wiederholt sich aber genau auf demselben
// Gregorianischen Kalendertag, das würde die Erinnerung Jahr für Jahr um
// die ~11 Tage Differenz von der echten Fälligkeit abdriften lassen). Wir
// rechnen die nächste Fälligkeit deshalb selbst aus (Näherung: 354 Tage pro
// Hijri-Jahr, dieselbe ±1-Tag-Unschärfe wie im Offline-Hijri-Konverter,
// siehe features/calendar/offline.ts) und planen EINEN einmaligen
// Datums-Trigger statt einer nativen Wiederholung - das Rescheduling läuft
// beim nächsten Screen-Besuch erneut (gleiches Muster wie die Gebetszeiten-
// Notifications).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

// Nur nativ: schon der IMPORT von expo-notifications warnt auf Web in der
// Konsole (Push-Token-Listener) — Guard-require wie in app/_layout.tsx.
const Notifications =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as typeof import('expo-notifications'));

export const HIJRI_YEAR_DAYS = 354;

export const ZAKAT_REMINDER_NOTIFICATION_ID = 'salatibox-zakat-reminder';

const ZAKAT_REMINDER_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Zakat-Stichtag', body: 'Ein Hijri-Jahr ist um - Zeit, deine Zakat zu berechnen und zu geben.' },
  en: { title: 'Zakat due date', body: 'A Hijri year has passed - time to calculate and give your zakat.' },
  tr: { title: 'Zekât vakti', body: 'Bir hicrî yıl doldu - zekâtını hesaplayıp verme zamanı.' },
  ar: { title: 'موعد الزكاة', body: 'مرت سنة هجرية كاملة - حان وقت حساب زكاتك وإخراجها.' },
  es: { title: 'Fecha del zakat', body: 'Ha pasado un año hijrí - hora de calcular y dar tu zakat.' },
  fr: { title: 'Échéance de la zakat', body: 'Une année hégirienne s’est écoulée - il est temps de calculer et donner ta zakat.' },
  // Audit 2026-07-27: 8 der 14 App-Sprachen fehlten und fielen über
  // `?? ZAKAT_REMINDER_TEXT.de` auf DEUTSCH zurück — hier vollständig.
  id: { title: 'Jatuh tempo zakat', body: 'Satu tahun Hijriah telah berlalu - saatnya menghitung dan menunaikan zakatmu.' },
  ms: { title: 'Tarikh zakat', body: 'Satu tahun Hijrah telah berlalu - masanya mengira dan menunaikan zakatmu.' },
  bn: { title: 'যাকাতের নির্ধারিত দিন', body: 'একটি হিজরি বছর পূর্ণ হয়েছে - আপনার যাকাত হিসাব করে আদায় করার সময়।' },
  ur: { title: 'زکوٰۃ کی تاریخ', body: 'ایک ہجری سال مکمل ہو گیا - اپنی زکوٰۃ کا حساب کر کے ادا کرنے کا وقت ہے۔' },
  fa: { title: 'موعد زکات', body: 'یک سال هجری گذشت - وقت آن است که زکاتت را حساب و پرداخت کنی.' },
  ru: { title: 'Срок закята', body: 'Прошёл хиджрийский год - пора рассчитать и выплатить закят.' },
  sw: { title: 'Muda wa zaka', body: 'Mwaka mmoja wa Kiislamu umepita - ni wakati wa kukokotoa na kutoa zaka yako.' },
  ps: { title: 'د زکات نېټه', body: 'یو هجري کال بشپړ شو - د خپل زکات د حساب او ورکړې وخت دی.' },
};

/** Titel/Text der Zakat-Erinnerung — reine Funktion, separat testbar. */
export function buildZakatReminderContent(locale: string): { title: string; body: string } {
  return ZAKAT_REMINDER_TEXT[locale] ?? ZAKAT_REMINDER_TEXT.de;
}

/** Nächste Zakat-Fälligkeit ab `anchor` (Stichtag), strikt nach `now`. */
export function nextZakatDueDate(anchor: Date, now: Date): Date {
  const due = new Date(anchor);
  while (due.getTime() <= now.getTime()) {
    due.setDate(due.getDate() + HIJRI_YEAR_DAYS);
  }
  return due;
}

/**
 * Plant (bzw. entfernt) die Zakat-Stichtag-Erinnerung. Muss nach jeder
 * Änderung an Stichtag/enabled sowie bei jedem Screen-Fokus erneut
 * aufgerufen werden (kein Server, keine Background-Task - Selbstheilung
 * beim nächsten App-Besuch nach Fälligkeit).
 */
export async function rescheduleZakatReminder(
  anchor: Date | null,
  enabled: boolean,
  now: Date = new Date(),
  locale: string = 'de',
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return; // kein Scheduling-Support, s. prayer-times/notifications.ts
  await Notifications.cancelScheduledNotificationAsync(ZAKAT_REMINDER_NOTIFICATION_ID).catch(() => {});
  if (!enabled || !anchor) return;

  const due = nextZakatDueDate(anchor, now);
  const text = buildZakatReminderContent(locale);
  await Notifications.scheduleNotificationAsync({
    identifier: ZAKAT_REMINDER_NOTIFICATION_ID,
    content: { title: text.title, body: text.body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due },
  });
}

const ANCHOR_KEY = 'salatibox:zakat-anchor';
const ENABLED_KEY = 'salatibox:zakat-reminder-enabled';

export interface ZakatReminderState {
  anchor: Date | null;
  enabled: boolean;
}

async function loadZakatReminderState(): Promise<ZakatReminderState> {
  const [rawAnchor, rawEnabled] = await Promise.all([
    AsyncStorage.getItem(ANCHOR_KEY),
    AsyncStorage.getItem(ENABLED_KEY),
  ]);
  const anchor = rawAnchor ? new Date(rawAnchor) : null;
  return {
    anchor: anchor && !Number.isNaN(anchor.getTime()) ? anchor : null,
    enabled: rawEnabled === '1',
  };
}

/** Fortschritts-Hook für den Settings-Screen: Stichtag setzen + Erinnerung an/aus. */
export function useZakatReminder(locale: string) {
  const [state, setState] = useState<ZakatReminderState>({ anchor: null, enabled: false });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadZakatReminderState().then((s) => {
        if (cancelled) return;
        setState(s);
        rescheduleZakatReminder(s.anchor, s.enabled, new Date(), locale);
      });
      return () => {
        cancelled = true;
      };
    }, [locale]),
  );

  const setAnchorToday = useCallback(() => {
    const anchor = new Date();
    setState((prev) => {
      const next = { ...prev, anchor };
      AsyncStorage.setItem(ANCHOR_KEY, anchor.toISOString()).catch(() => {});
      rescheduleZakatReminder(next.anchor, next.enabled, new Date(), locale);
      return next;
    });
  }, [locale]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setState((prev) => {
        const next = { ...prev, enabled };
        AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0').catch(() => {});
        rescheduleZakatReminder(next.anchor, next.enabled, new Date(), locale);
        return next;
      });
    },
    [locale],
  );

  return { ...state, setAnchorToday, setEnabled };
}
