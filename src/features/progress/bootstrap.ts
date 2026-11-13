import { AppState, Platform } from 'react-native';

import { flushAudioProgressNow } from './audioProgress';
import { ensureQuranProgressLoaded, flushQuranProgressNow } from './quranProgressStore';

let bootstrapped = false;

export async function runProgressBootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  await ensureQuranProgressLoaded();
}

export function installProgressLifecycleFlush(): () => void {
  const flushAll = () => {
    void flushQuranProgressNow();
    void flushAudioProgressNow();
  };

  const subs: Array<{ remove: () => void }> = [];

  subs.push(
    AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') flushAll();
    }),
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const onHide = () => flushAll();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    window.addEventListener('pagehide', onHide);
    subs.push({
      remove: () => {
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', onHide);
      },
    });
  }

  return () => subs.forEach((s) => s.remove());
}
