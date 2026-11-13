import { resolveMushafPlaylistResume, resolveQuranListenResume } from './quranListenResume';
import type { AudioProgressEntry } from './types';

const ayahs = [{ numberInSurah: 1 }, { numberInSurah: 2 }, { numberInSurah: 3 }];

describe('resolveQuranListenResume', () => {
  it('startet bei Vers 1 ohne gespeicherten Fortschritt', () => {
    expect(resolveQuranListenResume(ayahs, null)).toEqual({ index: 0, seekSec: 0 });
  });

  it('setzt Seek innerhalb des gespeicherten Verses fort', () => {
    const saved: AudioProgressEntry = {
      kind: 'quran-listen',
      id: 'quran-listen:2:ar.alafasy',
      positionSec: 42,
      durationSec: 120,
      updatedAt: 1,
      meta: { surah: 2, ayah: 2, reciter: 'ar.alafasy' },
    };
    expect(resolveQuranListenResume(ayahs, saved)).toEqual({ index: 1, seekSec: 42 });
  });

  it('springt zum gespeicherten Vers ohne Seek unter Mindest-Schwelle', () => {
    const saved: AudioProgressEntry = {
      kind: 'quran-listen',
      id: 'quran-listen:2:ar.alafasy',
      positionSec: 2,
      durationSec: 120,
      updatedAt: 1,
      meta: { surah: 2, ayah: 3, reciter: 'ar.alafasy' },
    };
    expect(resolveQuranListenResume(ayahs, saved)).toEqual({ index: 2, seekSec: 0 });
  });
});

describe('resolveMushafPlaylistResume', () => {
  const playlist = [
    { surah: 1, ayah: 1, audio: 'a1' },
    { surah: 1, ayah: 2, audio: 'a2' },
    { surah: 2, ayah: 1, audio: 'b1' },
  ];

  it('ohne Speicher bei Index 0', () => {
    expect(resolveMushafPlaylistResume(playlist, null)).toEqual({ index: 0, seekSec: 0 });
  });

  it('setzt auf der Seite am gespeicherten Vers fort', () => {
    const saved: AudioProgressEntry = {
      kind: 'quran-listen',
      id: 'quran-listen:2:ar.alafasy',
      positionSec: 18,
      durationSec: 90,
      updatedAt: 1,
      meta: { surah: 2, ayah: 1, reciter: 'ar.alafasy' },
    };
    expect(resolveMushafPlaylistResume(playlist, saved)).toEqual({ index: 2, seekSec: 18 });
  });

  it('ignoriert Vers außerhalb der aktuellen Playlist', () => {
    const saved: AudioProgressEntry = {
      kind: 'quran-listen',
      id: 'quran-listen:3:ar.alafasy',
      positionSec: 30,
      durationSec: 90,
      updatedAt: 1,
      meta: { surah: 3, ayah: 1, reciter: 'ar.alafasy' },
    };
    expect(resolveMushafPlaylistResume(playlist, saved)).toEqual({ index: 0, seekSec: 0 });
  });
});
