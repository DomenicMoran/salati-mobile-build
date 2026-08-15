import { NativeModules, Platform } from 'react-native';

import { checkExactAlarmPermission } from './exact-alarm';

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

describe('checkExactAlarmPermission', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).ExactAlarmStatus;
  });

  it('returns null on iOS (Problem existiert dort nicht)', async () => {
    await withPlatformOs('ios', async () => {
      expect(await checkExactAlarmPermission()).toBeNull();
    });
  });

  it('returns null on web', async () => {
    await withPlatformOs('web', async () => {
      expect(await checkExactAlarmPermission()).toBeNull();
    });
  });

  it('returns null on android when the native module is not linked (unbuilt session, siehe WearSync-Präzedenzfall)', async () => {
    await withPlatformOs('android', async () => {
      expect(await checkExactAlarmPermission()).toBeNull();
    });
  });

  it('returns the native result verbatim when the module is linked and grants the permission', async () => {
    (NativeModules as Record<string, unknown>).ExactAlarmStatus = {
      canScheduleExactAlarms: jest.fn().mockResolvedValue(true),
    };
    await withPlatformOs('android', async () => {
      expect(await checkExactAlarmPermission()).toBe(true);
    });
  });

  it('returns the native result verbatim when the module is linked and denies the permission', async () => {
    (NativeModules as Record<string, unknown>).ExactAlarmStatus = {
      canScheduleExactAlarms: jest.fn().mockResolvedValue(false),
    };
    await withPlatformOs('android', async () => {
      expect(await checkExactAlarmPermission()).toBe(false);
    });
  });

  it('returns null instead of throwing when the native call rejects', async () => {
    (NativeModules as Record<string, unknown>).ExactAlarmStatus = {
      canScheduleExactAlarms: jest.fn().mockRejectedValue(new Error('boom')),
    };
    await withPlatformOs('android', async () => {
      expect(await checkExactAlarmPermission()).toBeNull();
    });
  });
});
