import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HijriDate, Timings } from './api';
import type { PrayerCalcOptions } from './calc';

interface CachedTimings {
  today: Timings;
  tomorrow: Timings;
  hijri?: HijriDate;
  savedAt: number;
}

/**
 * Der Cache-Schlüssel enthält ALLE Parameter, die die Zeiten verändern —
 * seit 2026-07-27 also auch die Hochbreiten-Regel und die Minuten-Korrektur.
 * Sonst würde eine geänderte Einstellung offline weiterhin die alten Zeiten
 * ausliefern.
 */
function cacheKey(lat: number, lon: number, opts: PrayerCalcOptions): string {
  const o = opts.offsets;
  const tune = `${o.fajr},${o.sunrise},${o.dhuhr},${o.asr},${o.maghrib},${o.isha}`;
  return `salatibox:timings:${lat.toFixed(3)}:${lon.toFixed(3)}:${opts.method}:${opts.school}:${opts.highLatitude}:${tune}`;
}

export async function readTimingsCache(
  lat: number,
  lon: number,
  opts: PrayerCalcOptions,
): Promise<CachedTimings | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(lat, lon, opts));
    if (!raw) return null;
    return JSON.parse(raw) as CachedTimings;
  } catch {
    return null;
  }
}

export async function writeTimingsCache(
  lat: number,
  lon: number,
  opts: PrayerCalcOptions,
  data: Omit<CachedTimings, 'savedAt'>,
): Promise<void> {
  try {
    const payload: CachedTimings = { ...data, savedAt: Date.now() };
    await AsyncStorage.setItem(cacheKey(lat, lon, opts), JSON.stringify(payload));
  } catch {
    // Speicher voll o.ä. — Cache ist best-effort, kein harter Fehler
  }
}
