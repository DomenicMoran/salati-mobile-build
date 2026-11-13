import { useEffect, useRef } from 'react';
import type { AudioStatus } from 'expo-audio';

import {
  audiobookProgressId,
  flushAudioProgressNow,
  podcastProgressId,
  quranListenProgressId,
  saveAudioProgress,
} from './audioProgress';
import type { AudioProgressEntry } from './types';

type PersistKind = AudioProgressEntry['kind'];

interface UseSharedAudioProgressOpts {
  active: boolean;
  kind: PersistKind;
  status: AudioStatus;
  buildEntry: (positionSec: number, durationSec: number) => Omit<AudioProgressEntry, 'updatedAt'> | null;
}

/**
 * Debounced Persistenz (5 s) + sofort bei Pause/Ende über flushAudioProgressNow.
 */
export function useSharedAudioProgress({
  active,
  kind,
  status,
  buildEntry,
}: UseSharedAudioProgressOpts): void {
  const lastWrite = useRef(0);
  const wasPlaying = useRef(false);

  useEffect(() => {
    if (!active) return;
    const position = status.currentTime ?? 0;
    const duration = status.duration ?? 0;
    const playing = !!status.playing;

    const write = (immediate = false) => {
      const base = buildEntry(position, duration);
      if (!base || base.kind !== kind) return;
      void saveAudioProgress({ ...base, positionSec: position, durationSec: duration });
      if (immediate) void flushAudioProgressNow();
    };

    if (!playing && wasPlaying.current) {
      write(true);
    }
    wasPlaying.current = playing;

    if (!playing) return;
    const now = Date.now();
    if (now - lastWrite.current < 4500) return;
    lastWrite.current = now;
    write(false);
  }, [active, buildEntry, kind, status.currentTime, status.duration, status.playing]);

  useEffect(() => {
    if (!active) return;
    return () => {
      const position = status.currentTime ?? 0;
      const duration = status.duration ?? 0;
      const base = buildEntry(position, duration);
      if (base && base.kind === kind) {
        void saveAudioProgress({ ...base, positionSec: position, durationSec: duration });
        void flushAudioProgressNow();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, buildEntry, kind]);
}

export { podcastProgressId, audiobookProgressId, quranListenProgressId };
