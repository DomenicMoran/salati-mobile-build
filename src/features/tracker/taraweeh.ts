// Taraweeh-Tracker: pro Ramadan-Nacht (YYYY-MM-DD) die Anzahl verrichteter
// Rakaat. Bewusst eine freie Zahl statt fester Auswahl (8/12/20 sind
// verbreitete Varianten, aber kein Zwang je nach Moschee/Madhab) - ähnliches
// Muster wie der Qada-Zähler (tracker/qada.ts): reiner manueller Zähler,
// +/- Stepper in 2er-Schritten (übliche Taraweeh-Einheit ist ein Rakaat-Paar).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type TaraweehData = Record<string, number>;

export const TARAWEEH_STORAGE_KEY = 'salatibox:taraweeh';

/** Übliche Schrittweite beim +/- (Taraweeh wird paarweise, 2 Rakaat, gebetet). */
export const TARAWEEH_STEP = 2;

export function parseTaraweehData(raw: string | null): TaraweehData {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const dict = parsed as Record<string, unknown>;
    const next: TaraweehData = {};
    for (const [day, value] of Object.entries(dict)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) next[day] = Math.floor(n);
    }
    return next;
  } catch {
    return {};
  }
}

/** Setzt die Rakaat-Zahl einer Nacht direkt (freies Eingabefeld), min. 0. */
export function setTaraweehRakaat(data: TaraweehData, day: string, count: number): TaraweehData {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safe === 0) {
    const next = { ...data };
    delete next[day];
    return next;
  }
  return { ...data, [day]: safe };
}

/** +/- Stepper (Default 2er-Schritte), clamped auf min. 0. */
export function changeTaraweehRakaat(data: TaraweehData, day: string, delta: number): TaraweehData {
  const current = data[day] ?? 0;
  return setTaraweehRakaat(data, day, current + delta);
}

/** Summe aller je Ramadan gebeteten Taraweeh-Rakaat (für Statistik/Motivation). */
export function taraweehTotal(data: TaraweehData): number {
  return Object.values(data).reduce((sum, n) => sum + n, 0);
}

/** Anzahl Nächte mit mindestens 1 Rakaat eingetragen. */
export function taraweehNightsCount(data: TaraweehData): number {
  return Object.values(data).filter((n) => n > 0).length;
}

export function useTaraweehTracker() {
  const [data, setData] = useState<TaraweehData>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(TARAWEEH_STORAGE_KEY).then((raw) => {
        if (!cancelled) setData(parseTaraweehData(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const change = useCallback((day: string, delta: number) => {
    setData((prev) => {
      const next = changeTaraweehRakaat(prev, day, delta);
      AsyncStorage.setItem(TARAWEEH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setCount = useCallback((day: string, count: number) => {
    setData((prev) => {
      const next = setTaraweehRakaat(prev, day, count);
      AsyncStorage.setItem(TARAWEEH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { data, change, setCount };
}
