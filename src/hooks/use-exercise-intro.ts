// Zeigt beim ERSTEN Start eines Übungstyps automatisch ein Erklärungs-Sheet
// (siehe IntroSheet) und merkt sich das dauerhaft, damit es bei täglicher
// Nutzung nicht mehr nervt. Über das "?"-Icon im Header (IntroHelpButton)
// kann die Erklärung jederzeit erneut geöffnet werden.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'salatibox:seenIntros';

async function loadSeen(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function markSeen(id: string) {
  const seen = await loadSeen();
  seen.add(id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

export interface UseExerciseIntro {
  /** Sheet gerade sichtbar (automatisch beim ersten Besuch, oder manuell über `show`). */
  visible: boolean;
  /** Öffnet das Sheet erneut (z. B. per "?"-Icon im Header). */
  show: () => void;
  /** Schließt das Sheet und merkt sich dauerhaft, dass `id` gesehen wurde. */
  dismiss: () => void;
}

/**
 * `id` identifiziert den Übungstyp eindeutig (z. B. "puzzle", "placement").
 * Zwei Screens mit derselben `id` (z. B. die beiden Einstufungstest-Screens
 * in learn/ und study/) teilen sich bewusst denselben "gesehen"-Status — es
 * ist dieselbe Übungsmechanik, nur an anderer Stelle im Kurs.
 */
export function useExerciseIntro(id: string): UseExerciseIntro {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSeen().then((seen) => {
      if (!cancelled && !seen.has(id)) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function dismiss() {
    setVisible(false);
    markSeen(id).catch(() => {});
  }

  function show() {
    setVisible(true);
  }

  return { visible, show, dismiss };
}
