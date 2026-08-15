import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { logError } from '@/lib/errorLog';
import { parseTimeOn } from '@/features/prayer-times/next-prayer';

// Fasten-Tracker: pro Tag ob gefastet wurde (Ramadan, Mo/Do, Ayyam al-Bid …).

export type FastingData = Record<string, boolean>;

export const FASTING_STORAGE_KEY = 'salatibox:fasting';

export function toggleFast(data: FastingData, day: string): FastingData {
  return { ...data, [day]: !data[day] };
}

export function fastedCount(data: FastingData): number {
  return Object.values(data).filter(Boolean).length;
}

/**
 * "HH:MM" des heutigen Datums → Date; für Suhoor-/Iftar-Countdown.
 * Über parseTimeOn, damit der Countdown an den Umstellungstagen dieselbe
 * Zeit meint wie der Suhur-Wecker (s. prayer-times/next-prayer.ts).
 */
export function timeToday(hhmm: string, now: Date): Date {
  return parseTimeOn(hhmm, now);
}

export interface FastCountdown {
  /** 'suhoor' = bis Fajr (Essen erlaubt), 'iftar' = bis Maghrib (Fasten läuft), 'done' = nach Maghrib */
  phase: 'suhoor' | 'iftar' | 'done';
  msRemaining: number;
}

export function fastCountdown(fajr: string, maghrib: string, now: Date): FastCountdown {
  const fajrTime = timeToday(fajr, now);
  const maghribTime = timeToday(maghrib, now);
  if (now < fajrTime) return { phase: 'suhoor', msRemaining: fajrTime.getTime() - now.getTime() };
  if (now < maghribTime) return { phase: 'iftar', msRemaining: maghribTime.getTime() - now.getTime() };
  return { phase: 'done', msRemaining: 0 };
}

/**
 * Ramadan-Erkennung anhand des Hijri-Monats aus der Aladhan-Antwort
 * (`data.hijri.month.number`, siehe features/prayer-times/api.ts). Ramadan
 * ist Monat 9 im Hijri-Kalender - zentrale Stelle, damit die Home-Dashboard-
 * Karte (Suhoor-/Iftar-Countdown) und künftige Ramadan-Features dieselbe
 * Herleitung nutzen statt jeweils eigene Vergleichslogik zu bauen.
 */
export function isRamadanMonth(hijriMonthNumber: string | number | undefined): boolean {
  return Number(hijriMonthNumber) === 9;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function parseFasting(raw: string | null): FastingData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as FastingData) : {};
  } catch {
    return {};
  }
}

export function useFasting() {
  const [data, setData] = useState<FastingData>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(FASTING_STORAGE_KEY).then((raw) => {
        if (!cancelled) setData(parseFasting(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const toggle = useCallback((day: string) => {
    setData((prev) => {
      const next = toggleFast(prev, day);
      // Persistenz-Fehler heisst: der Haken ist beim naechsten Start wieder
      // weg. Der Nutzer sieht das nicht — darum in den lokalen Fehler-Log.
      AsyncStorage.setItem(FASTING_STORAGE_KEY, JSON.stringify(next)).catch((err: unknown) =>
        logError(err, 'fasting: Tag speichern'),
      );
      return next;
    });
  }, []);

  return { data, toggle };
}
