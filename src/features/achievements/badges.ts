// Abzeichen/Achievements: rein lokale Meilensteine, live aus bereits
// vorhandenen Fortschritts-Daten berechnet (Übungs-Streak, Gebets-Tracker,
// Lern-Lektionen, Studien-Kurse, Khatmah, Hifz, Quiz, Lesezeichen). Kein
// eigener "freigeschaltet"-Speicher nötig — Ausnahme ist khatmahCompletedOnce
// (der Leseplan kann zurückgesetzt werden, siehe features/achievements/store).
//
// Kein Konto-/Cloud-Zwang: alles wird bei jedem Fokus aus AsyncStorage neu
// berechnet, exakt wie der Rest der App (siehe practice-streak/streak.ts).
import type { IconName } from '@/components/ui/icon-symbol';

export type BadgeId =
  | 'first-lesson'
  | 'first-surah'
  | 'curriculum-complete'
  | 'streak-7'
  | 'streak-30'
  | 'streak-100'
  | 'prayer-week'
  | 'khatmah-complete'
  | 'course-complete'
  | 'courses-3'
  | 'courses-all'
  | 'grammar-complete'
  | 'tajwid-complete'
  | 'hifz-10'
  | 'hifz-50'
  | 'bookmark-first'
  | 'quiz-25'
  // "Explorer"-Meilensteine (Konkurrenz-Parität, z. B. Al Quran App): reine
  // Nutzungs-Meilensteine statt Lern-/Andachts-Fortschritt, aber genau wie
  // alle anderen Badges live aus bereits vorhandenen AsyncStorage-Daten
  // berechnet — keine neue Tracking-Infrastruktur.
  | 'note-first'
  | 'bookmark-collections'
  | 'hifz-explorer'
  | 'offline-audio'
  | 'surah-explorer'
  | 'fasting-tracker'
  | 'review-master';

export interface Badge {
  id: BadgeId;
  icon: IconName;
}

// Reihenfolge = Anzeige-Reihenfolge im Abzeichen-Screen (grob nach
// erwarteter Erreichbarkeit: schnelle Erfolge zuerst, große Meilensteine
// zuletzt).
export const BADGES: Badge[] = [
  { id: 'first-lesson', icon: 'school' },
  { id: 'first-surah', icon: 'book' },
  { id: 'bookmark-first', icon: 'bookmark' },
  { id: 'streak-7', icon: 'flame' },
  { id: 'prayer-week', icon: 'checkmark-circle' },
  { id: 'hifz-10', icon: 'bulb' },
  { id: 'quiz-25', icon: 'game-controller' },
  { id: 'course-complete', icon: 'library' },
  { id: 'courses-3', icon: 'library' },
  { id: 'grammar-complete', icon: 'language' },
  { id: 'tajwid-complete', icon: 'musical-notes' },
  { id: 'khatmah-complete', icon: 'calendar' },
  { id: 'streak-30', icon: 'flame' },
  { id: 'hifz-50', icon: 'bulb' },
  { id: 'curriculum-complete', icon: 'ribbon' },
  { id: 'courses-all', icon: 'school' },
  { id: 'streak-100', icon: 'trophy' },
  { id: 'note-first', icon: 'create' },
  { id: 'hifz-explorer', icon: 'layers' },
  { id: 'bookmark-collections', icon: 'albums' },
  { id: 'offline-audio', icon: 'cloud-download' },
  { id: 'fasting-tracker', icon: 'moon' },
  { id: 'surah-explorer', icon: 'compass' },
  { id: 'review-master', icon: 'medal' },
];

export interface AchievementInputs {
  learnPassedCount: number;
  firstSurahPassed: boolean;
  curriculumComplete: boolean;
  bestPracticeStreak: number;
  bestPrayerStreak: number;
  khatmahCompletedOnce: boolean;
  anyCourseComplete: boolean;
  /** Anzahl vollstaendig bestandener Studien-Kurse. */
  coursesCompleteTotal: number;
  /** Anzahl Kurse MIT Lektionen — Nenner fuer „alle Kurse“. */
  coursesTotal: number;
  grammarComplete: boolean;
  tajwidComplete: boolean;
  hifzKnownTotal: number;
  bookmarksTotal: number;
  quizPlaysTotal: number;
  /** Anzahl persönlicher Vers-Notizen im Koran-Reader (quran/progress.ts notes[]). */
  noteCount: number;
  /** Anzahl unterschiedlicher Lesezeichen-Sammlungen, die je genutzt wurden (max. 3: favorite/memorize/reflect). */
  bookmarkCollectionsUsed: number;
  /** Anzahl unterschiedlicher Suren, in denen mind. ein Vers als "übe ich"/"kann ich" markiert wurde. */
  hifzSurahsStarted: number;
  /** Anzahl "reciter|surah"-Einträge im Offline-Audio-Index (Konurrenz-Feature: Rezitation offline verfügbar). */
  offlineAudioSurahsTotal: number;
  /** Anzahl unterschiedlicher Suren im Leseverlauf (quran/progress.ts history[], gedeckelt bei READ_HISTORY_MAX). */
  readSurahsTotal: number;
  /** Anzahl als gefastet markierter Tage im Fasten-Tracker (fasting/store.ts), unabhängig vom Ramadan-Zeitraum. */
  fastedDaysTotal: number;
  /** Mind. eine Lektion hat im Wiederholungs-System (study/review.ts) das höchste Level (60-Tage-Intervall) erreicht. */
  reviewMaxLevelReached: boolean;
}

export const EMPTY_ACHIEVEMENT_INPUTS: AchievementInputs = {
  learnPassedCount: 0,
  firstSurahPassed: false,
  curriculumComplete: false,
  bestPracticeStreak: 0,
  bestPrayerStreak: 0,
  khatmahCompletedOnce: false,
  anyCourseComplete: false,
  coursesCompleteTotal: 0,
  coursesTotal: 0,
  grammarComplete: false,
  tajwidComplete: false,
  hifzKnownTotal: 0,
  bookmarksTotal: 0,
  quizPlaysTotal: 0,
  noteCount: 0,
  bookmarkCollectionsUsed: 0,
  hifzSurahsStarted: 0,
  offlineAudioSurahsTotal: 0,
  readSurahsTotal: 0,
  fastedDaysTotal: 0,
  reviewMaxLevelReached: false,
};

// Schwellen der neuen "Explorer"-Meilensteine — als benannte Konstanten statt
// Magic Numbers im switch, analog zur Lesbarkeit der Streak-Schwellen oben.
export const BOOKMARK_COLLECTIONS_THRESHOLD = 3;
export const HIFZ_EXPLORER_SURAHS_THRESHOLD = 3;
export const OFFLINE_AUDIO_THRESHOLD = 3;
export const SURAH_EXPLORER_THRESHOLD = 10;
export const FASTING_TRACKER_THRESHOLD = 10;

export function isBadgeUnlocked(id: BadgeId, input: AchievementInputs): boolean {
  switch (id) {
    case 'first-lesson':
      return input.learnPassedCount >= 1;
    case 'first-surah':
      return input.firstSurahPassed;
    case 'curriculum-complete':
      return input.curriculumComplete;
    case 'streak-7':
      return input.bestPracticeStreak >= 7;
    case 'streak-30':
      return input.bestPracticeStreak >= 30;
    case 'streak-100':
      return input.bestPracticeStreak >= 100;
    case 'prayer-week':
      return input.bestPrayerStreak >= 7;
    case 'khatmah-complete':
      return input.khatmahCompletedOnce;
    case 'course-complete':
      return input.anyCourseComplete;
    case 'courses-3':
      return input.coursesCompleteTotal >= 3;
    case 'courses-all':
      // `coursesTotal > 0` verhindert, dass das Abzeichen aufleuchtet,
      // solange die Kurse noch gar nicht geladen sind (0 >= 0).
      return input.coursesTotal > 0 && input.coursesCompleteTotal >= input.coursesTotal;
    case 'grammar-complete':
      return input.grammarComplete;
    case 'tajwid-complete':
      return input.tajwidComplete;
    case 'hifz-10':
      return input.hifzKnownTotal >= 10;
    case 'hifz-50':
      return input.hifzKnownTotal >= 50;
    case 'bookmark-first':
      return input.bookmarksTotal >= 1;
    case 'quiz-25':
      return input.quizPlaysTotal >= 25;
    case 'note-first':
      return input.noteCount >= 1;
    case 'bookmark-collections':
      return input.bookmarkCollectionsUsed >= BOOKMARK_COLLECTIONS_THRESHOLD;
    case 'hifz-explorer':
      return input.hifzSurahsStarted >= HIFZ_EXPLORER_SURAHS_THRESHOLD;
    case 'offline-audio':
      return input.offlineAudioSurahsTotal >= OFFLINE_AUDIO_THRESHOLD;
    case 'surah-explorer':
      return input.readSurahsTotal >= SURAH_EXPLORER_THRESHOLD;
    case 'fasting-tracker':
      return input.fastedDaysTotal >= FASTING_TRACKER_THRESHOLD;
    case 'review-master':
      return input.reviewMaxLevelReached;
    default:
      return false;
  }
}

export function unlockedBadgeCount(input: AchievementInputs): number {
  return BADGES.filter((b) => isBadgeUnlocked(b.id, input)).length;
}

/**
 * Längster zusammenhängender Lauf aufsteigend sortierter, eindeutiger
 * 'YYYY-MM-DD'-Tage (kalendarisch, ohne Streak-Schutz-Joker) — Abzeichen
 * zählen die beste jemals erreichte Serie, nicht nur den aktuell laufenden
 * Streak (der nach einer Pause wieder bei 0 beginnt).
 */
export function longestConsecutiveRun(
  sortedDays: string[],
  isNextDay: (previous: string, next: string) => boolean,
): number {
  if (sortedDays.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    current = isNextDay(sortedDays[i - 1], sortedDays[i]) ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}
