import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Tasbih-Zähler: Presets mit Ziel, aktueller Stand + Tagesstatistik persistiert.

export interface DhikrPreset {
  id: string;
  arabic: string;
  translit: string;
  target: number;
}

export const DHIKR_PRESETS: DhikrPreset[] = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', translit: 'SubhanAllah', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', translit: 'Alhamdulillah', target: 33 },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar', target: 34 },
  { id: 'la-ilaha', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ', translit: 'La ilaha illallah', target: 100 },
  { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ', translit: 'Astaghfirullah', target: 100 },
  {
    id: 'salawat',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
    translit: 'Allahumma salli ala Muhammad',
    target: 100,
  },
];

export interface TasbihState {
  /** Tag (YYYY-MM-DD), auf den sich die Zählungen beziehen */
  day: string;
  /** aktueller Zähler je Preset */
  counts: Record<string, number>;
  /** Gesamt heute (inkl. abgeschlossener Runden) */
  todayTotal: number;
}

export const TASBIH_STORAGE_KEY = 'salatibox:tasbih';

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const EMPTY = (day: string): TasbihState => ({ day, counts: {}, todayTotal: 0 });

/** Neuer Tag ⇒ Zähler und Tagesstatistik zurücksetzen. */
export function parseTasbihState(raw: string | null, day: string): TasbihState {
  if (!raw) return EMPTY(day);
  try {
    const parsed = JSON.parse(raw) as Partial<TasbihState>;
    if (parsed.day !== day) return EMPTY(day);
    return {
      day,
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
      todayTotal: typeof parsed.todayTotal === 'number' ? parsed.todayTotal : 0,
    };
  } catch {
    return EMPTY(day);
  }
}

/** Zählt +1; beim Erreichen des Ziels startet die nächste Runde bei 0. */
export function increment(state: TasbihState, preset: DhikrPreset): TasbihState {
  const current = state.counts[preset.id] ?? 0;
  const next = current + 1 >= preset.target ? 0 : current + 1;
  return {
    ...state,
    counts: { ...state.counts, [preset.id]: next },
    todayTotal: state.todayTotal + 1,
  };
}

export function resetCount(state: TasbihState, presetId: string): TasbihState {
  return { ...state, counts: { ...state.counts, [presetId]: 0 } };
}

export function useTasbih() {
  const [state, setState] = useState<TasbihState>(() => EMPTY(todayKey()));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(TASBIH_STORAGE_KEY).then((raw) => {
        if (!cancelled) setState(parseTasbihState(raw, todayKey()));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const apply = useCallback((updater: (prev: TasbihState) => TasbihState) => {
    setState((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(TASBIH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return {
    state,
    count: (preset: DhikrPreset) => apply((prev) => increment(prev, preset)),
    reset: (presetId: string) => apply((prev) => resetCount(prev, presetId)),
  };
}
