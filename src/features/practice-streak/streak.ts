import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Übungs-Streak: An welchen Kalendertagen (lokale Zeit) wurde mindestens ein
// Quiz-Lauf beendet? Die Practice-Stats speichern nur den LETZTEN Lauf je Modus
// (lastPlayedAt) — deshalb pflegen wir hier eine eigene Tages-Liste und nutzen
// die lastPlayedAt-Werte nur als Untergrenze (Erst-Migration). Eigener Ordner,
// da an practice/* parallel gearbeitet wird.

export const PRACTICE_DAYS_STORAGE_KEY = 'salatibox:practice-days';
const PLAYS_TOTAL_STORAGE_KEY = 'salatibox:practice-days-plays-total';
/** Muss zu PRACTICE_STATS_STORAGE_KEY in features/practice/stats passen. */
const PRACTICE_STATS_KEY = 'salatibox:practice-stats';

export const MAX_PRACTICE_DAYS = 400;

/** Minimalform der Practice-Stats — nur die hier benötigten Felder. */
export interface StatsLikeEntry {
  plays?: number;
  lastPlayedAt?: number;
}

export type StatsLike = Record<string, StatsLikeEntry | undefined>;

/** Lokales Kalenderdatum als 'YYYY-MM-DD'. */
export function toDayString(input: number | Date): string {
  const d = typeof input === 'number' ? new Date(input) : input;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Der Kalendertag vor `day` (lokale Zeit, DST-sicher über setDate). */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() - 1);
  return toDayString(date);
}

/**
 * Anzahl aufeinanderfolgender Übungstage bis heute. Fehlt der heutige Tag,
 * darf die Kette auch gestern enden (die Serie reißt erst mit Tagesende).
 */
export function computeStreak(days: string[], today: string): number {
  const set = new Set(days);
  let cursor = today;
  if (!set.has(cursor)) {
    cursor = previousDay(today);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

export interface StreakWithJokerResult {
  streak: number;
  jokersUsed: number;
}

/**
 * Wie computeStreak, aber mit Streak-Schutz: 1 Joker pro 7 tatsächlich
 * geübten Tagen ("1 Joker/Woche", User-Wunsch) überbrückt genau einen
 * fehlenden Tag, ohne die Serie zu reißen. Der erste Joker steht sofort
 * zur Verfügung (nicht erst nach der ersten vollen Woche) — sonst wäre der
 * Schutz in der ersten Woche wirkungslos, gerade wenn er am nötigsten ist.
 */
export function computeStreakWithJoker(
  days: string[],
  today: string,
  jokersPerWeek = 1,
): StreakWithJokerResult {
  const set = new Set(days);
  let cursor = today;
  if (!set.has(cursor)) {
    cursor = previousDay(cursor);
    if (!set.has(cursor)) return { streak: 0, jokersUsed: 0 };
  }
  let streak = 0;
  let jokersUsed = 0;
  let realDaysSinceRefill = 0;
  let jokerBudget = jokersPerWeek;
  for (;;) {
    if (set.has(cursor)) {
      streak += 1;
      realDaysSinceRefill += 1;
      if (realDaysSinceRefill >= 7) {
        realDaysSinceRefill = 0;
        jokerBudget = Math.min(jokerBudget + 1, jokersPerWeek);
      }
    } else if (jokerBudget > 0) {
      jokerBudget -= 1;
      jokersUsed += 1;
      streak += 1;
    } else {
      break;
    }
    cursor = previousDay(cursor);
  }
  return { streak, jokersUsed };
}

export function parsePracticeDays(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

export interface UpdateDaysResult {
  days: string[];
  playsTotal: number;
  changed: boolean;
}

/**
 * Tages-Liste fortschreiben: lastPlayedAt-Tage als Untergrenze einmischen und
 * den heutigen Tag eintragen, wenn seit dem letzten Fokus die Gesamtzahl der
 * plays gestiegen ist. Sortiert aufsteigend, gedeckelt auf die neuesten
 * MAX_PRACTICE_DAYS Einträge.
 */
export function updatePracticeDays(
  days: string[],
  stats: StatsLike,
  storedPlaysTotal: number | null,
  now: number = Date.now(),
): UpdateDaysResult {
  const set = new Set(days);
  let playsTotal = 0;
  for (const entry of Object.values(stats)) {
    if (!entry) continue;
    playsTotal += entry.plays ?? 0;
    if (typeof entry.lastPlayedAt === 'number' && entry.lastPlayedAt > 0) {
      set.add(toDayString(entry.lastPlayedAt));
    }
  }
  if (storedPlaysTotal !== null && playsTotal > storedPlaysTotal) {
    set.add(toDayString(now));
  }
  const next = [...set].sort().slice(-MAX_PRACTICE_DAYS);
  const changed =
    playsTotal !== storedPlaysTotal || next.length !== days.length || next.some((d, i) => d !== days[i]);
  return { days: next, playsTotal, changed };
}

/** Liest Stats + Tages-Liste, schreibt Änderungen zurück, liefert die Tage. */
export async function refreshPracticeDays(now: number = Date.now()): Promise<string[]> {
  const [rawDays, rawTotal, rawStats] = await Promise.all([
    AsyncStorage.getItem(PRACTICE_DAYS_STORAGE_KEY),
    AsyncStorage.getItem(PLAYS_TOTAL_STORAGE_KEY),
    AsyncStorage.getItem(PRACTICE_STATS_KEY),
  ]);
  const days = parsePracticeDays(rawDays);
  const storedTotal = rawTotal !== null && Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : null;
  let stats: StatsLike = {};
  try {
    const parsed = rawStats ? JSON.parse(rawStats) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stats = parsed as StatsLike;
  } catch {
    // kaputte Stats ignorieren — Streak bleibt dann bei der bisherigen Liste
  }
  const result = updatePracticeDays(days, stats, storedTotal, now);
  if (result.changed) {
    await Promise.all([
      AsyncStorage.setItem(PRACTICE_DAYS_STORAGE_KEY, JSON.stringify(result.days)).catch(() => {}),
      AsyncStorage.setItem(PLAYS_TOTAL_STORAGE_KEY, String(result.playsTotal)).catch(() => {}),
    ]);
  }
  return result.days;
}

/**
 * Aktueller Übungs-Streak in Tagen (mit Streak-Schutz, s. computeStreakWithJoker)
 * + ob dafür gerade ein Joker verbraucht wurde (für ein optionales Schutzschild-
 * Icon in der UI). Aktualisiert sich bei jedem Fokus.
 */
export function usePracticeStreak(): { streak: number; jokerActive: boolean } {
  const [state, setState] = useState({ streak: 0, jokerActive: false });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      refreshPracticeDays(now).then((days) => {
        if (cancelled) return;
        const result = computeStreakWithJoker(days, toDayString(now));
        setState({ streak: result.streak, jokerActive: result.jokersUsed > 0 });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return state;
}
