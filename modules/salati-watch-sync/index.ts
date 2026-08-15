// JS-Seite des lokalen Expo-Modules (natives Gegenstueck:
// ios/SalatiWatchSyncModule.swift).
//
// WICHTIG: Fuer den normalen Betrieb muss NICHTS hiervon aufgerufen werden.
// Die Uebertragung an die Uhr laeuft vollstaendig nativ: der AppDelegate-
// Subscriber aktiviert die WCSession beim App-Start und sendet, sobald sich
// die Nutzlast in der App-Group aendert (dort schreibt
// src/features/prayer-times/ios-widget.ts ohnehin schon hinein). Damit gibt es
// genau EINEN Datenpfad zur Uhr und keine zweite Aufrufstelle, die beim
// Refactoring vergessen werden kann.
//
// Diese Funktionen sind reine Diagnose-Hilfen (z. B. fuer einen kuenftigen
// "Uhr verbunden?"-Hinweis in den Einstellungen). requireOptionalNativeModule
// liefert null auf Android/Web und in Builds ohne dieses Modul.
import { requireOptionalNativeModule } from 'expo';

export type SalatiWatchSyncStatus = {
  /** Ob das Geraet WatchConnectivity grundsaetzlich unterstuetzt (iPad: nein). */
  supported: boolean;
  /** Ob eine Apple Watch gekoppelt ist. */
  paired: boolean;
  /** Ob die Salati-App auf der gekoppelten Uhr installiert ist. */
  watchAppInstalled: boolean;
  /** Ob die WCSession aktiviert ist. */
  activated: boolean;
  /** Ob die Uhr gerade direkt erreichbar ist (nur fuer sendMessage relevant). */
  reachable: boolean;
};

export type SalatiWatchSyncModule = {
  isSupported(): boolean;
  status(): SalatiWatchSyncStatus;
  /** Erzwingt eine Uebertragung der aktuellen App-Group-Nutzlast. true = gesendet. */
  sync(): boolean;
};

export default requireOptionalNativeModule<SalatiWatchSyncModule>('SalatiWatchSync');
