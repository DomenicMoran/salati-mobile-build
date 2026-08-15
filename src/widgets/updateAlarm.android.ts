// Android: exakter Alarm zur nächsten Gebetszeit, der die Homescreen-Widgets
// neu zeichnen lässt.
//
// Ohne ihn hing die Aktualisierung allein an `updatePeriodMillis` (30 Min
// Minimum, im Doze-Modus ganz ausgesetzt) plus dem AppState-Handler beim
// Öffnen der App — das Widget zeigte nach einer Gebetszeit minutenlang noch
// das bereits vergangene Gebet, und erst der App-Start rückte es gerade
// (Nutzer-Meldung 2026-07-31).
//
// Gegenstück nativ: android/app/src/main/java/de/salatibox/de/alarm/
// WidgetAlarmReceiver.kt + WidgetAlarmModule.kt.
import { NativeModules } from 'react-native';

import type { Timings } from '@/features/prayer-times/api';
import { widgetUpdateTimestamps } from './updateAlarmTimes';

export { widgetUpdateTimestamps } from './updateAlarmTimes';

interface WidgetUpdateAlarmModule {
  setUpdateTimes(timestamps: number[]): Promise<number>;
  cancel(): Promise<boolean>;
}

/** Fehlt in Entwickler-Builds ohne den nativen Teil (z. B. Expo Go) — dann
 *  bleibt es beim bisherigen 30-Minuten-Tick, statt abzustürzen. */
const nativeModule = (NativeModules as { WidgetUpdateAlarm?: WidgetUpdateAlarmModule }).WidgetUpdateAlarm;

export async function scheduleWidgetUpdateAlarms(today: Timings, tomorrow: Timings): Promise<void> {
  if (!nativeModule) return;
  const times = widgetUpdateTimestamps(today, tomorrow);
  if (times.length === 0) return;
  try {
    await nativeModule.setUpdateTimes(times);
  } catch {
    // Ein nicht gestellter Alarm darf nichts abbrechen — die Widgets
    // aktualisieren sich dann weiterhin über den System-Tick.
  }
}
