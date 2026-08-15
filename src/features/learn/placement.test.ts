import { LESSONS } from './curriculum';
import {
  applyPlacement,
  checkpointPassed,
  PLACEMENT_CHECKPOINTS,
  recommendedNextLesson,
} from './placement';

describe('checkpointPassed', () => {
  it('passes at or above 70%', () => {
    expect(checkpointPassed(7, 10)).toBe(true);
    expect(checkpointPassed(6, 10)).toBe(false);
    expect(checkpointPassed(0, 0)).toBe(false);
  });
});

describe('applyPlacement', () => {
  it('marks all lessons up to and including the checkpoint as passed', () => {
    const idx = LESSONS.findIndex((l) => l.id === 'forms-3');
    const progress = applyPlacement({}, 'forms-3', 1000);
    for (let i = 0; i <= idx; i++) {
      expect(progress[LESSONS[i].id]).toEqual({ score: 10, total: 10, completedAt: 1000 });
    }
    expect(progress[LESSONS[idx + 1].id]).toBeUndefined();
  });

  it('returns progress unchanged when no checkpoint was passed', () => {
    const progress = { foo: { score: 1, total: 1, completedAt: 1 } };
    expect(applyPlacement(progress, null)).toBe(progress);
  });
});

describe('recommendedNextLesson', () => {
  it('recommends the first lesson when nothing was passed', () => {
    expect(recommendedNextLesson(null).id).toBe(LESSONS[0].id);
  });

  it('recommends the lesson right after the last passed checkpoint', () => {
    const idx = LESSONS.findIndex((l) => l.id === 'damma');
    expect(recommendedNextLesson('damma').id).toBe(LESSONS[idx + 1].id);
  });
});

describe('PLACEMENT_CHECKPOINTS', () => {
  it('are all real, ordered lesson ids in the curriculum', () => {
    let lastIndex = -1;
    for (const id of PLACEMENT_CHECKPOINTS) {
      const idx = LESSONS.findIndex((l) => l.id === id);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });
});
