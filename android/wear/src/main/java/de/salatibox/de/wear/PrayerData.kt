package de.salatibox.de.wear

import android.content.Context
import android.text.format.DateFormat
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// Spiegelt WearSyncPayload aus src/features/prayer-times/wear-sync.ts (JS-
// Seite) und Timings aus src/features/prayer-times/api.ts - bei Aenderungen
// dort (neues Feld, umbenannt) MUSS dieser Parser synchron gehalten werden.
// Analoges Vorgehen wie targets/salati-widget/SalatiPrayerWidget.swift
// (dortiger Kommentar): die Tile laeuft als eigener Prozess auf der Uhr und
// berechnet "naechstes Gebet" bei jedem Tile-Request selbst aus den zuletzt
// per Data Layer empfangenen Roh-Zeiten - nicht aus einem vorberechneten
// Einzelwert, damit die Tile auch dann noch stimmt, wenn das Telefon laenger
// nicht synchronisiert hat.

val PRAYER_ORDER = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
private const val PREFS_NAME = "salati_wear_prefs"
private const val KEY_PAYLOAD = "payload_json"
private const val KEY_UPDATED_AT = "payload_updated_at"

/**
 * Data-Layer-Pfad/Keys - MUSS wortgleich mit den Konstanten in
 * android/app/src/main/java/de/salatibox/de/wear/WearSyncModule.kt
 * (Telefonseite) bleiben. Kann NICHT als gemeinsame Kotlin-Datei geteilt
 * werden, da android/app (Telefon-APK) und android/wear (Uhr-APK) zwei
 * unabhaengige Gradle-Module ohne gegenseitige Dependency sind - ein
 * drittes :shared-Modul waere die saubere Loesung, wurde in diesem Scaffold
 * aber bewusst nicht angelegt (Scope, siehe USER-TODO.md).
 */
object WearDataLayer {
  const val DATA_PATH = "/salati/prayer-times"
  const val KEY_PAYLOAD = "payload"
  const val KEY_UPDATED_AT = "updatedAt"
}

data class Timings(
  val fajr: String,
  val dhuhr: String,
  val asr: String,
  val maghrib: String,
  val isha: String,
) {
  fun time(name: String): String? = when (name) {
    "Fajr" -> fajr
    "Dhuhr" -> dhuhr
    "Asr" -> asr
    "Maghrib" -> maghrib
    "Isha" -> isha
    else -> null
  }

  companion object {
    fun fromJson(o: JSONObject) = Timings(
      fajr = o.getString("Fajr"),
      dhuhr = o.getString("Dhuhr"),
      asr = o.getString("Asr"),
      maghrib = o.getString("Maghrib"),
      isha = o.getString("Isha"),
    )
  }
}

data class WearPayload(
  val locationLabel: String,
  val today: Timings,
  val tomorrow: Timings,
  val timeFormat: String,
  /** Kaaba-Bearing in Grad (0 = Norden) bzw. Entfernung in km; null, wenn die
   * Telefon-App sie (noch) nicht mitschickt - dann blendet die Uhr den
   * Qibla-Bildschirm aus, statt eine geratene Richtung anzuzeigen. */
  val qiblaBearing: Double? = null,
  val qiblaDistanceKm: Double? = null,
) {
  companion object {
    fun fromJson(json: String): WearPayload? = try {
      val o = JSONObject(json)
      WearPayload(
        locationLabel = o.optString("locationLabel", "Salati"),
        today = Timings.fromJson(o.getJSONObject("today")),
        tomorrow = Timings.fromJson(o.getJSONObject("tomorrow")),
        timeFormat = o.optString("timeFormat", "24h"),
        qiblaBearing = o.optDoubleOrNull("qiblaBearing"),
        qiblaDistanceKm = o.optDoubleOrNull("qiblaDistanceKm"),
      )
    } catch (e: Exception) {
      null
    }
  }
}

private fun JSONObject.optDoubleOrNull(key: String): Double? {
  if (!has(key) || isNull(key)) return null
  val value = optDouble(key, Double.NaN)
  return if (value.isNaN()) null else value
}

data class NextPrayer(val name: String, val timestampMillis: Long)

/** Parst "HH:MM" auf den Kalendertag von `reference` - Portierung von parseTimeOn() aus next-prayer.ts. */
private fun parseTimeOn(hhmm: String, reference: Calendar): Calendar? {
  val parts = hhmm.split(":")
  if (parts.size < 2) return null
  val h = parts[0].toIntOrNull() ?: return null
  val m = parts[1].toIntOrNull() ?: return null
  val cal = reference.clone() as Calendar
  cal.set(Calendar.HOUR_OF_DAY, h)
  cal.set(Calendar.MINUTE, m)
  cal.set(Calendar.SECOND, 0)
  cal.set(Calendar.MILLISECOND, 0)
  return cal
}

/** Portierung von nextPrayer() aus next-prayer.ts: erstes noch nicht vergangenes
 * Gebet von heute, sonst Fajr von morgen. */
fun computeNextPrayer(payload: WearPayload, now: Calendar = Calendar.getInstance()): NextPrayer? {
  for (name in PRAYER_ORDER) {
    val hhmm = payload.today.time(name) ?: continue
    val ts = parseTimeOn(hhmm, now) ?: continue
    if (ts.timeInMillis > now.timeInMillis) {
      return NextPrayer(name, ts.timeInMillis)
    }
  }
  val tomorrow = now.clone() as Calendar
  tomorrow.add(Calendar.DAY_OF_YEAR, 1)
  val fajrTomorrow = parseTimeOn(payload.tomorrow.fajr, tomorrow) ?: return null
  return NextPrayer("Fajr", fajrTomorrow.timeInMillis)
}

/** Zwischenspeicher zwischen PrayerDataListenerService (Schreiber, empfaengt
 * vom Telefon) und PrayerTileService (Leser, rendert bei jedem Tile-Request) -
 * ein WearableListenerService haelt keinen Prozess dauerhaft am Leben, daher
 * kein In-Memory-Cache moeglich. */
object PrayerDataStore {
  /**
   * @param updatedAtMillis Sende-Zeitpunkt laut Telefon (DataMap-Feld
   *   [WearDataLayer.KEY_UPDATED_AT]). Wird gebraucht, weil der Payload selbst
   *   KEIN Datum enthaelt: nur mit diesem Zeitstempel laesst sich spaeter
   *   entscheiden, ob `today` noch "heute" meint (siehe [effectiveTimings]) -
   *   die Uhr soll offline weiterlaufen, ohne stumm falsche Zeiten zu zeigen.
   */
  fun save(context: Context, payloadJson: String, updatedAtMillis: Long) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PAYLOAD, payloadJson)
      .putLong(KEY_UPDATED_AT, updatedAtMillis)
      .apply()
  }

  fun load(context: Context): WearPayload? {
    val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_PAYLOAD, null) ?: return null
    return WearPayload.fromJson(raw)
  }

  fun loadUpdatedAt(context: Context): Long =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getLong(KEY_UPDATED_AT, 0L)
}

/**
 * Auf den aktuellen Kalendertag umgerechnete Zeiten. `staleDays` = Anzahl
 * Tage, die der zuletzt empfangene Payload alt ist (0 = frisch).
 */
data class EffectiveTimings(val today: Timings, val tomorrow: Timings, val staleDays: Int)

/**
 * Offline-Absicherung: der Payload enthaelt nur `today`/`tomorrow` ohne Datum.
 * Ist er einen Tag alt, ist sein `tomorrow` der heutige Tag - die Uhr zeigt
 * dann weiter plausible Zeiten, statt am Telefon zu haengen. Ab zwei Tagen
 * gibt es keine passenden Rohdaten mehr; dann bleibt die letzte bekannte
 * Tagesreihe stehen und die UI markiert sie ueber `staleDays` sichtbar als
 * veraltet (lieber sichtbar alt als stumm falsch).
 */
fun effectiveTimings(
  payload: WearPayload,
  updatedAtMillis: Long,
  now: Calendar = Calendar.getInstance(),
): EffectiveTimings {
  if (updatedAtMillis <= 0L) return EffectiveTimings(payload.today, payload.tomorrow, 0)
  val then = Calendar.getInstance().apply { timeInMillis = updatedAtMillis }
  val days = calendarDaysBetween(then, now)
  return when {
    days <= 0 -> EffectiveTimings(payload.today, payload.tomorrow, 0)
    days == 1 -> EffectiveTimings(payload.tomorrow, payload.tomorrow, 1)
    else -> EffectiveTimings(payload.tomorrow, payload.tomorrow, days)
  }
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten (Zeitzone der Uhr, ohne Uhrzeit-Anteil). */
private fun calendarDaysBetween(from: Calendar, to: Calendar): Int {
  val a = startOfDay(from)
  val b = startOfDay(to)
  return ((b.timeInMillis - a.timeInMillis) / 86_400_000L).toInt()
}

private fun startOfDay(cal: Calendar): Calendar = (cal.clone() as Calendar).apply {
  set(Calendar.HOUR_OF_DAY, 0)
  set(Calendar.MINUTE, 0)
  set(Calendar.SECOND, 0)
  set(Calendar.MILLISECOND, 0)
}

/**
 * Wie [computeNextPrayer], aber auf bereits tagesrichtig gedrehten Zeiten
 * ([effectiveTimings]) - fuer App-Screen, Kachel und Komplikation gemeinsam.
 */
fun computeNextPrayer(
  timings: EffectiveTimings,
  now: Calendar = Calendar.getInstance(),
): NextPrayer? {
  for (name in PRAYER_ORDER) {
    val hhmm = timings.today.time(name) ?: continue
    val ts = parseTimeOn(hhmm, now) ?: continue
    if (ts.timeInMillis > now.timeInMillis) return NextPrayer(name, ts.timeInMillis)
  }
  val tomorrow = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) }
  val fajrTomorrow = parseTimeOn(timings.tomorrow.fajr, tomorrow) ?: return null
  return NextPrayer("Fajr", fajrTomorrow.timeInMillis)
}

/** Startzeitpunkt eines Gebets am heutigen Tag (fuer die Tagesliste im App-Screen). */
fun timestampToday(timings: Timings, name: String, now: Calendar = Calendar.getInstance()): Long? {
  val hhmm = timings.time(name) ?: return null
  return parseTimeOn(hhmm, now)?.timeInMillis
}

/** String-Ressource des lokalisierten Gebetsnamens (14 Sprachen, res/values-xx/strings.xml). */
fun prayerNameRes(name: String): Int = when (name) {
  "Fajr" -> R.string.prayer_fajr
  "Dhuhr" -> R.string.prayer_dhuhr
  "Asr" -> R.string.prayer_asr
  "Maghrib" -> R.string.prayer_maghrib
  "Isha" -> R.string.prayer_isha
  else -> R.string.app_name
}

/**
 * Uhrzeit-Formatierung. Bevorzugt die am Telefon eingestellte 12h/24h-Praeferenz
 * (`timeFormat` aus dem Payload), damit Uhr und Telefon dasselbe Format zeigen;
 * ohne Payload faellt sie auf die Systemeinstellung der Uhr zurueck.
 */
fun formatClock(context: Context, timestampMillis: Long, timeFormat: String?): String {
  val is24h = when (timeFormat) {
    "12h" -> false
    "24h" -> true
    else -> DateFormat.is24HourFormat(context)
  }
  val pattern = if (is24h) "HH:mm" else "h:mm a"
  return SimpleDateFormat(pattern, Locale.getDefault()).format(Date(timestampMillis))
}

/** "in 2 Std 14 Min" / "in 7 Min" / "jetzt" - lokalisiert ueber String-Ressourcen. */
fun formatRemaining(context: Context, deltaMillis: Long): String {
  // Aufrunden statt abschneiden: 90 Sekunden Rest sollen "in 2 Min" heissen und
  // erst bei tatsaechlich erreichter Gebetszeit auf "jetzt" springen.
  val totalMinutes = ((deltaMillis + 59_999L) / 60_000L).toInt()
  if (totalMinutes <= 0) return context.getString(R.string.time_now)
  if (totalMinutes < 60) return context.getString(R.string.in_minutes, totalMinutes)
  return context.getString(R.string.in_hours_minutes, totalMinutes / 60, totalMinutes % 60)
}
