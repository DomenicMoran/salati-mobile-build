import { buildWeekRows, mondayFirstWeekdayIdx } from './week';

const TIMINGS = {
  Fajr: '04:30',
  Sunrise: '06:00',
  Dhuhr: '13:15',
  Asr: '17:30',
  Maghrib: '21:20',
  Isha: '23:10',
};

describe('mondayFirstWeekdayIdx', () => {
  it('mappt Montag auf 0', () => {
    // 2026-07-20 ist ein Montag
    expect(mondayFirstWeekdayIdx(new Date(2026, 6, 20))).toBe(0);
  });

  it('mappt Sonntag auf 6 (nicht 0 wie Date.getDay())', () => {
    // 2026-07-19 ist ein Sonntag
    expect(mondayFirstWeekdayIdx(new Date(2026, 6, 19))).toBe(6);
  });

  it('mappt Samstag auf 5', () => {
    expect(mondayFirstWeekdayIdx(new Date(2026, 6, 18))).toBe(5);
  });
});

describe('buildWeekRows', () => {
  it('restauriert Datumswerte nach einem JSON-Cache-Roundtrip ohne Mutation', () => {
    const date = new Date(2026, 6, 20, 12);
    const cached = JSON.parse(JSON.stringify([{ date, timings: TIMINGS }]));
    const rows = buildWeekRows(cached, new Date(2026, 6, 20, 18));
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBeInstanceOf(Date);
    expect(rows[0].date.getTime()).toBe(date.getTime());
    expect(rows[0]).toMatchObject({ weekdayIdx: 0, isToday: true, timings: TIMINGS });
    expect(typeof cached[0].date).toBe('string');
  });

  it('ignoriert ungueltige Cache-Daten statt die gesamte App abzustuerzen', () => {
    const rows = buildWeekRows([
      { date: 'invalid', timings: TIMINGS },
      { date: new Date(NaN), timings: TIMINGS },
      { date: new Date(2026, 6, 21).toISOString(), timings: TIMINGS },
    ], new Date(2026, 6, 20));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weekdayIdx: 1, isToday: false });
  });

  it('gibt für jeden Tag eine Zeile mit Wochentag-Index und Timings zurück', () => {
    const days = [
      { date: new Date(2026, 6, 20), timings: TIMINGS },
      { date: new Date(2026, 6, 21), timings: TIMINGS },
    ];
    const rows = buildWeekRows(days, new Date(2026, 6, 20, 10, 0));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ weekdayIdx: 0, isToday: true, timings: TIMINGS });
    expect(rows[1]).toMatchObject({ weekdayIdx: 1, isToday: false, timings: TIMINGS });
  });

  it('markiert keine Zeile als heute, wenn now außerhalb des Fensters liegt', () => {
    const days = [{ date: new Date(2026, 6, 20), timings: TIMINGS }];
    const rows = buildWeekRows(days, new Date(2026, 6, 27));
    expect(rows[0]?.isToday).toBe(false);
  });

  it('behält die Reihenfolge der Eingabe bei und ignoriert Uhrzeit-Anteile beim Tagesvergleich', () => {
    const days = [{ date: new Date(2026, 6, 20, 23, 59), timings: TIMINGS }];
    const rows = buildWeekRows(days, new Date(2026, 6, 20, 0, 1));
    expect(rows[0]?.isToday).toBe(true);
  });

  it('gibt ein leeres Array für ein leeres Fenster zurück', () => {
    expect(buildWeekRows([], new Date())).toEqual([]);
  });
});
