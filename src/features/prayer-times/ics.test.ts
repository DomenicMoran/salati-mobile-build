import { buildPrayerIcs } from './ics';

const TIMINGS = {
  Fajr: '04:30',
  Sunrise: '06:00',
  Dhuhr: '13:15',
  Asr: '17:30',
  Maghrib: '21:20',
  Isha: '23:10',
};

const NAMES = {
  Fajr: 'Fajr',
  Dhuhr: 'Dhuhr',
  Asr: 'Asr',
  Maghrib: 'Maghrib',
  Isha: 'Isha',
} as const;

describe('buildPrayerIcs', () => {
  it('erzeugt 5 Events pro Tag mit korrekten lokalen Zeiten', () => {
    const ics = buildPrayerIcs(
      [{ date: new Date(2026, 6, 18), timings: TIMINGS }],
      NAMES,
      'Berlin, Deutschland',
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(ics).toContain('DTSTART:20260718T043000');
    expect(ics).toContain('DTEND:20260718T044000'); // +10 Minuten
    expect(ics).toContain('SUMMARY:Isha');
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('nutzt CRLF-Zeilenenden (RFC 5545)', () => {
    const ics = buildPrayerIcs([{ date: new Date(2026, 6, 18), timings: TIMINGS }], NAMES, 'X');
    expect(ics).toContain('\r\n');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
  });

  it('mehrere Tage ergeben eindeutige UIDs', () => {
    const ics = buildPrayerIcs(
      [
        { date: new Date(2026, 6, 18), timings: TIMINGS },
        { date: new Date(2026, 6, 19), timings: TIMINGS },
      ],
      NAMES,
      'X',
    );
    const uids = ics.match(/UID:[^\r]+/g) ?? [];
    expect(uids).toHaveLength(10);
    expect(new Set(uids).size).toBe(10);
  });
});
