import { computeWeeklyReview, WEEK_MS } from './weeklyReview';
import type { LearnProgress } from '@/features/learn/progress';

const DAY_MS = 86_400_000;

function atOffset(now: Date, daysAgo: number): number {
  return now.getTime() - daysAgo * DAY_MS;
}

describe('computeWeeklyReview', () => {
  const now = new Date('2026-07-18T12:00:00');

  it('gibt Nullwerte zurück, wenn nirgends etwas getrackt wurde', () => {
    const review = computeWeeklyReview({}, now);
    expect(review).toEqual({
      lessonsCompleted: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      bestRatio: null,
      streak: 0,
    });
  });

  it('zählt nur bestandene Lektionen als "abgeschlossen", aber alle Fragen dieser Woche', () => {
    const learn: LearnProgress = {
      passed: { score: 8, total: 10, completedAt: atOffset(now, 1) }, // 80% bestanden
      failed: { score: 4, total: 10, completedAt: atOffset(now, 2) }, // 40% nicht bestanden
    };
    const review = computeWeeklyReview({ learn }, now);
    expect(review.lessonsCompleted).toBe(1);
    expect(review.questionsAnswered).toBe(20);
    expect(review.correctAnswers).toBe(12);
  });

  it('ignoriert Ergebnisse älter als 7 Tage bei Lektionen/Fragen/Bestwert', () => {
    const learn: LearnProgress = {
      recent: { score: 9, total: 10, completedAt: atOffset(now, 3) },
      old: { score: 10, total: 10, completedAt: atOffset(now, 8) },
    };
    const review = computeWeeklyReview({ learn }, now);
    expect(review.lessonsCompleted).toBe(1);
    expect(review.questionsAnswered).toBe(10);
    expect(review.bestRatio).toBe(0.9);
  });

  it('berücksichtigt genau den 7-Tage-Cutoff (inklusive Rand, exklusive kurz davor)', () => {
    const onEdge: LearnProgress = {
      x: { score: 5, total: 5, completedAt: now.getTime() - WEEK_MS },
    };
    expect(computeWeeklyReview({ learn: onEdge }, now).lessonsCompleted).toBe(1);

    const justBefore: LearnProgress = {
      x: { score: 5, total: 5, completedAt: now.getTime() - WEEK_MS - 1 },
    };
    const review = computeWeeklyReview({ learn: justBefore }, now);
    expect(review.lessonsCompleted).toBe(0);
    expect(review.questionsAnswered).toBe(0);
  });

  it('bestimmt den besten Anteil dieser Woche über mehrere Lektionen/Kurse hinweg', () => {
    const learn: LearnProgress = {
      a: { score: 6, total: 10, completedAt: atOffset(now, 1) },
    };
    const tajwid: LearnProgress = {
      b: { score: 9, total: 10, completedAt: atOffset(now, 2) },
      c: { score: 10, total: 10, completedAt: atOffset(now, 4) },
    };
    const review = computeWeeklyReview({ learn, tajwid }, now);
    expect(review.bestRatio).toBe(1);
    // "a" (6/10 = 60%) besteht nicht, "b" und "c" schon.
    expect(review.lessonsCompleted).toBe(2);
    expect(review.questionsAnswered).toBe(30);
  });

  it('bestRatio bleibt null, wenn nur ältere Ergebnisse existieren', () => {
    const learn: LearnProgress = {
      old: { score: 10, total: 10, completedAt: atOffset(now, 30) },
    };
    expect(computeWeeklyReview({ learn }, now).bestRatio).toBeNull();
  });

  it('ignoriert Einträge mit total 0 (keine Division durch 0)', () => {
    const learn: LearnProgress = {
      broken: { score: 0, total: 0, completedAt: atOffset(now, 1) },
    };
    const review = computeWeeklyReview({ learn }, now);
    expect(review.lessonsCompleted).toBe(0);
    expect(review.questionsAnswered).toBe(0);
    expect(review.bestRatio).toBeNull();
  });

  it('berechnet die Lernserie über alle bestandenen Lektionen (auch ältere)', () => {
    const learn: LearnProgress = {
      today: { score: 8, total: 10, completedAt: atOffset(now, 0) },
      yesterday: { score: 8, total: 10, completedAt: atOffset(now, 1) },
      dayBefore: { score: 8, total: 10, completedAt: atOffset(now, 2) },
    };
    expect(computeWeeklyReview({ learn }, now).streak).toBe(3);
  });
});
