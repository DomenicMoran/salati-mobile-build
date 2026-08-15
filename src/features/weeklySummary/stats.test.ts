import { computeFullPrayerDays, computeWeeklySummaryStats } from './stats';
import type { LearnProgress } from '@/features/learn/progress';
import type { TrackerData } from '@/features/tracker/store';

const DAY_MS = 86_400_000;
function atOffset(now: Date, daysAgo: number): number {
  return now.getTime() - daysAgo * DAY_MS;
}

const fullDay = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

describe('computeFullPrayerDays', () => {
  const now = new Date(2026, 6, 18); // 18. Juli 2026

  it('zählt 0 ohne Tracker-Daten', () => {
    expect(computeFullPrayerDays({}, now)).toBe(0);
  });

  it('zählt nur vollständige Tage innerhalb der letzten 7 Tage (inkl. heute)', () => {
    const data: TrackerData = {
      '2026-07-18': fullDay, // heute
      '2026-07-17': fullDay,
      '2026-07-16': { fajr: true }, // unvollständig
      '2026-07-11': fullDay, // 7 Tage her -> außerhalb (7-Tage-Fenster = heute..heute-6)
    };
    expect(computeFullPrayerDays(data, now)).toBe(2);
  });

  it('respektiert ein anderes Fenster', () => {
    const data: TrackerData = { '2026-07-11': fullDay };
    expect(computeFullPrayerDays(data, now, 8)).toBe(1);
  });
});

describe('computeWeeklySummaryStats', () => {
  const now = new Date('2026-07-18T12:00:00');

  it('kombiniert Lektionen (letzte 7 Tage) und volle Gebetstage', () => {
    const learn: LearnProgress = {
      passed: { score: 9, total: 10, completedAt: atOffset(now, 1) },
      failed: { score: 3, total: 10, completedAt: atOffset(now, 1) },
      old: { score: 10, total: 10, completedAt: atOffset(now, 30) },
    };
    const tracker: TrackerData = { '2026-07-18': fullDay, '2026-07-17': fullDay };
    const stats = computeWeeklySummaryStats({ learn }, tracker, now);
    expect(stats).toEqual({ lessonsCompleted: 1, fullPrayerDays: 2 });
  });

  it('liefert Nullwerte ohne jegliche Daten', () => {
    expect(computeWeeklySummaryStats({}, {}, now)).toEqual({ lessonsCompleted: 0, fullPrayerDays: 0 });
  });
});
