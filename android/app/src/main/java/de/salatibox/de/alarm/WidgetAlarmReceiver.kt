package de.salatibox.de.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

import de.salatibox.de.widget.SalatiCountdown
import de.salatibox.de.widget.SalatiPrayer
import de.salatibox.de.widget.SalatiQibla
import de.salatibox.de.widget.SalatiStreak
import de.salatibox.de.widget.SalatiWisdom

/**
 * Zeichnet die Homescreen-Widgets GENAU ZUR GEBETSZEIT neu.
 *
 * Warum es das braucht: `updatePeriodMillis` im appwidget-provider ist die
 * einzige Aktualisierung, die Android von sich aus anstoesst - Minimum 30
 * Minuten, und im Doze-Modus laesst das System den Tick ganz ausfallen, bis das
 * Geraet wieder wach ist. Fuer ein Gebetszeiten-Widget ist das sichtbar falsch:
 * das naechste Gebet steht dann noch minutenlang auf dem bereits vergangenen,
 * und erst das Oeffnen der App (AppState-Handler in app/_layout.tsx) hat es
 * geradegerueckt. Genau dieses Verhalten hat der Nutzer gemeldet.
 *
 * Dieser Receiver haengt an einem Alarm zum naechsten Gebetszeit-Wechsel. Er
 * braucht KEINEN React-Kontext: er schickt nur den ganz normalen
 * APPWIDGET_UPDATE-Broadcast an die eigenen Provider - denselben, den auch der
 * System-Tick schickt. Das Zeichnen uebernimmt danach wie gehabt der
 * Headless-Task (widgets/widget-task-handler.tsx).
 *
 * Nach jedem Ausloesen wird der jeweils naechste Zeitpunkt aus den vom
 * JS-Modul hinterlegten Zeitstempeln neu gestellt (WidgetAlarmScheduler).
 */
class WidgetAlarmReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      // Nach Neustart, Zeit- oder Zeitzonenwechsel sind alle Alarme weg bzw.
      // beziehen sich auf die falsche Uhr - neu stellen und gleich neu zeichnen.
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      ACTION_WIDGET_ALARM -> {
        updateWidgets(context)
        WidgetAlarmScheduler.scheduleNext(context)
      }
    }
  }

  private fun updateWidgets(context: Context) {
    val manager = AppWidgetManager.getInstance(context) ?: return
    for (provider in WIDGET_PROVIDERS) {
      val component = ComponentName(context, provider)
      val ids = manager.getAppWidgetIds(component)
      if (ids.isEmpty()) continue // kein Widget dieses Typs platziert
      val update = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
        .setComponent(component)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      context.sendBroadcast(update)
    }
  }

  companion object {
    const val TAG = "SalatiWidgetAlarm"
    const val ACTION_WIDGET_ALARM = "de.salatibox.de.WIDGET_ALARM"

    /**
     * Die fuenf Widget-Provider als Klassen statt als Namens-Strings: so faellt
     * ein umbenannter oder entfernter Provider beim Kompilieren auf und nicht
     * erst als stumm ausbleibende Aktualisierung auf dem Homescreen.
     * Entsprechen den <receiver>-Eintraegen in AndroidManifest.xml.
     */
    val WIDGET_PROVIDERS = listOf(
      SalatiPrayer::class.java,
      SalatiCountdown::class.java,
      SalatiQibla::class.java,
      SalatiStreak::class.java,
      SalatiWisdom::class.java,
    )
  }
}

/**
 * Stellt den Alarm auf den naechsten hinterlegten Zeitpunkt.
 *
 * Die Zeitstempel kommen aus JS (widgets/updateAlarm.android.ts) und liegen in
 * SharedPreferences, damit sie einen Prozess-Neustart und einen Geraete-Neustart
 * ueberleben - genau die Faelle, in denen kein React-Kontext laeuft.
 */
object WidgetAlarmScheduler {
  private const val PREFS = "salatibox_widget_alarm"
  private const val KEY_TIMES = "times"
  private const val REQUEST_CODE = 4711

  fun store(context: Context, timestamps: List<Long>) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_TIMES, timestamps.sorted().joinToString(","))
      .apply()
  }

  private fun load(context: Context): List<Long> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TIMES, "") ?: ""
    return raw.split(",").mapNotNull { it.trim().toLongOrNull() }.sorted()
  }

  /**
   * Naechsten Zeitpunkt in der Zukunft stellen. Exakt, wenn die App das darf;
   * sonst `setAndAllowWhileIdle` - ungenauer (Android buendelt solche Alarme im
   * Doze-Modus), aber es feuert ueberhaupt, statt an der fehlenden Berechtigung
   * still zu scheitern. Fuer ein Widget ist "ein paar Minuten spaeter" deutlich
   * besser als "erst beim naechsten App-Start".
   */
  fun scheduleNext(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val now = System.currentTimeMillis()
    val next = load(context).firstOrNull { it > now } ?: return

    val intent = Intent(context, WidgetAlarmReceiver::class.java).setAction(WidgetAlarmReceiver.ACTION_WIDGET_ALARM)
    val pending = PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val exactAllowed =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
    try {
      if (exactAllowed) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
      } else {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
      }
    } catch (e: SecurityException) {
      // Berechtigung wurde zwischen Pruefung und Aufruf entzogen.
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
      Log.w(WidgetAlarmReceiver.TAG, "exakter Alarm abgelehnt, ungenau gestellt", e)
    }
  }

  fun cancel(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val intent = Intent(context, WidgetAlarmReceiver::class.java).setAction(WidgetAlarmReceiver.ACTION_WIDGET_ALARM)
    val pending = PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    )
    if (pending != null) {
      alarmManager.cancel(pending)
      pending.cancel()
    }
  }
}
