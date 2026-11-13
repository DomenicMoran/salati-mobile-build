import type { AppSettings } from '@/features/settings/types';

/** Phase-1-Flags — in Prod standardmäßig aus. */
export function mosqueFlagsFromSettings(settings: AppSettings) {
  return {
    mosqueDisplayEnabled: settings.mosqueDisplayEnabled === true,
    khutbaLiveEnabled: settings.khutbaLiveEnabled === true,
  };
}

export const DEFAULT_MOSQUE_FLAGS = {
  mosqueDisplayEnabled: false,
  khutbaLiveEnabled: false,
} as const;
