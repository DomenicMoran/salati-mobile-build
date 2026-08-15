import AsyncStorage from '@react-native-async-storage/async-storage';

// Gleiches Muster wie onboarding/flag.ts: reines "schon gezeigt"-Flag, kein
// Nutzer-Wunsch. Steuert den einmaligen Akku-Optimierungs-Hinweis (Alert in
// settings.tsx), der beim ERSTEN Einschalten irgendeiner Gebetszeiten-
// Benachrichtigung erscheint — danach nie wieder, unabhängig davon, ob der
// Nutzer "Einstellungen öffnen" oder "Später" gewählt hat (Entscheidung
// respektieren statt wiederholt zu nerven, siehe Task-Vorgabe).
export const BATTERY_HINT_SHOWN_KEY = 'salatibox:battery-hint-shown';

export async function wasBatteryHintShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BATTERY_HINT_SHOWN_KEY)) !== null;
  } catch {
    return true; // im Zweifel nicht nerven, statt bei jedem Lesefehler erneut zu fragen
  }
}

export async function markBatteryHintShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(BATTERY_HINT_SHOWN_KEY, '1');
  } catch {
    // Persistenz-Fehler ignorieren — schlimmstenfalls erscheint der Hinweis
    // beim nächsten Umschalten noch einmal.
  }
}
