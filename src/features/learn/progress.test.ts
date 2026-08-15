import { LESSONS } from './curriculum';
import {
  isPassed,
  isUnlocked,
  parseLearnProgress,
  passedCount,
  recordResult,
  type LearnProgress,
} from './progress';

const pass = (score = 8, total = 8) => ({ score, total, completedAt: 1 });

describe('isUnlocked', () => {
  it('erste Lektion ist immer frei', () => {
    expect(isUnlocked({}, LESSONS[0].id)).toBe(true);
  });

  it('zweite Lektion erst nach Bestehen der ersten', () => {
    expect(isUnlocked({}, LESSONS[1].id)).toBe(false);
    const progress: LearnProgress = { [LESSONS[0].id]: pass() };
    expect(isUnlocked(progress, LESSONS[1].id)).toBe(true);
  });

  it('unbekannte Lektion ist nie freigeschaltet', () => {
    expect(isUnlocked({}, 'gibt-es-nicht')).toBe(false);
  });
});

describe('isPassed', () => {
  it('70% reichen zum Bestehen, darunter nicht', () => {
    expect(isPassed({ x: { score: 7, total: 10, completedAt: 1 } }, 'x')).toBe(true);
    expect(isPassed({ x: { score: 6, total: 10, completedAt: 1 } }, 'x')).toBe(false);
  });
});

describe('recordResult', () => {
  it('speichert neues Ergebnis', () => {
    const next = recordResult({}, 'a', 5, 8, 99);
    expect(next.a).toEqual({ score: 5, total: 8, completedAt: 99 });
  });

  it('schlechtere Wiederholung überschreibt Bestleistung nicht', () => {
    const progress: LearnProgress = { a: { score: 8, total: 8, completedAt: 1 } };
    expect(recordResult(progress, 'a', 4, 8)).toBe(progress);
  });

  it('bessere Wiederholung überschreibt', () => {
    const progress: LearnProgress = { a: { score: 5, total: 8, completedAt: 1 } };
    const next = recordResult(progress, 'a', 7, 8, 2);
    expect(next.a.score).toBe(7);
  });
});

describe('passedCount / parseLearnProgress', () => {
  it('zählt nur bestandene Lektionen', () => {
    const progress: LearnProgress = {
      [LESSONS[0].id]: pass(),
      [LESSONS[1].id]: { score: 1, total: 8, completedAt: 1 },
    };
    expect(passedCount(progress)).toBe(1);
  });

  it('parst defensiv', () => {
    expect(parseLearnProgress(null)).toEqual({});
    expect(parseLearnProgress('kaputt{')).toEqual({});
    expect(parseLearnProgress('{"a":{"score":1,"total":2,"completedAt":3}}')).toEqual({
      a: { score: 1, total: 2, completedAt: 3 },
    });
    // Arrays sind kein gültiger LearnProgress (typeof [] === 'object' reicht nicht) — z. B.
    // über einen manipulierten Sync-Code als "salatibox:learn-progress":"[]" einschleusbar.
    expect(parseLearnProgress('[]')).toEqual({});
    expect(parseLearnProgress('null')).toEqual({});
  });
});
