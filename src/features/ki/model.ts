import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/lib/errorLog';

import type { SalatiModelDownloadModule } from '../../../modules/salati-model-download';

// ALTBESTAND-VERWALTUNG, kein aktiver Download mehr.
//
// Seit 1.34.0 (Commit f57ed61, „KI ohne Sprachmodell") antwortet die Salati-KI
// extraktiv aus dem Korpus — `llama.rn` ist keine Abhängigkeit dieses Projekts
// mehr, und in der APK liegt folgerichtig kein `librnllama.so`. Von dieser
// Datei ist nur noch der Löschpfad in Gebrauch: `modellPfad`/`modellLoeschen`
// werden aus der Speicherverwaltung der Einstellungen aufgerufen
// (src/features/settings/storage.ts), damit Nutzer die 1,1 GB loswerden, die
// eine ältere Version heruntergeladen hat.
//
// Die Download-Funktionen darunter bleiben absichtlich stehen (sie beschreiben,
// woher die Datei kam, die hier gelöscht wird), werden aber von keinem Screen
// mehr aufgerufen. Wer sie wiederbelebt, braucht zuerst wieder eine
// Inferenz-Bibliothek im Build.
//
// Frühere Beschreibung: einmaliger optionaler Download desselben Modells wie
// die Web-Version (Qwen2.5-1.5B-Instruct, GGUF Q4_K_M).
//
// Download-Strategie:
//  • Android: echter Hintergrund-Download über den System-DownloadManager
//    (lokales Expo-Module salati-model-download) — läuft weiter bei App im
//    Hintergrund/geschlossen, System-Notification, Resume, Reattach nach
//    App-Neustart. Der @kesha-antonov-Downloader schrieb hier 0 Bytes.
//  • iOS / kein externer Speicher: Fallback auf den bewährten expo-Download
//    (Vordergrund) — so funktioniert der Download IMMER.

export const MODELL_DATEINAME = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';
// Eigener Cloudflare-R2-Bucket (schnell, kontrolliert, "vom eigenen Server").
export const MODELL_URL = `https://pub-d0489c0572704285af79896edb72cbed.r2.dev/ki/${MODELL_DATEINAME}`;
// Fallback für die Fortschrittsanzeige, falls kein Content-Length-Header kommt.
export const MODELL_GROESSE_BYTES = 1_120_000_000;

// Nativer Android-DownloadManager (null auf iOS/Web oder Build ohne das Modul).
const ModelDM = requireOptionalNativeModule<SalatiModelDownloadModule>('SalatiModelDownload');

/** Echten Hintergrund-Download (System-DownloadManager) nutzen? Nur Android + Modul vorhanden. */
function nutzeDM(): boolean {
  return Platform.OS === 'android' && ModelDM != null && ModelDM.isAvailable();
}

// Persistenz der laufenden DownloadManager-ID: der DM läuft im System-Prozess
// weiter, die JS-ID geht beim Screen-Unmount verloren — für den Reattach nach
// App-Neustart/Rückkehr wird sie in einer kleinen Datei gehalten.
const DM_ID_DATEI = `${FileSystem.documentDirectory}dm-download-id.txt`;
async function speichereDmId(id: number): Promise<void> {
  // Schlaegt das fehl, findet die App den laufenden Hintergrund-Download nach
  // einem Neustart nicht mehr wieder und beginnt 1,1 GB von vorn — der Nutzer
  // sieht nur "Download startet erneut". Darum protokollieren.
  await FileSystem.writeAsStringAsync(DM_ID_DATEI, String(id)).catch((err: unknown) =>
    logError(err, 'ki-modell: DownloadManager-ID speichern'),
  );
}
async function leseDmId(): Promise<number | null> {
  const info = await FileSystem.getInfoAsync(DM_ID_DATEI);
  if (!info.exists) return null;
  const s = await FileSystem.readAsStringAsync(DM_ID_DATEI).catch((err: unknown) => {
    void logError(err, 'ki-modell: DownloadManager-ID lesen');
    return '';
  });
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
async function loescheDmId(): Promise<void> {
  // idempotent:true — "Datei war schon weg" ist kein Fehler, bewusst still
  // (wuerde sonst nur den 20 Eintraege kleinen Fehler-Ringpuffer zumuellen).
  await FileSystem.deleteAsync(DM_ID_DATEI, { idempotent: true }).catch(() => {});
}

function fallbackVerzeichnis(): string {
  return `${FileSystem.documentDirectory}ki-modell/`;
}

export function modellPfad(): string {
  // DM: reiner External-Files-Pfad (llm.ts entfernt ohnehin ein evtl. file://).
  if (nutzeDM()) return ModelDM!.getModelPath(MODELL_DATEINAME);
  return `${fallbackVerzeichnis()}${MODELL_DATEINAME}`;
}

/** Web hat kein Dateisystem für große Modell-Downloads — dort bleibt es bei der Browser-Version (WebLLM). */
export function nativeKiUnterstuetzt(): boolean {
  return Platform.OS !== 'web';
}

export async function istModellHeruntergeladen(): Promise<boolean> {
  if (!nativeKiUnterstuetzt()) return false;
  if (nutzeDM()) return ModelDM!.exists(MODELL_DATEINAME);
  const info = await FileSystem.getInfoAsync(modellPfad());
  return info.exists && (info.size ?? 0) > 0;
}

export interface DownloadFortschritt {
  bytesGeladen: number;
  bytesGesamt: number;
  anteil: number; // 0..1
}

const schlaf = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Läuft nach App-Neustart noch ein Hintergrund-Download? (nur DM-Pfad) */
export async function laufenderDownload(): Promise<boolean> {
  if (!nutzeDM()) return false;
  const id = await leseDmId();
  if (id == null) return false;
  const s = ModelDM!.getStatus(id);
  return s.status === 1 || s.status === 2 || s.status === 4; // pending/running/paused
}

// DownloadManager-Status: 1=pending 2=running 4=paused 8=erfolg 16=fehler 0=weg
async function downloadViaDM(onProgress: (p: DownloadFortschritt) => void): Promise<void> {
  let id = await leseDmId();
  let wiederaufnehmbar = false;
  if (id != null) {
    const s = ModelDM!.getStatus(id);
    wiederaufnehmbar = s.status === 1 || s.status === 2 || s.status === 4 || s.status === 8;
  }
  if (!wiederaufnehmbar) {
    ModelDM!.deleteModel(MODELL_DATEINAME);
    id = await ModelDM!.start(MODELL_URL, MODELL_DATEINAME);
    await speichereDmId(id);
  }
  for (;;) {
    const s = ModelDM!.getStatus(id!);
    const gesamt = s.bytesTotal > 0 ? s.bytesTotal : MODELL_GROESSE_BYTES;
    onProgress({ bytesGeladen: s.bytesDownloaded, bytesGesamt: gesamt, anteil: Math.min(1, s.bytesDownloaded / gesamt) });
    if (s.status === 8) {
      await loescheDmId();
      if (!ModelDM!.exists(MODELL_DATEINAME)) throw new Error('Download abgeschlossen, aber Datei fehlt');
      return;
    }
    if (s.status === 16) {
      await loescheDmId();
      ModelDM!.deleteModel(MODELL_DATEINAME);
      throw new Error(`Download fehlgeschlagen (Grund ${s.reason})`);
    }
    if (s.status === 0) {
      await loescheDmId();
      throw new Error('Download wurde abgebrochen');
    }
    await schlaf(800);
  }
}

async function downloadViaExpo(onProgress: (p: DownloadFortschritt) => void): Promise<void> {
  // intermediates:true → "existiert schon" wirft nicht. Was hier ankommt, ist
  // ein echtes Dateisystem-Problem (kein Platz, keine Rechte) und erklaert den
  // gleich folgenden Download-Fehlschlag.
  await FileSystem.makeDirectoryAsync(fallbackVerzeichnis(), { intermediates: true }).catch((err: unknown) =>
    logError(err, 'ki-modell: Zielverzeichnis anlegen'),
  );
  const ziel = modellPfad();
  await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
  const resumable = FileSystem.createDownloadResumable(MODELL_URL, ziel, {}, (data) => {
    const gesamt = data.totalBytesExpectedToWrite > 0 ? data.totalBytesExpectedToWrite : MODELL_GROESSE_BYTES;
    onProgress({
      bytesGeladen: data.totalBytesWritten,
      bytesGesamt: gesamt,
      anteil: Math.min(1, data.totalBytesWritten / gesamt),
    });
  });
  const result = await resumable.downloadAsync();
  if (!result || result.status !== 200) {
    await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
    throw new Error(`Download fehlgeschlagen (Status ${result?.status ?? 'unbekannt'})`);
  }
}

/**
 * Lädt das GGUF-Modell herunter. Android: echter Hintergrund-Download
 * (DownloadManager), nimmt einen bereits laufenden wieder auf. Sonst: expo-
 * Download (Vordergrund). Wirft bei Fehlern (Aufrufer zeigt "Erneut versuchen").
 */
export async function modellHerunterladen(onProgress: (p: DownloadFortschritt) => void): Promise<void> {
  if (nutzeDM()) return downloadViaDM(onProgress);
  return downloadViaExpo(onProgress);
}

export async function modellLoeschen(): Promise<void> {
  await loescheDmId();
  if (nutzeDM()) {
    ModelDM!.deleteModel(MODELL_DATEINAME);
    return;
  }
  await FileSystem.deleteAsync(modellPfad(), { idempotent: true }).catch(() => {});
}

export function formatiereBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / 1_000_000;
  if (mb < 1000) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1000).toFixed(2)} GB`;
}
