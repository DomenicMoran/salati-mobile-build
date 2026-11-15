import type { Timings } from '@/features/prayer-times/api';

import { mobileRamadanMilestones, nextMobileRamadanMilestone } from './ramadanMilestones';

const today: Timings = {
  Fajr: '05:00',
  Sunrise: '06:30',
  Dhuhr: '12:30',
  Asr: '15:00',
  Maghrib: '18:30',
  Isha: '20:00',
};

describe('mobileRamadanMilestones', () => {
  it('orders imsak before suhur and iftar', () => {
    const now = new Date('2026-03-10T08:00:00');
    const ms = mobileRamadanMilestones(today, now);
    expect(ms.map((m) => m.key)).toEqual(['imsak', 'suhur', 'iftar', 'taraweeh']);
    expect(ms[0].at.getHours()).toBe(4);
    expect(ms[0].at.getMinutes()).toBe(50);
  });

  it('picks next milestone after now', () => {
    const now = new Date('2026-03-10T08:00:00');
    const ms = mobileRamadanMilestones(today, now);
    const next = nextMobileRamadanMilestone(ms, now);
    expect(next?.key).toBe('iftar');
  });
});