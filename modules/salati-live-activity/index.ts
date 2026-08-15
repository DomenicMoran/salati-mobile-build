// JS-Seite des lokalen Expo-Modules (natives Gegenstueck:
// ios/SalatiLiveActivityModule.swift). requireOptionalNativeModule liefert
// null, wenn das native Modul nicht vorhanden ist (Android/Web oder ein
// Build ohne die iOS-Extension) — Aufrufer muss daher auf null pruefen.
import { requireOptionalNativeModule } from 'expo';

export type SalatiLiveActivityModule = {
  /** Ob Live Activities auf dem Geraet grundsaetzlich erlaubt/aktiviert sind. */
  isSupported(): boolean;
  /** Beendet ggf. laufende Activities und startet eine neue. */
  start(title: string, prayer: string, time: string): void;
  /** Aktualisiert die laufende Activity (kein Neustart). */
  update(title: string, prayer: string, time: string): void;
  /** Beendet alle laufenden Activities sofort. */
  end(): void;
};

export default requireOptionalNativeModule<SalatiLiveActivityModule>('SalatiLiveActivity');
