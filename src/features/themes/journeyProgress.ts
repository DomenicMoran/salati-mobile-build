// Fortschritts-/Streak-Logik für Themen-Leseplaene (journeys.ts) - an
// khatmah/plan.ts angelehnt (Start-Tag, completed-Map, dayIndex/Rückstand
// aus dem Kalenderdatum), aber EIGENSTÄNDIG: Khatmah errechnet Seiten-/
// Juz-Bereiche aus dem Tagesindex, hier sind die Tagesinhalte fest kuratiert
// (journeys.ts) und es gibt anders als bei Khatmah (ein einziger aktiver
// Plan) MEHRERE unabhängige Reisen gleichzeitig - jede mit eigenem
// AsyncStorage-Eintrag (siehe journeyStorageKey), analog zu den
// Kurs-Fortschritten in features/study/courses.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { dayIndexSince } from '@/lib/dateKey';

export interface JourneyProgress {
  journeyId: string;
  startDay: string; // YYYY-MM-DD
  completed: Record<number, boolean>; // dayIndex → erledigt
}

const STORAGE_PREFIX = 'salatibox:journey:';

export function journeyStorageKey(journeyId: string): string {
  return `${STORAGE_PREFIX}${journeyId}`;
}

export function completedDays(progress: JourneyProgress): number {
  return Object.values(progress.completed).filter(Boolean).length;
}

/** Tagesindex (0-basiert, geklemmt auf [0, totalDays-1]) für das heutige Kalenderdatum. */
export function dayIndexForDate(progress: JourneyProgress, totalDays: number, todayKey: string): number {
  // DST-sichere UTC-Kalenderarithmetik — Begründung siehe lib/dateKey.ts.
  // Vorher wurde hier über zwei LOKALE Mitternachts-Dates gerechnet; an
  // Umstellungstagen (z. B. 2026-03-29 in DE) verschob das den Tagesindex
  // dieser Reise um 1 nach unten (khatmah/plan.ts hatte den Fix schon).
  return dayIndexSince(progress.startDay, todayKey, totalDays);
}

/**
 * Positive Zahl = Tage im Rückstand gegenüber dem Plan. Zählt nur VERGANGENE
 * Tage - der heutige, noch laufende Tag ist kein Rückstand (vorher stand
 * direkt nach dem Start "1 Tag im Rückstand", Live-Fund 2026-07-19).
 */
export function daysBehind(progress: JourneyProgress, totalDays: number, todayKey: string): number {
  const expected = dayIndexForDate(progress, totalDays, todayKey);
  return Math.max(0, expected - completedDays(progress));
}

export function isJourneyComplete(progress: JourneyProgress, totalDays: number): boolean {
  return totalDays > 0 && completedDays(progress) === totalDays;
}

/**
 * Eine Reise gilt als "aktiv" (gestartet, aber noch nicht abgeschlossen),
 * sobald ein Fortschritts-Eintrag existiert und sie noch nicht komplett ist -
 * bewusst AUCH direkt nach dem Start mit 0 erledigten Tagen, sonst würde ein
 * gerade gestarteter Plan beim nächsten Besuch des Hubs noch einmal aus der
 * "Aktiv"-Sektion in die Gesamtliste zurückfallen (genau das Live-Feedback,
 * das den Hub-Umbau in journeys/index.tsx ausgelöst hat).
 */
export function isJourneyActive(progress: JourneyProgress | null, totalDays: number): boolean {
  return !!progress && !isJourneyComplete(progress, totalDays);
}

export function toggleDay(progress: JourneyProgress, dayIndex: number): JourneyProgress {
  return { ...progress, completed: { ...progress.completed, [dayIndex]: !progress.completed[dayIndex] } };
}

export function parseJourneyProgress(raw: string | null): JourneyProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JourneyProgress;
    return parsed && typeof parsed.startDay === 'string' && typeof parsed.completed === 'object' && parsed.completed
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Fortschritts-Hook für EINE Reise (journeyId) - lädt/speichert unter ihrem
 * eigenen Storage-Key, unabhängig von anderen Reisen. */
export function useJourneyProgress(journeyId: string) {
  const [progress, setProgress] = useState<JourneyProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const key = journeyStorageKey(journeyId);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(key)
        .then((raw) => {
          if (!cancelled) {
            setProgress(parseJourneyProgress(raw));
            setLoaded(true);
          }
        })
        .catch(() => {
          // Storage-Lesefehler darf den Screen NIE dauerhaft im Blank-/Lade-
          // Zustand stecken lassen (loaded muss in jedem Fall true werden) -
          // sicherer Default: keine gespeicherte Reise gefunden.
          if (!cancelled) {
            setProgress(null);
            setLoaded(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [key]),
  );

  const save = useCallback(
    (next: JourneyProgress | null) => {
      setProgress(next);
      if (next) AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      else AsyncStorage.removeItem(key).catch(() => {});
    },
    [key],
  );

  const start = useCallback(
    (todayKey: string) => save({ journeyId, startDay: todayKey, completed: {} }),
    [save, journeyId],
  );
  const toggle = useCallback(
    (dayIndex: number) => {
      setProgress((prev) => {
        if (!prev) return prev;
        const next = toggleDay(prev, dayIndex);
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [key],
  );
  const reset = useCallback(() => save(null), [save]);

  return { progress, loaded, start, toggle, reset };
}
