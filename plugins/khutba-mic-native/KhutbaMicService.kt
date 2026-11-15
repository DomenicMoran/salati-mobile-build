package de.salatibox.de.khutba

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/** Foreground-Service für Khutba-Live-Erkennung — nur Mikrofon-Halten, kein Adhan. */
class KhutbaMicService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }
    ensureChannel()
    val notification = buildNotification()
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, FOREGROUND_TYPE)
    return START_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val ch = NotificationChannel(CHANNEL_ID, "Khutba live", NotificationManager.IMPORTANCE_LOW)
    ch.description = "Erkennung läuft — Mikrofon für Khutba-Untertitel"
    mgr.createNotificationChannel(ch)
  }

  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Khutba live")
      .setContentText("Spracherkennung aktiv — Audio bleibt auf dem Gerät")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentIntent(pending)
      .setOngoing(true)
      .build()
  }

  companion object {
    const val ACTION_STOP = "de.salatibox.de.khutba.STOP"
    private const val CHANNEL_ID = "khutba_mic"
    private const val NOTIFICATION_ID = 5824
    private val FOREGROUND_TYPE =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      } else {
        0
      }
  }
}