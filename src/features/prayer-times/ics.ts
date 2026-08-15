import { parseTimeOn, PRAYERS, type Prayer } from './next-prayer';
import type { Timings } from './api';

// iCalendar-Export der Gebetszeiten (RFC 5545, floating local time — Gebets-
// zeiten gelten in der lokalen Zeit des Ortes, bewusst ohne TZID/UTC).

export interface IcsDay {
  date: Date;
  timings: Timings;
}

function icsDateTime(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** Erzeugt einen VCALENDAR mit einem 10-Minuten-Event je Gebet und Tag. */
export function buildPrayerIcs(
  days: IcsDay[],
  prayerNames: Record<Prayer, string>,
  locationLabel: string,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Salati//Prayer Times//DE',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Salati',
  ];
  for (const day of days) {
    for (const prayer of PRAYERS) {
      const time = day.timings[prayer];
      if (!time) continue;
      const start = parseTimeOn(time, day.date);
      const end = new Date(start.getTime() + 10 * 60_000);
      lines.push(
        'BEGIN:VEVENT',
        `UID:salati-${icsDateTime(start)}-${prayer}@salati.pro`,
        `DTSTAMP:${icsDateTime(new Date(day.date))}`,
        `DTSTART:${icsDateTime(start)}`,
        `DTEND:${icsDateTime(end)}`,
        `SUMMARY:${prayerNames[prayer] ?? prayer}`,
        `LOCATION:${locationLabel.replace(/[,;]/g, '\\$&')}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 verlangt CRLF-Zeilenenden.
  return lines.join('\r\n') + '\r\n';
}
