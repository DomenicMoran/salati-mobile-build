import type { LocationSetting, SavedLocation } from './types';

// Reine Verwaltungslogik für gespeicherte Orte (Hinzufügen/Entfernen/Finden) —
// UI in app/settings.tsx ruft diese Funktionen an, der aktive Ort bleibt
// weiterhin AppSettings.location (unverändert), s. Kommentar in types.ts.

/** Obergrenze gegen unbegrenztes Wachstum der Liste (UI zeigt sie ohnehin flach untereinander). */
export const MAX_SAVED_LOCATIONS = 20;

/**
 * Fügt einen neuen gespeicherten Ort an. Leere/nur-Leerzeichen-Namen werden
 * verworfen (kein sinnloser Eintrag ohne erkennbaren Namen), ebenso sobald
 * MAX_SAVED_LOCATIONS erreicht ist. `id` kommt vom Aufrufer (z. B. Zeitstempel-
 * basiert) statt hier generiert zu werden — hält die Funktion pur/testbar.
 */
export function addSavedLocation(
  list: SavedLocation[],
  id: string,
  name: string,
  location: LocationSetting,
): SavedLocation[] {
  const trimmedName = name.trim();
  if (!trimmedName || list.length >= MAX_SAVED_LOCATIONS) return list;
  return [...list, { ...location, id, name: trimmedName }];
}

/** Entfernt einen gespeicherten Ort per id. No-op, wenn die id nicht existiert. */
export function removeSavedLocation(list: SavedLocation[], id: string): SavedLocation[] {
  return list.filter((l) => l.id !== id);
}

/** Findet einen gespeicherten Ort per id (z. B. beim Wechseln des aktiven Orts). */
export function findSavedLocation(list: SavedLocation[], id: string): SavedLocation | undefined {
  return list.find((l) => l.id === id);
}

/** true, wenn `location` (nach Koordinaten) bereits der aktuell aktive Ort ist — für die "aktiv"-Markierung in der Liste. */
export function isActiveSavedLocation(saved: SavedLocation, active: LocationSetting): boolean {
  return saved.lat === active.lat && saved.lon === active.lon;
}
