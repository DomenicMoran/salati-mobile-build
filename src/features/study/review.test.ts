import type { LearnProgress } from '@/features/learn/progress';
import {
  INTERVALS_DAYS,
  MAX_LEVEL,
  applyReviewResult,
  dueCandidates,
  isDue,
  parseReviewState,
  reviewKey,
} from './review';

const DAY = 24 * 60 * 60 * 1000;

describe('review scheduling', () => {
  it('isDue folgt den Intervallen je Level', () => {
    const now = 100 * DAY;
    expect(isDue({ level: 0, last: now - 1 * DAY }, now)).toBe(true);
    expect(isDue({ level: 0, last: now - 0.5 * DAY }, now)).toBe(false);
    expect(isDue({ level: 2, last: now - 6 * DAY }, now)).toBe(false);
    expect(isDue({ level: 2, last: now - 7 * DAY }, now)).toBe(true);
    // Level wird defensiv geklemmt
    expect(isDue({ level: 99, last: now - INTERVALS_DAYS[MAX_LEVEL] * DAY }, now)).toBe(true);
  });

  it('dueCandidates liefert nur bestandene, fällige Lektionen (learn-Kurs)', () => {
    const now = 100 * DAY;
    const progress: LearnProgress = {
      'letters-1': { score: 8, total: 8, completedAt: now - 2 * DAY }, // bestanden, fällig (Level 0 → 1 Tag)
      'letters-2': { score: 8, total: 8, completedAt: now - 0.2 * DAY }, // bestanden, noch nicht fällig
      'letters-3': { score: 2, total: 8, completedAt: now - 9 * DAY }, // nicht bestanden
    };
    const due = dueCandidates({ learn: progress }, {}, now);
    const ids = due.map((d) => d.lesson.id);
    expect(ids).toContain('letters-1');
    expect(ids).not.toContain('letters-2');
    expect(ids).not.toContain('letters-3');
    expect(due.find((d) => d.lesson.id === 'letters-1')?.key).toBe(reviewKey('learn', 'letters-1'));
  });

  it('applyReviewResult hebt/senkt Level und setzt last', () => {
    const now = 50 * DAY;
    const state = { 'learn:letters-1': { level: 2, last: 0 } };
    const up = applyReviewResult(state, ['learn:letters-1'], 0.9, now);
    expect(up['learn:letters-1']).toEqual({ level: 3, last: now });
    const down = applyReviewResult(state, ['learn:letters-1'], 0.4, now);
    expect(down['learn:letters-1']).toEqual({ level: 1, last: now });
    // Klemmen an den Rändern
    const top = applyReviewResult({ k: { level: MAX_LEVEL, last: 0 } }, ['k'], 1, now);
    expect(top.k.level).toBe(MAX_LEVEL);
    const bottom = applyReviewResult({ k: { level: 0, last: 0 } }, ['k'], 0, now);
    expect(bottom.k.level).toBe(0);
  });

  it('parseReviewState ist defensiv', () => {
    expect(parseReviewState(null)).toEqual({});
    expect(parseReviewState('kaputt')).toEqual({});
    expect(parseReviewState('{"a":{"level":1,"last":2}}')).toEqual({ a: { level: 1, last: 2 } });
    // Arrays sind kein gültiger ReviewState (typeof [] === 'object' reicht nicht) — z. B.
    // über einen manipulierten Sync-Code als "salatibox:review":"[]" einschleusbar.
    expect(parseReviewState('[]')).toEqual({});
    expect(parseReviewState('null')).toEqual({});
  });
});
