import {
  SETTINGS_BACKUP_KEY,
  collectBackupValues,
  isFullBackupKey,
  restoreBackupValues,
} from './backupKeys';
import { decodeBase64, encodeBase64 } from './base64';

// Übertragung von Lern-/Betfortschritt zwischen Geräten (Handy<->Handy,
// Handy<->Web) OHNE Server/Account/Kosten: der Nutzer exportiert einen Code
// (Text), überträgt ihn selbst (Kopieren+Einfügen in eine Notiz/Nachricht/
// E-Mail an sich selbst — beliebiger Kanal, den der Nutzer schon hat) und
// importiert ihn auf dem Zielgerät.
//
// WELCHE Schlüssel mitgehen, entscheidet ausschließlich features/sync/
// backupKeys.ts — dieselbe Quelle nutzt auch die Backup-Datei
// (features/settings/backup.ts). Vorher stand hier eine handgepflegte Liste
// mit 10 Einträgen, während die App ~40 Schlüssel schreibt; alles Übrige ging
// beim Gerätewechsel still verloren.

/**
 * v1: feste 10er-Liste, `data` enthielt nur diese Schlüssel.
 * v2: vollständige Sicherung über backupKeys.ts (inkl. dynamischer Kurs-/
 *     Lernweg-Präfixe und eines Einstellungs-Ausschnitts).
 *
 * Ein v1-Code bleibt lesbar: seine 10 Schlüssel sind auch in v2 gültige
 * Sicherungs-Schlüssel und werden ganz normal zurückgeschrieben. Ein Code mit
 * einer NEUEREN Version als dieser App bekannt wird abgelehnt, statt still
 * unvollständig importiert zu werden.
 */
export const SYNC_FORMAT_VERSION = 2;
export const MIN_SUPPORTED_SYNC_VERSION = 1;

export interface SyncPayload {
  v: number;
  exportedAt: string;
  data: Record<string, string>;
}

/** Ein Schlüssel gehört in den Code, wenn er als Sicherungs-Schlüssel gilt. */
function isSyncKey(key: string): boolean {
  return isFullBackupKey(key) || key === SETTINGS_BACKUP_KEY;
}

/** Reiner Aufbau des Payload-Objekts aus bereits gelesenen Werten — ohne AsyncStorage, daher ohne Mock testbar. */
export function buildSyncPayload(values: Record<string, string | null | undefined>): SyncPayload {
  const data: Record<string, string> = {};
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    if (value != null && isSyncKey(key)) data[key] = value;
  }
  return { v: SYNC_FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
}

export function encodeSyncPayload(payload: SyncPayload): string {
  return encodeBase64(JSON.stringify(payload));
}

export class InvalidSyncCodeError extends Error {
  constructor() {
    super('invalid_sync_code');
  }
}

/** Wirft InvalidSyncCodeError bei kaputtem/fremdem/zu neuem Code statt eines kryptischen JSON-Fehlers. */
export function decodeSyncPayload(code: string): SyncPayload {
  let json: string;
  try {
    json = decodeBase64(code.trim());
  } catch {
    throw new InvalidSyncCodeError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidSyncCodeError();
  }
  if (typeof parsed !== 'object' || parsed === null) throw new InvalidSyncCodeError();

  const { v, data } = parsed as { v?: unknown; data?: unknown };
  const versionOk =
    typeof v === 'number' && Number.isInteger(v) && v >= MIN_SUPPORTED_SYNC_VERSION && v <= SYNC_FORMAT_VERSION;
  if (!versionOk || typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new InvalidSyncCodeError();
  }
  return parsed as SyncPayload;
}

export async function exportProgressCode(): Promise<string> {
  return encodeSyncPayload(buildSyncPayload(await collectBackupValues()));
}

/** Schreibt die im Code enthaltenen Domänen zurück in AsyncStorage. Bereits
 * laufende Screens lesen ihre Daten teils nur einmalig beim Start — ein
 * Neustart der App nach dem Import stellt sicher, dass alles greift. */
export async function importProgressCode(code: string): Promise<{ restoredKeys: string[] }> {
  const payload = decodeSyncPayload(code);
  return { restoredKeys: await restoreBackupValues(payload.data) };
}
