import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * true erst NACH der Hydration (Web/Static-Export). React nutzt beim
 * Hydratisieren den Server-Snapshot (false) auch für den ersten
 * Client-Render — Server-HTML und Client stimmen also überein, danach
 * folgt der echte Wert. Das ist das einzige #418-sichere Muster für
 * Inhalte, die auf dem Server anders aussehen als im Browser (Uhrzeit,
 * Sensor-Verfügbarkeit, localStorage-Zustand).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
