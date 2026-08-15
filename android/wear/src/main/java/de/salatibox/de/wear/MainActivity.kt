package de.salatibox.de.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController

/**
 * Vollwertiger App-Bildschirm der Uhr (Compose for Wear OS) - Ergaenzung zur
 * Kachel [PrayerTileService], die aus Platzgruenden nur das naechste Gebet
 * zeigt. Beide lesen denselben lokalen Stand ([PrayerDataStore]) und rechnen
 * mit denselben Funktionen aus PrayerData.kt, damit Kachel, Bildschirm und
 * Komplikation nie auseinanderlaufen.
 */
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent { SalatiWearApp() }
  }
}

// Markenfarben wie im Telefon-Theme (Brand.gold) und in der Kachel.
private val Gold = Color(0xFFD4AF37)
private val Cream = Color(0xFFF5F1E6)
private val Muted = Color(0xFFA8A29E)
private val Warn = Color(0xFFE8A33D)
private val Surface = Color(0xFF1C1B18)

private val SalatiColors = Colors(
  primary = Gold,
  onPrimary = Color.Black,
  secondary = Gold,
  onSecondary = Color.Black,
  background = Color.Black,
  onBackground = Cream,
  surface = Surface,
  onSurface = Cream,
  onSurfaceVariant = Muted,
)

private const val ROUTE_PRAYERS = "prayers"
private const val ROUTE_QIBLA = "qibla"

@Composable
fun SalatiWearApp() {
  MaterialTheme(colors = SalatiColors) {
    val navController = rememberSwipeDismissableNavController()
    SwipeDismissableNavHost(navController = navController, startDestination = ROUTE_PRAYERS) {
      composable(ROUTE_PRAYERS) {
        PrayerTimesScreen(onOpenQibla = { navController.navigate(ROUTE_QIBLA) })
      }
      composable(ROUTE_QIBLA) { QiblaRoute() }
    }
  }
}

/** Qibla nur mit Bearing vom Telefon - sonst gibt es hier gar keinen Eintrag. */
@Composable
private fun QiblaRoute() {
  val state = rememberPrayerState()
  val bearing = state.payload?.qiblaBearing ?: return
  QiblaScreen(bearingDeg = bearing, distanceKm = state.payload.qiblaDistanceKm)
}

@Composable
private fun PrayerTimesScreen(onOpenQibla: () -> Unit) {
  val state = rememberPrayerState()
  val listState = rememberScalingLazyListState()

  Scaffold(
    timeText = { TimeText() },
    vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
    positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
  ) {
    ScalingLazyColumn(
      modifier = Modifier.fillMaxSize(),
      state = listState,
      horizontalAlignment = Alignment.CenterHorizontally,
      // Auf runden Displays beschneidet der Rand die Ecken; die Liste bleibt
      // deshalb schmaler als der Bildschirm (Inhalte werden zusaetzlich pro
      // Zeile auf 88 % Breite begrenzt).
      contentPadding = PaddingValues(horizontal = 10.dp, vertical = 26.dp),
    ) {
      item { LocationLine(state) }

      if (state.hasData) {
        item { NextPrayerHeadline(state) }
        if ((state.timings?.staleDays ?: 0) > 0) {
          item { StaleHint() }
        }
        item { SectionLabel(stringResource(R.string.today)) }
        items(PRAYER_ORDER.size) { index ->
          val name = PRAYER_ORDER[index]
          PrayerRow(name = name, state = state)
        }
        if (state.payload?.qiblaBearing != null) {
          item { QiblaEntry(onClick = onOpenQibla) }
        }
      } else {
        item { EmptyState() }
      }
    }
  }
}

@Composable
private fun LocationLine(state: PrayerUiState) {
  Text(
    text = state.payload?.locationLabel ?: stringResource(R.string.app_name),
    style = MaterialTheme.typography.caption2,
    color = Muted,
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
    textAlign = TextAlign.Center,
    modifier = Modifier.fillMaxWidth(0.88f),
  )
}

@Composable
private fun NextPrayerHeadline(state: PrayerUiState) {
  val context = LocalContext.current
  val next = state.next
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = Modifier.fillMaxWidth(0.88f).padding(top = 2.dp, bottom = 4.dp),
  ) {
    Text(
      text = stringResource(R.string.next_prayer),
      style = MaterialTheme.typography.caption3,
      color = Muted,
      maxLines = 1,
    )
    Text(
      text = next?.let { stringResource(prayerNameRes(it.name)) } ?: "–",
      style = MaterialTheme.typography.title1,
      color = Gold,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      textAlign = TextAlign.Center,
    )
    Text(
      text = next?.let { formatClock(context, it.timestampMillis, state.payload?.timeFormat) } ?: "--:--",
      style = MaterialTheme.typography.display3,
      color = Cream,
      maxLines = 1,
    )
    Text(
      text = next?.let { formatRemaining(context, it.timestampMillis - state.nowMillis) }.orEmpty(),
      style = MaterialTheme.typography.caption1,
      color = Muted,
      maxLines = 1,
      textAlign = TextAlign.Center,
    )
  }
}

@Composable
private fun StaleHint() {
  Text(
    text = stringResource(R.string.stale_data),
    style = MaterialTheme.typography.caption3,
    color = Warn,
    textAlign = TextAlign.Center,
    modifier = Modifier.fillMaxWidth(0.88f).padding(bottom = 2.dp),
  )
}

@Composable
private fun SectionLabel(text: String) {
  Text(
    text = text,
    style = MaterialTheme.typography.caption3,
    color = Muted,
    textAlign = TextAlign.Center,
    modifier = Modifier.fillMaxWidth(0.88f).padding(top = 4.dp, bottom = 2.dp),
  )
}

/** Eine Zeile der Tagesliste; das naechste Gebet ist golden hervorgehoben. */
@Composable
private fun PrayerRow(name: String, state: PrayerUiState) {
  val context = LocalContext.current
  val timings = state.timings ?: return
  val isNext = state.next?.name == name && (state.timings.staleDays == 0)
  val millis = timestampToday(timings.today, name)
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
    modifier = Modifier
      .fillMaxWidth(0.9f)
      .padding(vertical = 2.dp)
      .clip(RoundedCornerShape(18.dp))
      .background(if (isNext) Surface else Color.Transparent)
      .padding(horizontal = 14.dp, vertical = 7.dp),
  ) {
    Text(
      text = stringResource(prayerNameRes(name)),
      style = MaterialTheme.typography.body2,
      color = if (isNext) Gold else Cream,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      modifier = Modifier.fillMaxWidth(0.6f),
    )
    Text(
      text = millis?.let { formatClock(context, it, state.payload?.timeFormat) } ?: "--:--",
      style = MaterialTheme.typography.body2,
      color = if (isNext) Gold else Muted,
      maxLines = 1,
    )
  }
}

/** Einstieg in den Qibla-Bildschirm; nur sichtbar, wenn ein Bearing vorliegt. */
@Composable
private fun QiblaEntry(onClick: () -> Unit) {
  CompactChip(
    onClick = onClick,
    label = {
      Text(
        text = stringResource(R.string.qibla),
        style = MaterialTheme.typography.button,
        maxLines = 1,
      )
    },
    colors = ChipDefaults.secondaryChipColors(backgroundColor = Surface, contentColor = Gold),
    modifier = Modifier.fillMaxWidth(0.7f).padding(top = 6.dp),
  )
}

@Composable
private fun EmptyState() {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = Modifier.fillMaxWidth(0.86f),
  ) {
    Text(
      text = stringResource(R.string.no_data_title),
      style = MaterialTheme.typography.title3,
      color = Cream,
      textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = stringResource(R.string.no_data_body),
      style = MaterialTheme.typography.caption1,
      color = Muted,
      textAlign = TextAlign.Center,
    )
  }
}
