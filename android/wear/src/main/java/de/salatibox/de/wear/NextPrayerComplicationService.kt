package de.salatibox.de.wear

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.wear.watchface.complications.datasource.ComplicationRequest

/**
 * Zifferblatt-Komplikation "Naechstes Gebet": Gebetsname + Uhrzeit.
 *
 * Dritter Konsument derselben Datenkette wie [MainActivity] und
 * [PrayerTileService] - kein eigener Rechenweg, alles kommt aus PrayerData.kt.
 * Der Dienst laeuft nur kurz beim Update-Request; Zustand liegt im
 * [PrayerDataStore], damit auch ohne Telefonverbindung etwas Sinnvolles
 * angezeigt wird.
 */
class NextPrayerComplicationService : ComplicationDataSourceService() {

  override fun getPreviewData(type: ComplicationType): ComplicationData? =
    // Vorschau im Komplikations-Auswahldialog: fixe Beispielwerte, weil dort
    // noch keine echten Daten geladen sein muessen.
    build(type, getString(R.string.prayer_dhuhr), "13:15", getString(R.string.tile_label))

  override fun onComplicationRequest(
    request: ComplicationRequest,
    listener: ComplicationRequestListener,
  ) {
    val payload = PrayerDataStore.load(this)
    val timings = payload?.let { effectiveTimings(it, PrayerDataStore.loadUpdatedAt(this)) }
    val next = timings?.let { computeNextPrayer(it) }

    if (next == null) {
      // Kein "leerer" Platzhalter-Text: null bedeutet fuer das Zifferblatt
      // "diese Quelle hat gerade nichts", es zeigt dann seinen eigenen
      // Leerzustand statt eines irrefuehrenden Strichs.
      listener.onComplicationData(null)
      return
    }

    val name = getString(prayerNameRes(next.name))
    val clock = formatClock(this, next.timestampMillis, payload.timeFormat)
    val remaining = formatRemaining(this, next.timestampMillis - System.currentTimeMillis())
    listener.onComplicationData(build(request.complicationType, name, clock, remaining))
  }

  private fun build(
    type: ComplicationType,
    prayerName: String,
    clock: String,
    remaining: String,
  ): ComplicationData? {
    val description = PlainComplicationText.Builder("$prayerName $clock").build()
    return when (type) {
      ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
        text = PlainComplicationText.Builder(clock).build(),
        contentDescription = description,
      )
        .setTitle(PlainComplicationText.Builder(prayerName).build())
        .setTapAction(openAppIntent())
        .build()

      ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
        text = PlainComplicationText.Builder("$prayerName $clock").build(),
        contentDescription = description,
      )
        .setTitle(PlainComplicationText.Builder(remaining).build())
        .setTapAction(openAppIntent())
        .build()

      // Andere Typen (RANGED_VALUE, ICON, ...) sind im Manifest nicht als
      // SUPPORTED_TYPES deklariert; das System fragt sie deshalb nicht an.
      else -> null
    }
  }

  private fun openAppIntent(): PendingIntent = PendingIntent.getActivity(
    this,
    0,
    Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  companion object {
    /** Vom [PrayerDataListenerService] aufgerufen, sobald neue Zeiten ankommen. */
    fun requestUpdate(context: android.content.Context) {
      ComplicationDataSourceUpdateRequester
        .create(
          context,
          ComponentName(context, NextPrayerComplicationService::class.java),
        )
        .requestUpdateAll()
    }
  }
}
