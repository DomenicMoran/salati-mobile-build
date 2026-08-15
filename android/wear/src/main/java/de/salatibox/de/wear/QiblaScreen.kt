package de.salatibox.de.wear

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Qibla-Richtung auf der Uhr.
 *
 * Zwei Betriebsarten, weil viele Uhren kein Magnetometer haben:
 * - MIT Kompass: die Nadel zeigt die Richtung relativ zur aktuellen
 *   Blickrichtung, wie im Qibla-Screen der Telefon-App.
 * - OHNE Kompass: die Nadel steht fest auf dem Kaaba-Bearing ab Norden und
 *   ein Hinweis sagt das ausdruecklich - lieber ein ehrlicher statischer Wert
 *   als eine Nadel, die sich nicht mitdreht und dabei so tut als wuerde sie.
 *
 * Der Bildschirm wird nur aufgerufen, wenn das Telefon einen Bearing
 * mitgeschickt hat (siehe [WearPayload.qiblaBearing]); ohne Bearing gibt es
 * gar keinen Einstieg dorthin.
 */
@Composable
fun QiblaScreen(bearingDeg: Double, distanceKm: Double?) {
  val context = LocalContext.current
  val heading = rememberCompassHeading()
  val qiblaAngle = ((bearingDeg - (heading ?: 0.0)) % 360.0 + 360.0) % 360.0
  val aligned = heading != null && angularDistance(qiblaAngle) < 8.0

  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 18.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    Text(
      text = stringResource(R.string.qibla),
      style = MaterialTheme.typography.caption1,
      color = if (aligned) Color(0xFFD4AF37) else Color(0xFFF5F1E6),
      maxLines = 1,
    )
    Canvas(
      modifier = Modifier
        .fillMaxHeight(0.52f)
        .aspectRatio(1f)
        .padding(vertical = 4.dp),
    ) {
      drawCompass(qiblaAngle.toFloat(), northAngle = -(heading ?: 0.0).toFloat(), live = heading != null)
    }
    Text(
      text = when {
        heading == null -> stringResource(R.string.qibla_no_compass)
        aligned -> stringResource(R.string.qibla_aligned)
        else -> distanceLine(context, distanceKm) ?: "${qiblaAngle.roundToInt()}°"
      },
      style = MaterialTheme.typography.caption3,
      color = if (aligned) Color(0xFFD4AF37) else Color(0xFFA8A29E),
      textAlign = TextAlign.Center,
      maxLines = 2,
      modifier = Modifier.fillMaxWidth(0.86f),
    )
  }
}

private fun distanceLine(context: Context, distanceKm: Double?): String? =
  distanceKm?.let { context.getString(R.string.qibla_distance, it.roundToInt()) }

/** Kuerzester Winkelabstand zu 0 Grad (also zur Blickrichtung). */
private fun angularDistance(angleDeg: Double): Double {
  val normalized = ((angleDeg % 360.0) + 360.0) % 360.0
  return if (normalized > 180.0) 360.0 - normalized else normalized
}

/**
 * Aktuelle Blickrichtung in Grad (0 = Norden) oder null, wenn die Uhr keinen
 * Rotationsvektor-Sensor hat. Der Wert ist geglaettet, weil der Rohwert auf
 * dem Handgelenk stark springt.
 */
@Composable
private fun rememberCompassHeading(): Double? {
  val context = LocalContext.current
  val sensorManager = remember {
    context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  }
  val sensor = remember(sensorManager) {
    sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
  }
  var heading by remember { mutableStateOf<Double?>(null) }

  DisposableEffect(sensor) {
    val manager = sensorManager
    if (sensor == null || manager == null) {
      onDispose { }
    } else {
      val rotationMatrix = FloatArray(9)
      val orientation = FloatArray(3)
      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
          SensorManager.getOrientation(rotationMatrix, orientation)
          val raw = (Math.toDegrees(orientation[0].toDouble()) + 360.0) % 360.0
          val previous = heading
          heading = if (previous == null) raw else smooth(previous, raw)
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
      }
      manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
      onDispose { manager.unregisterListener(listener) }
    }
  }

  return heading
}

/** Exponentielle Glaettung ueber die 0/360-Grenze hinweg. */
private fun smooth(previous: Double, raw: Double, factor: Double = 0.2): Double {
  var delta = raw - previous
  if (delta > 180.0) delta -= 360.0
  if (delta < -180.0) delta += 360.0
  return (previous + factor * delta + 360.0) % 360.0
}

private val Ring = Color(0xFF3A3833)
private val Needle = Color(0xFFD4AF37)
private val NorthTick = Color(0xFFF5F1E6)

private fun DrawScope.drawCompass(qiblaAngleDeg: Float, northAngle: Float, live: Boolean) {
  val radius = size.minDimension / 2f
  val center = Offset(size.width / 2f, size.height / 2f)

  drawCircle(color = Ring, radius = radius - 2f, center = center, style = Stroke(width = 3f))

  // Nordmarke - nur sinnvoll, solange sich der Kompass wirklich mitdreht.
  if (live) {
    val outer = pointOn(center, radius - 4f, northAngle)
    val inner = pointOn(center, radius - 18f, northAngle)
    drawLine(color = NorthTick, start = inner, end = outer, strokeWidth = 4f)
  }

  // Qibla-Nadel mit Pfeilspitze.
  val tip = pointOn(center, radius - 10f, qiblaAngleDeg)
  drawLine(color = Needle, start = center, end = tip, strokeWidth = 6f)
  val left = pointOn(center, radius - 34f, qiblaAngleDeg - 11f)
  val right = pointOn(center, radius - 34f, qiblaAngleDeg + 11f)
  drawPath(
    path = Path().apply {
      moveTo(tip.x, tip.y)
      lineTo(left.x, left.y)
      lineTo(right.x, right.y)
      close()
    },
    color = Needle,
  )
  drawCircle(color = Needle, radius = 5f, center = center)
}

/** Punkt auf dem Kreis; 0 Grad = oben (12 Uhr), im Uhrzeigersinn. */
private fun pointOn(center: Offset, radius: Float, angleDeg: Float): Offset {
  val rad = Math.toRadians(angleDeg.toDouble())
  return Offset(
    x = center.x + (radius * sin(rad)).toFloat(),
    y = center.y - (radius * cos(rad)).toFloat(),
  )
}
