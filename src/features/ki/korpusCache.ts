// Ablageort und Löschung des nachgeladenen KI-Korpus — bewusst eine EIGENE,
// winzige Datei statt ein Export aus ./korpus.ts: dieses Modul zieht den
// gebündelten deutschen Korpus (public/rag/korpus-de.json, ~1,7 MB) als
// statischen Import mit. Die Speicherverwaltung (features/settings/storage.ts)
// braucht nur den Pfad; über ./korpus.ts importiert, würde allein das Öffnen
// des Speicher-Screens diese 1,7 MB JSON parsen.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/** Ablageort der nachgeladenen Korpus-Sprachdateien (korpus-<lang>.json). */
export function korpusDatenVerzeichnis(): string {
  return `${FileSystem.documentDirectory}ki-korpus/`;
}

function hatDateisystem(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

/**
 * Löscht die nachgeladenen Korpus-Sprachdateien. Verlustfrei: der deutsche
 * Korpus ist in der App gebündelt (korpus.ts, deutscherStand()), die übrigen
 * Sprachen werden beim nächsten Start neu geladen. Ein bereits im Speicher
 * liegender Stand bleibt bis zum App-Neustart aktiv — die Platte ist trotzdem
 * frei.
 */
export async function korpusCacheLoeschen(): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.deleteAsync(korpusDatenVerzeichnis(), { idempotent: true }).catch(() => {});
}
