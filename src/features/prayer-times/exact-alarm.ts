import { Linking, NativeModules, Platform } from 'react-native';

// JS-Seite des ExactAlarmModule.kt (android/app/.../alarm/) — siehe dortigen
// Kommentar für den vollen Root-Cause-Kontext (5h-zu-spät-Nutzermeldung,
// expo-notifications faellt ohne SCHEDULE_EXACT_ALARM lautlos auf ungenaues
// Doze-tolerantes Scheduling zurück). Analog zu wear-sync.ts: das native
// Modul ist NICHT autolinked und in dieser Session nie in einem echten Build
// verifiziert worden — jeder Aufruf ist deshalb defensiv (optional chaining
// + try/catch) und liefert im Zweifel `null` ("Status unbekannt") statt zu
// crashen oder einen falschen Status vorzutäuschen.

const NATIVE_MODULE_NAME = 'ExactAlarmStatus';

interface ExactAlarmNativeModule {
  canScheduleExactAlarms?: () => Promise<boolean>;
}

/**
 * true/false = Status vom nativen AlarmManager bekannt (nur Android ab API
 * 31 überhaupt relevant, siehe Kotlin-Seite). `null` auf iOS/Web, wenn das
 * native Modul (noch) nicht registriert ist, oder bei jedem Lesefehler —
 * Aufrufer müssen `null` als "keine Aussage möglich" behandeln, NICHT als
 * "nicht erlaubt" (sonst würde z. B. iOS fälschlich eine Android-Warnung
 * anzeigen).
 */
export async function checkExactAlarmPermission(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  const native = (NativeModules as Record<string, ExactAlarmNativeModule | undefined>)[NATIVE_MODULE_NAME];
  if (!native?.canScheduleExactAlarms) return null;
  try {
    return await native.canScheduleExactAlarms();
  } catch {
    return null;
  }
}

/**
 * Öffnet die System-Seite „Wecker & Erinnerungen". Einen In-App-Dialog gibt es
 * dafür nicht: SCHEDULE_EXACT_ALARM ist eine Sonderberechtigung, die nur über
 * die Systemeinstellungen erteilt werden kann.
 *
 * WARUM DAS ÜBERHAUPT NÖTIG IST — der Kern der „Benachrichtigung kommt eine
 * Stunde zu spät"-Meldung: seit Android 13 wird SCHEDULE_EXACT_ALARM bei einer
 * Neuinstallation NICHT mehr automatisch erteilt
 * (developer.android.com/about/versions/14/changes/schedule-exact-alarms).
 * Ohne sie fällt expo-notifications im nativen Scheduler still von
 * `setExactAndAllowWhileIdle` auf `setAndAllowWhileIdle` zurück
 * (ExpoSchedulingDelegate.kt) — und einen solchen ungenauen Alarm darf Android
 * im Doze-Modus bis zum nächsten Wartungsfenster aufschieben. Genau daraus
 * werden die beobachteten Verspätungen von Minuten bis zu rund einer Stunde.
 *
 * `Linking.sendIntent` gibt es nur auf Android; der Aufruf ist andernorts ein
 * No-op statt eines Fehlers.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() => {});
}
