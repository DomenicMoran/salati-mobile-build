import {
  completedDays,
  dayIndexForDate,
  daysBehind,
  juzRangeForDay,
  pageRangeForDay,
  parsePlan,
  toggleDay,
  type KhatmahPlan,
} from './plan';
import { JUZ_START_PAGES, MUSHAF_TOTAL_PAGES } from '../quran/api';
import { calcZakat, parseAmount } from '../zakat/calc';
import { fastCountdown, formatDuration, timeToday } from '../fasting/store';
import { DIVINE_NAMES } from '../names/names';

describe('khatmah plan', () => {
  const plan30: KhatmahPlan = { startDay: '2026-07-01', days: 30, completed: {} };

  it('30 Tage = 1 Juz pro Tag, lückenlos bis 30', () => {
    expect(juzRangeForDay(plan30, 0)).toEqual({ from: 1, to: 1 });
    expect(juzRangeForDay(plan30, 29)).toEqual({ from: 30, to: 30 });
  });

  it('7 Tage decken alle 30 Juz ab', () => {
    const plan7: KhatmahPlan = { startDay: '2026-07-01', days: 7, completed: {} };
    let covered = 0;
    for (let i = 0; i < 7; i++) {
      const r = juzRangeForDay(plan7, i);
      covered += r.to - r.from + 1;
    }
    expect(covered).toBe(30);
    expect(juzRangeForDay(plan7, 6).to).toBe(30);
  });

  it('dayIndex und Rückstand', () => {
    expect(dayIndexForDate(plan30, '2026-07-01')).toBe(0);
    expect(dayIndexForDate(plan30, '2026-07-05')).toBe(4);
    expect(dayIndexForDate(plan30, '2026-12-31')).toBe(29); // geklemmt
    // Tag 5 (Index 4) und nichts erledigt → 4 VERGANGENE Tage Rückstand
    // (der laufende Tag 5 zählt nicht als Rückstand)
    expect(daysBehind(plan30, '2026-07-05')).toBe(4);
    // Am Starttag ist man nie im Rückstand
    expect(daysBehind(plan30, '2026-07-01')).toBe(0);
    const some = { ...plan30, completed: { 0: true, 1: true, 2: true, 3: true, 4: true } };
    expect(daysBehind(some, '2026-07-05')).toBe(0);
  });

  it('dayIndex bleibt korrekt über eine DST-Umstellung hinweg (2026-03-29 in DE)', () => {
    // 2026-03-25 -> 2026-04-01 sind exakt 7 Kalendertage, obwohl der 29.03.
    // (Sommerzeit-Beginn) lokal nur 23 Stunden hat. Millisekunden-Division
    // auf lokalen Mitternächten würde hier fälschlich 6 statt 7 liefern.
    const plan: KhatmahPlan = { startDay: '2026-03-25', days: 30, completed: {} };
    expect(dayIndexForDate(plan, '2026-04-01')).toBe(7);
  });

  it('toggle + completedDays + parse defensiv', () => {
    const next = toggleDay(plan30, 3);
    expect(completedDays(next)).toBe(1);
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan('kaputt')).toBeNull();
  });

  it('pageRangeForDay: Tagesseitenbereich aus Juz-Startseiten', () => {
    // 30-Tage-Plan = 1 Juz/Tag: Tag 1 (Index 0) = Juz 1 = Seite 1 bis Seite vor Juz-2-Start (22-1=21).
    expect(pageRangeForDay(plan30, 0, JUZ_START_PAGES, MUSHAF_TOTAL_PAGES)).toEqual({ from: 1, to: 21 });
    // letzter Tag (Juz 30) reicht bis zur letzten Mushaf-Seite.
    expect(pageRangeForDay(plan30, 29, JUZ_START_PAGES, MUSHAF_TOTAL_PAGES)).toEqual({
      from: 582,
      to: MUSHAF_TOTAL_PAGES,
    });
    // 7-Tage-Plan deckt lückenlos alle 604 Seiten ab.
    const plan7: KhatmahPlan = { startDay: '2026-07-01', days: 7, completed: {} };
    let coveredPages = 0;
    for (let i = 0; i < 7; i++) {
      const r = pageRangeForDay(plan7, i, JUZ_START_PAGES, MUSHAF_TOTAL_PAGES);
      coveredPages += r.to - r.from + 1;
    }
    expect(coveredPages).toBe(MUSHAF_TOTAL_PAGES);
  });
});

describe('zakat', () => {
  it('über Nisab: 2,5 % der Basis', () => {
    const r = calcZakat({ cash: 10000, goldValue: 0, silverValue: 0, businessAssets: 0, debts: 0, goldPricePerGram: 80 });
    expect(r.nisab).toBe(6800);
    expect(r.aboveNisab).toBe(true);
    expect(r.due).toBeCloseTo(250);
  });

  it('unter Nisab: keine Zakat; Schulden mindern die Basis', () => {
    const r = calcZakat({ cash: 7000, goldValue: 0, silverValue: 0, businessAssets: 0, debts: 1000, goldPricePerGram: 80 });
    expect(r.base).toBe(6000);
    expect(r.aboveNisab).toBe(false);
    expect(r.due).toBe(0);
  });

  it('parseAmount toleriert Formate', () => {
    expect(parseAmount('1.234,56')).toBeCloseTo(1234.56);
    expect(parseAmount('1234.56')).toBeCloseTo(1234.56);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('fasting countdown', () => {
  it('vor Fajr = suhoor, tagsüber = iftar, danach = done', () => {
    const base = new Date(2026, 6, 13, 2, 0);
    expect(fastCountdown('03:30', '21:30', base).phase).toBe('suhoor');
    expect(fastCountdown('03:30', '21:30', new Date(2026, 6, 13, 12, 0)).phase).toBe('iftar');
    expect(fastCountdown('03:30', '21:30', new Date(2026, 6, 13, 22, 0)).phase).toBe('done');
  });

  it('formatDuration h:mm', () => {
    expect(formatDuration(90 * 60_000)).toBe('1:30');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('timeToday baut heutige Uhrzeit', () => {
    const d = timeToday('05:45', new Date(2026, 6, 13, 12, 0));
    expect(d.getHours()).toBe(5);
    expect(d.getMinutes()).toBe(45);
    expect(d.getDate()).toBe(13);
  });
});

describe('99 Namen', () => {
  it('genau 99 Einträge, Nummern 1–99, keine Duplikate', () => {
    expect(DIVINE_NAMES).toHaveLength(99);
    expect(DIVINE_NAMES[0].n).toBe(1);
    expect(DIVINE_NAMES[98].n).toBe(99);
    expect(new Set(DIVINE_NAMES.map((n) => n.arabic)).size).toBe(99);
    for (const n of DIVINE_NAMES) {
      expect(n.arabic.length).toBeGreaterThan(0);
      expect(n.de.length).toBeGreaterThan(0);
      expect(n.en.length).toBeGreaterThan(0);
      expect(n.tr.length).toBeGreaterThan(0);
    }
  });
});
