import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Fortschritt der Analyse-Übung: pro geübtem Vers Zähler + letzte/beste
// Trefferquote — gleiches Muster wie features/study/mistakes.ts (reine
// Reducer-Funktionen + async load/save-Wrapper, Record<string, Eintrag> statt
// Array) und wie features/quran/progress.ts (useFocusEffect-Hook: Screens
// laden bei Fokus neu statt über einen geteilten Provider).

export const ANALYSE_UEBUNG_STORAGE_KEY = 'salatibox:analyse-uebung';

export interface AnalyseUebungEintrag {
  /** Trefferquote (0..1) des letzten Durchlaufs. */
  letzteTrefferquote: number;
  /** Höchste je erzielte Trefferquote (0..1). */
  besteTrefferquote: number;
  /** Höchste bisher geübte Stufe für diesen Vers. */
  hoechsteStufe: 1 | 2 | 3;
  durchlaeufe: number;
  zuletzt: number;
}

export type AnalyseUebungState = Record<string, AnalyseUebungEintrag>; // Key: `${surah}:${ayah}`

export function verseKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

export function recordErgebnis(
  state: AnalyseUebungState,
  surah: number,
  ayah: number,
  stufe: 1 | 2 | 3,
  trefferquote: number,
  now: number = Date.now(),
): AnalyseUebungState {
  const key = verseKey(surah, ayah);
  const prev = state[key];
  return {
    ...state,
    [key]: {
      letzteTrefferquote: trefferquote,
      besteTrefferquote: Math.max(prev?.besteTrefferquote ?? 0, trefferquote),
      hoechsteStufe: Math.max(prev?.hoechsteStufe ?? 0, stufe) as 1 | 2 | 3,
      durchlaeufe: (prev?.durchlaeufe ?? 0) + 1,
      zuletzt: now,
    },
  };
}

export interface LetzterVersEintrag {
  surah: number;
  ayah: number;
  eintrag: AnalyseUebungEintrag;
}

/** Zuletzt geübte Verse, neueste zuerst, gedeckelt auf `limit`. */
export function letzteVerse(state: AnalyseUebungState, limit: number): LetzterVersEintrag[] {
  return Object.entries(state)
    .map(([key, eintrag]) => {
      const [surah, ayah] = key.split(':').map(Number);
      return { surah, ayah, eintrag };
    })
    .sort((a, b) => b.eintrag.zuletzt - a.eintrag.zuletzt)
    .slice(0, limit);
}

export function parseAnalyseUebungState(raw: string | null): AnalyseUebungState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AnalyseUebungState) : {};
  } catch {
    return {};
  }
}

export async function loadAnalyseUebungState(): Promise<AnalyseUebungState> {
  return parseAnalyseUebungState(await AsyncStorage.getItem(ANALYSE_UEBUNG_STORAGE_KEY));
}

export async function saveAnalyseUebungState(state: AnalyseUebungState): Promise<void> {
  await AsyncStorage.setItem(ANALYSE_UEBUNG_STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export function useAnalyseUebungFortschritt() {
  const [state, setState] = useState<AnalyseUebungState>({});
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAnalyseUebungState().then((s) => {
        if (!cancelled) {
          setState(s);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const record = useCallback((surah: number, ayah: number, stufe: 1 | 2 | 3, quote: number) => {
    setState((prev) => {
      const next = recordErgebnis(prev, surah, ayah, stufe, quote);
      saveAnalyseUebungState(next);
      return next;
    });
  }, []);

  return { state, loaded, record };
}
