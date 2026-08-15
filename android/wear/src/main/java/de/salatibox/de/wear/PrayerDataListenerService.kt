package de.salatibox.de.wear

import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

// Empfangs-Gegenstueck zu WearSyncModule.kt (Telefonseite, android/app/.../wear/).
// UNGETESTET (siehe android/wear/build.gradle Kopfkommentar) - insbesondere
// die Intent-Filter-Zustellung eines DATA_CHANGED-Events an einen
// WearableListenerService statt an eine registrierte DataClient.Listener-
// Instanz wurde nicht an einem echten Geraet verifiziert.
class PrayerDataListenerService : WearableListenerService() {

  override fun onDataChanged(dataEvents: DataEventBuffer) {
    for (event in dataEvents) {
      if (event.type != DataEvent.TYPE_CHANGED) continue
      if (event.dataItem.uri.path != WearDataLayer.DATA_PATH) continue

      val map = DataMapItem.fromDataItem(event.dataItem).dataMap
      val payloadJson = map.getString(WearDataLayer.KEY_PAYLOAD) ?: continue
      // Zeitstempel des Telefons; fehlt er (aeltere Telefon-App), zaehlt die
      // Empfangszeit der Uhr - beides taugt gleich gut zur Tages-Zuordnung
      // in effectiveTimings().
      val updatedAt = map.getLong(WearDataLayer.KEY_UPDATED_AT).takeIf { it > 0L }
        ?: System.currentTimeMillis()
      PrayerDataStore.save(applicationContext, payloadJson, updatedAt)

      // Stoesst einen sofortigen Tile-Refresh an, statt auf den naechsten
      // vom System getriggerten onTileRequest()-Aufruf zu warten (Freshness-
      // Interval allein reicht sonst erst nach mehreren Minuten Verzoegerung).
      TileService.getUpdater(applicationContext)
        .requestUpdate(PrayerTileService::class.java)

      // Dasselbe fuer die Zifferblatt-Komplikation - ohne diesen Anstoss
      // wuerde sie erst beim naechsten systemgesteuerten Update-Zyklus
      // (UPDATE_PERIOD_SECONDS, siehe Manifest) frische Zeiten zeigen.
      NextPrayerComplicationService.requestUpdate(applicationContext)
    }
    dataEvents.release()
  }
}
