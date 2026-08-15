import AsyncStorage from '@react-native-async-storage/async-storage';

// Kalibrierungs-Hinweis für den Qibla-Kompass.
//
// `expo-location`s `watchHeadingAsync` liefert nativ eine echte
// Kalibrierungsstufe (`accuracy`: 0=keine bis 3=hoch, s. useCompass.ts) — die
// verbreitete Annahme, dass Kompass-APIs nie eine Genauigkeit exponieren,
// stimmt hier NICHT. Auf Web (deviceorientation-Events) gibt es dagegen
// keine Genauigkeits-Metrik, dort bleibt nur die Heuristik unten.
//
// Heuristik: "unruhiges" Rauschen erkennt man daran, dass das Heading in
// kurzer Zeit viel HIN- UND HERspringt (hohe Summe der Einzel-Sprünge),
// während sich die tatsächliche Blickrichtung kaum ändert (kleine
// Netto-Verschiebung Anfang→Ende des Fensters). Ein Nutzer, der sich
// bewusst dreht, erzeugt dagegen eine große Netto-Verschiebung — das ist
// kein Rauschen und soll keinen Hinweis auslösen.
export interface HeadingSample {
  heading: number;
  /** ms, z. B. Date.now() */
  t: number;
}

export interface NoiseOptions {
  /** Zeitfenster, über das die Unruhe bewertet wird (ms). */
  windowMs: number;
  /** Ab dieser Summe der Einzel-Sprünge (Grad) gilt das Fenster als unruhig. */
  jitterDeg: number;
  /** Netto-Verschiebung darf höchstens so groß sein (Grad), sonst ist es Drehung, kein Rauschen. */
  netDeg: number;
}

export const DEFAULT_NOISE_OPTIONS: NoiseOptions = {
  windowMs: 1500,
  jitterDeg: 50,
  netDeg: 18,
};

/** Kürzeste Winkeldifferenz von `from` nach `to`, im Bereich (-180, 180]. */
function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/**
 * true = die letzten Heading-Samples wirken verrauscht (viel Zittern, wenig
 * echte Drehung) — ein guter Zeitpunkt, den Kalibrierungs-Hinweis zu zeigen.
 */
export function isHeadingNoisy(
  samples: readonly HeadingSample[],
  opts: NoiseOptions = DEFAULT_NOISE_OPTIONS,
): boolean {
  if (samples.length < 4) return false;
  const latest = samples[samples.length - 1]!;
  const windowed = samples.filter((s) => s.t >= latest.t - opts.windowMs);
  if (windowed.length < 4) return false;

  let totalAbs = 0;
  for (let i = 1; i < windowed.length; i++) {
    totalAbs += Math.abs(shortestDelta(windowed[i - 1]!.heading, windowed[i]!.heading));
  }
  const net = Math.abs(shortestDelta(windowed[0]!.heading, windowed[windowed.length - 1]!.heading));
  return totalAbs >= opts.jitterDeg && net <= opts.netDeg;
}

/** Native Kalibrierungsstufe (expo-location): 0/1 = niedrig oder keine Kalibrierung. */
export function isLowNativeAccuracy(accuracy: number | null): boolean {
  return accuracy !== null && accuracy <= 1;
}

// "Gesehen"-Flag für den Kalibrierungs-Hinweis beim allerersten Öffnen des
// Qibla-Screens — danach nur noch bei tatsächlich erkannter Instabilität
// zeigen, nicht bei jedem App-Start (Nerv-Vermeidung, s. Task-Vorgabe).
export const QIBLA_CALIBRATION_HINT_SEEN_KEY = 'salatibox:qibla-calibration-hint-seen';

/** Lese-Fehler zählen als "gesehen" — im Zweifel lieber kein Hinweis als einer, der sich nicht wegklicken lässt. */
export async function hasSeenQiblaCalibrationHint(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(QIBLA_CALIBRATION_HINT_SEEN_KEY)) !== null;
  } catch {
    return true;
  }
}

export async function markQiblaCalibrationHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(QIBLA_CALIBRATION_HINT_SEEN_KEY, '1');
  } catch {
    // Persistenz-Fehler ignorieren — schlimmstenfalls erscheint der Hinweis
    // beim nächsten Öffnen noch einmal (jederzeit wegklickbar).
  }
}
