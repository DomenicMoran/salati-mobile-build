import type { Timings } from '@/features/prayer-times/api';

import { widgetUpdateTimestamps } from './updateAlarmTimes';

// Nur die Felder, die die Funktion liest — `as Timings` statt eines
// vollständigen Aladhan-Objekts hält den Test lesbar.
const TODAY = {
  Fajr: '05:12',
  Sunrise: '06:45',
  Dhuhr: '13:20',
  Asr: '16:55',
  Maghrib: '21:10',
  Isha: '22:45',
} as unknown as Timings;

const TOMORROW = { Fajr: '05:14' } as unknown as Timings;

/** 2026-07-31, 12:00 lokale Zeit. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 6, 31, hour, minute, 0, 0);
}

describe('widgetUpdateTimestamps', () => {
  it('plant jeden noch kommenden Gebetszeit-Wechsel des Tages', () => {
    const times = widgetUpdateTimestamps(TODAY, TOMORROW, at(12));
    // Dhuhr, Asr, Maghrib, Isha (Fadschr ist um 12:00 vorbei) + Fadschr morgen
    // + Mitternacht = 6.
    expect(times).toHaveLength(6);
    expect(new Date(times[0]).getHours()).toBe(13);
    expect(new Date(times[1]).getHours()).toBe(16);
  });

  it('liegt kurz NACH dem Wechsel, nicht davor', () => {
    // Feuerte der Alarm in der Sekunde vor der Gebetszeit, stünde im Widget
    // weiterhin das alte „nächstes Gebet".
    const [first] = widgetUpdateTimestamps(TODAY, TOMORROW, at(12));
    const dhuhr = new Date(2026, 6, 31, 13, 20, 0, 0).getTime();
    expect(first).toBeGreaterThan(dhuhr);
    expect(first - dhuhr).toBeLessThanOrEqual(60_000);
  });

  it('lässt bereits vergangene Zeitpunkte weg', () => {
    const times = widgetUpdateTimestamps(TODAY, TOMORROW, at(23));
    const nowMs = at(23).getTime();
    expect(times.every((t) => t > nowMs)).toBe(true);
    // Nach Isha bleiben nur noch Mitternacht und der morgige Fadschr.
    expect(times).toHaveLength(2);
  });

  it('plant den Tageswechsel mit, damit Datum und Tagesliste umspringen', () => {
    const times = widgetUpdateTimestamps(TODAY, TOMORROW, at(23));
    const midnight = new Date(2026, 7, 1, 0, 0, 5, 0).getTime();
    expect(times).toContain(midnight);
  });

  it('ist aufsteigend sortiert und ohne Dubletten', () => {
    const times = widgetUpdateTimestamps(TODAY, TOMORROW, at(0, 30));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it('überspringt leere Zeitangaben, statt auf 1970 zu planen', () => {
    const broken = { ...TODAY, Asr: '' } as unknown as Timings;
    const times = widgetUpdateTimestamps(broken, TOMORROW, at(12));
    expect(times).toHaveLength(5);
    expect(times.every((t) => t > at(12).getTime())).toBe(true);
  });
});
