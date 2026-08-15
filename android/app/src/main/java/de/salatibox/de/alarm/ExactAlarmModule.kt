package de.salatibox.de.alarm

import android.app.AlarmManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Ergaenzt expo-notifications: dessen natives Scheduling (siehe node_modules/
// expo-notifications/android/.../ExpoSchedulingDelegate.kt) prueft bereits
// intern alarmManager.canScheduleExactAlarms() und faellt bei false lautlos
// auf AlarmManagerCompat.setAndAllowWhileIdle() zurueck (Android darf das
// dann per Doze/Batterie-Optimierung um Minuten bis ~1h verzoegern - das war
// der vermutete Root-Cause der 5h-zu-spaet-Meldung). expo-notifications
// exponiert diesen Status selbst NICHT nach JS (nur getPermissionsAsync fuer
// die normale Notification-Berechtigung) - dieses Minimal-Modul schliesst
// nur diese eine Luecke, damit die Settings-UI (settings.tsx) den Nutzer
// gezielt zu den System-Einstellungen leiten kann statt den Hinweis immer
// blind anzuzeigen.
//
// UNGETESTET wie WearSyncModule.kt (siehe dortiger Kommentar): kein echter
// Android-Geraete-/Emulator-Build in dieser Session verifiziert. JS-Seite
// (exact-alarm.ts) behandelt ein fehlendes/undefiniertes natives Modul als
// "Status unbekannt" statt abzustuerzen.
class ExactAlarmModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ExactAlarmStatus"

  /**
   * Vor Android 12 (API 31) gibt es SCHEDULE_EXACT_ALARM/canScheduleExactAlarms()
   * nicht - dort planten exakte Alarme schon immer ohne Sonderberechtigung,
   * daher `true`. Ab API 31 direkt an AlarmManager delegiert.
   */
  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(true)
        return
      }
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      promise.resolve(alarmManager.canScheduleExactAlarms())
    } catch (e: Exception) {
      promise.reject("ERR_EXACT_ALARM_STATUS", e)
    }
  }
}
