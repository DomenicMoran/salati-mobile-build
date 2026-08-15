import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { PracticeModeId } from './modes';

// Bestwerte pro Übungs-Modus, lokal persistiert (analog learn/progress).

export interface ModeStats {
  bestScore: number;
  bestTotal: number;
  plays: number;
  lastPlayedAt: number;
}

/** Quiz-Modi + eigenständige Spielarten (Satz-Puzzle, Matching, Duell zählt nicht). */
export type StatsModeId = PracticeModeId | 'puzzle' | 'matching' | 'listening';

export type PracticeStats = Partial<Record<StatsModeId, ModeStats>>;

export const PRACTICE_STATS_STORAGE_KEY = 'salatibox:practice-stats';

export function parsePracticeStats(raw: string | null): PracticeStats {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as PracticeStats) : {};
  } catch {
    return {};
  }
}

/** Bestwert nur überschreiben, wenn die neue Quote besser ist; plays zählt immer. */
export function recordRun(
  stats: PracticeStats,
  mode: StatsModeId,
  score: number,
  total: number,
  now: number = Date.now(),
): PracticeStats {
  const prev = stats[mode];
  const better =
    !prev || prev.bestTotal === 0 || (total > 0 && score / total > prev.bestScore / prev.bestTotal);
  return {
    ...stats,
    [mode]: {
      bestScore: better ? score : (prev?.bestScore ?? 0),
      bestTotal: better ? total : (prev?.bestTotal ?? 0),
      plays: (prev?.plays ?? 0) + 1,
      lastPlayedAt: now,
    },
  };
}

export async function loadPracticeStats(): Promise<PracticeStats> {
  return parsePracticeStats(await AsyncStorage.getItem(PRACTICE_STATS_STORAGE_KEY));
}

async function savePracticeStats(stats: PracticeStats): Promise<void> {
  await AsyncStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(stats)).catch(() => {});
}

export function usePracticeStats() {
  const [stats, setStats] = useState<PracticeStats>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadPracticeStats().then((s) => {
        if (!cancelled) setStats(s);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const record = useCallback((mode: StatsModeId, score: number, total: number) => {
    setStats((prev) => {
      const next = recordRun(prev, mode, score, total);
      savePracticeStats(next);
      return next;
    });
  }, []);

  return { stats, record };
}
