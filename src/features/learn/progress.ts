import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { LESSONS, type Lesson } from './curriculum';

// Lernfortschritt: pro Lektion bestes Ergebnis. Eine Lektion gilt als
// bestanden ab PASS_RATIO — erst dann wird die nächste freigeschaltet.
// Generisch über (lessons, storageKey), damit die Studien-Kurse (/study)
// dieselbe Logik mit eigenem Storage-Key nutzen können.

export interface LessonResult {
  score: number;
  total: number;
  completedAt: number;
}

export type LearnProgress = Record<string, LessonResult>;

export const LEARN_PROGRESS_STORAGE_KEY = 'salatibox:learn-progress';
export const PASS_RATIO = 0.7;

export function isPassed(progress: LearnProgress, lessonId: string): boolean {
  const r = progress[lessonId];
  return !!r && r.total > 0 && r.score / r.total >= PASS_RATIO;
}

/** Freigeschaltet, wenn alle vorherigen Lektionen des Kurses bestanden sind. */
export function isUnlockedIn(
  lessons: readonly Lesson[],
  progress: LearnProgress,
  lessonId: string,
): boolean {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index <= 0) return index === 0;
  return isPassed(progress, lessons[index - 1].id);
}

export function isUnlocked(progress: LearnProgress, lessonId: string): boolean {
  return isUnlockedIn(LESSONS, progress, lessonId);
}

/** Bestes Ergebnis behalten — eine schlechtere Wiederholung überschreibt nicht. */
export function recordResult(
  progress: LearnProgress,
  lessonId: string,
  score: number,
  total: number,
  now: number = Date.now(),
): LearnProgress {
  const prev = progress[lessonId];
  if (prev && prev.total > 0 && total > 0 && prev.score / prev.total >= score / total) {
    return progress;
  }
  return { ...progress, [lessonId]: { score, total, completedAt: now } };
}

export function passedCountIn(lessons: readonly Lesson[], progress: LearnProgress): number {
  return lessons.filter((l) => isPassed(progress, l.id)).length;
}

export function passedCount(progress: LearnProgress): number {
  return passedCountIn(LESSONS, progress);
}

export function parseLearnProgress(raw: string | null): LearnProgress {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as LearnProgress) : {};
  } catch {
    return {};
  }
}

async function loadProgress(storageKey: string): Promise<LearnProgress> {
  return parseLearnProgress(await AsyncStorage.getItem(storageKey));
}

async function saveProgress(storageKey: string, progress: LearnProgress): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(progress)).catch(() => {});
}

/** Fortschritts-Hook für einen beliebigen Kurs (Storage-Key pro Kurs). */
export function useCourseProgress(storageKey: string) {
  const [progress, setProgress] = useState<LearnProgress>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadProgress(storageKey).then((p) => {
        if (!cancelled) setProgress(p);
      });
      return () => {
        cancelled = true;
      };
    }, [storageKey]),
  );

  const record = useCallback(
    (lessonId: string, score: number, total: number) => {
      setProgress((prev) => {
        const next = recordResult(prev, lessonId, score, total);
        if (next !== prev) saveProgress(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return { progress, record };
}

export function useLearnProgress() {
  return useCourseProgress(LEARN_PROGRESS_STORAGE_KEY);
}
