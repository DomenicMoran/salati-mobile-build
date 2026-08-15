import {
  computeDuhaReminderTime,
  computeTahajjudReminderTime,
  computeWitrReminderTime,
  DUHA_OFFSET_MINUTES,
  TAHAJJUD_OFFSET_MINUTES,
  WITR_OFFSET_MINUTES,
} from './sunnahReminders';
import type { Timings } from './api';

const day = new Date('2026-07-20T00:00:00');
const timings: Timings = {
  Fajr: '04:00',
  Sunrise: '05:30',
  Dhuhr: '13:05',
  Asr: '17:00',
  Maghrib: '20:00',
  Isha: '21:30',
};

describe('computeDuhaReminderTime', () => {
  it('liegt DUHA_OFFSET_MINUTES nach Sonnenaufgang', () => {
    const result = computeDuhaReminderTime(day, timings);
    const sunrise = new Date('2026-07-20T05:30:00');
    expect(result?.getTime()).toBe(sunrise.getTime() + DUHA_OFFSET_MINUTES * 60_000);
  });

  it('gibt null zurück, wenn keine Sunrise-Zeit vorliegt', () => {
    expect(computeDuhaReminderTime(day, { ...timings, Sunrise: '' })).toBeNull();
  });
});

describe('computeTahajjudReminderTime', () => {
  it('liegt TAHAJJUD_OFFSET_MINUTES vor Fajr', () => {
    const result = computeTahajjudReminderTime(day, timings);
    const fajr = new Date('2026-07-20T04:00:00');
    expect(result?.getTime()).toBe(fajr.getTime() - TAHAJJUD_OFFSET_MINUTES * 60_000);
  });

  it('gibt null zurück, wenn keine Fajr-Zeit vorliegt', () => {
    expect(computeTahajjudReminderTime(day, { ...timings, Fajr: '' })).toBeNull();
  });
});

describe('computeWitrReminderTime', () => {
  it('liegt WITR_OFFSET_MINUTES nach Isha', () => {
    const result = computeWitrReminderTime(day, timings);
    const isha = new Date('2026-07-20T21:30:00');
    expect(result?.getTime()).toBe(isha.getTime() + WITR_OFFSET_MINUTES * 60_000);
  });

  it('gibt null zurück, wenn keine Isha-Zeit vorliegt', () => {
    expect(computeWitrReminderTime(day, { ...timings, Isha: '' })).toBeNull();
  });
});

describe('Reihenfolge der Sunnah-Zeitpunkte innerhalb eines Tages', () => {
  it('Tahajjud liegt vor Fajr, Duha nach Sonnenaufgang, Witr nach Isha', () => {
    const tahajjud = computeTahajjudReminderTime(day, timings)!;
    const fajr = new Date('2026-07-20T04:00:00');
    const duha = computeDuhaReminderTime(day, timings)!;
    const sunrise = new Date('2026-07-20T05:30:00');
    const witr = computeWitrReminderTime(day, timings)!;
    const isha = new Date('2026-07-20T21:30:00');

    expect(tahajjud.getTime()).toBeLessThan(fajr.getTime());
    expect(duha.getTime()).toBeGreaterThan(sunrise.getTime());
    expect(witr.getTime()).toBeGreaterThan(isha.getTime());
  });
});
