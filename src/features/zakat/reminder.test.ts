import { HIJRI_YEAR_DAYS, nextZakatDueDate } from './reminder';

describe('nextZakatDueDate', () => {
  it('gibt den ersten Jahrestag zurück, wenn er noch in der Zukunft liegt', () => {
    const anchor = new Date(2026, 0, 1);
    const now = new Date(2026, 5, 1);
    const due = nextZakatDueDate(anchor, now);
    const expected = new Date(2026, 0, 1);
    expected.setDate(expected.getDate() + HIJRI_YEAR_DAYS);
    expect(due.getTime()).toBe(expected.getTime());
  });

  it('springt über bereits verstrichene Jahrestage, bis einer in der Zukunft liegt', () => {
    const anchor = new Date(2020, 0, 1);
    const now = new Date(2026, 0, 1);
    const due = nextZakatDueDate(anchor, now);
    expect(due.getTime()).toBeGreaterThan(now.getTime());
    // Der vorherige Jahrestag muss <= now liegen (sonst wäre er nicht "übersprungen" worden)
    const prev = new Date(due);
    prev.setDate(prev.getDate() - HIJRI_YEAR_DAYS);
    expect(prev.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('liegt der Rückgabewert immer strikt nach now', () => {
    const anchor = new Date(2026, 3, 15);
    const now = new Date(2026, 3, 15); // exakt am Stichtag
    const due = nextZakatDueDate(anchor, now);
    expect(due.getTime()).toBeGreaterThan(now.getTime());
  });
});
