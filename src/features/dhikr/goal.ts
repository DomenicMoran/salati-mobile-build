import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { todayKey } from './counter';

// Tages-Ziel für den Tasbih-Zähler (Gesamt-Dhikr ÜBER ALLE Presets hinweg,
// unabhängig vom einzelnen Preset-Ziel wie 33/34/100) + einfacher 7-Tage-
// Verlauf. Gleiches Tages-basiertes Persistenz-Muster wie der Gebets-Tracker
// (features/tracker/store.ts: Tag-Key → Wert, lastDays() liest die letzten
// n Tage rückwärts). Bewusst zwei separate AsyncStorage-Keys statt alles in
// counter.ts' TasbihState zu packen: das Ziel ist eine Nutzer-Einstellung
// (überlebt Tageswechsel unverändert), der Verlauf braucht mehrere Tage
// gleichzeitig — beides würde EMPTY(day) in counter.ts beim Tageswechsel
// mit wegwischen.

export const TASBIH_GOAL_STORAGE_KEY = 'salatibox:tasbih-goal';
export const TASBIH_HISTORY_STORAGE_KEY = 'salatibox:tasbih-history';

/** Klassische Post-Gebet-Dhikr-Zahlen: 33+33+34 = 100. */
export const DAILY_GOAL_OPTIONS = [33, 99, 100] as const;
export const DEFAULT_DAILY_GOAL = 100;

export type TasbihHistory = Record<string, number>;

export function parseGoal(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_DAILY_GOAL;
}

/** Eigene Ziel-Eingabe absichern: ganze Zahl 1-9999, Unlesbares fällt auf den Standard zurück. */
export function sanitizeGoal(input: string): number {
  const n = Number.parseInt(input.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DAILY_GOAL;
  return Math.min(n, 9999);
}

export function parseHistory(raw: string | null): TasbihHistory {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as TasbihHistory) : {};
  } catch {
    return {};
  }
}

/** Schreibt/aktualisiert den Gesamtstand eines Tages. Gibt dieselbe Referenz
 * zurück, wenn sich nichts ändert (vermeidet unnötige Re-Renders/Writes). */
export function recordHistory(history: TasbihHistory, day: string, total: number): TasbihHistory {
  if (history[day] === total) return history;
  return { ...history, [day]: total };
}

/** Letzte n Tage (älteste zuerst) mit Gesamt-Dhikr — analog zu tracker/store.ts#lastDays. */
export function lastTasbihDays(history: TasbihHistory, today: Date, n: number): { day: string; total: number }[] {
  const result: { day: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    result.push({ day: key, total: history[key] ?? 0 });
  }
  return result;
}

/** true, wenn der neue Gesamtstand das Ziel gerade JETZT erreicht/überschreitet
 * (vorher nicht) — für den einmaligen Erfolgs-Impuls (Haptics) statt bei
 * jedem weiteren Tap über dem Ziel erneut zu feuern. */
export function crossesGoal(previousTotal: number, nextTotal: number, goal: number): boolean {
  return previousTotal < goal && nextTotal >= goal;
}

export function useTasbihGoal() {
  const [goal, setGoalState] = useState<number>(DEFAULT_DAILY_GOAL);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(TASBIH_GOAL_STORAGE_KEY).then((raw) => {
        if (!cancelled) setGoalState(parseGoal(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const setGoal = useCallback((next: number) => {
    setGoalState(next);
    AsyncStorage.setItem(TASBIH_GOAL_STORAGE_KEY, String(next)).catch(() => {});
  }, []);

  return { goal, setGoal };
}

/**
 * Lädt den Verlauf bei Fokus und schreibt bei jeder Änderung von
 * `todayTotal` (aus counter.ts' useTasbih()) den heutigen Stand fort.
 * Liefert zusätzlich die letzten `days` Tage (Default 7) für die
 * Verlaufs-Anzeige.
 */
export function useTasbihHistory(todayTotal: number, days = 7) {
  const [history, setHistory] = useState<TasbihHistory>({});
  // useTasbih() liefert beim Mount erst EMPTY(day) (todayTotal=0), bis der
  // eigene AsyncStorage-Load fertig ist — ohne diese Sperre würde der erste
  // Effekt-Durchlauf fälschlich eine 0 für heute wegschreiben und einen
  // evtl. schon vorhandenen echten Tageswert kurzzeitig überschreiben.
  // Erst ab dem ZWEITEN Durchlauf (also bei einer echten Änderung) wird
  // geschrieben.
  const skippedFirstRun = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(TASBIH_HISTORY_STORAGE_KEY).then((raw) => {
        if (!cancelled) setHistory(parseHistory(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    if (!skippedFirstRun.current) {
      skippedFirstRun.current = true;
      return;
    }
    const today = todayKey();
    setHistory((prev) => {
      const next = recordHistory(prev, today, todayTotal);
      if (next !== prev) AsyncStorage.setItem(TASBIH_HISTORY_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [todayTotal]);

  return { history, days: lastTasbihDays(history, new Date(), days) };
}
