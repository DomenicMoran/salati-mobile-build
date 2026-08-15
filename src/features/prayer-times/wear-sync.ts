import { NativeModules, Platform } from 'react-native';

import type { Timings } from './api';

// WearOS-Pendant zu ios-widget.ts (Apple Watch/WidgetKit) und
// src/widgets/widget-task-handler.tsx (Android-Telefon-Homescreen-Widget).
// Anders als beide: es gibt aktuell KEIN reifes Expo-Modul für die Wearable
// Data Layer API, daher ruft dieser Wrapper ein klassisches (nicht per
// Expo-Autolinking eingebundenes) natives Bridge-Modul über
// `NativeModules.WearSync` auf — siehe
// android/app/src/main/java/de/salatibox/de/wear/WearSyncModule.kt.
//
// EHRLICHER STATUS (siehe USER-TODO.md): dieses Bridge-Modul ist als
// Kotlin-Quellcode vorhanden und in MainApplication.kt registriert, wurde
// aber NIE tatsächlich kompiliert/auf einem Gerät verifiziert (kein
// Android-Build in dieser Session). `NativeModules.WearSync` ist daher zur
// Laufzeit `undefined`, bis ein echter nativer Android-Build (mit den
// manuellen Nacharbeiten aus den Kommentaren in WearSyncModule.kt,
// android/app/build.gradle und MainApplication.kt) tatsächlich stattfindet —
// der Guard unten macht das zu einem sauberen No-op statt einem Crash.

const NATIVE_MODULE_NAME = 'WearSync';

export interface WearSyncPayload {
  locationLabel: string;
  today: Timings;
  tomorrow: Timings;
  timeFormat: '24h' | '12h';
  /**
   * Kaaba-Bearing in Grad (0 = Norden) und Entfernung in km für den
   * Qibla-Bildschirm der Uhr. Optional, weil der Kotlin-Parser
   * (android/wear/.../PrayerData.kt) sie als fehlend behandeln können muss:
   * eine ältere Uhr-APK ignoriert sie, und eine ältere Telefon-App sendet sie
   * nicht — die Uhr blendet den Qibla-Eintrag dann aus, statt eine falsche
   * Richtung zu zeigen.
   */
  qiblaBearing?: number;
  qiblaDistanceKm?: number;
}

interface WearSyncNativeModule {
  sendPrayerTimes?: (payloadJson: string) => void;
}

/**
 * Schickt die aktuellen Tages-/Folgetagszeiten "fire and forget" an eine
 * gekoppelte Wear-OS-Uhr (Data Layer API, best-effort — keine
 * Zustellgarantie, kein Promise/Reject). Aufrufer: derselbe Effekt wie
 * updateIosWidget() in prayer-times-screen.tsx, no-op auf iOS/Web und immer
 * dann, wenn das native Modul (noch) nicht gebaut/registriert ist.
 */
export function updateWearComplication(payload: WearSyncPayload): void {
  if (Platform.OS !== 'android') return;
  const native = (NativeModules as Record<string, WearSyncNativeModule | undefined>)[NATIVE_MODULE_NAME];
  if (!native?.sendPrayerTimes) return;
  try {
    native.sendPrayerTimes(JSON.stringify(payload));
  } catch {
    // Data-Layer-Übertragung ist best-effort — kein Absturz, wenn keine Uhr
    // gekoppelt ist oder Play Services fehlen.
  }
}
