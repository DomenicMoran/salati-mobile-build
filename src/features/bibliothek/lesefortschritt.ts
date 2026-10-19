export type Lesefortschritt = { surah: number; block: number };

export const LESEFORTSCHRITT_STORAGE_KEY = 'salati.bibliothek.rassoul.v1';

export function parseLesefortschritt(raw: string | null): Lesefortschritt | null {
  if (raw == null || raw.trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { surah, block } = parsed as Record<string, unknown>;
    if (typeof surah !== 'number' || typeof block !== 'number') return null;
    if (!Number.isInteger(surah) || !Number.isInteger(block)) return null;
    if (surah < 1 || surah > 114) return null;
    if (block < 0) return null;
    return { surah, block };
  } catch {
    return null;
  }
}

export function serializeLesefortschritt(value: Lesefortschritt): string {
  return JSON.stringify(value);
}
