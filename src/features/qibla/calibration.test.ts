import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hasSeenQiblaCalibrationHint,
  isHeadingNoisy,
  isLowNativeAccuracy,
  markQiblaCalibrationHintSeen,
  QIBLA_CALIBRATION_HINT_SEEN_KEY,
  type HeadingSample,
} from './calibration';

function series(headings: number[], startT = 0, stepMs = 100): HeadingSample[] {
  return headings.map((heading, i) => ({ heading, t: startT + i * stepMs }));
}

describe('isHeadingNoisy', () => {
  it('is false with too few samples', () => {
    expect(isHeadingNoisy(series([10, 12, 11]))).toBe(false);
  });

  it('is false for a steady heading (no movement at all)', () => {
    expect(isHeadingNoisy(series([90, 90, 90, 90, 90, 90]))).toBe(false);
  });

  it('is false when the user deliberately rotates (large net displacement)', () => {
    // Gleichmäßige Drehung von 0° auf 120° — große Netto-Verschiebung, kein Zittern.
    expect(isHeadingNoisy(series([0, 20, 40, 60, 80, 100, 120]))).toBe(false);
  });

  it('is true when the heading jitters back and forth without net movement', () => {
    // Springt in einem engen Fenster stark hin und her, landet aber wieder nahe am Start.
    expect(isHeadingNoisy(series([100, 140, 90, 145, 95, 138, 102]))).toBe(true);
  });

  it('handles the 0/360 wrap without false positives', () => {
    // Drehung über die Nord-Grenze hinweg (350 -> 10) ist eine kleine, echte Bewegung.
    expect(isHeadingNoisy(series([350, 355, 0, 5, 10]))).toBe(false);
  });

  it('ignores samples outside the time window', () => {
    // Große Sprünge, aber weit auseinander in der Zeit -> jeweils außerhalb des Fensters.
    const old = series([0, 90], 0, 0);
    const recent = series([180, 185, 183, 186], 5000, 50);
    expect(isHeadingNoisy([...old, ...recent])).toBe(false);
  });
});

describe('isLowNativeAccuracy', () => {
  it('treats null (kein Wert / Web) as not-low — die Web-Heuristik übernimmt dort separat', () => {
    expect(isLowNativeAccuracy(null)).toBe(false);
  });

  it('treats 0 and 1 as low accuracy', () => {
    expect(isLowNativeAccuracy(0)).toBe(true);
    expect(isLowNativeAccuracy(1)).toBe(true);
  });

  it('treats 2 and 3 as sufficient', () => {
    expect(isLowNativeAccuracy(2)).toBe(false);
    expect(isLowNativeAccuracy(3)).toBe(false);
  });
});

describe('qibla calibration hint seen-flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is not seen before first mark', async () => {
    expect(await hasSeenQiblaCalibrationHint()).toBe(false);
  });

  it('is seen after markQiblaCalibrationHintSeen', async () => {
    await markQiblaCalibrationHintSeen();
    expect(await hasSeenQiblaCalibrationHint()).toBe(true);
    expect(await AsyncStorage.getItem(QIBLA_CALIBRATION_HINT_SEEN_KEY)).toBe('1');
  });

  it('treats storage read errors as seen (never trap the user with a stuck hint)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    expect(await hasSeenQiblaCalibrationHint()).toBe(true);
    spy.mockRestore();
  });
});
