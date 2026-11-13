import { plannedSunnahFastEvenings, DEFAULT_SUNNAH_FASTING } from './sunnahFasting';

describe('plannedSunnahFastEvenings', () => {
  it('includes mon/thu evenings when enabled', () => {
    const from = new Date(2026, 10, 10, 12, 0, 0);
    const dates = plannedSunnahFastEvenings(from, { ...DEFAULT_SUNNAH_FASTING, monThu: true, whiteDays: false, arafah: false, ashura: false, shawwal6: false });
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d.getTime() > from.getTime())).toBe(true);
  });

  it('returns none when all prefs off', () => {
    const from = new Date();
    const dates = plannedSunnahFastEvenings(from, {
      monThu: false,
      whiteDays: false,
      arafah: false,
      ashura: false,
      shawwal6: false,
    });
    expect(dates).toEqual([]);
  });
});
