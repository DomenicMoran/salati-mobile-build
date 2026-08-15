package de.salatibox.de.wear

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

// Bruecken-Modul Telefon -> Wear OS, Gegenstueck zu ios-widget.ts (dort:
// ExtensionStorage/App-Group; hier: Wearable Data Layer API). Aufgerufen aus
// src/features/prayer-times/wear-sync.ts ueber NativeModules.WearSync.
//
// UNGETESTET: dieses Modul ist NICHT autolinked und NICHT in einem echten
// Build kompiliert worden (kein Android-SDK-Build in dieser Session
// durchgefuehrt, siehe USER-TODO.md). Registrierung erfolgt manuell in
// MainApplication.kt (siehe Kommentar dort) statt ueber Expo-Autolinking,
// weil hierfuer kein Config-Plugin existiert (anders als beim iOS-Widget mit
// @bacons/apple-targets). Nach jedem `npx expo prebuild -p android --clean`
// wird MainApplication.kt vom Expo-CLI-Template ueberschrieben und die
// Registrierung MUSS von Hand wiederhergestellt werden (dieser Ordner selbst
// bleibt erhalten, da android/app/src/main/java nicht vom Prebuild-Diff
// beruehrt wird, aber die Package-Registrierung in MainApplication.kt schon).
//
// Fehlende Play-Services-Abhaengigkeit: com.google.android.gms:play-services-wearable
// wurde in android/app/build.gradle ergaenzt (siehe Kommentar dort) -- auch
// dieser Block wird bei einem vollen Clean-Prebuild geloescht, da build.gradle
// generiert ist.
class WearSyncModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WearSync"

  /**
   * Nimmt den JSON-String aus wear-sync.ts (WearSyncPayload: locationLabel,
   * today/tomorrow-Timings, timeFormat) entgegen und legt ihn als DataItem im
   * Data Layer ab. `setUrgent()` bittet das System um moeglichst sofortige
   * Zustellung an eine gekoppelte Uhr (Data Layer ist grundsaetzlich
   * best-effort/asynchron, keine Zustellgarantie ohne aktive Bluetooth-/
   * WLAN-Verbindung zur Uhr).
   */
  @ReactMethod
  fun sendPrayerTimes(payloadJson: String) {
    val request = PutDataMapRequest.create(DATA_PATH).apply {
      dataMap.putString(KEY_PAYLOAD, payloadJson)
      dataMap.putLong(KEY_UPDATED_AT, System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()

    Wearable.getDataClient(reactContext).putDataItem(request)
      .addOnFailureListener {
        // Best-effort: keine gekoppelte Uhr oder Data-Layer-Fehler ist kein
        // App-Fehler - JS-Seite ruft dies "fire and forget" auf (siehe
        // wear-sync.ts), es gibt bewusst keinen Reject/Promise-Callback.
      }
  }

  // Wortgleich mit WearDataLayer in
  // android/wear/src/main/java/de/salatibox/de/wear/PrayerData.kt (Uhrseite)
  // zu halten - kein gemeinsames Gradle-Modul zwischen android/app und
  // android/wear vorhanden, siehe Kommentar dort.
  companion object {
    const val DATA_PATH = "/salati/prayer-times"
    const val KEY_PAYLOAD = "payload"
    const val KEY_UPDATED_AT = "updatedAt"
  }
}
