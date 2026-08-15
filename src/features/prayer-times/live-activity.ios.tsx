// iOS Live Activity ("nächstes Gebet" auf dem Sperrbildschirm/in der Dynamic
// Island) — Gegenstück zu Androids dauerhafter Notification
// (updateOngoingCountdown in notifications.ts), gleiche Datenquelle
// (next-prayer.ts) und derselbe Wortlaut (formatOngoingCountdownText).
//
// ARCHITEKTUR (bewusst NICHT expo-widgets): Das Starten/Aktualisieren/Beenden
// läuft über das lokale Expo-Module `salati-live-activity`
// (modules/salati-live-activity/ios/SalatiLiveActivityModule.swift, ActivityKit
// Activity.request). Die DARSTELLUNG liefert die bestehende
// @bacons/apple-targets Widget-Extension
// (targets/salati-widget/PrayerLiveActivity.swift). Grund: expo-widgets legt
// ein EIGENES Xcode-Target an und kollidiert dabei mit @bacons/apple-targets im
// prebuild (verifiziert an EAS-Build 28, s. Memory
// project_salati_expo_widgets_bacons_conflict). Das lokale Module wird dagegen
// als Pod in die Haupt-App gelinkt — kein zweites Target, kein Konflikt.
//
// Das native Modul wird direkt per requireOptionalNativeModule('SalatiLiveActivity')
// geladen (nicht über den Bare-Import 'salati-live-activity' — modules/ ist KEIN
// pnpm-Workspace-Package, s. pnpm-workspace.yaml; das native Modul autolinkt aber
// unabhängig davon über expo-modules-autolinking im modules/-Verzeichnis).
// requireOptionalNativeModule liefert null, wenn das native Modul fehlt (z. B.
// Build ohne die iOS-Extension) — daher der null-Guard unten. Android/Web laden
// ohnehin die No-op-Variante live-activity.ts (Metro-Platform-Split).
//
// UNVERIFIZIERT: Dieser Rechner hat kein macOS/Xcode/iPhone (s. AGENTS.md) —
// echte Verifikation (kompiliert der Swift-Code, erscheint die Activity) erst
// bei EAS-Build + TestFlight auf einem iPhone. tsc/lint/jest + prebuild-Mod-
// Phase sind grün.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { SalatiLiveActivityModule } from '../../../modules/salati-live-activity';
import type { NextPrayerResult, TimeFormat } from './next-prayer';
import { formatOngoingCountdownText } from './notifications';
import type { NotificationPrefs } from '@/features/settings/types';

const LiveActivity = requireOptionalNativeModule<SalatiLiveActivityModule>('SalatiLiveActivity');

/**
 * Startet/aktualisiert/beendet die "nächstes Gebet"-Live-Activity. Aufrufer
 * soll dies NUR bei Wechsel des nächsten Gebets neu aufrufen (nicht
 * sekündlich, s. Aufrufstelle in prayer-times-screen.tsx) — max. 5x/Tag.
 */
export async function updatePrayerLiveActivity(
  next: NextPrayerResult,
  prefs: NotificationPrefs,
  locale: string,
  timeFormat: TimeFormat,
): Promise<void> {
  if (Platform.OS !== 'ios' || !LiveActivity) return;

  // Nutzer-Einstellung aus: laufende Activity beenden, nichts Neues starten.
  if (!prefs.liveActivity) {
    try {
      LiveActivity.end();
    } catch {
      // Live Activities können deaktiviert sein — kein Fallback nötig.
    }
    return;
  }

  try {
    if (!LiveActivity.isSupported()) return;
    const text = formatOngoingCountdownText(next, locale, timeFormat);
    // start() beendet intern eine ggf. laufende Activity und startet neu —
    // damit ist der Aufruf idempotent bei jedem Gebetswechsel.
    LiveActivity.start(text.title, text.prayer, text.time);
  } catch {
    // Live Activities können vom Nutzer/System deaktiviert sein — kein Absturz.
  }
}
