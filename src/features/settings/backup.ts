import * as FileSystem from 'expo-file-system/legacy';

import { HIFZ_STORAGE_KEY, parseHifzProgress } from '@/features/hifz/progress';
import { LEARN_PROGRESS_STORAGE_KEY, parseLearnProgress } from '@/features/learn/progress';
import { listDownloadedReciters } from '@/features/quran/offline-audio';
import { parseProgress, QURAN_PROGRESS_STORAGE_KEY } from '@/features/quran/progress';
import { classifyStorageKey, collectBackupValues, restoreBackupValues } from '@/features/sync/backupKeys';

// Fortschritt exportieren/importieren: die App hat bewusst kein Konto/Cloud-
// Sync (Privacy-Positionierung), Fortschritt liegt daher ausschließlich lokal
// in AsyncStorage/FileSystem und geht bei Geräte-/App-Wechsel verloren. Dieses
// Modul bündelt alle betroffenen Keys in EIN JSON, das der Nutzer selbst
// exportieren/aufheben/wieder einspielen kann - ohne jeden Cloud-Zwang.
//
// WELCHE Keys das sind, steht seit Format v2 NICHT mehr hier, sondern in
// features/sync/backupKeys.ts - derselben Quelle, aus der auch der Sync-Code
// (features/sync/codeSync.ts) schöpft. Vorher hatten die beiden Wege
// unterschiedlichen Umfang: die Datei sicherte nur Lern-, Hifz- und
// Koran-Fortschritt, der Code eine andere 10er-Auswahl - je nachdem, welchen
// Weg der Nutzer wählte, verlor er etwas anderes.
//
// Rezitator-Downloads bleiben eine reine Info: die Audio-Dateien selbst werden
// nie mit exportiert (zu groß), der Nutzer sieht nach dem Import nur, welche
// Rezitatoren er bei Bedarf erneut laden muss.

/**
 * v1: getippte Einzelfelder (learnProgress/courseProgress/hifzProgress/
 *     quranProgress) - deckte nur diese vier Domänen ab.
 * v2: `storage` = vollständige Abbildung Schlüssel -> Rohwert laut
 *     backupKeys.ts. Eine v1-Datei bleibt lesbar (siehe migrateV1Storage);
 *     eine ZU NEUE Datei wird weiterhin komplett abgelehnt, statt still
 *     unvollständig importiert zu werden.
 */
export const BACKUP_FORMAT_VERSION = 2;
export const MIN_SUPPORTED_BACKUP_VERSION = 1;

export interface BackupData {
  formatVersion: number;
  exportedAt: number;
  /** Alle gesicherten AsyncStorage-Schlüssel mit ihrem Rohwert (JSON-String). */
  storage: Record<string, string>;
  /** Nur Rezitator-Kennungen, informativ - keine Audio-Dateien. */
  downloadedReciters: string[];
}

export const BACKUP_FILE_NAME = 'salati-fortschritt.json';

/** Sammelt den aktuellen lokalen Zustand aller betroffenen Keys zu einem Backup-Objekt. */
export async function collectBackupData(now: number = Date.now()): Promise<BackupData> {
  const storage = await collectBackupValues();
  const downloadedReciters = (await listDownloadedReciters()).map((pack) => pack.reciter);
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now,
    storage,
    downloadedReciters,
  };
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

/** Schreibt das Backup als Datei ins Cache-Verzeichnis (für den Share-Sheet) und liefert die URI. */
export async function writeBackupFile(data: BackupData): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}${BACKUP_FILE_NAME}`;
  await FileSystem.writeAsStringAsync(uri, serializeBackup(data));
  return uri;
}

export async function readBackupFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}

export type ParsedBackup =
  | { ok: true; data: BackupData }
  | { ok: false; reason: 'invalid_json' | 'invalid_shape' | 'unsupported_version' };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Hebt eine v1-Datei auf das v2-Format: die vier getippten Felder wandern in
 * `storage`. Die alten parse*-Funktionen bleiben dabei im Spiel, damit von
 * Hand editierte/kaputte v1-Dateien genauso tolerant behandelt werden wie
 * bisher (jedes Teilfeld fällt für sich auf einen leeren Zustand zurück).
 */
function migrateV1Storage(parsed: Record<string, unknown>): Record<string, string> {
  const storage: Record<string, string> = {};
  storage[LEARN_PROGRESS_STORAGE_KEY] = JSON.stringify(parseLearnProgress(JSON.stringify(parsed.learnProgress ?? {})));
  storage[HIFZ_STORAGE_KEY] = JSON.stringify(parseHifzProgress(JSON.stringify(parsed.hifzProgress ?? {})));
  storage[QURAN_PROGRESS_STORAGE_KEY] = JSON.stringify(parseProgress(JSON.stringify(parsed.quranProgress ?? {})));
  if (isPlainObject(parsed.courseProgress)) {
    for (const [key, value] of Object.entries(parsed.courseProgress)) {
      if (classifyStorageKey(key) !== 'full') continue;
      storage[key] = JSON.stringify(parseLearnProgress(JSON.stringify(value ?? {})));
    }
  }
  return storage;
}

/** Nimmt nur echte String-Werte unter gesicherten Schlüsseln an - eine von Hand
 * editierte Datei darf keine beliebigen Schlüssel/Typen in den Speicher tragen. */
function sanitizeStorage(raw: unknown): Record<string, string> {
  if (!isPlainObject(raw)) return {};
  const storage: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    const cls = classifyStorageKey(key);
    if (cls === 'full' || cls === 'partial') storage[key] = value;
  }
  return storage;
}

/**
 * Validiert + normalisiert eine importierte Backup-Datei. Robust gegen von
 * Hand editierte/kaputte JSONs: unbekannte/kaputte Teile werden verworfen
 * statt den ganzen Import zu kippen - AUSSER die Formatversion ist neuer als
 * das, was diese App-Version versteht: dann wird der komplette Import
 * abgelehnt, statt still falsche/unvollständige Daten zurückzuschreiben.
 */
export function parseBackupFile(raw: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  if (!isPlainObject(parsed)) return { ok: false, reason: 'invalid_shape' };
  const version = parsed.formatVersion;
  if (
    typeof version !== 'number' ||
    version < MIN_SUPPORTED_BACKUP_VERSION ||
    version > BACKUP_FORMAT_VERSION
  ) {
    return { ok: false, reason: 'unsupported_version' };
  }

  return {
    ok: true,
    data: {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      storage: version === 1 ? migrateV1Storage(parsed) : sanitizeStorage(parsed.storage),
      downloadedReciters: Array.isArray(parsed.downloadedReciters)
        ? parsed.downloadedReciters.filter((r): r is string => typeof r === 'string')
        : [],
    },
  };
}

/** Schreibt ein validiertes Backup zurück in AsyncStorage - überschreibt den aktuellen lokalen Fortschritt. */
export async function applyBackupData(data: BackupData): Promise<string[]> {
  return restoreBackupValues(data.storage);
}
