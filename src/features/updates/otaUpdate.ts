// Over-the-Air-Updates (EAS Update) — Logikteil ohne UI.
//
// Hintergrund: bis 27.07.2026 war `expo-updates` nicht installiert. Jede
// Inhalts- oder KI-Korrektur brauchte deshalb einen kompletten Store-Zyklus
// (Play-Prüfung + Apple-Review), und Nutzer auf alten Versionen erfuhren nie,
// dass es etwas Neues gibt (docs/audit-2026-07-27/AUSLIEFERUNG.md).
//
// Bewusste Grenzen dieses Moduls:
//   - Es spricht AUSSCHLIESSLICH mit dem EAS-Update-Endpunkt aus app.config.ts
//     (`updates.url`). Kein Analytics, kein Tracking, keine ID, kein weiterer
//     Dienst; expo-updates sendet nur die Angaben, die der Endpunkt braucht,
//     um das passende Bundle zu bestimmen (Plattform, runtimeVersion, Kanal).
//   - Der automatische Check läuft höchstens EINMAL PRO TAG und nur, wenn eine
//     Netzverbindung tatsächlich zustande kommt. Der native Auto-Check ist in
//     app.config.ts abgeschaltet ('ON_ERROR_RECOVERY'), damit es genau einen
//     Ort gibt, an dem geprüft wird.
//   - Ein geladenes Update wird NIE selbsttätig angewandt. Der Nutzer entscheidet
//     (Hinweis mit „Jetzt neu starten") — spätestens beim nächsten kompletten
//     App-Start greift es ohnehin.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/** Zeitstempel (ms) des letzten ERFOLGREICHEN Checks. */
export const OTA_LAST_CHECK_KEY = 'salatibox:ota-last-check';

const EIN_TAG_MS = 24 * 60 * 60 * 1000;

export type OtaCheckResult =
  /** Nicht geprüft: Plattform/Build unterstützt keine OTA-Updates oder heute schon geprüft. */
  | 'skipped'
  /** Geprüft, es gibt nichts Neues. */
  | 'up-to-date'
  /** Update ist heruntergeladen und wartet auf den Neustart. */
  | 'ready'
  /** Prüfung nicht möglich (kein Netz, Endpunkt nicht erreichbar). */
  | 'failed';

/**
 * Ist ein erneuter Check fällig?
 *
 * `lastCheckMs > nowMs` gilt bewusst als fällig: eine zurückgestellte
 * Geräteuhr (oder ein Zeitzonenwechsel) darf den Check nicht bis zu einem Tag
 * lang blockieren.
 */
export function isDueForCheck(lastCheckMs: number | null, nowMs: number): boolean {
  if (lastCheckMs === null || !Number.isFinite(lastCheckMs)) return true;
  if (lastCheckMs > nowMs) return true;
  return nowMs - lastCheckMs >= EIN_TAG_MS;
}

/**
 * Liefert nur dann true, wenn expo-updates in diesem Build wirklich arbeitet:
 * nicht auf Web (dort ist die Seite selbst immer aktuell), nicht im
 * Entwicklungs-Client und nicht in einem Build ohne Update-Konfiguration.
 */
export function otaSupported(): boolean {
  return Platform.OS !== 'web' && Updates.isEnabled;
}

async function readLastCheck(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(OTA_LAST_CHECK_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    // Lesefehler: lieber einmal zu viel prüfen als nie.
    return null;
  }
}

async function writeLastCheck(nowMs: number): Promise<void> {
  try {
    await AsyncStorage.setItem(OTA_LAST_CHECK_KEY, String(nowMs));
  } catch {
    // Schlimmstenfalls wird beim nächsten Start erneut geprüft — harmlos.
  }
}

/**
 * Prüft auf ein OTA-Update und lädt es bei Bedarf herunter.
 *
 * @param options.force `true` = Tagesgrenze ignorieren (manueller Aufruf aus
 *   den Einstellungen). Der automatische Start-Check ruft ohne `force` auf.
 */
export async function checkForOtaUpdate(options: { force?: boolean } = {}): Promise<OtaCheckResult> {
  if (!otaSupported()) return 'skipped';

  const now = Date.now();
  if (!options.force && !isDueForCheck(await readLastCheck(), now)) return 'skipped';

  try {
    const check = await Updates.checkForUpdateAsync();
    // Erst NACH einer beantworteten Anfrage merken. Ohne Netz schlägt der
    // Aufruf fehl und landet im catch — dann darf der nächste Start sofort
    // wieder prüfen, statt einen Tag lang blind zu warten.
    await writeLastCheck(now);
    if (!check.isAvailable && !check.isRollBackToEmbedded) return 'up-to-date';
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew || fetched.isRollBackToEmbedded ? 'ready' : 'up-to-date';
  } catch {
    return 'failed';
  }
}

/** Startet die App mit dem bereits geladenen Update neu. */
export async function restartWithUpdate(): Promise<void> {
  await Updates.reloadAsync();
}
