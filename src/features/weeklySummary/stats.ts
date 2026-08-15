// Wochenzusammenfassung für die lokale Erinnerung (notifications.ts): fasst
// Lern-Fortschritt (features/study/weeklyReview.ts) und Gebets-Tracker
// (features/tracker/store.ts) zu zwei Kennzahlen zusammen — bewusst NICHT
// dieselbe WeeklyReview wie der Studium-Wochen-Rückblick (der zeigt Fragen/
// Bestwert/Lernserie, hier reicht für eine kurze Notification "X Lektionen,
// Y Tage mit allen 5 Gebeten"). Reine Berechnung + Loader getrennt (wie
// weeklyReview.ts), damit die Kennzahlen ohne AsyncStorage-Mock testbar sind.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LearnProgress } from '@/features/learn/progress';
import { loadWeeklyProgress, computeWeeklyReview } from '@/features/study/weeklyReview';
import { dayKey, isDayComplete, parseTracker, TRACKER_STORAGE_KEY, type TrackerData } from '@/features/tracker/store';

export const SUMMARY_WINDOW_DAYS = 7;

export interface WeeklySummaryStats {
  /** In den letzten 7 Tagen bestandene Lektionen (alle Kurse, s. computeWeeklyReview). */
  lessonsCompleted: number;
  /** Tage der letzten 7, an denen alle 5 Gebete abgehakt wurden. */
  fullPrayerDays: number;
}

/** Tage der letzten `windowDays` (inkl. heute) mit allen 5 Gebeten. */
export function computeFullPrayerDays(
  data: TrackerData,
  now: Date = new Date(),
  windowDays: number = SUMMARY_WINDOW_DAYS,
): number {
  let count = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (isDayComplete(data, dayKey(d))) count++;
  }
  return count;
}

export function computeWeeklySummaryStats(
  progressByCourse: Record<string, LearnProgress>,
  trackerData: TrackerData,
  now: Date = new Date(),
): WeeklySummaryStats {
  return {
    lessonsCompleted: computeWeeklyReview(progressByCourse, now).lessonsCompleted,
    fullPrayerDays: computeFullPrayerDays(trackerData, now),
  };
}

/** Lädt Lern-Fortschritt + Gebets-Tracker aus AsyncStorage und berechnet daraus die Kennzahlen. */
export async function loadWeeklySummaryStats(now: Date = new Date()): Promise<WeeklySummaryStats> {
  const [progressByCourse, trackerRaw] = await Promise.all([
    loadWeeklyProgress(),
    AsyncStorage.getItem(TRACKER_STORAGE_KEY),
  ]);
  return computeWeeklySummaryStats(progressByCourse, parseTracker(trackerRaw), now);
}
