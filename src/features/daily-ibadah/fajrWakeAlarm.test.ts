import {
  buildFajrWakeMathTask,
  fajrWakeNotificationId,
  localDayKey,
  MAX_SNOOZE_COUNT,
} from './fajrWakeAlarm';

describe('fajrWakeAlarm', () => {
  it('builds stable math task from seed', () => {
    const t = buildFajrWakeMathTask(42);
    expect(t.question).toMatch(/\d+ × \d+/);
    expect(t.answer).toBeGreaterThan(0);
  });

  it('notification ids are unique per day and snooze', () => {
    expect(fajrWakeNotificationId('2026-11-15')).toBe('fajr-wake-2026-11-15');
    expect(fajrWakeNotificationId('2026-11-15', 1)).toBe('fajr-wake-snooze-2026-11-15-1');
  });

  it('localDayKey is YYYY-MM-DD', () => {
    expect(localDayKey(new Date('2026-11-15T10:00:00'))).toBe('2026-11-15');
  });

  it('snooze cap is fixed', () => {
    expect(MAX_SNOOZE_COUNT).toBe(2);
  });
});