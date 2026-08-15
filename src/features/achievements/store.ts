import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  BADGES,
  EMPTY_ACHIEVEMENT_INPUTS,
  isBadgeUnlocked,
  longestConsecutiveRun,
  type AchievementInputs,
  type Badge,
} from './badges';
import { LESSONS } from '@/features/learn/curriculum';
import {
  LEARN_PROGRESS_STORAGE_KEY,
  isPassed,
  parseLearnProgress,
  passedCountIn,
} from '@/features/learn/progress';
import { PRACTICE_DAYS_STORAGE_KEY, parsePracticeDays, previousDay } from '@/features/practice-streak/streak';
import { isDayComplete, parseTracker, TRACKER_STORAGE_KEY } from '@/features/tracker/store';
import { KHATMAH_STORAGE_KEY, completedDays, parsePlan } from '@/features/khatmah/plan';
import { COURSE_META, loadAllCourses } from '@/features/study/courses';
import { HIFZ_STORAGE_KEY, knownCount, parseHifzProgress } from '@/features/hifz/progress';
import { QURAN_PROGRESS_STORAGE_KEY, parseProgress } from '@/features/quran/progress';
import { PRACTICE_STATS_STORAGE_KEY, parsePracticeStats } from '@/features/practice/stats';
import { OFFLINE_AUDIO_INDEX_KEY } from '@/features/quran/offline-audio';
import { FASTING_STORAGE_KEY, fastedCount, parseFasting } from '@/features/fasting/store';
import { MAX_LEVEL, REVIEW_STORAGE_KEY, parseReviewState } from '@/features/study/review';

// Reines Text-Lese-Modul (Vaseelah-Leseübungen am Koran-Text): "erste Sure
// komplett gelesen" bildet sich auf das Bestehen einer dieser Lektionen ab
// statt auf eine neue Ayah-Zähl-Logik — die 4 Lektionen SIND vollständige
// Suren (Al-Fatiha, Al-Ikhlas, Al-Falaq, An-Nas).
const FULL_SURAH_LESSON_IDS = ['reading-fatiha', 'reading-ikhlas', 'reading-falaq', 'reading-nas'];

/**
 * Persistiert nur, dass ein Khatmah-Leseplan JE einmal zu 100 % erledigt
 * wurde — der Plan selbst wird beim Neustart zurückgesetzt (siehe
 * features/khatmah/plan.ts), das Abzeichen soll trotzdem bestehen bleiben.
 */
export const KHATMAH_COMPLETED_ONCE_KEY = 'salatibox:khatmah-completed-once';

function isNextCalendarDay(previous: string, next: string): boolean {
  return previousDay(next) === previous;
}

/**
 * Zählt die Einträge im Offline-Audio-Index ("reciter|surah" → Ayah-Anzahl,
 * siehe features/quran/offline-audio.ts). Das Feature exportiert bewusst nur
 * den Storage-Key, keinen Parser (der Index ist reiner Download-Cache, kein
 * Fortschritt) — der Zähl-Bedarf hier ist achievements-spezifisch, daher hier
 * lokal statt dort als neue öffentliche API ergänzt.
 */
function parseOfflineAudioCount(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0;
  } catch {
    return 0;
  }
}

async function computeAchievementInputs(): Promise<AchievementInputs> {
  const [
    learnRaw,
    practiceDaysRaw,
    trackerRaw,
    khatmahRaw,
    khatmahFlagRaw,
    hifzRaw,
    quranProgressRaw,
    practiceStatsRaw,
    offlineAudioRaw,
    fastingRaw,
    reviewRaw,
    ...courseRaws
  ] = await Promise.all([
    AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
    AsyncStorage.getItem(PRACTICE_DAYS_STORAGE_KEY),
    AsyncStorage.getItem(TRACKER_STORAGE_KEY),
    AsyncStorage.getItem(KHATMAH_STORAGE_KEY),
    AsyncStorage.getItem(KHATMAH_COMPLETED_ONCE_KEY),
    AsyncStorage.getItem(HIFZ_STORAGE_KEY),
    AsyncStorage.getItem(QURAN_PROGRESS_STORAGE_KEY),
    AsyncStorage.getItem(PRACTICE_STATS_STORAGE_KEY),
    AsyncStorage.getItem(OFFLINE_AUDIO_INDEX_KEY),
    AsyncStorage.getItem(FASTING_STORAGE_KEY),
    AsyncStorage.getItem(REVIEW_STORAGE_KEY),
    ...COURSE_META.map((c) => AsyncStorage.getItem(c.storageKey)),
  ]);

  const learnProgress = parseLearnProgress(learnRaw);
  const firstSurahPassed = FULL_SURAH_LESSON_IDS.some((id) => isPassed(learnProgress, id));
  const learnPassedCount = passedCountIn(LESSONS, learnProgress);
  const curriculumComplete = LESSONS.length > 0 && learnPassedCount === LESSONS.length;

  const practiceDays = [...new Set(parsePracticeDays(practiceDaysRaw))].sort();
  const bestPracticeStreak = longestConsecutiveRun(practiceDays, isNextCalendarDay);

  const trackerData = parseTracker(trackerRaw);
  const completePrayerDays = Object.keys(trackerData)
    .filter((day) => isDayComplete(trackerData, day))
    .sort();
  const bestPrayerStreak = longestConsecutiveRun(completePrayerDays, isNextCalendarDay);

  const plan = parsePlan(khatmahRaw);
  const currentlyComplete = !!plan && plan.days > 0 && completedDays(plan) === plan.days;
  let khatmahCompletedOnce = khatmahFlagRaw === '1';
  if (currentlyComplete && !khatmahCompletedOnce) {
    khatmahCompletedOnce = true;
    AsyncStorage.setItem(KHATMAH_COMPLETED_ONCE_KEY, '1').catch(() => {});
  }

  let anyCourseComplete = false;
  let grammarComplete = false;
  let tajwidComplete = false;
  // Gezählt wird zusätzlich, WIE VIELE Kurse fertig sind: eigene Abzeichen gab
  // es nur für Grammatik und Tadschwied, die übrigen elf Kurse zahlten auf
  // nichts weiter ein als das generische „irgendein Kurs". Eine Staffelung
  // (drei / alle) lässt jeden Kurs zählen, ohne für jeden neuen Kurs ein
  // eigenes Abzeichen samt 14 Übersetzungen nachziehen zu müssen.
  let coursesCompleteTotal = 0;
  let coursesTotal = 0;
  // Lektionsinhalte werden hier bewusst erst jetzt (async, alle 12 Kurse auf
  // einmal) geladen statt wie früher statisch importiert — dieser Screen
  // (Achievements) ist der einzige Ort, der wirklich für JEDEN Kurs prüfen
  // muss, ob alle Lektionen bestanden sind; andere Routen (Studium-Hub-
  // Listing, Reorder, Widgets) brauchen das nicht und laden es seit dem
  // courses.ts-Refactor nicht mehr mit.
  const courses = await loadAllCourses();
  courses.forEach((course, i) => {
    if (course.lessons.length === 0) return;
    // Nur Kurse mit Lektionen zählen als Nenner — ein leerer Kurs wäre sonst
    // nie erfüllbar und „alle Kurse" damit unerreichbar.
    coursesTotal += 1;
    const progress = parseLearnProgress(courseRaws[i]);
    const done = passedCountIn(course.lessons, progress) === course.lessons.length;
    if (!done) return;
    anyCourseComplete = true;
    coursesCompleteTotal += 1;
    if (course.id === 'grammar') grammarComplete = true;
    if (course.id === 'tajwid') tajwidComplete = true;
  });

  const hifzProgress = parseHifzProgress(hifzRaw);
  const hifzKnownTotal = Object.keys(hifzProgress).reduce(
    (sum, surah) => sum + knownCount(hifzProgress, Number(surah)),
    0,
  );
  // Anzahl unterschiedlicher Suren mit mind. einem Hifz-Eintrag (egal ob
  // "übe ich" oder "kann ich") — Breite statt Tiefe, siehe hifz-explorer-Badge.
  const hifzSurahsStarted = Object.keys(hifzProgress).length;

  const quranProgress = parseProgress(quranProgressRaw);
  const bookmarksTotal = quranProgress.bookmarks.length;
  const noteCount = quranProgress.notes.length;
  const readSurahsTotal = quranProgress.history.length;
  const bookmarkCollectionsUsed = new Set(
    quranProgress.bookmarks.map((b) => b.label).filter((label): label is NonNullable<typeof label> => !!label),
  ).size;

  const practiceStats = parsePracticeStats(practiceStatsRaw);
  const quizPlaysTotal = Object.values(practiceStats).reduce((sum, s) => sum + (s?.plays ?? 0), 0);

  const offlineAudioSurahsTotal = parseOfflineAudioCount(offlineAudioRaw);

  const fastedDaysTotal = fastedCount(parseFasting(fastingRaw));

  const reviewState = parseReviewState(reviewRaw);
  const reviewMaxLevelReached = Object.values(reviewState).some((entry) => entry.level >= MAX_LEVEL);

  return {
    learnPassedCount,
    firstSurahPassed,
    curriculumComplete,
    bestPracticeStreak,
    bestPrayerStreak,
    khatmahCompletedOnce,
    anyCourseComplete,
    coursesCompleteTotal,
    coursesTotal,
    grammarComplete,
    tajwidComplete,
    hifzKnownTotal,
    bookmarksTotal,
    quizPlaysTotal,
    noteCount,
    bookmarkCollectionsUsed,
    hifzSurahsStarted,
    offlineAudioSurahsTotal,
    readSurahsTotal,
    fastedDaysTotal,
    reviewMaxLevelReached,
  };
}

export interface BadgeWithStatus extends Badge {
  unlocked: boolean;
}

export function useAchievements() {
  const [input, setInput] = useState<AchievementInputs>(EMPTY_ACHIEVEMENT_INPUTS);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      computeAchievementInputs().then((result) => {
        if (!cancelled) {
          setInput(result);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const badges: BadgeWithStatus[] = BADGES.map((b) => ({ ...b, unlocked: isBadgeUnlocked(b.id, input) }));
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return { badges, unlockedCount, total: BADGES.length, loaded };
}
