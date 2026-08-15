// Web: Spracherkennung über die SpeechRecognition-API des Browsers (Chrome/
// Edge/Safari). Ein einzelner Erkennungslauf, Arabisch.

interface WebSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => WebSpeechRecognition) | null {
  const w = globalThis as unknown as {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionAvailable(): boolean {
  return getRecognitionCtor() !== null;
}

export async function recognizeArabicOnce(): Promise<string> {
  const alternatives = await recognizeArabicAlternatives();
  return alternatives[0] ?? '';
}

/**
 * Liefert ALLE Erkennungs-Alternativen des Browsers (bis zu 5) statt nur der
 * wahrscheinlichsten — der Aufrufer wählt die beste gegen den Zieltext
 * (bestTranscript), was falsche "retry"-Bewertungen bei mehrdeutiger
 * Erkennung deutlich reduziert.
 */
export async function recognizeArabicAlternatives(): Promise<string[]> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) throw new Error('speech_recognition_unavailable');

  return new Promise<string[]>((resolve, reject) => {
    const recognition = new Ctor();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    let settled = false;
    recognition.onresult = (event) => {
      settled = true;
      // Pro Alternative k den Gesamttext über alle Ergebnis-Segmente bauen.
      const segmentCount = event.results.length;
      const altCount = Math.max(...Array.from({ length: segmentCount }, (_, i) => event.results[i].length), 0);
      const alternatives: string[] = [];
      for (let k = 0; k < altCount; k++) {
        const text = Array.from({ length: segmentCount }, (_, i) =>
          (event.results[i][k] ?? event.results[i][0])?.transcript ?? '',
        )
          .join(' ')
          .trim();
        if (text) alternatives.push(text);
      }
      resolve(alternatives);
    };
    recognition.onerror = (event) => {
      if (!settled) {
        settled = true;
        reject(new Error(`speech_recognition_${event.error}`));
      }
    };
    recognition.onend = () => {
      if (!settled) {
        settled = true;
        resolve([]);
      }
    };
    recognition.start();
  });
}
