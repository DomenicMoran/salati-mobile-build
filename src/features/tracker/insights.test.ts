import {
  PATTERN_WINDOW_DAYS,
  completionRatio,
  missedPattern,
  monthDays,
  monthLeadingBlanks,
  monthStats,
  statsForDays,
  weeklyTrend,
  windowDays,
} from './insights';
import { shiftDayKey, type TrackerData } from './store';

const fullDay = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

describe('monthLeadingBlanks', () => {
  it('Montag als Wochenbeginn (Mo=0)', () => {
    // 01.07.2026 ist ein Mittwoch → 2 Leerzellen
    expect(monthLeadingBlanks(2026, 7)).toBe(2);
    // 01.06.2026 ist ein Montag → keine Leerzelle
    expect(monthLeadingBlanks(2026, 6)).toBe(0);
    // 01.02.2026 ist ein Sonntag → 6 Leerzellen
    expect(monthLeadingBlanks(2026, 2)).toBe(6);
  });
});

describe('monthDays', () => {
  const today = new Date(2026, 6, 13); // 13.07.2026

  it('liefert die richtige Anzahl Tage je Monat, auch im Schaltjahr', () => {
    expect(monthDays({}, 2026, 7, today, 30)).toHaveLength(31);
    expect(monthDays({}, 2026, 6, today, 30)).toHaveLength(30);
    expect(monthDays({}, 2026, 2, today, 30)).toHaveLength(28);
    expect(monthDays({}, 2028, 2, today, 30)).toHaveLength(29);
  });

  it('kennzeichnet heute, Zukunft und Bearbeitbarkeit', () => {
    const days = monthDays({}, 2026, 7, today, 30);
    const byDate = (n: number) => days[n - 1];

    expect(byDate(13)).toMatchObject({ day: '2026-07-13', isToday: true, future: false, editable: true });
    expect(byDate(14)).toMatchObject({ isToday: false, future: true, editable: false });
    expect(byDate(31)).toMatchObject({ future: true, editable: false });
    expect(byDate(1)).toMatchObject({ future: false, editable: true });
  });

  it('macht Tage jenseits des Nachtrag-Fensters nicht bearbeitbar', () => {
    // Fenster 30 Tage ab 13.07. → 13.06. ist der älteste bearbeitbare Tag
    const juni = monthDays({}, 2026, 6, today, 30);
    expect(juni[12]).toMatchObject({ day: '2026-06-13', editable: true });
    expect(juni[11]).toMatchObject({ day: '2026-06-12', editable: false, future: false });
  });

  it('übernimmt Zählstand, Befreiung und Erfassungs-Zustand', () => {
    const data: TrackerData = {
      '2026-07-02': { fajr: true, dhuhr: true },
      '2026-07-03': { exempt: true },
    };
    const days = monthDays(data, 2026, 7, today, 30);
    expect(days[1]).toMatchObject({ done: 2, exempt: false, tracked: true });
    expect(days[2]).toMatchObject({ done: 0, exempt: true, tracked: true });
    expect(days[3]).toMatchObject({ done: 0, exempt: false, tracked: false });
  });

  it('bildet Tagesschlüssel mit führender Null', () => {
    expect(monthDays({}, 2026, 3, today, 30)[4].day).toBe('2026-03-05');
  });
});

describe('statsForDays', () => {
  it('zählt nur erfasste Tage, befreite getrennt', () => {
    const data: TrackerData = {
      '2026-07-01': fullDay,
      '2026-07-02': { fajr: true, dhuhr: true },
      '2026-07-03': { exempt: true },
      // 04.07. gar nicht erfasst
    };
    const stats = statsForDays(data, ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
    expect(stats).toEqual({
      elapsedDays: 4,
      trackedDays: 2,
      exemptDays: 1,
      fullDays: 1,
      prayersDone: 7,
      prayersPossible: 10,
    });
  });

  it('ein nicht erfasster Tag zählt NICHT als verpasster Tag', () => {
    const stats = statsForDays({}, ['2026-07-01', '2026-07-02']);
    expect(stats.trackedDays).toBe(0);
    expect(stats.prayersPossible).toBe(0);
    expect(completionRatio(stats)).toBeNull();
  });

  it('ein befreiter Tag steht weder im Zähler noch im Nenner', () => {
    const stats = statsForDays({ '2026-07-01': { exempt: true } }, ['2026-07-01']);
    expect(stats.trackedDays).toBe(0);
    expect(stats.exemptDays).toBe(1);
    expect(stats.prayersDone).toBe(0);
    expect(stats.prayersPossible).toBe(0);
  });

  it('ein befreiter Tag mit alten Häkchen wird trotzdem nicht mitgezählt', () => {
    const stats = statsForDays({ '2026-07-01': { ...fullDay, exempt: true } }, ['2026-07-01']);
    expect(stats).toMatchObject({ trackedDays: 0, exemptDays: 1, prayersDone: 0, fullDays: 0 });
  });
});

describe('monthStats', () => {
  it('lässt künftige Tage des laufenden Monats außen vor', () => {
    const today = new Date(2026, 6, 13);
    const stats = monthStats({ '2026-07-01': fullDay }, 2026, 7, today);
    expect(stats.elapsedDays).toBe(13); // 1.-13.07., nicht 31
    expect(stats.trackedDays).toBe(1);
    expect(stats.prayersDone).toBe(5);
  });

  it('ein vollständig vergangener Monat zählt alle seine Tage', () => {
    const today = new Date(2026, 6, 13);
    expect(monthStats({}, 2026, 6, today).elapsedDays).toBe(30);
  });

  it('ein künftiger Monat hat keine vergangenen Tage', () => {
    const today = new Date(2026, 6, 13);
    expect(monthStats({}, 2026, 8, today).elapsedDays).toBe(0);
  });
});

describe('windowDays', () => {
  it('endet gestern und beginnt mit dem ältesten Tag', () => {
    const days = windowDays(new Date(2026, 6, 13), 30);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2026-06-13');
    expect(days[29]).toBe('2026-07-12');
    expect(days).not.toContain('2026-07-13');
  });

  it('läuft korrekt über den Monatswechsel', () => {
    const days = windowDays(new Date(2026, 2, 3), 5); // 03.03.2026
    expect(days).toEqual(['2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });
});

describe('missedPattern', () => {
  const today = new Date(2026, 6, 13);

  function trackedDay(missing: string[] = []) {
    const day = { ...fullDay } as Record<string, boolean>;
    for (const m of missing) day[m] = false;
    return day;
  }

  it('nennt das am häufigsten fehlende Gebet', () => {
    const data: TrackerData = {
      '2026-07-10': trackedDay(['fajr']),
      '2026-07-11': trackedDay(['fajr']),
      '2026-07-12': trackedDay(['isha']),
    };
    const pattern = missedPattern(data, today);
    expect(pattern.trackedDays).toBe(3);
    expect(pattern.mostMissed).toEqual({ prayer: 'fajr', missed: 2 });
  });

  it('nennt bei Gleichstand kein Gebet (kein erfundenes Muster)', () => {
    const data: TrackerData = {
      '2026-07-11': trackedDay(['fajr']),
      '2026-07-12': trackedDay(['isha']),
    };
    expect(missedPattern(data, today).mostMissed).toBeNull();
  });

  it('nennt nichts, wenn kein Gebet gefehlt hat', () => {
    const pattern = missedPattern({ '2026-07-12': fullDay }, today);
    expect(pattern.mostMissed).toBeNull();
    expect(pattern.rows.every((r) => r.missed === 0)).toBe(true);
  });

  it('ignoriert nicht erfasste Tage vollständig', () => {
    const pattern = missedPattern({ '2026-07-12': trackedDay(['fajr']) }, today);
    expect(pattern.trackedDays).toBe(1);
    expect(pattern.rows.find((r) => r.prayer === 'fajr')?.missed).toBe(1);
    // die übrigen 29 Tage des Fensters sind ohne Angabe und zählen nicht mit
    expect(pattern.rows.find((r) => r.prayer === 'isha')?.missed).toBe(0);
  });

  it('ignoriert befreite Tage', () => {
    const data: TrackerData = { '2026-07-11': { exempt: true }, '2026-07-12': fullDay };
    const pattern = missedPattern(data, today);
    expect(pattern.trackedDays).toBe(1);
    expect(pattern.rows.every((r) => r.missed === 0)).toBe(true);
  });

  it('lässt den heutigen Tag außen vor (noch nicht fällige Gebete)', () => {
    const data: TrackerData = { '2026-07-13': { fajr: true } };
    const pattern = missedPattern(data, today);
    expect(pattern.trackedDays).toBe(0);
    expect(pattern.rows.every((r) => r.missed === 0)).toBe(true);
  });

  it('reicht genau PATTERN_WINDOW_DAYS zurück, nicht weiter', () => {
    const aeltester = shiftDayKey('2026-07-13', -PATTERN_WINDOW_DAYS);
    const zuAlt = shiftDayKey(aeltester, -1);
    expect(missedPattern({ [aeltester]: fullDay }, today).trackedDays).toBe(1);
    expect(missedPattern({ [zuAlt]: fullDay }, today).trackedDays).toBe(0);
  });
});

describe('weeklyTrend', () => {
  const today = new Date(2026, 6, 13);

  it('liefert 4 Blöcke à 7 Tage, ältester zuerst, endend gestern', () => {
    const weeks = weeklyTrend({}, today);
    expect(weeks).toHaveLength(4);
    expect(weeks[0].startDay).toBe('2026-06-15');
    expect(weeks[3].endDay).toBe('2026-07-12');
    for (const w of weeks) expect(w.stats.elapsedDays).toBe(7);
  });

  it('rechnet je Block nur über erfasste Tage', () => {
    const data: TrackerData = {
      '2026-07-10': fullDay,
      '2026-07-11': { fajr: true },
      '2026-07-12': { exempt: true },
    };
    const letzte = weeklyTrend(data, today)[3];
    expect(letzte.stats).toMatchObject({ trackedDays: 2, prayersDone: 6, prayersPossible: 10, exemptDays: 1 });
    expect(completionRatio(letzte.stats)).toBeCloseTo(0.6);
  });

  it('ein Block ohne Erfassung liefert kein Verhältnis statt 0 %', () => {
    expect(completionRatio(weeklyTrend({}, today)[0].stats)).toBeNull();
  });

  it('läuft über einen Jahreswechsel korrekt', () => {
    const weeks = weeklyTrend({}, new Date(2026, 0, 5)); // 05.01.2026
    expect(weeks[0].startDay).toBe('2025-12-08');
    expect(weeks[3].endDay).toBe('2026-01-04');
  });
});
