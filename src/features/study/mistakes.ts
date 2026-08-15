import AsyncStorage from '@react-native-async-storage/async-storage';

// Fehler-Tracking: Jede falsch beantwortete Frage erhöht den Zähler der
// zugehörigen Lektion. Daraus speist sich "Schwächen üben" — die App schlägt
// gezielt das vor, was zuletzt falsch beantwortet wurde. Eine Schwächen-
// Session halbiert die Zähler der geübten Lektionen (Abklingen statt ewig).

export const MISTAKES_STORAGE_KEY = 'salatibox:mistakes';

export interface MistakeEntry {
  count: number;
  last: number;
}

export type MistakeState = Record<string, MistakeEntry>; // Key: `${courseId}:${lessonId}`

export function mistakeKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

export function addMistake(state: MistakeState, key: string, now: number = Date.now()): MistakeState {
  const prev = state[key];
  return { ...state, [key]: { count: (prev?.count ?? 0) + 1, last: now } };
}

/** Schwächste Lektionen zuerst: nach Zähler, bei Gleichstand nach Aktualität. */
export function weakestKeys(state: MistakeState, limit: number): string[] {
  return Object.entries(state)
    .filter(([, e]) => e.count > 0)
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([key]) => key);
}

/** Nach einer Schwächen-Session: Zähler der geübten Lektionen halbieren. */
export function decayMistakes(state: MistakeState, keys: string[]): MistakeState {
  const next = { ...state };
  for (const key of keys) {
    const prev = next[key];
    if (!prev) continue;
    const count = Math.floor(prev.count / 2);
    if (count <= 0) delete next[key];
    else next[key] = { ...prev, count };
  }
  return next;
}

export function parseMistakeState(raw: string | null): MistakeState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as MistakeState) : {};
  } catch {
    return {};
  }
}

export async function loadMistakeState(): Promise<MistakeState> {
  return parseMistakeState(await AsyncStorage.getItem(MISTAKES_STORAGE_KEY));
}

export async function saveMistakeState(state: MistakeState): Promise<void> {
  await AsyncStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

/** Bequemer Fire-and-forget-Recorder für die Antwort-Handler. */
export async function recordMistake(courseId: string, lessonId: string): Promise<void> {
  const state = await loadMistakeState();
  await saveMistakeState(addMistake(state, mistakeKey(courseId, lessonId)));
}
