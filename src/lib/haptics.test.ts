import { Platform } from 'react-native';

import { hapticLight, hapticSuccess, hapticWarning } from './haptics';

// jest hoisted: jest.mock() laeuft vor allen Imports oben, unabhaengig von
// der Quelltext-Reihenfolge (babel-plugin-jest-hoist) - Deklaration hier
// unten haelt import/first zufrieden, ohne die Hoisting-Semantik zu aendern.
const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockImpactAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
}));

/** Platform.OS ist in RN ein Getter - temporär per defineProperty ersetzen. */
function withPlatformOs(os: typeof Platform.OS, fn: () => void) {
  const original = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  try {
    fn();
  } finally {
    Object.defineProperty(Platform, 'OS', original);
  }
}

describe('haptics', () => {
  beforeEach(() => {
    mockNotificationAsync.mockClear();
    mockImpactAsync.mockClear();
  });

  it('hapticSuccess loest auf nativen Plattformen notificationAsync(Success) aus', () => {
    withPlatformOs('ios', () => {
      hapticSuccess();
      expect(mockNotificationAsync).toHaveBeenCalledWith('success');
    });
  });

  it('hapticWarning loest auf nativen Plattformen notificationAsync(Warning) aus', () => {
    withPlatformOs('android', () => {
      hapticWarning();
      expect(mockNotificationAsync).toHaveBeenCalledWith('warning');
    });
  });

  it('hapticLight loest auf nativen Plattformen impactAsync(Light) aus', () => {
    withPlatformOs('ios', () => {
      hapticLight();
      expect(mockImpactAsync).toHaveBeenCalledWith('light');
    });
  });

  it('ist auf Web ein No-op (kein Haptics-Aufruf)', () => {
    withPlatformOs('web', () => {
      hapticSuccess();
      hapticWarning();
      hapticLight();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });
  });

  it('ein Fehler aus dem nativen Aufruf wirft nicht (fire-and-forget)', () => {
    mockNotificationAsync.mockRejectedValueOnce(new Error('native error'));
    withPlatformOs('ios', () => {
      expect(() => hapticSuccess()).not.toThrow();
    });
  });
});
