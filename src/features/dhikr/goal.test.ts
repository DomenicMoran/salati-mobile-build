import {
  crossesGoal,
  DEFAULT_DAILY_GOAL,
  lastTasbihDays,
  parseGoal,
  parseHistory,
  recordHistory,
  sanitizeGoal,
  type TasbihHistory,
} from './goal';

describe('tasbih Tagesziel', () => {
  it('parseGoal fällt auf den Standard zurück, wenn nichts gespeichert ist', () => {
    expect(parseGoal(null)).toBe(DEFAULT_DAILY_GOAL);
  });

  it('parseGoal liest eine gespeicherte Zahl', () => {
    expect(parseGoal('33')).toBe(33);
  });

  it('parseGoal ignoriert kaputte Werte', () => {
    expect(parseGoal('nope')).toBe(DEFAULT_DAILY_GOAL);
    expect(parseGoal('0')).toBe(DEFAULT_DAILY_GOAL);
    expect(parseGoal('-5')).toBe(DEFAULT_DAILY_GOAL);
  });

  it('sanitizeGoal rundet auf eine gültige ganze Zahl 1-9999', () => {
    expect(sanitizeGoal('250')).toBe(250);
    expect(sanitizeGoal('  99  ')).toBe(99);
    expect(sanitizeGoal('99999')).toBe(9999);
    expect(sanitizeGoal('abc')).toBe(DEFAULT_DAILY_GOAL);
    expect(sanitizeGoal('0')).toBe(DEFAULT_DAILY_GOAL);
  });

  it('crossesGoal feuert nur beim Überschreiten, nicht danach erneut', () => {
    expect(crossesGoal(99, 100, 100)).toBe(true);
    expect(crossesGoal(100, 101, 100)).toBe(false); // war schon drüber
    expect(crossesGoal(50, 60, 100)).toBe(false); // noch nicht erreicht
    expect(crossesGoal(0, 100, 100)).toBe(true); // ein Sprung direkt aufs Ziel
  });
});

describe('tasbih Verlauf', () => {
  it('parseHistory liefert leeres Objekt bei fehlendem/kaputtem Wert', () => {
    expect(parseHistory(null)).toEqual({});
    expect(parseHistory('{nope')).toEqual({});
    expect(parseHistory('[1,2,3]')).toEqual({});
  });

  it('parseHistory liest gespeicherte Tageswerte', () => {
    expect(parseHistory(JSON.stringify({ '2026-07-12': 133 }))).toEqual({ '2026-07-12': 133 });
  });

  it('recordHistory aktualisiert einen Tag, gibt bei unveränderten Werten dieselbe Referenz zurück', () => {
    const history: TasbihHistory = { '2026-07-12': 50 };
    const unchanged = recordHistory(history, '2026-07-12', 50);
    expect(unchanged).toBe(history);

    const updated = recordHistory(history, '2026-07-12', 60);
    expect(updated).toEqual({ '2026-07-12': 60 });
    expect(updated).not.toBe(history);
  });

  it('recordHistory ergänzt einen neuen Tag, ohne bestehende zu verlieren', () => {
    const history: TasbihHistory = { '2026-07-11': 10 };
    expect(recordHistory(history, '2026-07-12', 20)).toEqual({ '2026-07-11': 10, '2026-07-12': 20 });
  });

  it('lastTasbihDays liefert die letzten n Tage älteste zuerst, fehlende Tage als 0', () => {
    const today = new Date(2026, 6, 12); // 12. Juli 2026
    const history: TasbihHistory = { '2026-07-10': 33, '2026-07-12': 99 };
    const days = lastTasbihDays(history, today, 3);
    expect(days).toEqual([
      { day: '2026-07-10', total: 33 },
      { day: '2026-07-11', total: 0 },
      { day: '2026-07-12', total: 99 },
    ]);
  });
});
