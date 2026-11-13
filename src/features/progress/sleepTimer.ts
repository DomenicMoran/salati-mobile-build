/**
 * Screen-unabhängiger Sleep-Timer für Shared-Player (Podcast, Hörbuch, Koran).
 * Läuft in der App-Wurzel, nicht im jeweiligen Screen.
 */

export type SleepTimerMode = number | 'episode' | 'surah' | null;

export interface SleepTimerState {
  endsAt: number | null;
  mode: SleepTimerMode;
  label: string | null;
}

let state: SleepTimerState = { endsAt: null, mode: null, label: null };
const listeners = new Set<() => void>();
let tickId: ReturnType<typeof setInterval> | null = null;
let onExpire: (() => void) | null = null;

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeSleepTimer(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSleepTimerSnapshot(): SleepTimerState {
  return state;
}

export function registerSleepTimerExpire(handler: () => void): () => void {
  onExpire = handler;
  return () => {
    if (onExpire === handler) onExpire = null;
  };
}

function stopTick(): void {
  if (tickId) {
    clearInterval(tickId);
    tickId = null;
  }
}

function startTick(): void {
  stopTick();
  tickId = setInterval(() => {
    if (!state.endsAt) return;
    if (Date.now() >= state.endsAt) {
      clearSleepTimer();
      onExpire?.();
    } else {
      emit();
    }
  }, 1000);
}

export function setSleepTimerMinutes(minutes: number, label?: string): void {
  state = {
    endsAt: Date.now() + minutes * 60_000,
    mode: minutes,
    label: label ?? `${minutes} min`,
  };
  emit();
  startTick();
}

export function setSleepTimerEndOfEpisode(label = 'Ende der Folge'): void {
  state = { endsAt: null, mode: 'episode', label };
  emit();
  stopTick();
}

export function clearSleepTimer(): void {
  state = { endsAt: null, mode: null, label: null };
  emit();
  stopTick();
}

export function sleepTimerRemainingSec(): number | null {
  if (!state.endsAt) return null;
  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
}
