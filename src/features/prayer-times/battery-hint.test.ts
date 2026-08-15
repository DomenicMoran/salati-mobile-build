import AsyncStorage from '@react-native-async-storage/async-storage';

import { BATTERY_HINT_SHOWN_KEY, markBatteryHintShown, wasBatteryHintShown } from './battery-hint';

describe('battery optimization hint flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has not been shown before the first mark', async () => {
    expect(await wasBatteryHintShown()).toBe(false);
  });

  it('is remembered as shown after markBatteryHintShown', async () => {
    await markBatteryHintShown();
    expect(await wasBatteryHintShown()).toBe(true);
    expect(await AsyncStorage.getItem(BATTERY_HINT_SHOWN_KEY)).toBe('1');
  });

  it('treats storage read errors as "already shown" (nie wiederholt nerven)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    expect(await wasBatteryHintShown()).toBe(true);
    spy.mockRestore();
  });

  it('swallows storage write errors without throwing', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('io'));
    await expect(markBatteryHintShown()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
