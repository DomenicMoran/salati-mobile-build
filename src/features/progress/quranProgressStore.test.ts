import AsyncStorage from '@react-native-async-storage/async-storage';

import { QURAN_PROGRESS_STORAGE_KEY } from '@/features/quran/progress';

import {
  ensureQuranProgressLoaded,
  quranProgressSetLastRead,
  quranProgressToggleBookmark,
  getQuranProgressSnapshot,
  flushQuranProgressNow,
} from './quranProgressStore';

describe('quranProgressStore lost-update guard', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // Modul-State zurücksetzen: frischer Import nicht möglich — leere Storage reicht für sequentielle Tests.
    await ensureQuranProgressLoaded();
  });

  it('zwei schnelle Schreibzugriffe verlieren keine Lesezeichen', async () => {
    quranProgressToggleBookmark(1, 1);
    quranProgressToggleBookmark(2, 255);
    quranProgressSetLastRead(2, 10);
    await flushQuranProgressNow();

    const snap = getQuranProgressSnapshot();
    expect(snap.bookmarks).toHaveLength(2);
    expect(snap.lastRead?.surah).toBe(2);

    const raw = await AsyncStorage.getItem(QURAN_PROGRESS_STORAGE_KEY);
    expect(raw).toContain('"surah":2,"ayah":255');
    expect(raw).toContain('"surah":2,"ayah":10');
  });
});
