import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { dayIndexSince } from '@/lib/dateKey';

// Khatmah-Leseplan: den Koran (30 Juz') in X Tagen lesen. Jeder Tag deckt
// einen gleichmäßigen Juz'-Bereich ab; Fortschritt pro Tag abhakbar.

export interface KhatmahPlan {
  startDay: string; // YYYY-MM-DD
  days: number;
  completed: Record<number, boolean>; // dayIndex → erledigt
}

export const KHATMAH_STORAGE_KEY = 'salatibox:khatmah';
export const PLAN_OPTIONS = [7, 15, 30, 60] as const;

/** Juz'-Bereich (1-basiert, inklusive) für Tag i (0-basiert). */
export function juzRangeForDay(plan: KhatmahPlan, dayIndex: number): { from: number; to: number } {
  const from = Math.floor((dayIndex * 30) / plan.days) + 1;
  const to = Math.floor(((dayIndex + 1) * 30) / plan.days);
  return { from, to: Math.max(from, to) };
}

export function completedDays(plan: KhatmahPlan): number {
  return Object.values(plan.completed).filter(Boolean).length;
}

/** Mushaf-Seitenbereich (1-basiert, inklusive) für Tag i — leitet sich aus dem
 * Juz'-Bereich (juzRangeForDay) und den Juz'-Startseiten des Madina-Mushaf ab,
 * für die "Seite X von Y"-Fortschrittsanzeige im Mushaf (Task #65). */
export function pageRangeForDay(
  plan: KhatmahPlan,
  dayIndex: number,
  juzStartPages: readonly number[],
  totalPages: number,
): { from: number; to: number } {
  const { from: juzFrom, to: juzTo } = juzRangeForDay(plan, dayIndex);
  const from = juzStartPages[juzFrom - 1] ?? 1;
  const to = juzTo < juzStartPages.length ? juzStartPages[juzTo] - 1 : totalPages;
  return { from, to: Math.max(from, to) };
}

export function dayIndexForDate(plan: KhatmahPlan, todayKey: string): number {
  // DST-sichere UTC-Kalenderarithmetik — Begründung siehe lib/dateKey.ts.
  return dayIndexSince(plan.startDay, todayKey, plan.days);
}

/** Positive Zahl = Tage im Rückstand gegenüber dem Plan. */
export function daysBehind(plan: KhatmahPlan, todayKey: string): number {
  // Nur VERGANGENE Tage zählen - der heutige, noch laufende Tag ist kein
  // Rückstand (gleiches Muster wie themes/journeyProgress.ts).
  const expected = dayIndexForDate(plan, todayKey);
  return Math.max(0, expected - completedDays(plan));
}

export function toggleDay(plan: KhatmahPlan, dayIndex: number): KhatmahPlan {
  return { ...plan, completed: { ...plan.completed, [dayIndex]: !plan.completed[dayIndex] } };
}

export function parsePlan(raw: string | null): KhatmahPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as KhatmahPlan;
    return parsed && typeof parsed.days === 'number' && parsed.days > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function useKhatmah() {
  const [plan, setPlan] = useState<KhatmahPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(KHATMAH_STORAGE_KEY).then((raw) => {
        if (!cancelled) {
          setPlan(parsePlan(raw));
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const save = useCallback((next: KhatmahPlan | null) => {
    setPlan(next);
    if (next) AsyncStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(KHATMAH_STORAGE_KEY).catch(() => {});
  }, []);

  const start = useCallback(
    (days: number, todayKey: string) => save({ startDay: todayKey, days, completed: {} }),
    [save],
  );
  const toggle = useCallback(
    (dayIndex: number) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const next = toggleDay(prev, dayIndex);
        AsyncStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );
  const reset = useCallback(() => save(null), [save]);

  return { plan, loaded, start, toggle, reset };
}
