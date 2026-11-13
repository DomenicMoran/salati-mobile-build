import AsyncStorage from '@react-native-async-storage/async-storage';

import { ABC_LESSONS, ABC_PROGRESS_STORAGE_KEY } from '@/features/learn/abc/curriculum';
import { runAbcProgressMigrationIfNeeded, shouldAutoCompleteAbc } from '@/features/learn/abc/migration';
import { LEARN_PROGRESS_STORAGE_KEY, type LearnProgress } from '@/features/learn/progress';

describe('abc migration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shouldAutoCompleteAbc when core has a passed lesson', () => {
    const core: LearnProgress = { 'letters-1': { score: 8, total: 10, completedAt: 1 } };
    expect(shouldAutoCompleteAbc(core)).toBe(true);
    expect(shouldAutoCompleteAbc({})).toBe(false);
  });

  it('runAbcProgressMigrationIfNeeded fills abc when core progressed', async () => {
    await AsyncStorage.setItem(
      LEARN_PROGRESS_STORAGE_KEY,
      JSON.stringify({ 'letters-1': { score: 10, total: 10, completedAt: 1 } }),
    );
    const abc = await runAbcProgressMigrationIfNeeded();
    expect(Object.keys(abc).length).toBe(ABC_LESSONS.length);
    const raw = await AsyncStorage.getItem(ABC_PROGRESS_STORAGE_KEY);
    expect(raw).toBeTruthy();
  });
});
