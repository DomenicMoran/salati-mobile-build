// Store-Bewertungsaufforderung: ruft den NATIVEN Rating-Dialog von iOS/Android
// auf (StoreReview.requestReview() - kein eigenes UI, das Betriebssystem zeigt
// seinen eigenen System-Dialog). Apple/Google haben dafür jeweils eigene,
// interne Kontingente (z. B. max. wenige Male pro Jahr/Installation) - ob der
// Dialog tatsächlich erscheint, entscheidet ausschließlich das OS. Das ist
// normal und kein Bug, den man von hier aus reparieren könnte.
//
// Salati selbst hält sich noch strenger: requestReview() wird über das ganze
// App-Leben bewusst nur EIN EINZIGES MAL versucht (kein Cooldown-Zähler, kein
// "später nochmal fragen") - das ist der von Apple/Google empfohlene sparsame
// Umgang: nie nerven, nie mehrfach fragen, nur an einem positiven Moment
// ansetzen (siehe Aufrufer in app/achievements.tsx: frisch freigeschaltetes
// Abzeichen - positive Emotion, nicht mitten in einer Aufgabe/einem Fehler).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

export const RATING_PROMPT_SHOWN_KEY = 'salatibox:rating-prompt-shown';

/** true = requestReview() wurde bereits (versucht) aufgerufen - nie wieder. */
export async function hasShownRatingPrompt(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RATING_PROMPT_SHOWN_KEY)) !== null;
  } catch {
    // Lesefehler: lieber keinen (evtl. zweiten) Aufruf riskieren als den
    // Nutzer zu nerven - im Zweifel gilt der Prompt als "schon gezeigt".
    return true;
  }
}

async function markRatingPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(RATING_PROMPT_SHOWN_KEY, '1');
  } catch {
    // Persistenz-Fehler ignorieren - schlimmstenfalls wird beim nächsten
    // positiven Moment erneut versucht. Harmlos: das OS begrenzt ohnehin
    // selbst, wie oft sein Dialog tatsächlich erscheint.
  }
}

/**
 * Löst - falls in diesem App-Leben noch nie versucht - den nativen
 * Store-Rating-Dialog aus. Nur für positive Momente gedacht (z. B. neues
 * Abzeichen freigeschaltet), NICHT für einen Button oder mitten in einer
 * Aufgabe (Apple-/Google-Guideline für requestReview()).
 *
 * Web: expo-store-review hat dort keinen nativen Dialog - gilt daher direkt
 * als "erledigt", ohne einen Aufruf zu versuchen (kein Flag-Verbrauch nötig,
 * aber auch kein Grund, es dort separat zu verwalten).
 */
export async function maybeRequestReview(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await hasShownRatingPrompt()) return;

  // Flag VOR dem eigentlichen Aufruf setzen: der einmalige Versuch zählt
  // unabhängig davon, ob requestReview() wirklich einen Dialog zeigt (das
  // entscheidet das OS-Kontingent) oder mit einem Fehler abbricht.
  await markRatingPromptShown();

  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  } catch {
    // Kann u. a. im Simulator/bei fehlender Store-Konfiguration fehlschlagen
    // - bewusst kein zweiter Versuch (siehe Modul-Kommentar oben).
  }
}
