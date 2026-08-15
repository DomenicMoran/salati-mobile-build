// Qada-Zähler: wie viele Ramadan-Fastentage noch nachgeholt werden müssen.
// Bewusst ein rein manueller Zähler statt aus dem Tages-Tracker abgeleitet -
// eine automatische Herleitung ("Tag X nicht markiert = Ramadan-Tag verpasst")
// wäre bei lückenhafter Nutzung (App nicht jeden Tag geöffnet, Reise, Urlaub
// vor Erstinstallation …) leicht falsch und würde eine religiöse Verpflichtung
// fehlerhaft anzeigen - das darf nicht passieren. Der Nutzer trägt die Zahl
// deshalb selbst ein (z. B. nach Ramadan-Ende: "ich schulde noch 3 Tage") und
// zählt sie hier herunter, sobald er sie nachholt.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { logError } from '@/lib/errorLog';

// Nachzuholende FASTENTAGE (eine einzelne Zahl). Nicht zu verwechseln mit
// `salatibox:prayer-qada-owed` (features/tracker/qada.ts) — das sind
// nachzuholende GEBETE, je Gebetsart als Objekt. Zwei Domänen, zwei Formate,
// beide live: keine Altlast, keiner der beiden Schlüssel ist entbehrlich.
export const QADA_STORAGE_KEY = 'salatibox:qada-owed';

export function parseQadaCount(raw: string | null): number {
  const n = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function useQadaCount() {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(QADA_STORAGE_KEY).then((raw) => {
        if (!cancelled) setCount(parseQadaCount(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const change = useCallback((delta: number) => {
    setCount((prev) => {
      const next = Math.max(0, prev + delta);
      // s. fasting/store.ts: stumm verlorene Persistenz waere hier eine falsch
      // angezeigte religioese Verpflichtung — mindestens protokollieren.
      AsyncStorage.setItem(QADA_STORAGE_KEY, String(next)).catch((err: unknown) =>
        logError(err, 'fasting: Qada-Zaehler speichern'),
      );
      return next;
    });
  }, []);

  return { count, change };
}
