// Qada-Zähler für verpasste Gebete (Audit 2026-07-19 C5, Pro-Gebetsart-Ausbau
// 2026-07-21): gleiche bewusste Entscheidung wie beim Fasten-Qada
// (features/fasting/qada.ts) - rein manueller Zähler statt Ableitung aus dem
// Tages-Tracker, weil eine automatische Herleitung bei lückenhafter Nutzung
// eine religiöse Verpflichtung falsch anzeigen würde. Der Nutzer trägt die
// Zahl selbst ein und zählt sie herunter, sobald er nachgeholt hat.
//
// Getrennt nach Gebetsart (Fajr/Dhuhr/Asr/Maghrib/Isha), weil das dem
// üblichen Modell etablierter Qada-Tracker-Apps entspricht - wer z. B. nur
// Fajr regelmäßig verpasst, will das nicht mit den anderen vier Gebeten in
// einer Summe vermischen. Witr wird bewusst nicht als eigene Gebetsart
// geführt, weil der Tages-Tracker (features/tracker/store.ts, PRAYER_IDS)
// ebenfalls nur die 5 Pflichtgebete kennt.
//
// Ausbau 2026-07-27: neben dem offenen Bestand wird mitgeführt, wie viel davon
// bereits nachgeholt wurde. Nur so ist der Bestand ehrlich lesbar — ein
// Zähler, der von 100 auf 40 fällt, sagt sonst nicht, ob 60 nachgeholt oder
// 60 wegkorrigiert wurden. Deshalb sind Korrektur (`change`) und Nachholen
// (`makeUp`) getrennte Vorgänge; nur Letzteres erhöht den Nachhol-Stand.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { logError } from '@/lib/errorLog';

import { PRAYER_IDS, type PrayerId } from './store';

// KEINE Dublette zu `salatibox:qada-owed` (features/fasting/qada.ts), auch
// wenn die Namen danach aussehen (Prüfung 2026-07-27): dieser Schlüssel hält
// nachzuholende GEBETE als Objekt je Gebetsart, jener nachzuholende
// FASTENTAGE als einzelne Zahl. Beide sind live (app/tracker.tsx bzw.
// app/fasting.tsx), keiner ist tot — nicht "aufräumen".
export const PRAYER_QADA_STORAGE_KEY = 'salatibox:prayer-qada-owed';

export type PrayerQadaData = Record<PrayerId, number>;

export interface PrayerQadaState {
  /** noch offen, je Gebetsart */
  owed: PrayerQadaData;
  /** bereits nachgeholt, je Gebetsart */
  done: PrayerQadaData;
}

/** Schrittweiten der Bestandskorrektur — Rückstände über Jahre sind in Einerschritten nicht eintragbar. */
export const QADA_STEPS = [1, 10] as const;

function emptyQadaData(): PrayerQadaData {
  return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
}

function readCounts(dict: Record<string, unknown>): PrayerQadaData {
  const next = emptyQadaData();
  for (const id of PRAYER_IDS) {
    const n = Number(dict[id]);
    next[id] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  return next;
}

export function parsePrayerQadaData(raw: string | null): PrayerQadaData {
  const empty = emptyQadaData();
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Legacy-Format (vor dem Pro-Gebetsart-Ausbau): eine einzelne Zahl für
    // den Gesamtbestand. Wird nicht verworfen, sondern komplett auf Fajr
    // gebucht, damit kein bereits eingetragener Nachhol-Bedarf verloren
    // geht - der Nutzer kann die Zahl danach frei zwischen den Gebetsarten
    // verschieben.
    if (typeof parsed === 'number') {
      return Number.isFinite(parsed) && parsed >= 0 ? { ...empty, fajr: Math.floor(parsed) } : empty;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return readCounts(parsed as Record<string, unknown>);
    }
    return empty;
  } catch {
    return empty;
  }
}

/**
 * Voller Zustand inkl. Nachhol-Stand. Der offene Bestand steht weiterhin auf
 * der obersten Ebene (`{"fajr":3,…}`), der Nachhol-Stand daneben unter `done`
 * — ältere Datenstände ohne `done` lesen sich damit unverändert korrekt, und
 * der Speicherschlüssel bleibt derselbe (er wird bereits gesichert).
 */
export function parsePrayerQadaState(raw: string | null): PrayerQadaState {
  const owed = parsePrayerQadaData(raw);
  if (!raw) return { owed, done: emptyQadaData() };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const nested = (parsed as Record<string, unknown>).done;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return { owed, done: readCounts(nested as Record<string, unknown>) };
      }
    }
  } catch {
    // gleicher Umgang wie oben: kaputter Datenstand ergibt einen leeren Zähler
  }
  return { owed, done: emptyQadaData() };
}

export function serializePrayerQadaState(state: PrayerQadaState): string {
  return JSON.stringify({ ...state.owed, done: state.done });
}

export function totalQadaOwed(data: PrayerQadaData): number {
  return PRAYER_IDS.reduce((sum, id) => sum + data[id], 0);
}

/** Korrektur des offenen Bestands — verändert den Nachhol-Stand NICHT. */
export function applyQadaChange(state: PrayerQadaState, prayer: PrayerId, delta: number): PrayerQadaState {
  return { ...state, owed: { ...state.owed, [prayer]: Math.max(0, state.owed[prayer] + delta) } };
}

/**
 * `count` Gebete dieser Gebetsart als nachgeholt verbuchen: senkt den offenen
 * Bestand und erhöht den Nachhol-Stand um dieselbe Menge — nie über den
 * vorhandenen Bestand hinaus.
 */
export function applyQadaMakeUp(state: PrayerQadaState, prayer: PrayerId, count: number): PrayerQadaState {
  const n = Math.min(Math.max(0, Math.floor(count)), state.owed[prayer]);
  if (n === 0) return state;
  return {
    owed: { ...state.owed, [prayer]: state.owed[prayer] - n },
    done: { ...state.done, [prayer]: state.done[prayer] + n },
  };
}

/**
 * Einen ganzen Tag nachholen: je ein Gebet aller fünf Gebetsarten. Das ist der
 * praktische Regelfall (ein verschlafener Tag wird als Tag nachgeholt) und
 * spart fünf Einzeltipps. Bewusst nur anwendbar, wenn ALLE fünf Gebetsarten
 * offen sind — sonst wäre es kein ganzer Tag.
 */
export function canMakeUpFullDay(state: PrayerQadaState): boolean {
  return PRAYER_IDS.every((id) => state.owed[id] > 0);
}

export function applyQadaMakeUpDay(state: PrayerQadaState): PrayerQadaState {
  if (!canMakeUpFullDay(state)) return state;
  return PRAYER_IDS.reduce((acc, id) => applyQadaMakeUp(acc, id, 1), state);
}

export function usePrayerQadaCount() {
  const [state, setState] = useState<PrayerQadaState>(() => ({ owed: emptyQadaData(), done: emptyQadaData() }));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(PRAYER_QADA_STORAGE_KEY).then((raw) => {
        if (!cancelled) setState(parsePrayerQadaState(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const update = useCallback((fn: (prev: PrayerQadaState) => PrayerQadaState) => {
    setState((prev) => {
      const next = fn(prev);
      // Wie beim Fasten-Qada: eine stumm verlorene Persistenz wäre eine falsch
      // angezeigte religiöse Verpflichtung — mindestens protokollieren.
      AsyncStorage.setItem(PRAYER_QADA_STORAGE_KEY, serializePrayerQadaState(next)).catch((err: unknown) =>
        logError(err, 'tracker: Qada-Zaehler speichern'),
      );
      return next;
    });
  }, []);

  const change = useCallback(
    (prayer: PrayerId, delta: number) => update((prev) => applyQadaChange(prev, prayer, delta)),
    [update],
  );
  const makeUp = useCallback(
    (prayer: PrayerId, count = 1) => update((prev) => applyQadaMakeUp(prev, prayer, count)),
    [update],
  );
  const makeUpDay = useCallback(() => update((prev) => applyQadaMakeUpDay(prev)), [update]);

  return {
    data: state.owed,
    done: state.done,
    total: totalQadaOwed(state.owed),
    totalDone: totalQadaOwed(state.done),
    canMakeUpDay: canMakeUpFullDay(state),
    change,
    makeUp,
    makeUpDay,
  };
}
