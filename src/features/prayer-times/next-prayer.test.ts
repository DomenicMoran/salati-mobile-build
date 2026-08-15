import { formatClock, formatCountdown, formatHHMM, nextPrayer, parseTimeOn } from './next-prayer';
import type { Timings as ApiTimings } from './api';

const today: ApiTimings = {
  Fajr: '04:30',
  Sunrise: '06:10',
  Dhuhr: '13:15',
  Asr: '17:00',
  Maghrib: '20:45',
  Isha: '22:15',
};

const tomorrow: ApiTimings = {
  Fajr: '04:32',
  Sunrise: '06:12',
  Dhuhr: '13:15',
  Asr: '17:01',
  Maghrib: '20:43',
  Isha: '22:13',
};

function at(hh: number, mm: number): Date {
  const d = new Date(2026, 5, 15, hh, mm, 0, 0);
  return d;
}

describe('nextPrayer', () => {
  it('picks the next prayer later today', () => {
    const result = nextPrayer(today, tomorrow, at(12, 0));
    expect(result.nextPrayer).toBe('Dhuhr');
    expect(result.nextIdx).toBe(1);
    expect(result.diffMs).toBeGreaterThan(0);
  });

  it('picks Fajr right after midnight boundary within the same day timings', () => {
    const result = nextPrayer(today, tomorrow, at(0, 0));
    expect(result.nextPrayer).toBe('Fajr');
    expect(result.nextIdx).toBe(0);
  });

  it('rolls over to tomorrow Fajr once all of today has passed', () => {
    const result = nextPrayer(today, tomorrow, at(23, 0));
    expect(result.nextPrayer).toBe('Fajr');
    expect(result.nextIdx).toBe(-1);
    // Tomorrow's date, not today's
    expect(result.nextTs.getDate()).toBe(16);
    expect(result.nextTs.getHours()).toBe(4);
    expect(result.nextTs.getMinutes()).toBe(32);
  });

  it('clamps diffMs to 0, never negative', () => {
    const result = nextPrayer(today, tomorrow, at(23, 59));
    expect(result.diffMs).toBeGreaterThanOrEqual(0);
  });
});

describe('formatCountdown', () => {
  // Einheiten kommen seit dem Audit 2026-07-28 (T17) aus der Sprache; hier
  // stehen sie fest, damit der Test die Formatierung prueft und nicht die
  // Uebersetzung (die deckt countdown-units.test.ts ab).
  const units = { hours: 'h', minutes: 'm', seconds: 's' };

  it('formats hours/minutes/seconds with zero-padding', () => {
    expect(formatCountdown(3 * 3600_000 + 5 * 60_000 + 9_000, units)).toBe('3h 05m 09s');
  });

  it('formats sub-hour durations correctly', () => {
    expect(formatCountdown(65_000, units)).toBe('0h 01m 05s');
  });

  it('keeps number and unit together for right-to-left scripts', () => {
    expect(formatCountdown(65_000, { hours: 'س', minutes: 'د', seconds: 'ث' })).toBe('0س 01د 05ث');
  });
});

describe('formatClock', () => {
  it('formats 24h with zero-padding', () => {
    expect(formatClock(4, 5, '24h')).toBe('04:05');
    expect(formatClock(23, 59, '24h')).toBe('23:59');
  });

  it('formats 12h with AM/PM and midnight/noon edge cases', () => {
    expect(formatClock(0, 0, '12h')).toBe('12:00 AM');
    expect(formatClock(12, 0, '12h')).toBe('12:00 PM');
    expect(formatClock(13, 30, '12h')).toBe('1:30 PM');
    expect(formatClock(23, 5, '12h')).toBe('11:05 PM');
  });
});

describe('formatHHMM', () => {
  it('parses an Aladhan "HH:MM" string and reformats it', () => {
    expect(formatHHMM('04:30', '24h')).toBe('04:30');
    expect(formatHHMM('04:30', '12h')).toBe('4:30 AM');
    expect(formatHHMM('20:45', '12h')).toBe('8:45 PM');
  });
});

// Die Testläufe sind auf Europe/Berlin gepinnt (jest.config.js) — die beiden
// Umstellungstage 2026 sind damit fest: 29.03. (02:00 -> 03:00) und
// 25.10. (03:00 -> 02:00).
describe('parseTimeOn an der Zeitumstellung', () => {
  it('trifft an gewöhnlichen Tagen genau die Wanduhrzeit', () => {
    const d = parseTimeOn('13:15', new Date(2026, 5, 15));
    expect(d.getHours()).toBe(13);
    expect(d.getMinutes()).toBe(15);
    expect(d.getDate()).toBe(15);
  });

  it('überspringt in der Umstellungslücke keine volle Stunde', () => {
    // 02:30 existiert am 29.03. nicht. setHours() lieferte hier 03:30 — eine
    // Stunde zu spät; das war der Fehler. Erwartet ist der Umstellungs-
    // zeitpunkt selbst (03:00 Ortszeit = 01:00 UTC).
    const d = parseTimeOn('02:30', new Date(2026, 2, 29));
    expect(d.toISOString()).toBe('2026-03-29T01:00:00.000Z');
    expect(d.getTime()).toBeLessThan(new Date(2026, 2, 29, 3, 30).getTime());
  });

  it('zieht jede Minute der Lücke auf den Umstellungszeitpunkt', () => {
    for (let m = 0; m < 60; m++) {
      const hhmm = `02:${String(m).padStart(2, '0')}`;
      expect(parseTimeOn(hhmm, new Date(2026, 2, 29)).toISOString()).toBe('2026-03-29T01:00:00.000Z');
    }
  });

  it('nimmt bei der Rückstellung das erste Vorkommen der Uhrzeit', () => {
    // 02:30 gibt es am 25.10. zweimal: 00:30 UTC (Sommerzeit) und 01:30 UTC.
    const d = parseTimeOn('02:30', new Date(2026, 9, 25));
    expect(d.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('rechnet an den Umstellungstagen außerhalb der Lücke unverändert', () => {
    expect(parseTimeOn('04:55', new Date(2026, 9, 25)).toISOString()).toBe('2026-10-25T03:55:00.000Z');
    expect(parseTimeOn('04:48', new Date(2026, 2, 29)).toISOString()).toBe('2026-03-29T02:48:00.000Z');
  });

  it('ignoriert die Uhrzeit der Referenz und nimmt nur deren Kalendertag', () => {
    const a = parseTimeOn('05:00', new Date(2026, 5, 15, 23, 59, 59));
    const b = parseTimeOn('05:00', new Date(2026, 5, 15, 0, 0, 0));
    expect(a.getTime()).toBe(b.getTime());
  });
});
