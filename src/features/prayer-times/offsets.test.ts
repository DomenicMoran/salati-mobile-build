import { NO_PRAYER_TIME_OFFSETS, type PrayerTimeOffsets } from '@/features/settings/types';

import type { Timings } from './api';
import { applyPrayerTimeOffsets, clampOffset, shiftHHMM } from './offsets';

const BERLIN_JUNE: Timings = {
  Fajr: '02:45',
  Sunrise: '04:44',
  Dhuhr: '13:12',
  Asr: '17:29',
  Maghrib: '21:32',
  Isha: '23:15',
};

describe('clampOffset', () => {
  it('begrenzt auf ±60 Minuten', () => {
    expect(clampOffset(90)).toBe(60);
    expect(clampOffset(-90)).toBe(-60);
    expect(clampOffset(0)).toBe(0);
    expect(clampOffset(-7)).toBe(-7);
  });

  it('rundet auf ganze Minuten und fängt ungültige Werte ab', () => {
    expect(clampOffset(3.4)).toBe(3);
    expect(clampOffset(-3.6)).toBe(-4);
    expect(clampOffset(Number.NaN)).toBe(0);
  });
});

describe('shiftHHMM', () => {
  it('verschiebt vorwärts und rückwärts', () => {
    expect(shiftHHMM('13:12', 5)).toBe('13:17');
    expect(shiftHHMM('13:12', -15)).toBe('12:57');
  });

  it('rechnet über die Stundengrenze', () => {
    expect(shiftHHMM('04:55', 10)).toBe('05:05');
    expect(shiftHHMM('05:05', -10)).toBe('04:55');
  });

  it('rechnet zyklisch über Mitternacht (wie Aladhan-tune)', () => {
    expect(shiftHHMM('23:50', 20)).toBe('00:10');
    expect(shiftHHMM('00:05', -10)).toBe('23:55');
  });

  it('lässt unparsbare Werte unverändert', () => {
    expect(shiftHHMM('', 5)).toBe('');
    expect(shiftHHMM('-----', 5)).toBe('-----');
  });
});

describe('applyPrayerTimeOffsets', () => {
  it('verschiebt jedes Gebet einzeln, inklusive Sonnenaufgang', () => {
    const offsets: PrayerTimeOffsets = {
      fajr: -3,
      sunrise: 1,
      dhuhr: 2,
      asr: 0,
      maghrib: 4,
      isha: -60,
    };
    expect(applyPrayerTimeOffsets(BERLIN_JUNE, offsets)).toEqual({
      Fajr: '02:42',
      Sunrise: '04:45',
      Dhuhr: '13:14',
      Asr: '17:29',
      Maghrib: '21:36',
      Isha: '22:15',
    });
  });

  it('lässt die Zeiten ohne Korrektur unverändert', () => {
    expect(applyPrayerTimeOffsets(BERLIN_JUNE, NO_PRAYER_TIME_OFFSETS)).toEqual(BERLIN_JUNE);
  });

  it('begrenzt auch überschrittene Werte auf ±60', () => {
    const t = applyPrayerTimeOffsets(BERLIN_JUNE, { ...NO_PRAYER_TIME_OFFSETS, dhuhr: 500 });
    expect(t.Dhuhr).toBe('14:12');
  });
});
