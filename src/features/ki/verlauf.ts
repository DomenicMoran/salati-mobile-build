// Lokale Ablage des KI-Chats: Verlauf und Feedback.
//
// Der frühere Antwort-Cache und der Beta-Sprachwunsch sind mit dem Zitat-Modus
// entfallen: Antworten werden nicht mehr vom Sprachmodell gerechnet (10-30 s je
// Frage), sondern in Millisekunden aus dem Korpus zitiert — ein Cache brächte
// nichts und könnte nach einem Korpus-Update veralteten Text zeigen.
//
// ALLES bleibt auf dem Gerät (AsyncStorage). Kein Netzwerk, kein Tracking —
// „läuft zu 100 % auf deinem Gerät" ist ein Kernversprechen der App
// (locales/*.json, ki.subtitle). Das Feedback wandert bewusst in den bereits
// vorhandenen lokalen Fehler-Log (lib/errorLog.ts), damit es über die
// bestehende „Fehlerbericht kopieren"-Funktion in den Einstellungen mit
// exportiert wird und KEIN zweiter Export-Weg gebaut werden muss.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logError } from '@/lib/errorLog';

const VERLAUF_KEY = 'salatibox:ki-verlauf';

/** Höchstzahl gespeicherter Nachrichten (Frage + Antwort zählen einzeln). */
export const MAX_NACHRICHTEN = 30;

export interface GespeicherteNachricht {
  role: 'du' | 'ki';
  text: string;
  /** Doc-IDs der Quellen — die Texte selbst stehen im gebündelten Korpus. */
  quellen?: string[];
  rtl?: boolean;
  /** Nutzer-Rückmeldung zu einer KI-Antwort (nur lokal). */
  feedback?: 'gut' | 'schlecht';
}

// ---------- Verlauf ----------

export async function ladeVerlauf(): Promise<GespeicherteNachricht[]> {
  try {
    const roh = await AsyncStorage.getItem(VERLAUF_KEY);
    const geparst: unknown = roh ? JSON.parse(roh) : [];
    if (!Array.isArray(geparst)) return [];
    // Fremde/alte Einträge aussortieren statt blind zu vertrauen: Der Verlauf
    // wird direkt gerendert, ein kaputter Eintrag würde den Screen zerlegen.
    return geparst.filter(
      (m): m is GespeicherteNachricht =>
        !!m && typeof m === 'object' && typeof (m as GespeicherteNachricht).text === 'string' &&
        ((m as GespeicherteNachricht).role === 'du' || (m as GespeicherteNachricht).role === 'ki'),
    );
  } catch {
    return [];
  }
}

export async function speichereVerlauf(nachrichten: GespeicherteNachricht[]): Promise<void> {
  try {
    await AsyncStorage.setItem(VERLAUF_KEY, JSON.stringify(nachrichten.slice(-MAX_NACHRICHTEN)));
  } catch {
    // Speichern fehlgeschlagen — der Verlauf bleibt für diese Sitzung im State.
  }
}

export async function loescheVerlauf(): Promise<void> {
  try {
    await AsyncStorage.removeItem(VERLAUF_KEY);
  } catch {
    // Nichts zu tun: Der State wird vom Aufrufer ohnehin geleert.
  }
}

// ---------- Feedback ----------

/**
 * Speichert eine Rückmeldung zu einer Antwort — ausschließlich lokal, über den
 * vorhandenen Fehler-Log. Damit erscheint sie automatisch im bestehenden
 * „Fehlerbericht kopieren"-Export der Einstellungen; es entsteht KEIN
 * zusätzlicher Speicher- oder Versandweg.
 */
export async function merkeFeedback(frage: string, bewertung: 'gut' | 'schlecht', quellen: string[]): Promise<void> {
  await logError(
    `KI-Feedback: ${bewertung === 'gut' ? 'hilfreich' : 'nicht hilfreich'} · Frage: "${frage}" · Quellen: ${quellen.join(', ') || '—'}`,
    'ki-feedback',
  );
}
