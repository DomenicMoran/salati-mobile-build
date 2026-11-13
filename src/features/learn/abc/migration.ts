import AsyncStorage from '@react-native-async-storage/async-storage';

import { ABC_LESSONS, ABC_PROGRESS_STORAGE_KEY } from '@/features/learn/abc/curriculum';
import {
  LEARN_PROGRESS_STORAGE_KEY,
  parseLearnProgress,
  passedCount,
  recordResult,
  type LearnProgress,
} from '@/features/learn/progress';

const MIGRATION_FLAG = 'salatibox:learn-abc-migration-v1';

/** Volle Punktzahl für alle ABC-Lektionen (überspringen ohne Kern-Fortschritt zu löschen). */
export function abcCompletionProgress(now = Date.now()): LearnProgress {
  const full: LearnProgress = {};
  for (const lesson of ABC_LESSONS) {
    full[lesson.id] = { score: 10, total: 10, completedAt: now };
  }
  return full;
}

export function shouldAutoCompleteAbc(coreProgress: LearnProgress): boolean {
  if (passedCount(coreProgress) > 0) return true;
  const early = ['similar', 'forms-3', 'damma', 'sun-moon', 'words-2'];
  return early.some((id) => {
    const r = coreProgress[id];
    return !!r && r.total > 0 && r.score / r.total >= 0.7;
  });
}

/**
 * Idempotent: markiert ABC für Nutzer mit bestehendem Lesekurs-Fortschritt als erledigt.
 * Schreibt nur den ABC-Key, löscht nichts anderes.
 */
export async function runAbcProgressMigrationIfNeeded(): Promise<LearnProgress> {
  const rawAbc = await AsyncStorage.getItem(ABC_PROGRESS_STORAGE_KEY);
  let abcProgress = parseLearnProgress(rawAbc);
  const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
  if (flag === 'done' && Object.keys(abcProgress).length > 0) return abcProgress;

  const coreRaw = await AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY);
  const core = parseLearnProgress(coreRaw);
  if (shouldAutoCompleteAbc(core)) {
    let merged = { ...abcProgress };
    const now = Date.now();
    for (const lesson of ABC_LESSONS) {
      merged = recordResult(merged, lesson.id, 10, 10, now);
    }
    abcProgress = merged;
    await AsyncStorage.setItem(ABC_PROGRESS_STORAGE_KEY, JSON.stringify(abcProgress));
  }
  await AsyncStorage.setItem(MIGRATION_FLAG, 'done');
  return abcProgress;
}

/** Nutzer wählt bewusst „Ich kann das schon“ — nur ABC-Key. */
export async function markAbcCourseComplete(): Promise<void> {
  const progress = abcCompletionProgress();
  await AsyncStorage.setItem(ABC_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  await AsyncStorage.setItem(MIGRATION_FLAG, 'done');
}
