import { Platform } from 'react-native';

import type { Timings } from './api';

// iOS-Pendant zu src/widgets/widget-task-handler.tsx (Android). Anders als
// react-native-android-widget (das per Headless-JS-Task direkt render()
// aufruft) liest eine WidgetKit-Extension NIE den JS-Prozess der App — sie
// läuft als eigener nativer Prozess und bekommt Daten NUR über eine geteilte
// App-Group-UserDefaults-Instanz. ExtensionStorage (aus @bacons/apple-targets,
// demselben Paket wie das Config-Plugin für das Xcode-Target unter
// targets/salati-widget/) schreibt genau dorthin; das Schema hier MUSS mit
// dem Swift-Decoder in targets/salati-widget/SalatiPrayerWidget.swift
// synchron bleiben.
//
// UNGETESTET auf echtem Gerät (siehe targets/salati-widget/expo-target.config.js
// Kopfkommentar — kein macOS zum Prebuilden/Kompilieren in dieser Umgebung
// verfügbar). Web/Android rufen updateIosWidget() nie sinnvoll auf (Guard
// unten), daher risikofrei im gemeinsamen prayer-times-Code eingebunden.

const APP_GROUP = 'group.de.salatibox.de';
const STORAGE_KEY = 'salati.widget.prayerTimes';

export interface IosWidgetPayload {
  locationLabel: string;
  today: Timings;
  tomorrow: Timings;
  timeFormat: '24h' | '12h';
  /** Qibla-Peilung in Grad (0..360, von Norden im Uhrzeigersinn) — für das Qibla-Widget. */
  qiblaBearing: number;
  /** Entfernung zur Kaaba in km — für das Qibla-Widget. */
  qiblaDistanceKm: number;
  /** Gewähltes Widget-Farbthema (s. widgetTheme.ts / settings.widgetTheme). */
  widgetTheme: string;
}

type ExtensionStorageModule = typeof import('@bacons/apple-targets');
let extensionStorageModule: ExtensionStorageModule | null | undefined;

/** Lazy + gecacht: vermeidet den nativen Modul-Zugriff komplett auf Nicht-iOS-Plattformen. */
function getExtensionStorageModule(): ExtensionStorageModule | null {
  if (Platform.OS !== 'ios') return null;
  if (extensionStorageModule === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- nur auf iOS geladen, kein Web-/Android-Bundle-Risiko
    extensionStorageModule = require('@bacons/apple-targets') as ExtensionStorageModule;
  }
  return extensionStorageModule;
}

/**
 * Schreibt die aktuellen Tages-/Folgetagszeiten in die geteilte App-Group,
 * damit das WidgetKit-Timeline-Provider sie lesen kann, und stößt einen
 * Widget-Reload an. Aufrufer: z. B. ein Effekt in useTimings()-Konsumenten
 * nach erfolgreichem Fetch — bewusst NICHT direkt in hooks.ts verdrahtet,
 * um den reinen Daten-Hook nicht mit Plattform-Seiteneffekten zu vermischen.
 */
export function updateIosWidget(payload: IosWidgetPayload): void {
  const mod = getExtensionStorageModule();
  if (!mod) return;
  new mod.ExtensionStorage(APP_GROUP).set(STORAGE_KEY, JSON.stringify(payload));
  mod.ExtensionStorage.reloadWidget();
}
