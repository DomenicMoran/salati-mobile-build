import type { MushafPlaylistEntry } from '@/features/quran/mushafPlaylist';
import { findMushafPlaylistIndex } from '@/features/quran/mushafPlaylist';

import type { AudioProgressEntry } from './types';
import { AUDIO_MIN_POSITION_SEC } from './types';

export interface QuranListenAyahRef {
  numberInSurah: number;
}

/** Ermittelt Vers-Index und Seek für Fortsetzen (Sure-Hören, A01). */
export function resolveQuranListenResume(
  ayahs: QuranListenAyahRef[],
  saved: AudioProgressEntry | null | undefined,
): { index: number; seekSec: number } {
  const firstPlayable = (): number => (ayahs.length > 0 ? 0 : 0);

  const indexForAyah = (ayahNo: number): number | null => {
    const idx = ayahs.findIndex((a) => a.numberInSurah === ayahNo);
    return idx >= 0 ? idx : null;
  };

  if (!saved) {
    return { index: firstPlayable(), seekSec: 0 };
  }

  const ayahNo = saved.meta?.ayah;
  if (ayahNo != null) {
    const idx = indexForAyah(ayahNo);
    if (idx !== null) {
      const seekSec =
        saved.positionSec >= AUDIO_MIN_POSITION_SEC && Number.isFinite(saved.positionSec)
          ? saved.positionSec
          : 0;
      return { index: idx, seekSec };
    }
  }

  if (saved.positionSec >= AUDIO_MIN_POSITION_SEC) {
    return { index: firstPlayable(), seekSec: 0 };
  }

  return { index: firstPlayable(), seekSec: 0 };
}

/** Resume für Mushaf-Seiten-Playlist (mehrere Suren auf einer Druckseite, A05). */
export function resolveMushafPlaylistResume(
  playlist: MushafPlaylistEntry[],
  saved: AudioProgressEntry | null | undefined,
): { index: number; seekSec: number } {
  if (!playlist.length) return { index: 0, seekSec: 0 };
  const surah = saved?.meta?.surah;
  const ayah = saved?.meta?.ayah;
  if (!saved || surah == null || ayah == null) {
    return { index: 0, seekSec: 0 };
  }
  const idx = findMushafPlaylistIndex(playlist, surah, ayah);
  if (idx < 0) return { index: 0, seekSec: 0 };
  const seekSec =
    saved.positionSec >= AUDIO_MIN_POSITION_SEC && Number.isFinite(saved.positionSec)
      ? saved.positionSec
      : 0;
  return { index: idx, seekSec };
}
