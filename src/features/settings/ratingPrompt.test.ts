import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { hasShownRatingPrompt, maybeRequestReview, RATING_PROMPT_SHOWN_KEY } from './ratingPrompt';

// jest hoisted: jest.mock() laeuft vor allen Imports oben, unabhaengig von
// der Quelltext-Reihenfolge (babel-plugin-jest-hoist) - Deklaration hier
// unten haelt import/first zufrieden, ohne die Hoisting-Semantik zu aendern.
const mockIsAvailable = jest.fn().mockResolvedValue(true);
const mockRequestReview = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-store-review', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailable(...args),
  requestReview: (...args: unknown[]) => mockRequestReview(...args),
}));

/** Platform.OS ist in RN ein Getter - temporär per defineProperty ersetzen. */
async function withPlatformOs(os: typeof Platform.OS, fn: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  try {
    await fn();
  } finally {
    Object.defineProperty(Platform, 'OS', original);
  }
}

describe('ratingPrompt', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockIsAvailable.mockClear();
    mockRequestReview.mockClear();
    mockIsAvailable.mockResolvedValue(true);
    mockRequestReview.mockResolvedValue(undefined);
  });

  it('ist beim ersten Start noch nicht gezeigt worden', async () => {
    expect(await hasShownRatingPrompt()).toBe(false);
  });

  it('ruft requestReview() beim ersten Aufruf auf und setzt das Flag', async () => {
    await withPlatformOs('ios', async () => {
      await maybeRequestReview();
      expect(mockIsAvailable).toHaveBeenCalledTimes(1);
      expect(mockRequestReview).toHaveBeenCalledTimes(1);
      expect(await hasShownRatingPrompt()).toBe(true);
      expect(await AsyncStorage.getItem(RATING_PROMPT_SHOWN_KEY)).toBe('1');
    });
  });

  it('fragt nie ein zweites Mal - auch nicht bei erneutem positivem Moment', async () => {
    await withPlatformOs('ios', async () => {
      await maybeRequestReview();
      await maybeRequestReview();
      await maybeRequestReview();
      expect(mockRequestReview).toHaveBeenCalledTimes(1);
    });
  });

  it('ruft requestReview() nicht auf, wenn isAvailableAsync() false liefert - Flag wird trotzdem gesetzt', async () => {
    mockIsAvailable.mockResolvedValueOnce(false);
    await withPlatformOs('android', async () => {
      await maybeRequestReview();
      expect(mockRequestReview).not.toHaveBeenCalled();
      expect(await hasShownRatingPrompt()).toBe(true);
    });
  });

  it('auf Web wird nie versucht und das Flag bleibt ungesetzt', async () => {
    await withPlatformOs('web', async () => {
      await maybeRequestReview();
      expect(mockIsAvailable).not.toHaveBeenCalled();
      expect(mockRequestReview).not.toHaveBeenCalled();
      expect(await hasShownRatingPrompt()).toBe(false);
    });
  });

  it('ein Fehler in requestReview() wirft nicht und verhindert keinen künftigen Aufruf-Versuch (Flag bleibt trotzdem gesetzt)', async () => {
    mockRequestReview.mockRejectedValueOnce(new Error('native error'));
    await withPlatformOs('ios', async () => {
      await expect(maybeRequestReview()).resolves.toBeUndefined();
      expect(await hasShownRatingPrompt()).toBe(true);
      // Kein zweiter Versuch, obwohl der erste fehlgeschlagen ist.
      await maybeRequestReview();
      expect(mockRequestReview).toHaveBeenCalledTimes(1);
    });
  });

  it('behandelt Lesefehler aus AsyncStorage als "schon gezeigt" (nie riskant zweimal fragen)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    expect(await hasShownRatingPrompt()).toBe(true);
    spy.mockRestore();
  });
});
