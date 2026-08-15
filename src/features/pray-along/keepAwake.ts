import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Bildschirm während des Gebets wachhalten. Nativ über expo-keep-awake
// (activateKeepAwakeAsync), Web über die Screen Wake Lock API (re-acquire bei
// Rückkehr in den Vordergrund).

const KEEP_AWAKE_TAG = 'salati-pray-along';

interface WakeLockSentinel {
  release: () => Promise<void>;
}
interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
}

export function useKeepScreenAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    // Nativ (iOS/Android): expo-keep-awake hält den Bildschirm an, solange der
    // Screen aktiv ist — beim Verlassen/Deaktivieren wieder freigeben.
    if (Platform.OS !== 'web') {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
      };
    }

    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
    const nav = navigator as Navigator & WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = () => {
      nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (cancelled) {
            s.release().catch(() => undefined);
          } else {
            sentinel = s;
          }
        })
        .catch(() => undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
