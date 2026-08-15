package expo.modules.salatimodeldownload

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Echter Android-Hintergrund-Download des KI-Modells ueber den System-
// DownloadManager: laeuft im System-Prozess weiter, auch wenn die App im
// Hintergrund oder geschlossen ist, zeigt eine System-Notification, kann
// Netzwechsel/Resume und schreibt in das app-eigene External-Files-
// Verzeichnis (kein Permission noetig, reiner Dateipfad fuer llama.rn).
//
// Warum nicht @kesha-antonov/react-native-background-downloader: dessen
// Android-14+-Pfad (User-Initiated-Job) schrieb auf echten Geraeten 0 Bytes
// (am Emulator reproduziert: kein Job, keine Bytes, keine Logs). Der
// System-DownloadManager ist der OS-Standard fuer genau diesen Fall.
class SalatiModelDownloadModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val downloadManager: DownloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  private fun relPath(fileName: String): String = "ki-modell/$fileName"

  private fun modelFile(fileName: String): File =
    File(context.getExternalFilesDir(null), relPath(fileName))

  override fun definition() = ModuleDefinition {
    Name("SalatiModelDownload")

    // External-Files verfuegbar? (praktisch immer true; false nur ohne externen Speicher)
    Function("isAvailable") {
      context.getExternalFilesDir(null) != null
    }

    // Reiner Zielpfad (kein file://) — von model.ts + llm.ts genutzt.
    Function("getModelPath") { fileName: String ->
      modelFile(fileName).absolutePath
    }

    Function("exists") { fileName: String ->
      val f = modelFile(fileName)
      f.exists() && f.length() > 0L
    }

    Function("deleteModel") { fileName: String ->
      val f = modelFile(fileName)
      if (f.exists()) f.delete() else true
    }

    // Startet den Hintergrund-Download. Gibt die DownloadManager-ID zurueck
    // (in JS als Number). Loescht eine evtl. unvollstaendige Vorgaenger-Datei.
    AsyncFunction("start") { url: String, fileName: String ->
      val existing = modelFile(fileName)
      if (existing.exists()) existing.delete()
      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle("Salati KI-Modell")
        .setDescription("Sprachmodell fuer die Salati KI wird geladen")
        .setDestinationInExternalFilesDir(context, null, relPath(fileName))
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(true)
      downloadManager.enqueue(request).toDouble()
    }

    // Status/Fortschritt einer laufenden ID.
    // status: 0=unbekannt/entfernt, 1=pending, 2=running, 4=paused, 8=erfolg, 16=fehler
    Function("getStatus") { id: Double ->
      val query = DownloadManager.Query().setFilterById(id.toLong())
      val cursor = downloadManager.query(query)
      val result = HashMap<String, Any>()
      if (cursor != null && cursor.moveToFirst()) {
        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
        val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
        val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
        result["status"] = status
        result["bytesDownloaded"] = downloaded.toDouble()
        result["bytesTotal"] = total.toDouble()
        result["reason"] = reason
      } else {
        result["status"] = 0
        result["bytesDownloaded"] = 0.0
        result["bytesTotal"] = 0.0
        result["reason"] = 0
      }
      cursor?.close()
      result
    }

    Function("cancel") { id: Double ->
      downloadManager.remove(id.toLong())
    }
  }
}
