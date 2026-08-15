// Wochen-Rückblick: "Diese Woche gelernt" über ALLE Kurse hinweg (Studium +
// Koran-lesen-lernen) — aggregiert dieselben Fortschritts-Einträge, die auch
// der Studium-Hub (app/study/index.tsx) und der Lernserie-Zähler
// (features/study/streak.ts) verwenden. Reine, testbare Berechnung: nimmt
// die Fortschritts-Objekte je Kurs entgegen und liefert Lektionen/Fragen/
// Bestwert/Serie der letzten 7 Tage.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEARN_PROGRESS_STORAGE_KEY, PASS_RATIO, parseLearnProgress, type LearnProgress } from '@/features/learn/progress';
import { COURSE_META } from '@/features/study/courses';
import { computeLearningStreak } from './streak';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export interface WeeklyReview {
  /** In den letzten 7 Tagen BESTANDENE Lektionen (score/total >= PASS_RATIO). */
  lessonsCompleted: number;
  /** Summe aller Quiz-Fragen aus Lektionen, die in den letzten 7 Tagen abgeschlossen wurden. */
  questionsAnswered: number;
  /** Davon richtig beantwortet. */
  correctAnswers: number;
  /** Bester score/total-Anteil (0..1) dieser Woche, `null` wenn diese Woche nichts abgeschlossen wurde. */
  bestRatio: number | null;
  /** Aktuelle Lernserie (Tage in Folge), über alle Kurse hinweg — wie im Studium-Hub. */
  streak: number;
}

/**
 * @param progressByCourse Fortschritt je Kurs-ID (inkl. `'learn'` für Koran-
 *   lesen-lernen), wie z. B. `loadWeeklyProgress()` unten liefert.
 * @param now Für Tests injizierbar, Default = aktueller Zeitpunkt.
 */
export function computeWeeklyReview(
  progressByCourse: Record<string, LearnProgress>,
  now: Date = new Date(),
): WeeklyReview {
  const cutoff = now.getTime() - WEEK_MS;

  let lessonsCompleted = 0;
  let questionsAnswered = 0;
  let correctAnswers = 0;
  let bestRatio: number | null = null;
  const passedTimestamps: number[] = [];

  for (const progress of Object.values(progressByCourse)) {
    for (const result of Object.values(progress)) {
      if (result.total <= 0) continue;
      const ratio = result.score / result.total;
      const passed = ratio >= PASS_RATIO;
      if (passed) passedTimestamps.push(result.completedAt);

      if (result.completedAt < cutoff) continue;
      if (passed) lessonsCompleted++;
      questionsAnswered += result.total;
      correctAnswers += result.score;
      if (bestRatio === null || ratio > bestRatio) bestRatio = ratio;
    }
  }

  return {
    lessonsCompleted,
    questionsAnswered,
    correctAnswers,
    bestRatio,
    streak: computeLearningStreak(passedTimestamps, now),
  };
}

/** Lädt den Fortschritt aller Kurse aus AsyncStorage (gleiches Muster wie app/study/index.tsx). */
export async function loadWeeklyProgress(): Promise<Record<string, LearnProgress>> {
  const [learnRaw, ...courseRaws] = await Promise.all([
    AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
    ...COURSE_META.map((c) => AsyncStorage.getItem(c.storageKey)),
  ]);
  const progressByCourse: Record<string, LearnProgress> = {
    learn: parseLearnProgress(learnRaw),
  };
  COURSE_META.forEach((c, i) => {
    progressByCourse[c.id] = parseLearnProgress(courseRaws[i]);
  });
  return progressByCourse;
}

/** Lädt den Fortschritt und berechnet daraus den Wochen-Rückblick. */
export async function loadWeeklyReview(now: Date = new Date()): Promise<WeeklyReview> {
  return computeWeeklyReview(await loadWeeklyProgress(), now);
}
