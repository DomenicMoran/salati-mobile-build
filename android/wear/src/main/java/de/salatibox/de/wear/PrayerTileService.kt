package de.salatibox.de.wear

import androidx.wear.tiles.ActionBuilders
import androidx.wear.tiles.ColorBuilders.argb
import androidx.wear.tiles.ModifiersBuilders
import androidx.wear.tiles.DimensionBuilders.dp
import androidx.wear.tiles.LayoutElementBuilders.Column
import androidx.wear.tiles.LayoutElementBuilders.Layout
import androidx.wear.tiles.RequestBuilders.ResourcesRequest
import androidx.wear.tiles.RequestBuilders.TileRequest
// androidx.wear.tiles:tiles:1.4.0 definiert TileService.onTileResourcesRequest()
// selbst schon gegen den neueren androidx.wear.protolayout.ResourceBuilders.Resources
// (per javap gegen die aufgeloeste 1.4.0-AAR verifiziert, 2026-07-20) - die
// tiles.ResourceBuilders.Resources-Variante passt hier NICHT als Override-
// Rueckgabetyp, obwohl der Kopfkommentar in wear/build.gradle bewusst gegen
// die protolayout-Artefakte entschieden hatte (tiles:1.4.0 zieht sie intern
// trotzdem als Abhaengigkeit).
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.TileService
import androidx.wear.tiles.TimelineBuilders.Timeline
import androidx.wear.tiles.TimelineBuilders.TimelineEntry
import androidx.wear.tiles.material.Text
import androidx.wear.tiles.material.Typography
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

// "Naechstes Gebet"-Tile - Uhr-Pendant zu targets/salati-widget/SalatiPrayerWidget.swift
// (iOS-Homescreen-Widget) und src/widgets/PrayerWidget.tsx (Android-Telefon-
// Homescreen-Widget). Liest NIE den JS-Prozess der Telefon-App direkt (auf
// der Uhr laeuft ohnehin kein React-Native-JS) - Datenquelle ist
// ausschliesslich PrayerDataStore (SharedPreferences), befuellt von
// PrayerDataListenerService.kt ueber die Wearable Data Layer API.
//
// Am Wear-OS-Emulator (AVD salati_wear, API 34, 384x384 rund) verifiziert:
// die Kachel rendert Ort, naechstes Gebet, Uhrzeit und Restzeit und oeffnet
// per Tap MainActivity (siehe docs/audit-2026-07-27/WEAR-OS-AUSBAU.md).
class PrayerTileService : TileService() {

  override fun onTileRequest(requestParams: TileRequest): ListenableFuture<Tile> {
    val payload = PrayerDataStore.load(applicationContext)
    // Dieselbe Rechenkette wie im App-Screen (MainActivity) und in der
    // Komplikation: Rohzeiten -> tagesrichtige Zeiten -> naechstes Gebet.
    val timings = payload?.let { effectiveTimings(it, PrayerDataStore.loadUpdatedAt(applicationContext)) }
    val next = timings?.let { computeNextPrayer(it) }

    val layout = buildLayout(payload, timings, next)

    val tile = Tile.Builder()
      .setResourcesVersion(RESOURCES_VERSION)
      // Kurzes Freshness-Interval: die Tile zeigt eine Restzeit-Uhrzeit
      // (kein laufender Sekunden-Countdown, WidgetKit-Timeline-Verhalten wie
      // im iOS-Widget gibt es bei Tiles nicht) - ein periodisches Reload alle
      // Minute haelt "in Xh Ym" halbwegs aktuell, ohne den Akku zu belasten.
      .setFreshnessIntervalMillis(60_000L)
      .setTimeline(
        Timeline.Builder()
          .addTimelineEntry(
            TimelineEntry.Builder().setLayout(Layout.Builder().setRoot(layout).build()).build(),
          )
          .build(),
      )
      .build()

    return Futures.immediateFuture(tile)
  }

  override fun onTileResourcesRequest(requestParams: ResourcesRequest): ListenableFuture<Resources> =
    Futures.immediateFuture(Resources.Builder().setVersion(RESOURCES_VERSION).build())

  private fun buildLayout(payload: WearPayload?, timings: EffectiveTimings?, next: NextPrayer?) =
    Column.Builder()
      .addContent(
        Text.Builder(this, payload?.locationLabel ?: getString(R.string.app_name))
          .setTypography(Typography.TYPOGRAPHY_CAPTION1)
          .setColor(argb(COLOR_MUTED))
          .setMaxLines(1)
          .build(),
      )
      .addContent(
        Text.Builder(this, next?.let { getString(prayerNameRes(it.name)) } ?: getString(R.string.next_prayer))
          .setTypography(Typography.TYPOGRAPHY_TITLE2)
          .setColor(argb(COLOR_ACCENT))
          .setMaxLines(1)
          .build(),
      )
      .addContent(
        Text.Builder(
          this,
          next?.let { formatClock(this, it.timestampMillis, payload?.timeFormat) }
            ?: getString(R.string.no_data_title),
        )
          .setTypography(Typography.TYPOGRAPHY_BODY1)
          .setColor(argb(COLOR_TEXT))
          .setMaxLines(1)
          .build(),
      )
      .addContent(
        Text.Builder(this, subLine(timings, next))
          .setTypography(Typography.TYPOGRAPHY_CAPTION2)
          .setColor(argb(if (timings != null && timings.staleDays > 0) COLOR_WARN else COLOR_MUTED))
          .setMaxLines(2)
          .build(),
      )
      .setWidth(dp(160f))
      // Tap auf die Kachel oeffnet den vollen App-Bildschirm mit der
      // Tagesliste - die Kachel selbst hat dafuer keinen Platz.
      .setModifiers(
        ModifiersBuilders.Modifiers.Builder()
          .setClickable(
            ModifiersBuilders.Clickable.Builder()
              .setId("open_app")
              .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                  .setAndroidActivity(
                    ActionBuilders.AndroidActivity.Builder()
                      .setPackageName(packageName)
                      .setClassName(MainActivity::class.java.name)
                      .build(),
                  )
                  .build(),
              )
              .build(),
          )
          .build(),
      )
      .build()

  /** Restzeit; bei veralteten Daten stattdessen der Veraltet-Hinweis, bei fehlenden Daten der Telefon-Hinweis. */
  private fun subLine(timings: EffectiveTimings?, next: NextPrayer?): String = when {
    timings == null || next == null -> getString(R.string.no_data_body)
    timings.staleDays > 0 -> getString(R.string.stale_data)
    else -> formatRemaining(this, next.timestampMillis - System.currentTimeMillis())
  }

  companion object {
    private const val RESOURCES_VERSION = "1"
    private const val COLOR_ACCENT = 0xFFD4AF37.toInt() // Brand.gold
    private const val COLOR_TEXT = 0xFFF5F1E6.toInt()
    private const val COLOR_MUTED = 0xFFA8A29E.toInt()
    private const val COLOR_WARN = 0xFFE8A33D.toInt()
  }
}
