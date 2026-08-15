import { dayOfYear, pickVerseOfDayRef, VERSE_OF_DAY_POOL } from './pool';

describe('dayOfYear', () => {
  it('liefert 1 für den 1. Januar', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it('liefert 32 für den 1. Februar (Januar hat 31 Tage)', () => {
    expect(dayOfYear(new Date(2026, 1, 1))).toBe(32);
  });

  it('liefert 366 für den 31. Dezember eines Schaltjahres', () => {
    expect(dayOfYear(new Date(2028, 11, 31))).toBe(366); // 2028 ist ein Schaltjahr
  });

  it('liefert 365 für den 31. Dezember eines Nicht-Schaltjahres', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });
});

describe('pickVerseOfDayRef', () => {
  it('ist deterministisch: derselbe Kalendertag liefert immer denselben Eintrag', () => {
    const date = new Date(2026, 6, 19);
    const first = pickVerseOfDayRef(date);
    const second = pickVerseOfDayRef(new Date(2026, 6, 19, 23, 59));
    expect(first).toEqual(second);
  });

  it('rotiert an unterschiedlichen Tagen durch den Pool (nicht überall derselbe Eintrag)', () => {
    const picks = new Set(
      Array.from({ length: VERSE_OF_DAY_POOL.length }, (_, i) =>
        JSON.stringify(pickVerseOfDayRef(new Date(2026, 0, 1 + i))),
      ),
    );
    // Bei so vielen aufeinanderfolgenden Tagen wie der Pool groß ist, muss
    // jeder Pool-Eintrag genau einmal getroffen werden (Modulo-Rotation).
    expect(picks.size).toBe(VERSE_OF_DAY_POOL.length);
  });

  it('bleibt innerhalb der Pool-Grenzen (kein undefined durch Modulo-Fehler)', () => {
    for (let day = 1; day <= 366; day++) {
      const date = new Date(2028, 0, day); // 2028: Schaltjahr, deckt Tag 366 ab
      const ref = pickVerseOfDayRef(date);
      expect(VERSE_OF_DAY_POOL).toContainEqual(ref);
    }
  });

  it('wechselt den Eintrag exakt beim Wrap-Around nach Pool-Größe Tagen', () => {
    const start = new Date(2026, 0, 1);
    const wrapped = new Date(2026, 0, 1 + VERSE_OF_DAY_POOL.length);
    expect(pickVerseOfDayRef(start)).toEqual(pickVerseOfDayRef(wrapped));
  });
});
