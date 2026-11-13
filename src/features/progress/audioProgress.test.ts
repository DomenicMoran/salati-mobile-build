import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  flushAudioProgressNow,
  loadAudioProgressEntry,
  mergeAudioProgressMaps,
  podcastProgressId,
  saveAudioProgress,
} from './audioProgress';
import { AUDIO_PROGRESS_STORAGE_KEY } from './keys';

describe('audioProgress', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('speichert und lädt Podcast-Position', async () => {
    const id = podcastProgressId(7);
    await saveAudioProgress({
      kind: 'podcast',
      id,
      positionSec: 120,
      durationSec: 600,
      meta: { episodeNo: 7 },
    });
    const entry = await loadAudioProgressEntry(id);
    expect(entry?.positionSec).toBe(120);
  });

  it('merge gewinnt neueres updatedAt', () => {
    const id = 'podcast:1';
    const local = {
      [id]: {
        kind: 'podcast' as const,
        id,
        positionSec: 10,
        durationSec: 100,
        updatedAt: 1000,
      },
    };
    const imported = {
      [id]: {
        kind: 'podcast' as const,
        id,
        positionSec: 50,
        durationSec: 100,
        updatedAt: 2000,
      },
    };
    const merged = mergeAudioProgressMaps(local, imported);
    expect(merged[id].positionSec).toBe(50);
  });

  it('speichert Koran-Hören mit Vers-Metadaten', async () => {
    const id = 'quran-listen:1:ar.alafasy';
    await saveAudioProgress({
      kind: 'quran-listen',
      id,
      positionSec: 18,
      durationSec: 90,
      meta: { surah: 1, ayah: 3, reciter: 'ar.alafasy' },
    });
    await flushAudioProgressNow();
    const entry = await loadAudioProgressEntry(id);
    expect(entry?.meta?.ayah).toBe(3);
    expect(entry?.positionSec).toBe(18);
  });

  it('schreibt unter salatibox:progress:v1:audio', async () => {
    await saveAudioProgress({
      kind: 'podcast',
      id: 'podcast:2',
      positionSec: 30,
      durationSec: 400,
    });
    await flushAudioProgressNow();
    const raw = await AsyncStorage.getItem(AUDIO_PROGRESS_STORAGE_KEY);
    expect(raw).toContain('podcast:2');
  });
});
