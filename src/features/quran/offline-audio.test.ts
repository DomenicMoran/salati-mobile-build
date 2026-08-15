import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  deleteFullMushafAudio,
  downloadSurahAudio,
  listDownloadedReciters,
  OFFLINE_AUDIO_INDEX_KEY,
} from './offline-audio';

// jest.mock-Aufrufe werden von babel-plugin-jest-hoist ohnehin vor die
// Imports gehoben - hier trotzdem nach den Imports notiert, damit
// eslint(import/first) nicht meckert.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///doc/x.mp3' }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

/**
 * listDownloadedReciters/deleteFullMushafAudio sind Ergänzungen zum
 * bestehenden "reciter|surah" → ayahCount-Index (offline-audio.ts) für die
 * eigenständige Rezitator-Auswahl beim Offline-Download in den Einstellungen.
 * Diese Tests decken vor allem ab: mehrere Rezitatoren nebeneinander,
 * Rückwärtskompatibilität mit dem bestehenden Index-Format, und dass Löschen
 * eines Pakets andere Pakete unangetastet lässt.
 */
describe('offline-audio: reciter packs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('lists no reciters when nothing is downloaded', async () => {
    expect(await listDownloadedReciters()).toEqual([]);
  });

  it('groups the existing flat index by reciter after downloads', async () => {
    await downloadSurahAudio('ar.alafasy', 1, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'], () => {});
    await downloadSurahAudio('ar.alafasy', 2, ['u1', 'u2'], () => {});
    await downloadSurahAudio('ar.husary', 1, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'], () => {});

    const list = await listDownloadedReciters();
    expect(list).toEqual(
      expect.arrayContaining([
        { reciter: 'ar.alafasy', surahCount: 2 },
        { reciter: 'ar.husary', surahCount: 1 },
      ]),
    );
    expect(list).toHaveLength(2);
  });

  it('reads a pre-existing raw index written by the old format (backward compatible)', async () => {
    // Simuliert einen Index, der vor Einführung von listDownloadedReciters
    // bereits existierte - reines "reciter|surah": ayahCount, ohne jede neue
    // Struktur. Muss unverändert korrekt gruppiert werden.
    await AsyncStorage.setItem(
      OFFLINE_AUDIO_INDEX_KEY,
      JSON.stringify({ 'ar.alafasy|1': 7, 'ar.alafasy|2': 286, 'ar.minshawi|114': 6 }),
    );

    const list = await listDownloadedReciters();
    expect(list).toEqual(
      expect.arrayContaining([
        { reciter: 'ar.alafasy', surahCount: 2 },
        { reciter: 'ar.minshawi', surahCount: 1 },
      ]),
    );
  });

  it('ignores zero/negative counts as "not downloaded"', async () => {
    await AsyncStorage.setItem(OFFLINE_AUDIO_INDEX_KEY, JSON.stringify({ 'ar.alafasy|1': 0 }));
    expect(await listDownloadedReciters()).toEqual([]);
  });

  it('deleteFullMushafAudio removes only the given reciter, leaving others intact', async () => {
    await downloadSurahAudio('ar.alafasy', 1, ['u1'], () => {});
    await downloadSurahAudio('ar.husary', 1, ['u1'], () => {});

    await deleteFullMushafAudio('ar.alafasy');

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('ar.alafasy')),
      { idempotent: true },
    );
    const list = await listDownloadedReciters();
    expect(list).toEqual([{ reciter: 'ar.husary', surahCount: 1 }]);
  });

  it('supports multiple reciters downloaded at the same time (no exclusivity)', async () => {
    await downloadSurahAudio('ar.alafasy', 1, ['u1'], () => {});
    await downloadSurahAudio('ar.husary', 1, ['u1'], () => {});
    await downloadSurahAudio('ar.minshawi', 1, ['u1'], () => {});

    const list = await listDownloadedReciters();
    expect(list.map((p) => p.reciter).sort()).toEqual(['ar.alafasy', 'ar.husary', 'ar.minshawi']);
  });
});
