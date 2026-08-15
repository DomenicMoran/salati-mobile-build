// Auswahl-Logik für die gleichzeitige Mehrfach-Tafsir-Ansicht (Konkurrenz-
// Feature-Parität, z. B. quran.com zeigt mehrere Tafsir-Quellen nebeneinander).
export const TAFSIR_MAX_SIMULTANEOUS = 3;

/**
 * Schaltet eine Tafsir-Edition in der Auswahl an/aus. Mindestens eine Edition
 * bleibt immer ausgewählt (Abwählen der letzten wird ignoriert). Ist das
 * Limit erreicht und eine neue Edition wird angetippt, rotiert die älteste
 * Auswahl heraus statt die Aktion stillschweigend zu ignorieren.
 */
export function toggleTafsirSelection(current: string[], id: string): string[] {
  if (current.includes(id)) {
    return current.length > 1 ? current.filter((x) => x !== id) : current;
  }
  if (current.length >= TAFSIR_MAX_SIMULTANEOUS) {
    return [...current.slice(1), id];
  }
  return [...current, id];
}
