import { daysBetween, dayIndexSince, dayKeyToUtcMs } from './dateKey';
import { dayIndexForDate as khatmahDayIndex, daysBehind as khatmahDaysBehind } from '@/features/khatmah/plan';
import {
  dayIndexForDate as journeyDayIndex,
  daysBehind as journeyDaysBehind,
} from '@/features/themes/journeyProgress';

describe('daysBetween', () => {
  it('zaehlt normale Kalendertage', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2026-01-01', '2026-02-01')).toBe(31);
  });

  it('wird negativ, wenn das Ziel frueher liegt', () => {
    expect(daysBetween('2026-01-10', '2026-01-03')).toBe(-7);
  });

  it('rechnet ueber Monats- und Jahresgrenzen (inkl. Schaltjahr 2028)', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
  });

  it('dayKeyToUtcMs liefert Mitternacht UTC', () => {
    expect(dayKeyToUtcMs('2026-03-29')).toBe(Date.UTC(2026, 2, 29));
  });
});

// Der eigentliche Regressionstest: journeyProgress.ts rechnete frueher ueber
// zwei LOKALE Mitternachts-Dates mit Math.floor(diff / 86_400_000). An einem
// DST-Umstellungstag hat der lokale Tag 23 bzw. 25 Stunden — die Differenz ist
// dann kein exaktes Vielfaches von 86_400_000 mehr und der Index kippt um 1.
describe('DST-Umstellungstage', () => {
  const alteBerechnung = (start: string, heute: string): number =>
    Math.floor((new Date(`${heute}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000);

  it('Sommerzeit-Beginn 2026-03-29 (DE): Tag 28.03. -> 30.03. sind 2 Tage', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(dayIndexSince('2026-03-28', '2026-03-30', 30)).toBe(2);
  });

  it('Winterzeit-Ende 2026-10-25 (DE): 24.10. -> 26.10. sind 2 Tage', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('liefert unabhaengig von der Prozess-Zeitzone dieselbe Zahl wie die Kalenderdifferenz', () => {
    // In einer Zeitzone MIT DST weicht die alte Rechnung ueber den
    // Umstellungstag ab; die neue niemals. Wo die alte zufaellig stimmt
    // (Prozess laeuft in UTC), ist der Test trotzdem gruen — er fixiert das
    // korrekte Ergebnis, nicht die Abweichung.
    for (const [start, heute, erwartet] of [
      ['2026-03-28', '2026-03-29', 1],
      ['2026-03-28', '2026-04-05', 8],
      ['2026-10-24', '2026-11-02', 9],
    ] as const) {
      expect(daysBetween(start, heute)).toBe(erwartet);
      // Dokumentiert die frueher genutzte Formel — sie darf nie GROESSER sein.
      expect(alteBerechnung(start, heute)).toBeLessThanOrEqual(erwartet);
    }
  });
});

describe('dayIndexSince — Klemmung', () => {
  it('klemmt vor dem Start auf 0', () => {
    expect(dayIndexSince('2026-05-10', '2026-05-01', 30)).toBe(0);
  });

  it('klemmt am Planende auf totalDays - 1', () => {
    expect(dayIndexSince('2026-05-01', '2026-12-31', 30)).toBe(29);
  });

  it('bleibt bei totalDays = 0 auf 0 (kein negativer Index)', () => {
    expect(dayIndexSince('2026-05-01', '2026-12-31', 0)).toBe(0);
  });
});

describe('beide Aufrufer rechnen jetzt identisch', () => {
  const start = '2026-03-28';
  const heute = '2026-04-02';

  it('Khatmah und Themen-Reise liefern denselben Tagesindex', () => {
    const k = khatmahDayIndex({ startDay: start, days: 30, completed: {} }, heute);
    const j = journeyDayIndex({ journeyId: 'x', startDay: start, completed: {} }, 30, heute);
    expect(k).toBe(5);
    expect(j).toBe(5);
  });

  it('und denselben Rueckstand', () => {
    const k = khatmahDaysBehind({ startDay: start, days: 30, completed: { 0: true, 1: true } }, heute);
    const j = journeyDaysBehind({ journeyId: 'x', startDay: start, completed: { 0: true, 1: true } }, 30, heute);
    expect(k).toBe(3);
    expect(j).toBe(3);
  });

  it('Rueckstand wird nie negativ (mehr erledigt als erwartet)', () => {
    const viel = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
    expect(khatmahDaysBehind({ startDay: start, days: 30, completed: viel }, heute)).toBe(0);
    expect(journeyDaysBehind({ journeyId: 'x', startDay: start, completed: viel }, 30, heute)).toBe(0);
  });
});
