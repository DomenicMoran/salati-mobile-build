// JS-Seite des lokalen Expo-Modules (natives Gegenstueck:
// android/.../SalatiModelDownloadModule.kt). requireOptionalNativeModule
// liefert null, wenn das native Modul fehlt (iOS/Web oder ein Build ohne das
// Modul) — model.ts prueft auf null und faellt dann auf den expo-Download
// (Vordergrund) zurueck, sodass der Download IMMER funktioniert.
import { requireOptionalNativeModule } from 'expo';

export interface DmStatus {
  /** 0=unbekannt/entfernt, 1=pending, 2=running, 4=paused, 8=erfolg, 16=fehler */
  status: number;
  bytesDownloaded: number;
  bytesTotal: number;
  reason: number;
}

export interface SalatiModelDownloadModule {
  /** Externer Speicher (und damit der System-DownloadManager) nutzbar? */
  isAvailable(): boolean;
  /** Reiner Zielpfad (kein file://) der Modelldatei im app-eigenen External-Files-Verzeichnis. */
  getModelPath(fileName: string): string;
  /** Existiert die Modelldatei bereits (und ist nicht leer)? */
  exists(fileName: string): boolean;
  /** Loescht die Modelldatei. */
  deleteModel(fileName: string): boolean;
  /** Startet den Hintergrund-Download; liefert die DownloadManager-ID. */
  start(url: string, fileName: string): Promise<number>;
  /** Fortschritt/Status einer laufenden Download-ID. */
  getStatus(id: number): DmStatus;
  /** Bricht einen Download ab / entfernt ihn. */
  cancel(id: number): number;
}

export default requireOptionalNativeModule<SalatiModelDownloadModule>('SalatiModelDownload');
