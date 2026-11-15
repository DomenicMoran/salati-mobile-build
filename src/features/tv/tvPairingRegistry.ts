/** Bekannte Salati-TVs (nur lokal) — Mehrfach-Kopplung Status vom Handy. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PairTarget } from './pairing-client';

export type RegisteredTv = PairTarget & {
  name: string;
  role?: string;
  lastSeenAt: number;
  status: 'connected' | 'idle' | 'error';
};

const KEY = 'salatibox:tv-registry';

export async function loadTvRegistry(): Promise<RegisteredTv[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RegisteredTv[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export async function upsertTvRegistry(entry: RegisteredTv): Promise<RegisteredTv[]> {
  const list = await loadTvRegistry();
  const id = `${entry.host}:${entry.port}`;
  const next = [{ ...entry, lastSeenAt: Date.now() }, ...list.filter((t) => `${t.host}:${t.port}` !== id)].slice(0, 8);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function markTvStatus(host: string, port: number, status: RegisteredTv['status'], name?: string): Promise<void> {
  const list = await loadTvRegistry();
  const id = `${host}:${port}`;
  const hit = list.find((t) => `${t.host}:${t.port}` === id);
  const base: RegisteredTv = hit ?? { host, port, token: '', name: name ?? host, lastSeenAt: Date.now(), status };
  await upsertTvRegistry({ ...base, name: name ?? base.name, status, lastSeenAt: Date.now() });
}