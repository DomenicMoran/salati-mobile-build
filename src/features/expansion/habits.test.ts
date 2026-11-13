import { parseHabits, streakDays, toggleHabitDay, PRESET_HABITS } from './habits';

describe('habits', () => {
  it('parses invalid as presets', () => {
    expect(parseHabits('not-json')).toHaveLength(PRESET_HABITS.length);
  });

  it('toggles day on habit', () => {
    const day = '2026-11-13';
    const next = toggleHabitDay(parseHabits(null), 'dhikr', day);
    expect(next.find((h) => h.id === 'dhikr')?.doneOn).toContain(day);
  });

  it('counts streak', () => {
    const done = ['2026-11-13', '2026-11-12', '2026-11-10'];
    expect(streakDays(done, '2026-11-13')).toBe(2);
  });
});
