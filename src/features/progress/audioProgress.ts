import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AUDIO_MIN_POSITION_SEC,
  AUDIO_NEAR_END_RATIO,
  type AudioProgressEntry,
  type AudioProgressMap,
} from './types';
import { AUDIO_PROGRESS_STORAGE_KEY } from './keys';

function isAudioMap(value: unknown): value is AudioProgressMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntry(value: unknown): AudioProgressEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const kind = o.kind;
  const id = o.id;
  const positionSec = o.positionSec;
  const durationSec = o.durationSec;
  const updatedAt = o.updatedAt;
  if (
    (kind !== 'podcast' && kind !== 'audiobook' && kind !== 'quran-listen') ||
    typeof id !== 'string' ||
    typeof positionSec !== 'number' ||
    typeof durationSec !== 'number' ||
    typeof updatedAt !== 'number'
  ) {
    return null;
  }
  const meta = o.meta;
  const completedAt = o.completedAt;
  return {
    kind,
    id,
    positionSec,
    durationSec,
    updatedAt,
    completedAt: typeof completedAt === 'number' ? completedAt : undefined,
    meta:
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as AudioProgressEntry['meta'])
        : undefined,
  };
}

export function parseAudioProgressMap(raw: string | null): AudioProgressMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isAudioMap(parsed)) return {};
    const out: AudioProgressMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const entry = parseEntry(v);
      if (entry) out[k] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

async function readMap(): Promise<AudioProgressMap> {
  return parseAudioProgressMap(await AsyncStorage.getItem(AUDIO_PROGRESS_STORAGE_KEY).catch(() => null));
}

async function writeMap(map: AudioProgressMap): Promise<void> {
  await AsyncStorage.setItem(AUDIO_PROGRESS_STORAGE_KEY, JSON.stringify(map)).catch(() => {});
}

let memoryMap: AudioProgressMap | null = null;
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 5000;

async function ensureHydrated(): Promise<AudioProgressMap> {
  if (hydrated && memoryMap) return memoryMap;
  memoryMap = await readMap();
  hydrated = true;
  return memoryMap;
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAudioProgressNow();
  }, FLUSH_MS);
}

export async function flushAudioProgressNow(): Promise<void> {
  if (!hydrated || !memoryMap) return;
  await writeMap(memoryMap);
}

export async function loadAudioProgressEntry(id: string): Promise<AudioProgressEntry | null> {
  const map = await ensureHydrated();
  return map[id] ?? null;
}

export async function loadAllAudioProgress(): Promise<AudioProgressMap> {
  return { ...(await ensureHydrated()) };
}

export type SaveAudioProgressInput = Omit<AudioProgressEntry, 'updatedAt'> & { updatedAt?: number };

/**
 * Speichert Hörposition (debounced). Nahe am Ende oder unter Mindest-Schwelle:
 * Position 0, optional completedAt.
 */
export async function saveAudioProgress(input: SaveAudioProgressInput): Promise<void> {
  const map = await ensureHydrated();
  const now = input.updatedAt ?? Date.now();
  const duration = input.durationSec;
  const position = input.positionSec;
  const done = duration > 0 && position / duration >= AUDIO_NEAR_END_RATIO;
  const key = input.id;

  if (done) {
    map[key] = {
      ...input,
      positionSec: 0,
      updatedAt: now,
      completedAt: map[key]?.completedAt ?? now,
    };
    scheduleFlush();
    return;
  }

  if (!Number.isFinite(position) || position < AUDIO_MIN_POSITION_SEC) {
    const prev = map[key];
    if (prev?.completedAt) {
      map[key] = { ...input, positionSec: 0, updatedAt: now, completedAt: prev.completedAt };
      scheduleFlush();
    }
    return;
  }

  map[key] = { ...input, updatedAt: now, completedAt: map[key]?.completedAt };
  scheduleFlush();
}

/** Podcast-Folge */
export function podcastProgressId(episodeNo: number): string {
  return `podcast:${episodeNo}`;
}

export function audiobookProgressId(track: string, chapterNo: number, lang: string): string {
  return `audiobook:${track}:${chapterNo}:${lang}`;
}

export function quranListenProgressId(surah: number, reciter: string): string {
  return `quran-listen:${surah}:${reciter}`;
}

export function mergeAudioProgressMaps(
  local: AudioProgressMap,
  imported: AudioProgressMap,
): AudioProgressMap {
  const merged: AudioProgressMap = { ...local };
  for (const [id, entry] of Object.entries(imported)) {
    const prev = merged[id];
    if (!prev || entry.updatedAt >= prev.updatedAt) merged[id] = entry;
  }
  return merged;
}
