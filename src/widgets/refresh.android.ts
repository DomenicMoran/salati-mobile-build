// Android-Implementierung von refreshAllWidgets(): zeichnet ALLE platzierten
// Homescreen-Widgets sofort mit echten Daten + aktueller Konfiguration neu.
//
// Wird aufgerufen, wenn sich global etwas ändert, das die Widgets betrifft —
// v. a. das Widget-Farbthema in den Einstellungen (src/app/settings.tsx).
// Ohne diesen Push würde eine Theme-Änderung erst beim nächsten
// updatePeriodMillis-Tick (bis zu 30 Min bzw. 6 h) sichtbar — für den Nutzer
// wirkt das, als ob "die Themes nichts ändern".
//
// requestWidgetUpdate ruft den renderWidget-Callback pro platziertem Widget
// dieses Namens mit dessen WidgetInfo (inkl. widgetId) auf; renderWidgetForInfo
// löst darüber die pro-Instanz gespeicherte Konfiguration auf.
import { requestWidgetUpdate, type WidgetInfo } from 'react-native-android-widget';

import { renderWidgetForInfo } from './widget-task-handler';

// Muss den in AndroidManifest.xml registrierten Provider-Namen entsprechen
// (die 5 <receiver>-Einträge). renderWidgetForInfo mappt evtl. "Light"-Namen
// intern per baseWidgetName ab, daher genügen die Basis-Namen.
const WIDGET_NAMES = [
  'SalatiPrayer',
  'SalatiCountdown',
  'SalatiQibla',
  'SalatiStreak',
  'SalatiWisdom',
] as const;

export async function refreshAllWidgets(): Promise<void> {
  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info: WidgetInfo) =>
          renderWidgetForInfo(info.widgetName, info.widgetId, { width: info.width, height: info.height }),
        // Kein platziertes Widget dieses Namens → nichts tun (kein Fehler).
        widgetNotFound: () => {},
      }).catch(() => {
        // Einzelnes Widget-Update darf den Rest nicht abbrechen.
      }),
    ),
  );
}
