import type { Timings } from './api';

// Reine Aufbereitung des bereits geladenen 7-Tage-Fensters (fetchUpcomingTimings
// in api.ts, siehe dortigen Kommentar zur Mehrtages-Notification-Planung) für
// die tabellarische Wochenübersicht (app/prayer-times-week.tsx). Kein eigener
// Netzwerk-Request — reine Datumsberechnung, deshalb ohne i18n-Abhängigkeit
// (Wochentagsnamen übersetzt erst in der UI via calendar.weekdays.*).

export interface WeekDayRow {
  date: Date;
  /** Mo=0 .. So=6 — passt zur Reihenfolge der Übersetzungs-Keys calendar.weekdays.*. */
  weekdayIdx: number;
  isToday: boolean;
  timings: Timings;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Konvertiert Date.getDay() (So=0..Sa=6) auf Mo=0..So=6 (deutsche/europäische Wochenordnung). */
export function mondayFirstWeekdayIdx(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Baut die Zeilen für die Wochentabelle aus dem bereits geladenen 7-Tage-
 * Fenster. `now` bestimmt, welche Zeile als "heute" markiert wird.
 */
export function buildWeekRows(
  days: { date: Date; timings: Timings }[],
  now: Date = new Date(),
): WeekDayRow[] {
  return days.map(({ date, timings }) => ({
    date,
    weekdayIdx: mondayFirstWeekdayIdx(date),
    isToday: isSameDay(date, now),
    timings,
  }));
}
