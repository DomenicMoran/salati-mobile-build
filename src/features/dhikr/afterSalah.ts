// Geführte Post-Salah-Dhikr-Sequenz: 33x Subhanallah, 33x Alhamdulillah,
// 34x Allahu Akbar (insgesamt 100) — die klassische Zahlenfolge nach dem
// Pflichtgebet. Reine Phasen-Übergangs-Logik, getrennt vom freien
// Tasbih-Zähler (features/dhikr/counter.ts), weil hier die Reihenfolge fest
// vorgegeben ist und automatisch zur nächsten Phase weitergeschaltet wird.

export type AfterSalahPhaseId = 'subhanallah' | 'alhamdulillah' | 'allahuakbar';

export interface AfterSalahPhase {
  id: AfterSalahPhaseId;
  arabic: string;
  translit: string;
  target: number;
}

export const AFTER_SALAH_PHASES: AfterSalahPhase[] = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', translit: 'SubhanAllah', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', translit: 'Alhamdulillah', target: 33 },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar', target: 34 },
];

export const AFTER_SALAH_TOTAL = AFTER_SALAH_PHASES.reduce((sum, p) => sum + p.target, 0); // 100

export interface AfterSalahState {
  /** Index der aktuellen Phase in AFTER_SALAH_PHASES (0-2). */
  phaseIndex: number;
  /** Zähler innerhalb der aktuellen Phase (0..target). */
  count: number;
  /** true, sobald alle drei Phasen durchgezählt sind. */
  complete: boolean;
}

export const INITIAL_AFTER_SALAH_STATE: AfterSalahState = { phaseIndex: 0, count: 0, complete: false };

/**
 * Ein Tap: zählt in der aktuellen Phase hoch. Erreicht der Zähler das
 * Phasen-Ziel, schaltet automatisch zur nächsten Phase weiter (Zähler
 * startet dort bei 0) — nach der letzten Phase (Allahu Akbar, 34) gilt die
 * gesamte Sequenz als abgeschlossen (complete=true), der Zähler bleibt dann
 * auf dem vollen Ziel stehen (34/34) statt auf 0 zu springen, damit der
 * Erfolgs-Moment den vollständigen letzten Stand zeigt. Nach Abschluss ist
 * die Funktion ein No-Op, bis resetAfterSalah() aufgerufen wird.
 */
export function tapAfterSalah(state: AfterSalahState): AfterSalahState {
  if (state.complete) return state;
  const phase = AFTER_SALAH_PHASES[state.phaseIndex];
  const nextCount = state.count + 1;
  if (nextCount < phase.target) {
    return { ...state, count: nextCount };
  }
  const nextPhaseIndex = state.phaseIndex + 1;
  if (nextPhaseIndex >= AFTER_SALAH_PHASES.length) {
    return { phaseIndex: state.phaseIndex, count: nextCount, complete: true };
  }
  return { phaseIndex: nextPhaseIndex, count: 0, complete: false };
}

export function resetAfterSalah(): AfterSalahState {
  return INITIAL_AFTER_SALAH_STATE;
}

/** Gesamtfortschritt über alle drei Phasen hinweg (0..AFTER_SALAH_TOTAL) — für eine Gesamt-Fortschrittsanzeige. */
export function totalAfterSalahProgress(state: AfterSalahState): number {
  const completedBefore = AFTER_SALAH_PHASES.slice(0, state.phaseIndex).reduce((sum, p) => sum + p.target, 0);
  return completedBefore + state.count;
}
