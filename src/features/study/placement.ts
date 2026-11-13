// Einstufungstest für die 12 Studium-Kurse — generische Version von
// features/learn/placement.ts (das feste, namentlich bekannte Meilenstein-
// Lektionen für den Koran-lesen-lernen-Kurs voraussetzt). Studium-Kurse haben
// keine solchen benannten Meilensteine, daher werden Checkpoints dynamisch
// über die tatsächliche Kurslänge verteilt. Reine Funktionen, testbar ohne
// React/AsyncStorage.
import type { Lesson } from '@/features/learn/curriculum';
import { recordResult, type LearnProgress } from '@/features/learn/progress';
import { buildQuiz, type QuizQuestion, type Rand } from '@/features/learn/quiz';
import type { Locale } from '@/lib/locale-detect';

export { checkpointPassed, PLACEMENT_PASS_RATIO } from '@/features/learn/placement';

export interface CourseCheckpoint {
  lessonId: string;
  questions: QuizQuestion[];
}

/** Obergrenze an Meilensteinen — reicht von den 3 Akhlaq- bis zu den 83 Madinah-Lektionen. */
const MAX_CHECKPOINTS = 5;

/**
 * Wählt bis zu MAX_CHECKPOINTS gleichmäßig über den Kurs verteilte Lektionen
 * als Meilensteine. Kurse mit <= MAX_CHECKPOINTS Lektionen nutzen jede
 * Lektion als Meilenstein. Der letzte Meilenstein ist immer die letzte
 * Lektion des Kurses, damit ein voll bestandener Test den kompletten Kurs
 * als bekannt markieren kann.
 */
export function selectCheckpointLessons(lessons: readonly Lesson[]): Lesson[] {
  if (lessons.length === 0) return [];
  if (lessons.length <= MAX_CHECKPOINTS) return [...lessons];
  const step = (lessons.length - 1) / (MAX_CHECKPOINTS - 1);
  const indices = new Set<number>();
  for (let i = 0; i < MAX_CHECKPOINTS; i++) {
    indices.add(Math.round(i * step));
  }
  return [...indices].sort((a, b) => a - b).map((i) => lessons[i]);
}

export function buildCourseCheckpoints(
  lessons: readonly Lesson[],
  locale: Locale,
  rand: Rand = Math.random,
): CourseCheckpoint[] {
  return selectCheckpointLessons(lessons).map((lesson) => ({
    lessonId: lesson.id,
    questions: buildQuiz(lesson, rand, locale),
  }));
}

/** Markiert alle Lektionen bis einschließlich upToLessonId als bestanden (volle Punktzahl). */
export function applyCoursePlacement(
  lessons: readonly Lesson[],
  progress: LearnProgress,
  upToLessonId: string | null,
  now: number = Date.now(),
): LearnProgress {
  if (!upToLessonId) return progress;
  const idx = lessons.findIndex((l) => l.id === upToLessonId);
  if (idx < 0) return progress;
  let next = progress;
  for (let i = 0; i <= idx; i++) {
    next = recordResult(next, lessons[i].id, 10, 10, now);
  }
  return next;
}

/** Empfohlene nächste Lektion nach dem letzten bestandenen Meilenstein. */
export function recommendedNextLessonIn(
  lessons: readonly Lesson[],
  lastPassedLessonId: string | null,
): Lesson {
  if (!lastPassedLessonId) return lessons[0];
  const idx = lessons.findIndex((l) => l.id === lastPassedLessonId);
  return lessons[Math.min(idx + 1, lessons.length - 1)];
}
