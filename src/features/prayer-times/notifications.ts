import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Timings } from './api';
import { androidChannelSound, iosNotificationSound } from './azan';
import { formatHHMM, parseTimeOn, PRAYERS, type NextPrayerResult, type Prayer, type TimeFormat } from './next-prayer';
import { prayerName } from './prayerNames';
import type { AzanChoice, AzanPerPrayer, NotificationPrefs, NotificationToggles } from '@/features/settings/types';

/** Kein Adhan-Ton — Rückfallwert, damit Altaufrufer unverändert bleiben. */
const NO_AZAN_NOTIFICATION: AzanPerPrayer = {
  fajr: 'default',
  dhuhr: 'default',
  asr: 'default',
  maghrib: 'default',
  isha: 'default',
};

// Gebetsnamen sind Eigennamen (Fajr, Dhuhr, ...) — nur der Satz drumherum
// wird lokalisiert. {p} wird durch den Gebetsnamen ersetzt.
// {time} steht im Titel (nicht nur im Body), damit die Uhrzeit auch in der
// eingeklappten/Kurz-Ansicht der System-Notification sichtbar ist — Nutzer-
// Feedback: mehrere Gebetszeiten-Notifications kamen gebündelt/verspätet
// an (Android-Batching bei fehlender Exact-Alarm-Berechtigung), ohne
// Uhrzeit in der Notification selbst war dann nicht erkennbar, für welches
// Gebet/welche Zeit sie eigentlich galt.
const PRAYER_REMINDER_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: '{p}-Zeit · {time}', body: 'Es ist Zeit für das {p}-Gebet ({time}).' },
  en: { title: '{p} time · {time}', body: 'It is time for the {p} prayer ({time}).' },
  tr: { title: '{p} vakti · {time}', body: '{p} namazının vakti geldi ({time}).' },
  ar: { title: 'حان وقت {p} · {time}', body: 'حان الآن وقت صلاة {p} ({time}).' },
  es: { title: 'Hora de {p} · {time}', body: 'Es la hora de la oración de {p} ({time}).' },
  fr: { title: 'Heure de {p} · {time}', body: "C'est l'heure de la prière de {p} ({time})." },
  // Audit 2026-07-27: die Tabelle deckte nur 6 der 14 App-Sprachen ab —
  // id/bn/fa/ms/ur/ru/sw/ps liefen über `?? PRAYER_REMINDER_TEXT.de` in eine
  // DEUTSCHE Gebets-Benachrichtigung. Neue Sprachen hier mit ergänzen
  // (notifications.test.ts erzwingt die Vollständigkeit).
  id: { title: 'Waktu {p} · {time}', body: 'Sudah masuk waktu salat {p} ({time}).' },
  ms: { title: 'Waktu {p} · {time}', body: 'Sudah masuk waktu solat {p} ({time}).' },
  bn: { title: '{p} ওয়াক্ত · {time}', body: '{p} নামাজের সময় হয়েছে ({time})।' },
  ur: { title: '{p} کا وقت · {time}', body: '{p} کی نماز کا وقت ہو گیا ہے ({time})۔' },
  fa: { title: 'وقت {p} · {time}', body: 'وقت نماز {p} فرا رسید ({time}).' },
  ru: { title: 'Время {p} · {time}', body: 'Настало время молитвы {p} ({time}).' },
  sw: { title: 'Wakati wa {p} · {time}', body: 'Ni wakati wa swala ya {p} ({time}).' },
  ps: { title: 'د {p} وخت · {time}', body: 'د {p} لمانځه وخت رارسېد ({time}).' },
};

// Audit 2026-07-27 (O1): die Gebetsnamen lagen doppelt hier und in
// preAdhanReminder.ts und waren beide Male an `locale === 'ar'` gebunden —
// ur/fa/ps bekamen die lateinische Umschrift mitten in den RTL-Satz. Jetzt
// eine gemeinsame Quelle mit `isRtlLanguageCode`, s. prayerNames.ts.
// Re-Export, weil live-activity (iOS) `prayerName` von hier importiert.
export { prayerName };

/**
 * Titel/Text einer Gebetszeit-Benachrichtigung — reine Funktion, damit die
 * Sprachauswahl ohne expo-notifications testbar ist (gleiches Muster wie
 * buildPreAdhanReminderContent/buildJumuahReminderContent).
 */
export function buildPrayerReminderContent(
  prayer: Prayer,
  displayTime: string,
  locale: string,
): { title: string; body: string } {
  const text = PRAYER_REMINDER_TEXT[locale] ?? PRAYER_REMINDER_TEXT.de;
  const name = prayerName(prayer, locale);
  return {
    title: text.title.replace('{p}', name).replace('{time}', displayTime),
    body: text.body.replace('{p}', name).replace('{time}', displayTime),
  };
}

/**
 * Titel/Text für "nächstes Gebet, feste Uhrzeit" — gemeinsam von Androids
 * dauerhafter Notification (updateOngoingCountdown) UND der iOS Live
 * Activity (live-activity.tsx) genutzt, damit beide Plattformen exakt
 * denselben Wortlaut zeigen statt zweier getrennt gepflegter Übersetzungen.
 */
export function formatOngoingCountdownText(
  next: NextPrayerResult,
  locale: string,
  timeFormat: TimeFormat,
): { title: string; prayer: string; time: string; body: string } {
  const text = ONGOING_COUNTDOWN_TEXT[locale] ?? ONGOING_COUNTDOWN_TEXT.de;
  const time = formatHHMM(
    `${String(next.nextTs.getHours()).padStart(2, '0')}:${String(next.nextTs.getMinutes()).padStart(2, '0')}`,
    timeFormat,
  );
  const prayer = prayerName(next.nextPrayer, locale);
  return { title: text.title, prayer, time, body: text.body.replace('{p}', prayer).replace('{time}', time) };
}

/** Alle Gebets-Notifications tragen dieses Prefix — NUR diese werden beim
 * Neuplanen gelöscht (cancelAll löschte vorher auch die Lern-Erinnerung mit). */
const PRAYER_NOTIFICATION_PREFIX = 'prayer-';

/** Feste, nicht wegwischbare "nächstes Gebet"-Notification — eigene ID,
 * bleibt von rescheduleNotifications' Prefix-Löschung unberührt. */
const ONGOING_NOTIFICATION_ID = 'prayer-ongoing';

const ONGOING_COUNTDOWN_TEXT: Record<string, { title: string; body: string }> = {
  de: { title: 'Nächstes Gebet', body: '{p} um {time}' },
  en: { title: 'Next prayer', body: '{p} at {time}' },
  tr: { title: 'Sıradaki namaz', body: 'Saat {time} - {p}' },
  ar: { title: 'الصلاة القادمة', body: '{p} الساعة {time}' },
  es: { title: 'Próxima oración', body: '{p} a las {time}' },
  fr: { title: 'Prochaine prière', body: '{p} à {time}' },
  id: { title: 'Salat berikutnya', body: '{p} pukul {time}' },
  ms: { title: 'Solat seterusnya', body: '{p} pukul {time}' },
  bn: { title: 'পরবর্তী নামাজ', body: '{p} — {time}' },
  ur: { title: 'اگلی نماز', body: '{p} بوقت {time}' },
  fa: { title: 'نماز بعدی', body: '{p} ساعت {time}' },
  ru: { title: 'Следующая молитва', body: '{p} в {time}' },
  sw: { title: 'Swala inayofuata', body: '{p} saa {time}' },
  ps: { title: 'راتلونکی لمونځ', body: '{p} په {time}' },
};

export async function requestNotificationPermission(): Promise<boolean> {
  // expo-notifications hat auf Web keinen Scheduling-Support (Stub wirft
  // UnavailabilityError) — der Gebetszeiten-Screen ist dort unter /prayer
  // erreichbar und darf dadurch nicht crashen.
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return status === 'granted';
}

/**
 * True, wenn das System keinen Berechtigungsdialog mehr zeigt (dauerhaft
 * verweigert). Audit 2026-07-27 (U5): in dem Fall lief jeder Schalter ins
 * Leere — `requestNotificationPermission()` kehrt sofort mit `false` zurück,
 * der Schalter sprang zurück und der Nutzer bekam keinerlei Erklärung. Wer
 * das abfragt, muss `Linking.openSettings()` anbieten.
 */
export async function notificationPermissionBlocked(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return status !== 'granted' && !canAskAgain;
}

/**
 * Android-Notification-Channels sind nach Erstellung UNVERÄNDERLICH — die
 * Nutzer-Einstellungen (Ton/Vibration/Heads-up) stecken deshalb in der
 * Channel-ID; bei geänderten Prefs entsteht ein neuer Channel. Seit der
 * Adhan-Ton-Auswahl gehört auch die Ton-Wahl in die ID, denn ein einmal
 * angelegter Channel nimmt einen anderen Ton nicht mehr an.
 * Heads-up ("über allen anderen Apps") = Importance MAX.
 *
 * `azan === 'default'` liefert exakt die alte ID — bestehende Nutzer, die den
 * Adhan-Ton nicht einschalten, behalten damit ihren Channel samt aller
 * System-Einstellungen, die sie daran vorgenommen haben.
 */
export function prayerChannelId(prefs: NotificationPrefs, azan: AzanChoice = 'default'): string {
  const base = `prayer-s${prefs.sound ? 1 : 0}v${prefs.vibrate ? 1 : 0}h${prefs.headsUp ? 1 : 0}`;
  return azan === 'default' ? base : `${base}-${azan}`;
}

/**
 * Welcher Adhan tatsächlich als Ton gilt: der Ton-Schalter (`prefs.sound`)
 * und der Adhan-Schalter müssen beide an sein, sonst bleibt es beim
 * Standardton bzw. bei Stille.
 */
export function effectiveAzan(prefs: NotificationPrefs, azanEnabled: boolean, choice: AzanChoice): AzanChoice {
  if (!prefs.sound || !azanEnabled) return 'default';
  return choice;
}

async function ensurePrayerChannel(prefs: NotificationPrefs, azan: AzanChoice = 'default'): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  const id = prayerChannelId(prefs, azan);
  await Notifications.setNotificationChannelAsync(id, {
    name: azan === 'default' ? 'Gebetszeiten · Prayer times' : `Gebetszeiten · Adhan (${azan})`,
    importance: prefs.headsUp
      ? Notifications.AndroidImportance.MAX
      : Notifications.AndroidImportance.DEFAULT,
    // Native Channel-API (expo-notifications 57): 'sound' fehlt im Objekt =>
    // System-Standardton, 'sound: null' => stumm, 'sound: "<name>"' => sucht
    // eine eigene Sound-Resource mit diesem Namen. Der String 'default' war
    // hier fälschlich als Custom-Sound-Dateiname gedacht (existiert nicht),
    // loggte bei jedem Channel-Erstellen "Custom sound 'default' not found"
    // UND lieferte für sound:true vermutlich gar keinen Ton statt des
    // System-Standardtons. undefined lässt den Key beim Bridge-Marshalling
    // weg (=> Standardton), null erzwingt explizit Stille.
    // Der Adhan-Name zeigt auf die Raw-Resource, die Metro ohnehin baut
    // (s. androidChannelSound) — Android kennt hier KEINE Längenbegrenzung,
    // es läuft der volle Ruf.
    sound: azan !== 'default' ? androidChannelSound(azan) : prefs.sound ? undefined : null,
    vibrationPattern: prefs.vibrate ? [0, 300, 200, 300] : undefined,
    enableVibrate: prefs.vibrate,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  return id;
}

/**
 * Räumt Gebets-Channels auf, die durch eine geänderte Ton-/Adhan-Auswahl
 * verwaist sind — sonst wächst die Kanalliste in den Android-Einstellungen mit
 * jeder Änderung um einen unbenutzten Eintrag.
 *
 * Zwei Sicherungen gegen Datenverlust: (1) läuft ERST, nachdem alle jetzt
 * benötigten Channels angelegt sind, (2) der Basis-Channel (Adhan aus) steht
 * immer in `keep`, weil die dauerhafte "nächstes Gebet"-Notification
 * (updateOngoingCountdown) daran hängt — mit seinem Channel verschwände sie
 * sofort vom Sperrbildschirm. Löscht ausschließlich `prayer-*`-Channels, alles
 * andere (inkl. des System-Default-Channels) bleibt unangetastet.
 */
async function prunePrayerChannels(keep: Set<string>): Promise<void> {
  if (Platform.OS !== 'android') return;
  const channels = await Notifications.getNotificationChannelsAsync().catch(() => []);
  for (const channel of channels) {
    const id = channel?.id;
    if (!id || !id.startsWith(PRAYER_NOTIFICATION_PREFIX) || keep.has(id)) continue;
    await Notifications.deleteNotificationChannelAsync(id).catch(() => {});
  }
}

export interface DayTimings {
  /** Kalendertag, auf den sich die Zeiten beziehen */
  date: Date;
  timings: Timings;
}

/**
 * Plant lokale Gebets-Notifications für MEHRERE Tage im Voraus (statt nur
 * heute — vorher gab es keine Benachrichtigungen mehr, sobald die App einen
 * Tag lang nicht geöffnet wurde). iOS erlaubt 64 geplante Notifications:
 * 5 Gebete × 7 Tage = 35 + Lern-Erinnerung bleibt im Rahmen.
 * Löscht ausschließlich eigene (prayer-*) Planungen.
 */
export async function rescheduleNotifications(
  days: DayTimings[],
  enabled: NotificationToggles,
  prefs: NotificationPrefs,
  now: Date = new Date(),
  locale: string = 'de',
  timeFormat: TimeFormat = '24h',
  // Adhan als Benachrichtigungston, Stimme je Gebet. Ohne Angabe bleibt es
  // beim bisherigen Verhalten (kurzer System-Standardton).
  azan: { enabled: boolean; choices: AzanPerPrayer } = { enabled: false, choices: NO_AZAN_NOTIFICATION },
): Promise<void> {
  if (Platform.OS === 'web') return; // kein Scheduling-Support, s. o.

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith(PRAYER_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const azanFor = (prayer: Prayer): AzanChoice =>
    effectiveAzan(prefs, azan.enabled, azan.choices[prayer.toLowerCase() as keyof AzanPerPrayer] ?? 'default');

  // Basis-Channel immer anlegen (die dauerhafte Countdown-Notification hängt
  // daran, s. prunePrayerChannels) und je gewähltem Adhan einen weiteren —
  // Channels sind unveränderlich, ein Ton-Wechsel heißt immer: neuer Channel.
  const channelIds = new Map<AzanChoice, string | undefined>();
  channelIds.set('default', await ensurePrayerChannel(prefs));
  for (const prayer of PRAYERS) {
    const choice = azanFor(prayer);
    if (!channelIds.has(choice)) channelIds.set(choice, await ensurePrayerChannel(prefs, choice));
  }
  await prunePrayerChannels(new Set([...channelIds.values()].filter((id): id is string => Boolean(id))));

  for (const day of days) {
    for (const prayer of PRAYERS) {
      if (!enabled[prayer.toLowerCase() as keyof NotificationToggles]) continue;
      const time = day.timings[prayer];
      if (!time) continue;
      const date = parseTimeOn(time, day.date);
      if (date.getTime() <= now.getTime()) continue; // schon vorbei — nicht planen
      const displayTime = formatHHMM(time, timeFormat);
      const { title, body } = buildPrayerReminderContent(prayer, displayTime, locale);
      const choice = azanFor(prayer);
      // iOS nimmt den Ton aus dem Notification-Inhalt (Dateiname des < 30-s-
      // Schnitts im App-Bundle), Android aus dem Channel — der Name greift
      // dort nur noch auf Android 7 und älter, wo es keine Channels gibt.
      const soundName = Platform.OS === 'ios' ? iosNotificationSound(choice) : androidChannelSound(choice);

      await Notifications.scheduleNotificationAsync({
        identifier: `${PRAYER_NOTIFICATION_PREFIX}${date.toISOString().slice(0, 10)}-${prayer}`,
        content: { title, body, sound: prefs.sound ? (soundName ?? true) : false },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: channelIds.get(choice),
        },
      });
    }
  }
}

/**
 * Dauerhafte "nächstes Gebet"-Notification (Android-only, Opt-in über
 * prefs.ongoingCountdown). Zeigt eine feste Uhrzeit statt eines live
 * tickenden Countdowns — expo-notifications exponiert Androids
 * Chronometer-Style nicht, ein falscher "Live"-Anspruch wäre irreführend.
 * Aufrufer soll dies NUR bei Wechsel des nächsten Gebets neu aufrufen
 * (nicht sekündlich), sonst entsteht unnötiger Schedule-Spam.
 */
export async function updateOngoingCountdown(
  next: NextPrayerResult,
  prefs: NotificationPrefs,
  locale: string,
  timeFormat: TimeFormat,
): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS hat kein Ongoing/Sticky-Äquivalent hierfür
  if (!prefs.ongoingCountdown) {
    await Notifications.cancelScheduledNotificationAsync(ONGOING_NOTIFICATION_ID).catch(() => {});
    await Notifications.dismissNotificationAsync(ONGOING_NOTIFICATION_ID).catch(() => {});
    return;
  }
  const channelId = await ensurePrayerChannel(prefs);
  const text = formatOngoingCountdownText(next, locale, timeFormat);
  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_NOTIFICATION_ID,
    content: {
      title: text.title,
      body: text.body,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(), channelId },
  });
}
