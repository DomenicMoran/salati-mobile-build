package de.salatibox.de.wear

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.delay

/**
 * Zustand des Uhr-Bildschirms. Quelle ist ausschliesslich der lokale
 * [PrayerDataStore] (SharedPreferences) - die Uhr rechnet Restzeit und
 * naechstes Gebet selbst und funktioniert damit auch ohne Telefonverbindung
 * weiter, solange sie die Zeiten schon einmal empfangen hat.
 */
data class PrayerUiState(
  val payload: WearPayload?,
  val timings: EffectiveTimings?,
  val next: NextPrayer?,
  val nowMillis: Long,
) {
  val hasData: Boolean get() = payload != null && timings != null
}

private fun readState(context: Context): PrayerUiState {
  val payload = PrayerDataStore.load(context)
  val timings = payload?.let { effectiveTimings(it, PrayerDataStore.loadUpdatedAt(context)) }
  return PrayerUiState(
    payload = payload,
    timings = timings,
    next = timings?.let { computeNextPrayer(it) },
    nowMillis = System.currentTimeMillis(),
  )
}

/**
 * Holt den zuletzt vom Telefon abgelegten DataItem-Stand aktiv ab, statt nur
 * auf das Push-Event in [PrayerDataListenerService] zu warten. Noetig, weil
 * DataItems auf der Uhr persistent liegen: wird die Uhr-App erst nach dem
 * letzten Sync installiert/geoeffnet, kommt kein neues DATA_CHANGED mehr -
 * ohne diesen Pull bliebe der Bildschirm dauerhaft leer.
 *
 * Best-effort und ohne Fehler-UI: schlaegt der Abruf fehl (keine Play
 * Services, keine Kopplung), bleibt einfach der lokale Stand stehen.
 */
fun pullLatestFromDataLayer(context: Context, onUpdated: () -> Unit) {
  val appContext = context.applicationContext
  Wearable.getDataClient(appContext).dataItems
    .addOnSuccessListener { buffer ->
      try {
        var changed = false
        for (item in buffer) {
          if (item.uri.path != WearDataLayer.DATA_PATH) continue
          val map = DataMapItem.fromDataItem(item).dataMap
          val json = map.getString(WearDataLayer.KEY_PAYLOAD) ?: continue
          val updatedAt = map.getLong(WearDataLayer.KEY_UPDATED_AT)
            .takeIf { it > 0L } ?: System.currentTimeMillis()
          if (updatedAt > PrayerDataStore.loadUpdatedAt(appContext)) {
            PrayerDataStore.save(appContext, json, updatedAt)
            changed = true
          }
        }
        if (changed) onUpdated()
      } finally {
        buffer.release()
      }
    }
}

/**
 * Liefert den Bildschirm-Zustand und haelt ihn aktuell: Sekundentakt fuer die
 * Restzeit, dazu ein einmaliger Data-Layer-Pull beim Oeffnen.
 */
@Composable
fun rememberPrayerState(): PrayerUiState {
  val context = LocalContext.current
  var state by remember { mutableStateOf(readState(context)) }

  LaunchedEffect(Unit) {
    pullLatestFromDataLayer(context) { state = readState(context) }
  }

  LaunchedEffect(Unit) {
    while (true) {
      // 10 s reichen: angezeigt wird Minutengenauigkeit, und ein
      // Sekundentakt haelt die (akkukritische) Uhr unnoetig wach.
      delay(10_000L)
      state = readState(context)
    }
  }

  return state
}
