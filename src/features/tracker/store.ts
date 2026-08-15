import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { daysBetween, dayKeyToUtcMs } from '@/lib/dateKey';

// Gebets-Tracker: pro Tag (YYYY-MM-DD) welche der 5 Gebete verrichtet wurden.
// Streak = zusammenhängende Tage mit allen 5 Gebeten, endend heute (oder
// gestern, solange heute noch läuft).
//
// Zwei Erweiterungen (Audit 2026-07-27, Tracker-Ausbau):
//
//  1. NACHTRAGEN: der Screen hakte früher ausschließlich `today` ab. Wer abends
//     vergaß einzutragen, konnte es nie nachholen — die Serie riss zu Unrecht
//     und der Verlauf blieb dauerhaft falsch. Vergangene Tage sind jetzt
//     bearbeitbar, begrenzt auf EDITABLE_PAST_DAYS (Begründung dort).
//  2. BEFREITE TAGE: ein Tag kann als „an diesem Tag bestand keine
//     Gebetspflicht" markiert werden (Reise-Ausnahmen, Krankheit,
//     Menstruation). Rein manueller Vermerk, nichts wird vorhergesagt oder
//     berechnet. Solche Tage unterbrechen die Serie nicht und fallen aus jeder
//     Auswertung heraus, statt als „verpasst" zu zählen.
//
// Beides liegt bewusst IM bestehenden Blob `salatibox:prayer-tracker` (das
// Befreit-Kennzeichen als Feld neben den 5 Gebeten desselben Tages) und nicht
// in einem neuen Speicherschlüssel: der Tracker-Schlüssel wird bereits
// gesichert (features/sync/backupKeys.ts), damit geht der Vermerk ohne weitere
// Abstimmung bei Gerätewechsel mit. Alte Datenstände bleiben unverändert
// lesbar — ein Tag ohne `exempt`-Feld ist schlicht nicht befreit.

export type PrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYER_IDS: PrayerId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Ein Tageseintrag: die 5 Gebete plus der manuelle Befreiungs-Vermerk. */
export type DayEntry = Partial<Record<PrayerId, boolean>> & { exempt?: boolean };

export type TrackerData = Record<string, DayEntry>;

export const TRACKER_STORAGE_KEY = 'salatibox:prayer-tracker';

/**
 * Wie weit zurück nachgetragen werden darf (Tage vor heute).
 *
 * 30 Tage, weil das die Spanne ist, über die jemand seinen Tagesablauf noch
 * aus dem Gedächtnis belegen kann. Ein gestern oder am Wochenende vergessener
 * Eintrag ist der Normalfall und muss nachtragbar sein; was einen Monat
 * zurückliegt, wäre rekonstruiert statt erinnert. Ein Verlauf, der sich
 * unbegrenzt weit rückwirkend umschreiben lässt, ist außerdem kein Protokoll
 * der eigenen Praxis mehr — für alte, tatsächlich verpasste Gebete ist der
 * Qada-Zähler (features/tracker/qada.ts) die richtige Stelle, nicht der
 * Tageskalender. Die Monatsansicht zeigt denselben Horizont.
 */
export const EDITABLE_PAST_DAYS = 30;

/**
 * Obergrenze der Streak-Rückwärtssuche. Ohne sie könnte eine lückenlose Kette
 * befreiter Tage (die übersprungen werden) endlos weiterlaufen.
 */
const STREAK_SCAN_LIMIT = 3660; // ~10 Jahre

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Tagesschlüssel um `delta` Kalendertage verschieben.
 *
 * Über UTC-Mitternachten gerechnet (s. lib/dateKey.ts): ein lokaler Kalendertag
 * hat an DST-Umstellungstagen 23 bzw. 25 Stunden, eine Millisekunden-Addition
 * auf einer lokalen Zeit läge dort um einen Tag daneben.
 */
export function shiftDayKey(day: string, delta: number): string {
  const d = new Date(dayKeyToUtcMs(day) + delta * 86_400_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function togglePrayer(data: TrackerData, day: string, prayer: PrayerId): TrackerData {
  const current = data[day] ?? {};
  return { ...data, [day]: { ...current, [prayer]: !current[prayer] } };
}

/** Manueller Vermerk „an diesem Tag bestand keine Gebetspflicht". */
export function isExemptDay(data: TrackerData, day: string): boolean {
  return data[day]?.exempt === true;
}

export function toggleExemptDay(data: TrackerData, day: string): TrackerData {
  const current = data[day] ?? {};
  return { ...data, [day]: { ...current, exempt: !current.exempt } };
}

/**
 * Wurde dieser Tag überhaupt erfasst? Ausschlaggebend ist, ob der Nutzer eine
 * Angabe gemacht hat — auch ein wieder abgewähltes Gebet (Wert `false`) ist
 * eine Angabe. Auswertungen unterscheiden damit „nicht gebetet" von „nicht
 * eingetragen"; ein Tag ohne jede Angabe darf nicht als Ausfall gelten.
 */
export function hasDayEntry(data: TrackerData, day: string): boolean {
  const entry = data[day];
  if (!entry) return false;
  return PRAYER_IDS.some((p) => p in entry) || entry.exempt === true;
}

export function completedCount(data: TrackerData, day: string): number {
  const d = data[day] ?? {};
  return PRAYER_IDS.filter((p) => d[p]).length;
}

export function isDayComplete(data: TrackerData, day: string): boolean {
  return completedCount(data, day) === PRAYER_IDS.length;
}

/**
 * Darf dieser Tag bearbeitet werden? Zukunft nie, Vergangenheit bis
 * EDITABLE_PAST_DAYS zurück.
 */
export function canEditDay(day: string, today: Date): boolean {
  const diff = daysBetween(dayKey(today), day);
  return diff <= 0 && diff >= -EDITABLE_PAST_DAYS;
}

/** Ältester nachtragbarer Tag (einschließlich). */
export function earliestEditableDay(today: Date): string {
  return shiftDayKey(dayKey(today), -EDITABLE_PAST_DAYS);
}

/**
 * Streak kompletter Tage; der heutige Tag zählt mit, sobald er komplett ist.
 * Als befreit vermerkte Tage werden übersprungen: sie verlängern die Serie
 * nicht, brechen sie aber auch nicht — genau dafür gibt es den Vermerk.
 */
export function currentStreak(data: TrackerData, today: Date): number {
  let streak = 0;
  let key = dayKey(today);
  if (!isDayComplete(data, key) && !isExemptDay(data, key)) {
    // Heute noch nicht komplett — Streak ab gestern zählen
    key = shiftDayKey(key, -1);
  }
  for (let scanned = 0; scanned < STREAK_SCAN_LIMIT; scanned++) {
    if (isExemptDay(data, key)) {
      key = shiftDayKey(key, -1);
      continue;
    }
    if (!isDayComplete(data, key)) break;
    streak++;
    key = shiftDayKey(key, -1);
  }
  return streak;
}

export interface DaySummary {
  day: string;
  done: number;
  exempt: boolean;
}

/** Letzte n Tage (älteste zuerst) mit Anzahl erledigter Gebete. */
export function lastDays(data: TrackerData, today: Date, n: number): DaySummary[] {
  const todayKey = dayKey(today);
  const result: DaySummary[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = shiftDayKey(todayKey, -i);
    result.push({ day: key, done: completedCount(data, key), exempt: isExemptDay(data, key) });
  }
  return result;
}

export function parseTracker(raw: string | null): TrackerData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as TrackerData) : {};
  } catch {
    return {};
  }
}

export function useTracker() {
  const [data, setData] = useState<TrackerData>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(TRACKER_STORAGE_KEY).then((raw) => {
        if (!cancelled) setData(parseTracker(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Der Zeitbezug wird beim Schreiben neu bestimmt, nicht beim Rendern: bleibt
  // der Screen über Mitternacht offen, wäre der ausgewählte „heutige" Tag sonst
  // plötzlich ein Zukunftstag.
  const write = useCallback((update: (prev: TrackerData) => TrackerData, day: string) => {
    if (!canEditDay(day, new Date())) return;
    setData((prev) => {
      const next = update(prev);
      AsyncStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggle = useCallback(
    (day: string, prayer: PrayerId) => write((prev) => togglePrayer(prev, day, prayer), day),
    [write],
  );

  const toggleExempt = useCallback((day: string) => write((prev) => toggleExemptDay(prev, day), day), [write]);

  return { data, toggle, toggleExempt };
}
