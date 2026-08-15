package de.salatibox.de.alarm

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

/**
 * JS-Schnittstelle zum Widget-Aktualisierungs-Alarm (siehe
 * WidgetAlarmReceiver.kt fuer das Warum).
 *
 * JS kennt die Gebetszeiten (Berechnungsmethode, Madhab, Minuten-Korrektur,
 * Hochbreiten-Regel - alles Einstellungen), nativ kennt niemand sie. Deshalb
 * liefert JS fertige Zeitstempel (Millisekunden seit Epoch), und nativ wird
 * daraus nur noch der naechste Alarm gestellt.
 */
class WidgetAlarmModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WidgetUpdateAlarm"

  /**
   * Uebernimmt die Zeitpunkte, zu denen ein Widget neu gezeichnet werden soll
   * (in der Regel die fuenf heutigen und der morgige Fadschr), und stellt den
   * naechsten davon. Bereits vergangene Werte werden beim Stellen uebersprungen.
   */
  @ReactMethod
  fun setUpdateTimes(timestamps: ReadableArray, promise: Promise) {
    try {
      val values = ArrayList<Long>(timestamps.size())
      for (i in 0 until timestamps.size()) {
        val value = timestamps.getDouble(i)
        if (value > 0) values.add(value.toLong())
      }
      WidgetAlarmScheduler.store(reactContext, values)
      WidgetAlarmScheduler.scheduleNext(reactContext)
      promise.resolve(values.size)
    } catch (e: Exception) {
      promise.reject("ERR_WIDGET_ALARM", e)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    try {
      WidgetAlarmScheduler.cancel(reactContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_WIDGET_ALARM", e)
    }
  }
}
