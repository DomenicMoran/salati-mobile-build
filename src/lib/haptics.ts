// Zentrale Haptik-Hilfsfunktionen. Zwei Gründe für diese Schicht statt
// überall direkt Haptics.* zu importieren:
// 1) Web-Gating an EINER Stelle statt an jeder Aufrufstelle (expo-haptics hat
//    auf Web keinen sinnvollen nativen Effekt).
// 2) Haptik ist bewusst SPARSAM eingesetzt - nur an wenigen, wirklich
//    bedeutsamen Momenten (Achievement freigeschaltet, Zakat-Ergebnis,
//    Rezitator-Download fertig, Hifz-Check korrekt/falsch, Qada-Häkchen).
//    Benannte Funktionen statt roher Haptics-Aufrufe machen an der
//    Aufrufstelle sofort klar, dass es sich um einen bewusst gewählten
//    Moment handelt, nicht um Tap-Feedback für jeden Button.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function run(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}

/** Positiver Abschluss: Achievement freigeschaltet, Download fertig, Hifz-Rezitation korrekt erkannt. */
export function hapticSuccess(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Nicht wie erwartet: Hifz-Rezitation falsch/nicht erkannt. */
export function hapticWarning(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Leichtes Feedback für kleine, aber bewusste Bestätigungen: Qada-Häkchen, Zakat-Ergebnis. */
export function hapticLight(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
