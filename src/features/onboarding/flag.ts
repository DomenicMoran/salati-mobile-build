// Erststart-Flag für das native Onboarding (Audit C2). Bewusst getrennt vom
// Settings-Store: das Flag beschreibt keinen Nutzer-Wunsch, sondern nur "der
// Einrichtungs-Flow lief schon einmal" — es soll z. B. ein Settings-Reset
// NICHT erneut das Onboarding auslösen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const ONBOARDING_DONE_KEY = 'salatibox:onboarding-done';

/**
 * true = Onboarding nicht mehr anzeigen. Auf Web IMMER true — dort übernimmt
 * die Landingpage das Onboarding, der Flow existiert nur nativ.
 * Lese-Fehler zählen als "erledigt": im Zweifel lieber kein Onboarding als
 * ein Nutzer, der bei jedem Start erneut hineingezwungen wird.
 */
export async function isOnboardingDone(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    return (await AsyncStorage.getItem(ONBOARDING_DONE_KEY)) !== null;
  } catch {
    return true;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {
    // Persistenz-Fehler ignorieren — schlimmstenfalls erscheint das
    // Onboarding beim nächsten Start noch einmal (skippbar).
  }
}
