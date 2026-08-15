import AsyncStorage from '@react-native-async-storage/async-storage';

import { LESSONS, type Lesson } from '@/features/learn/curriculum';
import {
  isPassed,
  LEARN_PROGRESS_STORAGE_KEY,
  parseLearnProgress,
  type LearnProgress,
} from '@/features/learn/progress';
import { COURSE_META, loadAllCourses } from './courses';

// Wiederholungs-System (Spaced Repetition, bewusst einfach):
// Jede BESTANDENE Lektion wird zum Wiederholungs-Kandidaten. Pro Lektion
// merken wir Level + letzten Review; fällig nach INTERVALS[level] Tagen.
// Richtige Session hebt das Level (längerer Abstand), eine schwache Session
// senkt es. Reine Funktionen unten sind ohne React/Storage testbar.

export const REVIEW_STORAGE_KEY = 'salatibox:review';
export const INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;
export const MAX_LEVEL = INTERVALS_DAYS.length - 1;
/** Session gilt als gut ab diesem Anteil richtiger Antworten. */
export const REVIEW_PASS_RATIO = 0.7;

export interface ReviewEntry {
  /** 0..MAX_LEVEL — Index in INTERVALS_DAYS */
  level: number;
  /** Zeitstempel des letzten Reviews (bzw. des Bestehens der Lektion) */
  last: number;
}

export type ReviewState = Record<string, ReviewEntry>; // Key: `${courseId}:${lessonId}`

export interface ReviewCandidate {
  courseId: string;
  lesson: Lesson;
  key: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function reviewKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

export function isDue(entry: ReviewEntry, now: number): boolean {
  const level = Math.min(Math.max(entry.level, 0), MAX_LEVEL);
  return now - entry.last >= INTERVALS_DAYS[level] * DAY_MS;
}

/**
 * Alle fälligen Lektionen über alle Kurse (inkl. "Koran lesen lernen" als
 * Kurs-Id 'learn'). Bestandene Lektionen ohne Review-Eintrag gelten mit dem
 * Bestehens-Zeitpunkt als Level 0.
 *
 * `coursesLessons` (Kurs-Id -> Lektionen) muss der Aufrufer bereitstellen,
 * da courses.ts die Lektionsinhalte inzwischen nur noch async lädt (siehe
 * loadAllCourses/loadDueCandidates) — reine, weiterhin ohne Storage/async
 * testbare Funktion.
 */
export function dueCandidates(
  progressByCourse: Record<string, LearnProgress>,
  review: ReviewState,
  now: number = Date.now(),
  coursesLessons: Record<string, readonly Lesson[]> = {},
): ReviewCandidate[] {
  const courses: { id: string; lessons: readonly Lesson[] }[] = [
    { id: 'learn', lessons: LESSONS },
    ...Object.entries(coursesLessons).map(([id, lessons]) => ({ id, lessons })),
  ];
  const due: ReviewCandidate[] = [];
  for (const course of courses) {
    const progress = progressByCourse[course.id] ?? {};
    for (const lesson of course.lessons) {
      if (!isPassed(progress, lesson.id)) continue;
      const key = reviewKey(course.id, lesson.id);
      const entry = review[key] ?? { level: 0, last: progress[lesson.id].completedAt };
      if (isDue(entry, now)) due.push({ courseId: course.id, lesson, key });
    }
  }
  return due;
}

/**
 * Lädt Fortschritt aller Kurse (inkl. "Koran lesen lernen") + Wiederholungs-
 * Status aus AsyncStorage und liefert die fälligen Kandidaten (siehe
 * dueCandidates). Bündelt die Lade-Logik, die sonst mehrfach dupliziert
 * würde (Studium-Hub-Zähler, Wiederholungs-Erinnerung).
 */
export async function loadDueCandidates(now: number = Date.now()): Promise<ReviewCandidate[]> {
  const [learnRaw, review, courses, ...courseRaws] = await Promise.all([
    AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
    loadReviewState(),
    loadAllCourses(),
    ...COURSE_META.map((c) => AsyncStorage.getItem(c.storageKey)),
  ]);
  const progressByCourse: Record<string, LearnProgress> = {
    learn: parseLearnProgress(learnRaw),
  };
  COURSE_META.forEach((c, i) => {
    progressByCourse[c.id] = parseLearnProgress(courseRaws[i]);
  });
  const coursesLessons = Object.fromEntries(courses.map((c) => [c.id, c.lessons]));
  return dueCandidates(progressByCourse, review, now, coursesLessons);
}

/** Session-Ergebnis einarbeiten: gut → Level rauf, schwach → Level runter. */
export function applyReviewResult(
  review: ReviewState,
  keys: string[],
  ratio: number,
  now: number = Date.now(),
): ReviewState {
  const next = { ...review };
  for (const key of keys) {
    const prev = next[key] ?? { level: 0, last: 0 };
    const level =
      ratio >= REVIEW_PASS_RATIO ? Math.min(prev.level + 1, MAX_LEVEL) : Math.max(prev.level - 1, 0);
    next[key] = { level, last: now };
  }
  return next;
}

export function parseReviewState(raw: string | null): ReviewState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ReviewState) : {};
  } catch {
    return {};
  }
}

export async function loadReviewState(): Promise<ReviewState> {
  return parseReviewState(await AsyncStorage.getItem(REVIEW_STORAGE_KEY));
}

export async function saveReviewState(state: ReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}
