import { NativeModules, Platform } from 'react-native';

const MOD = 'KhutbaMicForeground';

interface KhutbaMicNative {
  start?: () => Promise<boolean>;
  stop?: () => Promise<boolean>;
}

/** Android FGS type=microphone — getrennt vom Adhan-Dienst (F14). */
export function startKhutbaMicForeground(): void {
  if (Platform.OS !== 'android') return;
  const native = (NativeModules as Record<string, KhutbaMicNative | undefined>)[MOD];
  native?.start?.().catch(() => undefined);
}

export function stopKhutbaMicForeground(): void {
  if (Platform.OS !== 'android') return;
  const native = (NativeModules as Record<string, KhutbaMicNative | undefined>)[MOD];
  native?.stop?.().catch(() => undefined);
}