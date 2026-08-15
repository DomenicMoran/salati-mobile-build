import { computeLearningStreak } from './streak';

const DAY_MS = 86_400_000;

function atNoon(date: Date): number {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

describe('computeLearningStreak', () => {
  it('returns 0 for no activity', () => {
    expect(computeLearningStreak([])).toBe(0);
  });

  it('returns 1 when only today has activity', () => {
    const now = new Date('2026-07-16T18:00:00');
    expect(computeLearningStreak([atNoon(now)], now)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    const now = new Date('2026-07-16T18:00:00');
    const yesterday = new Date(now.getTime() - DAY_MS);
    const dayBefore = new Date(now.getTime() - 2 * DAY_MS);
    expect(
      computeLearningStreak([atNoon(dayBefore), atNoon(yesterday), atNoon(now)], now),
    ).toBe(3);
  });

  it('keeps the streak alive if today has no activity yet but yesterday did', () => {
    const now = new Date('2026-07-16T08:00:00');
    const yesterday = new Date(now.getTime() - DAY_MS);
    const dayBefore = new Date(now.getTime() - 2 * DAY_MS);
    expect(computeLearningStreak([atNoon(dayBefore), atNoon(yesterday)], now)).toBe(2);
  });

  it('resets to 0 when a full day was skipped', () => {
    const now = new Date('2026-07-16T18:00:00');
    const twoDaysAgo = new Date(now.getTime() - 2 * DAY_MS);
    expect(computeLearningStreak([atNoon(twoDaysAgo)], now)).toBe(0);
  });

  it('does not double-count multiple lessons on the same day', () => {
    const now = new Date('2026-07-16T18:00:00');
    expect(computeLearningStreak([atNoon(now), atNoon(now), atNoon(now)], now)).toBe(1);
  });

  it('ignores future timestamps beyond today when counting backwards', () => {
    const now = new Date('2026-07-16T18:00:00');
    const yesterday = new Date(now.getTime() - DAY_MS);
    expect(computeLearningStreak([atNoon(yesterday), atNoon(now)], now)).toBe(2);
  });
});
