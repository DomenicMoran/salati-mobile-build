import {
  EDITABLE_PAST_DAYS,
  canEditDay,
  completedCount,
  currentStreak,
  dayKey,
  earliestEditableDay,
  hasDayEntry,
  isDayComplete,
  isExemptDay,
  lastDays,
  parseTracker,
  shiftDayKey,
  toggleExemptDay,
  togglePrayer,
  type TrackerData,
} from './store';

const fullDay = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

describe('prayer tracker', () => {
  it('toggle setzt und entfernt', () => {
    let data: TrackerData = {};
    data = togglePrayer(data, '2026-07-13', 'fajr');
    expect(data['2026-07-13'].fajr).toBe(true);
    data = togglePrayer(data, '2026-07-13', 'fajr');
    expect(data['2026-07-13'].fajr).toBe(false);
  });

  it('completedCount und isDayComplete', () => {
    const data: TrackerData = { '2026-07-13': { fajr: true, dhuhr: true } };
    expect(completedCount(data, '2026-07-13')).toBe(2);
    expect(isDayComplete(data, '2026-07-13')).toBe(false);
    expect(isDayComplete({ '2026-07-13': fullDay }, '2026-07-13')).toBe(true);
  });

  it('Streak zählt zusammenhängende komplette Tage, heute optional', () => {
    const today = new Date(2026, 6, 13);
    const data: TrackerData = {
      '2026-07-11': fullDay,
      '2026-07-12': fullDay,
      // heute (13.) noch unvollständig
      '2026-07-13': { fajr: true },
    };
    expect(currentStreak(data, today)).toBe(2);
    // heute komplett → 3
    expect(currentStreak({ ...data, '2026-07-13': fullDay }, today)).toBe(3);
    // Lücke bricht die Serie
    expect(currentStreak({ '2026-07-10': fullDay }, today)).toBe(0);
  });

  it('lastDays liefert n Tage, älteste zuerst', () => {
    const days = lastDays({}, new Date(2026, 6, 13), 7);
    expect(days).toHaveLength(7);
    expect(days[0].day).toBe('2026-07-07');
    expect(days[6].day).toBe('2026-07-13');
    expect(days[0].exempt).toBe(false);
  });

  it('dayKey und parseTracker defensiv', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(parseTracker(null)).toEqual({});
    expect(parseTracker('{kaputt')).toEqual({});
    // Array statt Objekt darf nicht durchrutschen (typeof [] === 'object')
    expect(parseTracker('[]')).toEqual({});
    expect(parseTracker('null')).toEqual({});
  });
});

describe('shiftDayKey', () => {
  it('verschiebt vorwärts und rückwärts', () => {
    expect(shiftDayKey('2026-07-13', 1)).toBe('2026-07-14');
    expect(shiftDayKey('2026-07-13', -1)).toBe('2026-07-12');
    expect(shiftDayKey('2026-07-13', 0)).toBe('2026-07-13');
  });

  it('über Monats-, Jahres- und Schaltjahresgrenzen', () => {
    expect(shiftDayKey('2026-07-31', 1)).toBe('2026-08-01');
    expect(shiftDayKey('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31');
    // 2028 ist ein Schaltjahr, 2026 nicht
    expect(shiftDayKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDayKey('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('ist an DST-Umstellungstagen exakt (deshalb UTC-Arithmetik)', () => {
    // Europa: Sommerzeitbeginn 29.03.2026 (23-Stunden-Tag), Ende 25.10.2026
    // (25-Stunden-Tag). Eine Millisekunden-Addition auf lokaler Zeit läge hier
    // um einen Tag daneben.
    expect(shiftDayKey('2026-03-28', 1)).toBe('2026-03-29');
    expect(shiftDayKey('2026-03-29', 1)).toBe('2026-03-30');
    expect(shiftDayKey('2026-03-30', -1)).toBe('2026-03-29');
    expect(shiftDayKey('2026-10-24', 1)).toBe('2026-10-25');
    expect(shiftDayKey('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftDayKey('2026-10-26', -1)).toBe('2026-10-25');
    // USA: Umstellung am 08.03.2026 bzw. 01.11.2026
    expect(shiftDayKey('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftDayKey('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('30 Schritte zurück und wieder vor landen am Ausgangstag', () => {
    let key = '2026-03-15';
    for (let i = 0; i < 30; i++) key = shiftDayKey(key, -1);
    expect(key).toBe('2026-02-13');
    for (let i = 0; i < 30; i++) key = shiftDayKey(key, 1);
    expect(key).toBe('2026-03-15');
  });
});

describe('Nachtragen: Grenzen des bearbeitbaren Zeitraums', () => {
  const today = new Date(2026, 6, 13); // 13.07.2026

  it('heute und gestern sind bearbeitbar', () => {
    expect(canEditDay('2026-07-13', today)).toBe(true);
    expect(canEditDay('2026-07-12', today)).toBe(true);
  });

  it('Zukunft ist nie bearbeitbar', () => {
    expect(canEditDay('2026-07-14', today)).toBe(false);
    expect(canEditDay('2026-12-24', today)).toBe(false);
    expect(canEditDay('2027-01-01', today)).toBe(false);
  });

  it('genau EDITABLE_PAST_DAYS zurück ist noch erlaubt, ein Tag mehr nicht', () => {
    const earliest = earliestEditableDay(today);
    expect(earliest).toBe('2026-06-13');
    expect(canEditDay(earliest, today)).toBe(true);
    expect(canEditDay(shiftDayKey(earliest, -1), today)).toBe(false);
    expect(EDITABLE_PAST_DAYS).toBe(30);
  });

  it('die Grenze bleibt über einen Jahreswechsel hinweg korrekt', () => {
    // 03.01.2026 → 30 Tage zurück ist der 04.12.2025
    const januar = new Date(2026, 0, 3);
    expect(earliestEditableDay(januar)).toBe('2025-12-04');
    expect(canEditDay('2025-12-04', januar)).toBe(true);
    expect(canEditDay('2025-12-03', januar)).toBe(false);
  });

  it('die Grenze bleibt über eine DST-Umstellung hinweg korrekt', () => {
    // 10.04.2026, Sommerzeit begann am 29.03. — 30 Tage zurück ist der 11.03.
    const april = new Date(2026, 3, 10);
    expect(earliestEditableDay(april)).toBe('2026-03-11');
    expect(canEditDay('2026-03-11', april)).toBe(true);
    expect(canEditDay('2026-03-10', april)).toBe(false);
  });

  it('die Tageszeit spielt keine Rolle (kurz vor und nach Mitternacht)', () => {
    const frueh = new Date(2026, 6, 13, 0, 1);
    const spaet = new Date(2026, 6, 13, 23, 59);
    for (const now of [frueh, spaet]) {
      expect(canEditDay('2026-07-13', now)).toBe(true);
      expect(canEditDay('2026-07-14', now)).toBe(false);
    }
  });
});

describe('befreite Tage', () => {
  it('werden gesetzt und wieder entfernt', () => {
    let data: TrackerData = {};
    data = toggleExemptDay(data, '2026-07-12');
    expect(isExemptDay(data, '2026-07-12')).toBe(true);
    data = toggleExemptDay(data, '2026-07-12');
    expect(isExemptDay(data, '2026-07-12')).toBe(false);
  });

  it('lassen bereits abgehakte Gebete unangetastet', () => {
    const data = toggleExemptDay({ '2026-07-12': { fajr: true } }, '2026-07-12');
    expect(data['2026-07-12'].fajr).toBe(true);
    expect(completedCount(data, '2026-07-12')).toBe(1);
  });

  it('brechen die Serie nicht, verlängern sie aber auch nicht', () => {
    const today = new Date(2026, 6, 13);
    const data: TrackerData = {
      '2026-07-10': fullDay,
      '2026-07-11': { exempt: true },
      '2026-07-12': fullDay,
      '2026-07-13': fullDay,
    };
    // 13. und 12. zählen, der 11. wird übersprungen, der 10. zählt → 3
    expect(currentStreak(data, today)).toBe(3);
  });

  it('mehrere befreite Tage am Stück werden übersprungen', () => {
    const today = new Date(2026, 6, 13);
    const data: TrackerData = {
      '2026-07-08': fullDay,
      '2026-07-09': { exempt: true },
      '2026-07-10': { exempt: true },
      '2026-07-11': { exempt: true },
      '2026-07-12': fullDay,
      '2026-07-13': fullDay,
    };
    expect(currentStreak(data, today)).toBe(3);
  });

  it('ein befreiter heutiger Tag lässt die Serie von gestern weiterlaufen', () => {
    const today = new Date(2026, 6, 13);
    const data: TrackerData = {
      '2026-07-11': fullDay,
      '2026-07-12': fullDay,
      '2026-07-13': { exempt: true },
    };
    expect(currentStreak(data, today)).toBe(2);
  });

  it('eine echte Lücke bricht die Serie auch neben befreiten Tagen', () => {
    const today = new Date(2026, 6, 13);
    const data: TrackerData = {
      '2026-07-10': fullDay,
      '2026-07-11': { fajr: true }, // unvollständig, nicht befreit
      '2026-07-12': { exempt: true },
      '2026-07-13': fullDay,
    };
    expect(currentStreak(data, today)).toBe(1);
  });

  it('lückenlos befreite Tage laufen nicht endlos (Abbruchgrenze greift)', () => {
    const today = new Date(2026, 6, 13);
    const data: TrackerData = {};
    let key = dayKey(today);
    for (let i = 0; i < 200; i++) {
      data[key] = { exempt: true };
      key = shiftDayKey(key, -1);
    }
    expect(currentStreak(data, today)).toBe(0);
  });

  it('werden in lastDays ausgewiesen', () => {
    const days = lastDays({ '2026-07-12': { exempt: true } }, new Date(2026, 6, 13), 7);
    expect(days.find((d) => d.day === '2026-07-12')).toEqual({ day: '2026-07-12', done: 0, exempt: true });
  });
});

describe('hasDayEntry', () => {
  it('ohne Eintrag falsch, mit Angabe wahr', () => {
    expect(hasDayEntry({}, '2026-07-12')).toBe(false);
    expect(hasDayEntry({ '2026-07-12': {} }, '2026-07-12')).toBe(false);
    expect(hasDayEntry({ '2026-07-12': { fajr: true } }, '2026-07-12')).toBe(true);
  });

  it('ein wieder abgewähltes Gebet bleibt eine Angabe', () => {
    expect(hasDayEntry({ '2026-07-12': { fajr: false } }, '2026-07-12')).toBe(true);
  });

  it('ein befreiter Tag gilt als erfasst', () => {
    expect(hasDayEntry({ '2026-07-12': { exempt: true } }, '2026-07-12')).toBe(true);
  });
});
