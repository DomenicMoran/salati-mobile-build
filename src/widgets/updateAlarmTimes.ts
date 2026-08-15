// Zu welchen Zeitpunkten ein Homescreen-Widget neu gezeichnet werden muss —
// reine Funktion, plattformunabhängig testbar (updateAlarm.android.ts reicht
// das Ergebnis an den nativen AlarmManager weiter).
import type { Timings } from '@/features/prayer-times/api';
import { PRAYERS, parseTimeOn } from '@/features/prayer-times/next-prayer';

/**
 * Ergibt die Zeitpunkte, an denen sich der ANGEZEIGTE Inhalt der Widgets
 * ändert:
 *
 *  • jede der fünf heutigen Gebetszeiten — dann rückt „nächstes Gebet" weiter
 *    und die vergangene Zeile wird abgetönt,
 *  • der morgige Fadschr — ab Isha zeigt das Widget ihn als nächstes Gebet,
 *  • Mitternacht — Datum, Hijri-Datum und die ganze Tagesliste wechseln.
 *
 * Nur Zeitpunkte in der Zukunft, aufsteigend, ohne Dubletten. Eine Sekunde
 * Zuschlag, damit der Alarm sicher NACH dem Wechsel feuert und nicht in die
 * Sekunde davor fällt (dann stünde immer noch das alte Gebet da).
 */
export function widgetUpdateTimestamps(today: Timings, tomorrow: Timings, now: Date = new Date()): number[] {
  const times: number[] = [];

  for (const p of PRAYERS) {
    const value = today[p];
    if (typeof value === 'string' && value !== '') times.push(parseTimeOn(value, now).getTime() + 1000);
  }

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (typeof tomorrow.Fajr === 'string' && tomorrow.Fajr !== '') {
    times.push(parseTimeOn(tomorrow.Fajr, tomorrowDate).getTime() + 1000);
  }

  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0); // 00:00:05 des Folgetags
  times.push(midnight.getTime());

  const nowMs = now.getTime();
  return Array.from(new Set(times.filter((t) => t > nowMs))).sort((a, b) => a - b);
}
