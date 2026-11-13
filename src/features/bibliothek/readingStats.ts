import AsyncStorage from '@react-native-async-storage/async-storage';

import { toDayString, previousDay, computeStreak } from '@/features/practice-streak/streak';

export const BIBLIOTHEK_READING_STATS_KEY = 'salati.bibliothek.reading-stats.v1';

export type BibliothekReadingDay = {
  day: string;
  pages: number;
  seconds: number;
};

export type BibliothekReadingStats = {
  schema: 1;
  /** Kalendertage mit Lesezeit (lokale TZ). */
  days: BibliothekReadingDay[];
  totalPages: number;
  totalSeconds: number;
  updatedAt: string;
};

const EMPTY: BibliothekReadingStats = {
  schema: 1,
  days: [],
  totalPages: 0,
  totalSeconds: 0,
  updatedAt: new Date(0).toISOString(),
};

function isDayRow(raw: unknown): raw is BibliothekReadingDay {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.day === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.day) &&
    typeof o.pages === 'number' &&
    typeof o.seconds === 'number' &&
    o.pages >= 0 &&
    o.seconds >= 0
  );
}

export function parseBibliothekReadingStats(raw: string | null): BibliothekReadingStats {
  if (raw == null || raw.trim() === '') return { ...EMPTY };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    const o = parsed as Record<string, unknown>;
    const days = Array.isArray(o.days) ? o.days.filter(isDayRow) : [];
    const totalPages = typeof o.totalPages === 'number' && o.totalPages >= 0 ? Math.floor(o.totalPages) : 0;
    const totalSeconds = typeof o.totalSeconds === 'number' && o.totalSeconds >= 0 ? Math.floor(o.totalSeconds) : 0;
    const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString();
    return { schema: 1, days, totalPages, totalSeconds, updatedAt };
  } catch {
    return { ...EMPTY };
  }
}

export function serializeBibliothekReadingStats(stats: BibliothekReadingStats): string {
  return JSON.stringify(stats);
}

export type ReadingSessionTick = {
  day: string;
  pagesRead: number;
  secondsSpent: number;
};

/** Reine Funktion fuer Jest — haengt Lesezeit eines Intervalls an. */
export function applyBibliothekReadingSession(
  stats: BibliothekReadingStats,
  tick: ReadingSessionTick,
  nowIso = new Date().toISOString(),
): BibliothekReadingStats {
  const pagesRead = Math.max(0, Math.floor(tick.pagesRead));
  const secondsSpent = Math.max(0, Math.floor(tick.secondsSpent));
  if (pagesRead === 0 && secondsSpent === 0) return stats;
  const day = tick.day;
  const days = [...stats.days];
  const idx = days.findIndex((d) => d.day === day);
  if (idx >= 0) {
    const row = days[idx];
    days[idx] = {
      day,
      pages: row.pages + pagesRead,
      seconds: row.seconds + secondsSpent,
    };
  } else {
    days.push({ day, pages: pagesRead, seconds: secondsSpent });
  }
  days.sort((a, b) => a.day.localeCompare(b.day));
  return {
    schema: 1,
    days,
    totalPages: stats.totalPages + pagesRead,
    totalSeconds: stats.totalSeconds + secondsSpent,
    updatedAt: nowIso,
  };
}

export function bibliothekReadingStreak(stats: BibliothekReadingStats, today = toDayString(Date.now())): number {
  return computeStreak(
    stats.days.filter((d) => d.seconds > 0 || d.pages > 0).map((d) => d.day),
    today,
  );
}

export function bibliothekPagesToday(stats: BibliothekReadingStats, today = toDayString(Date.now())): number {
  return stats.days.find((d) => d.day === today)?.pages ?? 0;
}

export async function loadBibliothekReadingStats(): Promise<BibliothekReadingStats> {
  const raw = await AsyncStorage.getItem(BIBLIOTHEK_READING_STATS_KEY).catch(() => null);
  return parseBibliothekReadingStats(raw);
}

export async function saveBibliothekReadingStats(stats: BibliothekReadingStats): Promise<void> {
  await AsyncStorage.setItem(BIBLIOTHEK_READING_STATS_KEY, serializeBibliothekReadingStats(stats)).catch(() => {});
}

export async function recordBibliothekReadingSession(tick: ReadingSessionTick): Promise<BibliothekReadingStats> {
  const current = await loadBibliothekReadingStats();
  const next = applyBibliothekReadingSession(current, tick);
  await saveBibliothekReadingStats(next);
  return next;
}

/** Fuer Tests: letzter Tag mit Aktivitaet. */
export function lastActiveBibliothekDay(stats: BibliothekReadingStats): string | null {
  if (stats.days.length === 0) return null;
  return stats.days[stats.days.length - 1].day;
}

export { previousDay, toDayString };
