import AsyncStorage from '@react-native-async-storage/async-storage';

export const HABIT_STORAGE_KEY = 'salatibox:expansion-habits';

export type HabitId = 'dhikr' | 'quranPages' | 'charity' | 'custom';

export type HabitEntry = {
  id: HabitId;
  label: string;
  /** ISO date keys YYYY-MM-DD */
  doneOn: string[];
};

export const PRESET_HABITS: HabitEntry[] = [
  { id: 'dhikr', label: 'Dhikr', doneOn: [] },
  { id: 'quranPages', label: 'Quran reading', doneOn: [] },
  { id: 'charity', label: 'Sadaqah', doneOn: [] },
];

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function parseHabits(raw: string | null): HabitEntry[] {
  if (!raw) return PRESET_HABITS.map((h) => ({ ...h, doneOn: [] }));
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PRESET_HABITS.map((h) => ({ ...h, doneOn: [] }));
    return parsed
      .filter((x) => x && typeof x === 'object' && typeof (x as HabitEntry).id === 'string')
      .map((x) => {
        const e = x as HabitEntry;
        return {
          id: e.id,
          label: typeof e.label === 'string' ? e.label : e.id,
          doneOn: Array.isArray(e.doneOn) ? e.doneOn.filter((d) => typeof d === 'string') : [],
        };
      });
  } catch {
    return PRESET_HABITS.map((h) => ({ ...h, doneOn: [] }));
  }
}

export async function loadHabits(): Promise<HabitEntry[]> {
  return parseHabits(await AsyncStorage.getItem(HABIT_STORAGE_KEY));
}

export async function saveHabits(entries: HabitEntry[]): Promise<void> {
  await AsyncStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(entries));
}

export function toggleHabitDay(entries: HabitEntry[], id: HabitId, day = todayKey()): HabitEntry[] {
  return entries.map((e) => {
    if (e.id !== id) return e;
    const has = e.doneOn.includes(day);
    const doneOn = has ? e.doneOn.filter((d) => d !== day) : [...e.doneOn, day];
    return { ...e, doneOn };
  });
}

export function streakDays(doneOn: string[], from = todayKey()): number {
  const set = new Set(doneOn);
  let streak = 0;
  const d = new Date(from);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
