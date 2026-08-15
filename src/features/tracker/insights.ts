// Auswertung des Gebets-Trackers: Monatsansicht, häufigst ausgefallenes Gebet,
// Entwicklung über Wochen.
//
// Drei Festlegungen tragen alles Weitere — sie entscheiden darüber, ob die
// Zahlen ehrlich sind oder nur nach Statistik aussehen:
//
//  1. NICHT ERFASST ≠ NICHT GEBETET. Ein Tag ohne jede Angabe geht in keine
//     Quote ein. Wer die App eine Woche nicht öffnet, hat keine Woche
//     „verpasster" Gebete — er hat eine Woche ohne Daten. Jede Auswertung nennt
//     deshalb ihre Grundlage („X erfasste Tage") mit.
//  2. HEUTE ZÄHLT NICHT MIT. Der laufende Tag ist unvollständig, solange nicht
//     alle Gebetszeiten vorbei sind; ein noch nicht fälliges Isha als
//     „ausgefallen" zu werten wäre schlicht falsch. Muster-Auswertungen enden
//     bei gestern, die Monatsansicht zeigt heute selbstverständlich trotzdem.
//  3. BEFREITE TAGE FALLEN HERAUS. Als „keine Gebetspflicht" vermerkte Tage
//     sind weder erfüllt noch versäumt; sie stehen in keinem Zähler und in
//     keinem Nenner.
//
// Bewusst KEINE Bewertung: keine Ziele, keine Warnungen, keine Vergleiche mit
// „Idealwerten". Die Funktionen liefern Zahlen, die Oberfläche zeigt sie an.
import { daysBetween } from '@/lib/dateKey';

import {
  PRAYER_IDS,
  completedCount,
  dayKey,
  hasDayEntry,
  isDayComplete,
  isExemptDay,
  shiftDayKey,
  type PrayerId,
  type TrackerData,
} from './store';

/** Fenster der Muster-Auswertung in Tagen (endet gestern). */
export const PATTERN_WINDOW_DAYS = 30;

/** Anzahl der Wochenblöcke in der Entwicklungs-Ansicht. */
export const TREND_WEEKS = 4;

export interface MonthDay {
  /** 'YYYY-MM-DD' */
  day: string;
  /** Tag im Monat (1-31) */
  date: number;
  /** Anzahl abgehakter Gebete (0-5) */
  done: number;
  exempt: boolean;
  tracked: boolean;
  isToday: boolean;
  /** liegt nach heute — nie eintragbar */
  future: boolean;
  /** innerhalb des Nachtrag-Fensters und nicht in der Zukunft */
  editable: boolean;
}

function daysInMonth(year: number, month: number): number {
  // Tag 0 des Folgemonats = letzter Tag dieses Monats. Über UTC, damit die
  // Länge nicht von der Zeitzone des Geräts abhängt.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Führende Leerzellen des Monatsrasters bei Wochenbeginn Montag — dieselbe
 * Rechnung wie im Hijri-Kalender (app/calendar.tsx), damit beide Raster
 * identisch ausgerichtet sind.
 */
export function monthLeadingBlanks(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
}

/** Alle Tage eines Monats (`month` 1-12) mit ihrem Tracker-Zustand. */
export function monthDays(
  data: TrackerData,
  year: number,
  month: number,
  today: Date,
  editablePastDays: number,
): MonthDay[] {
  const todayKey = dayKey(today);
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const date = i + 1;
    const day = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const diff = daysBetween(todayKey, day);
    return {
      day,
      date,
      done: completedCount(data, day),
      exempt: isExemptDay(data, day),
      tracked: hasDayEntry(data, day),
      isToday: diff === 0,
      future: diff > 0,
      editable: diff <= 0 && diff >= -editablePastDays,
    };
  });
}

export interface PeriodStats {
  /** Vergangene Tage (inkl. heute) im Zeitraum */
  elapsedDays: number;
  /** davon mit Angabe des Nutzers, ohne befreite Tage */
  trackedDays: number;
  /** davon als „keine Gebetspflicht" vermerkt */
  exemptDays: number;
  /** erfasste Tage mit allen 5 Gebeten */
  fullDays: number;
  /** abgehakte Gebete an erfassten Tagen */
  prayersDone: number;
  /** 5 x trackedDays */
  prayersPossible: number;
}

const EMPTY_STATS: PeriodStats = {
  elapsedDays: 0,
  trackedDays: 0,
  exemptDays: 0,
  fullDays: 0,
  prayersDone: 0,
  prayersPossible: 0,
};

/** Kennzahlen über eine Liste von Tagesschlüsseln (alle bereits vergangen). */
export function statsForDays(data: TrackerData, days: readonly string[]): PeriodStats {
  const stats: PeriodStats = { ...EMPTY_STATS, elapsedDays: days.length };
  for (const day of days) {
    if (isExemptDay(data, day)) {
      stats.exemptDays++;
      continue;
    }
    if (!hasDayEntry(data, day)) continue;
    stats.trackedDays++;
    stats.prayersDone += completedCount(data, day);
    if (isDayComplete(data, day)) stats.fullDays++;
  }
  stats.prayersPossible = stats.trackedDays * PRAYER_IDS.length;
  return stats;
}

/** Kennzahlen eines Kalendermonats — künftige Tage bleiben außen vor. */
export function monthStats(data: TrackerData, year: number, month: number, today: Date): PeriodStats {
  const elapsed = monthDays(data, year, month, today, 0)
    .filter((d) => !d.future)
    .map((d) => d.day);
  return statsForDays(data, elapsed);
}

/** Die `count` Tage, die gestern enden (älteste zuerst). */
export function windowDays(today: Date, count: number): string[] {
  const todayKey = dayKey(today);
  return Array.from({ length: count }, (_, i) => shiftDayKey(todayKey, -(count - i)));
}

export interface MissedPrayerRow {
  prayer: PrayerId;
  /** erfasste, nicht befreite Tage im Fenster ohne dieses Gebet */
  missed: number;
}

export interface MissedPattern {
  rows: MissedPrayerRow[];
  trackedDays: number;
  /** Gebet mit den meisten Ausfällen; null bei Gleichstand aller oder ohne Ausfall */
  mostMissed: MissedPrayerRow | null;
}

/**
 * Welches Gebet fehlt am häufigsten? Nur über erfasste, nicht befreite Tage.
 * `mostMissed` bleibt null, wenn kein Gebet ausgefallen ist ODER mehrere
 * Gebete gleichauf an der Spitze liegen — dann gibt es kein Muster, und eines
 * davon willkürlich zu nennen wäre eine erfundene Aussage.
 */
export function missedPattern(data: TrackerData, today: Date, count = PATTERN_WINDOW_DAYS): MissedPattern {
  const days = windowDays(today, count).filter((day) => !isExemptDay(data, day) && hasDayEntry(data, day));
  const rows: MissedPrayerRow[] = PRAYER_IDS.map((prayer) => ({
    prayer,
    missed: days.filter((day) => !data[day]?.[prayer]).length,
  }));
  const sorted = [...rows].sort((a, b) => b.missed - a.missed);
  const top = sorted[0];
  const unique = top.missed > 0 && (sorted[1] === undefined || sorted[1].missed < top.missed);
  return { rows, trackedDays: days.length, mostMissed: unique ? top : null };
}

export interface TrendWeek {
  /** erster Tag des Blocks ('YYYY-MM-DD') */
  startDay: string;
  endDay: string;
  stats: PeriodStats;
}

/**
 * `weeks` Sieben-Tage-Blöcke, die gestern enden (ältester zuerst). Bewusst
 * rollierende Blöcke statt Kalenderwochen: der jüngste Block soll immer die
 * letzten sieben Tage abbilden und nicht je nach Wochentag aus zwei Tagen
 * bestehen.
 */
export function weeklyTrend(data: TrackerData, today: Date, weeks = TREND_WEEKS): TrendWeek[] {
  const days = windowDays(today, weeks * 7);
  return Array.from({ length: weeks }, (_, i) => {
    const block = days.slice(i * 7, i * 7 + 7);
    return { startDay: block[0], endDay: block[block.length - 1], stats: statsForDays(data, block) };
  });
}

/** Anteil erledigter Gebete (0-1); null, wenn im Zeitraum nichts erfasst wurde. */
export function completionRatio(stats: PeriodStats): number | null {
  return stats.prayersPossible === 0 ? null : stats.prayersDone / stats.prayersPossible;
}
