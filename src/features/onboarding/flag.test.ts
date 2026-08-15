import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { isOnboardingDone, markOnboardingDone, ONBOARDING_DONE_KEY } from './flag';

/** Platform.OS ist in RN ein Getter — temporär per defineProperty ersetzen. */
async function withPlatformOs(os: typeof Platform.OS, fn: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  try {
    await fn();
  } finally {
    Object.defineProperty(Platform, 'OS', original);
  }
}

describe('onboarding flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is not done on first native start', async () => {
    expect(await isOnboardingDone()).toBe(false);
  });

  it('is done after markOnboardingDone', async () => {
    await markOnboardingDone();
    expect(await isOnboardingDone()).toBe(true);
    expect(await AsyncStorage.getItem(ONBOARDING_DONE_KEY)).toBe('1');
  });

  it('always counts as done on web (landing page owns onboarding there)', async () => {
    await withPlatformOs('web', async () => {
      expect(await isOnboardingDone()).toBe(true);
    });
  });

  it('treats storage read errors as done (never trap the user in the flow)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    expect(await isOnboardingDone()).toBe(true);
    spy.mockRestore();
  });
});
