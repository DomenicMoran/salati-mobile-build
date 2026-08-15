// Einstufungstest: wer Buchstaben/Verbindungsformen/Harakat etc. schon kann,
// muss nicht linear ab Lektion 1 starten. Reine Funktionen, testbar ohne
// React/AsyncStorage — analog zu quiz.ts/progress.ts.
import type { Locale } from '@/lib/locale-detect';
import { LESSONS, type Lesson } from './curriculum';
import { recordResult, type LearnProgress } from './progress';
import { buildQuiz, type QuizQuestion, type Rand } from './quiz';

/**
 * Meilensteine im Kurs, an denen ein Quereinstieg sinnvoll ist. Jeder Checkpoint
 * prüft das bis dahin nötige Wissen — wer ihn besteht, kennt auch alle Lektionen
 * davor und darf direkt danach weitermachen.
 */
export const PLACEMENT_CHECKPOINTS = ['similar', 'forms-3', 'damma', 'sun-moon', 'words-2'] as const;

export interface PlacementCheckpoint {
  /** Lektion, deren Quiz als Diagnose für diesen Meilenstein dient. */
  lessonId: string;
  questions: QuizQuestion[];
}

export function buildPlacementCheckpoints(
  locale: Locale,
  rand: Rand = Math.random,
): PlacementCheckpoint[] {
  return PLACEMENT_CHECKPOINTS.map((lessonId) => {
    const lesson = LESSONS.find((l) => l.id === lessonId);
    if (!lesson) throw new Error(`Placement checkpoint lesson not found: ${lessonId}`);
    return { lessonId, questions: buildQuiz(lesson, rand, locale) };
  });
}

/** Ab welcher Ratio gilt ein Checkpoint als bestanden (gleiche Schwelle wie Lektionen). */
export const PLACEMENT_PASS_RATIO = 0.7;

export function checkpointPassed(score: number, total: number): boolean {
  return total > 0 && score / total >= PLACEMENT_PASS_RATIO;
}

/** Markiert alle Lektionen bis einschließlich upToLessonId als bestanden (volle Punktzahl). */
export function applyPlacement(
  progress: LearnProgress,
  upToLessonId: string | null,
  now: number = Date.now(),
): LearnProgress {
  if (!upToLessonId) return progress;
  const idx = LESSONS.findIndex((l) => l.id === upToLessonId);
  if (idx < 0) return progress;
  let next = progress;
  for (let i = 0; i <= idx; i++) {
    next = recordResult(next, LESSONS[i].id, 10, 10, now);
  }
  return next;
}

/** Empfohlene nächste Lektion nach dem letzten bestandenen Checkpoint. */
export function recommendedNextLesson(lastPassedCheckpointId: string | null): Lesson {
  if (!lastPassedCheckpointId) return LESSONS[0];
  const idx = LESSONS.findIndex((l) => l.id === lastPassedCheckpointId);
  return LESSONS[Math.min(idx + 1, LESSONS.length - 1)];
}
