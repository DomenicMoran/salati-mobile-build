/** Fortschritts-Typen für Lesen und Hören (Reader-Audio-Fortschritt v1). */

export type MediaProgressKind =
  | 'quran-read'
  | 'quran-listen'
  | 'mushaf'
  | 'book'
  | 'tafsir'
  | 'hadith'
  | 'audiobook'
  | 'podcast'
  | 'video'
  | 'lecture';

export interface AudioProgressEntry {
  kind: 'podcast' | 'audiobook' | 'quran-listen';
  /** Stabile ID, z. B. `podcast:42`, `audiobook:pflichtwissen:3:de`, `quran-listen:2:abdul_basit`. */
  id: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  completedAt?: number;
  /** Rezitator- oder Spur-Metadaten (Sync-Anzeige, kein PII). */
  meta?: {
    reciter?: string;
    edition?: string;
    speed?: number;
    surah?: number;
    ayah?: number;
    chapterNo?: number;
    track?: string;
    lang?: string;
    episodeNo?: number;
  };
}

export type AudioProgressMap = Record<string, AudioProgressEntry>;

export const AUDIO_NEAR_END_RATIO = 0.95;
export const AUDIO_MIN_POSITION_SEC = 5;
