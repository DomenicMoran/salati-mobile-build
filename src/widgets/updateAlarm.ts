// Plattform-neutraler No-Op — die echte Umsetzung steht in updateAlarm.android.ts
// (Metro löst die Plattform-Endung auf). Homescreen-Widgets gibt es nur auf
// Android; iOS aktualisiert seine Widgets über WidgetKit-Timelines
// (features/prayer-times/ios-widget.ts), Web hat gar keine.
import type { Timings } from '@/features/prayer-times/api';

export { widgetUpdateTimestamps } from './updateAlarmTimes';

export async function scheduleWidgetUpdateAlarms(_today: Timings, _tomorrow: Timings): Promise<void> {
  // Nichts zu tun.
}
