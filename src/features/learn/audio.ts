// Audio fürs Lern-Modul, zwei Quellen:
// 1) Echte Rezitation über cdn.islamic.network — dieselbe CDN, die der
//    Quran-Reader (Al Quran Cloud) nutzt — für Lese-Lektionen, Tajwid-
//    Beispielverse und Wort-Fragen mit globalAyah.
//    Rezitator: HUSARY (Mahmoud Khalil al-Husary) statt Alafasy — der
//    klassische LEHR-Rezitator: langsames, deutlich artikuliertes Murattal,
//    weltweit der Referenz-Standard für Tajweed-Unterricht (User-Direktive
//    2026-07-16: "besonders Husary für die Übungen"). Verfügbarkeit für
//    globale Ayahs 1/6226/6236 live gegen die CDN verifiziert.
// 2) Geräte-TTS (expo-speech, ar) für Buchstabennamen, Silben und Wörter —
//    offline, lizenzfrei, auf allen Plattformen inkl. Web verfügbar.

import * as Speech from 'expo-speech';

const RECITATION_BASE = 'https://cdn.islamic.network/quran/audio/128/ar.husary';

/** MP3-URL der Rezitation für eine globale Ayah-Nummer (1–6236). */
export function recitationUrl(globalAyah: number): string {
  return `${RECITATION_BASE}/${globalAyah}.mp3`;
}

// Beste verfügbare Arabisch-Stimme statt Browser-/System-Default
// (Gerätefeedback: Default-TTS klingt bei den 99 Namen schlecht). Cloud-
// Stimmen (Google/Microsoft) klingen deutlich natürlicher als lokale.
let bestArabicVoice: string | null | undefined;

async function findBestArabicVoice(): Promise<string | null> {
  if (bestArabicVoice !== undefined) return bestArabicVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const arabic = voices.filter((v) => v.language?.toLowerCase().startsWith('ar'));
    // Bevorzugt bekannte hochwertige Stimmen, dann ar-SA, dann irgendeine ar-Stimme
    const bevorzugt = ['majed', 'hamed', 'zariyah', 'salma', 'google', 'natural'];
    const scored = arabic
      .map((v) => {
        const name = `${v.identifier} ${v.name ?? ''}`.toLowerCase();
        const prefIdx = bevorzugt.findIndex((p) => name.includes(p));
        const score = (prefIdx >= 0 ? 100 - prefIdx : 0) + (v.language?.toLowerCase() === 'ar-sa' ? 10 : 0);
        return { v, score };
      })
      .sort((a, b) => b.score - a.score);
    bestArabicVoice = scored[0]?.v.identifier ?? null;
  } catch {
    bestArabicVoice = null;
  }
  return bestArabicVoice;
}

/**
 * Spricht arabischen Text über die beste verfügbare Arabisch-Stimme.
 * Leicht verlangsamt, damit Lernende Harakat einzeln heraushören können.
 */
export function speakArabic(text: string): void {
  Speech.stop();
  findBestArabicVoice().then((voice) => {
    Speech.speak(text, { language: 'ar', rate: 0.8, ...(voice ? { voice } : {}) });
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
