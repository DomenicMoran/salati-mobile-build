import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Eigene Dhikr-Einträge (Text + Ziel-Anzahl) für den Tasbih-Screen,
// persistiert wie der Zähler selbst (AsyncStorage, Laden bei Fokus).

export interface CustomDhikr {
  id: string;
  text: string;
  target: number;
}

export const CUSTOM_DHIKR_STORAGE_KEY = 'salatibox:tasbih:custom';

export function parseCustomDhikr(raw: string | null): CustomDhikr[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is CustomDhikr =>
        !!d &&
        typeof d === 'object' &&
        typeof (d as CustomDhikr).id === 'string' &&
        typeof (d as CustomDhikr).text === 'string' &&
        (d as CustomDhikr).text.trim() !== '' &&
        typeof (d as CustomDhikr).target === 'number' &&
        Number.isFinite((d as CustomDhikr).target) &&
        (d as CustomDhikr).target >= 1,
    );
  } catch {
    return [];
  }
}

/** Ziel-Eingabe absichern: ganze Zahl 1-9999, Unlesbares fällt auf 33 zurück. */
export function sanitizeTarget(input: string): number {
  const n = Number.parseInt(input.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 33;
  return Math.min(n, 9999);
}

export function useCustomDhikr() {
  const [items, setItems] = useState<CustomDhikr[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(CUSTOM_DHIKR_STORAGE_KEY).then((raw) => {
        if (!cancelled) setItems(parseCustomDhikr(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const apply = useCallback((updater: (prev: CustomDhikr[]) => CustomDhikr[]) => {
    setItems((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(CUSTOM_DHIKR_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const add = useCallback(
    (text: string, target: number): CustomDhikr => {
      const item: CustomDhikr = { id: `custom-${Date.now()}`, text: text.trim(), target };
      apply((prev) => [...prev, item]);
      return item;
    },
    [apply],
  );

  const remove = useCallback((id: string) => apply((prev) => prev.filter((d) => d.id !== id)), [apply]);

  return { items, add, remove };
}
