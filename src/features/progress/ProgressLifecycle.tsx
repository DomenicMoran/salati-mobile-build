import { useEffect } from 'react';

import { useSharedPlayer } from '@/features/quran/usePlayer';

import { installProgressLifecycleFlush, runProgressBootstrap } from './bootstrap';
import { registerSleepTimerExpire } from './sleepTimer';

export function ProgressLifecycle() {
  const { player } = useSharedPlayer();

  useEffect(() => {
    void runProgressBootstrap();
    return installProgressLifecycleFlush();
  }, []);

  useEffect(() => {
    return registerSleepTimerExpire(() => {
      player.pause();
    });
  }, [player]);

  return null;
}
