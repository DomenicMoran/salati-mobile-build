// Serialisiert asynchrone Läufe so, dass IMMER nur einer gleichzeitig aktiv ist.
//
// Kern-Fix gegen den nativen whisper.rn-Fehler „Context is already transcribing"
// (Gerät-Report 2026-07-22, Code whisper_transcribe_failed): whisper.rn/whisper.cpp
// erlaubt pro Kontext nur EINE transcribe() gleichzeitig. Da sich die ganze App
// EINEN Singleton-Whisper-Kontext teilt (whisperCheck.ts → whisperContextPromise),
// müssen ALLE Transkriptionen global serialisiert werden — quer über Einzelvers-
// (recognizeArabicStreaming), Schnell- (recognizeArabicAlternatives) und Ganz-Sure-
// Pfad (recognizeArabicContinuous). Die früheren per-Session-`busy`/`partialBusy`-
// Flags schützten nur INNERHALB eines Timers, nicht die Überlappung „letzter Live-
// Tick läuft noch, während der Final-Durchlauf startet" und nicht Läufe, die ein
// vorher verlassener Screen offen ließ.
//
// Bewusst dependency-frei (keine react-native-/expo-Importe), damit die
// Serialisierungs-Logik ohne native Module unter Jest testbar ist.

export interface SerializerRun<T> {
  /** true, wenn der Lauf wegen skipIfBusy übersprungen wurde — fn() wurde NICHT ausgeführt. */
  skipped: boolean;
  /** Rückgabe von fn(), nur gesetzt wenn skipped === false. */
  value?: T;
}

export interface TranscribeSerializer {
  /** true, solange ein Lauf aktiv ODER eingereiht ist. */
  istBesetzt(): boolean;
  /**
   * Führt fn() exklusiv aus.
   * - Standard: reiht sich hinter einen laufenden Lauf ein und startet erst,
   *   wenn der Kontext wieder frei ist (für die FINALEN Bewertungs-Durchläufe —
   *   sie dürfen nicht verworfen werden, sondern warten auf den letzten Live-Tick).
   * - Mit `skipIfBusy`: läuft/wartet bereits etwas, wird fn() NICHT ausgeführt
   *   und `{ skipped: true }` zurückgegeben (für Live-Zwischenstände, die sich
   *   nicht stauen dürfen — der nächste Tick folgt ohnehin).
   */
  run<T>(fn: () => Promise<T>, opts?: { skipIfBusy?: boolean }): Promise<SerializerRun<T>>;
  /** Wartet, bis kein Lauf mehr aktiv/eingereiht ist (für Screen-Cleanup). Wirft nie. */
  leerlauf(): Promise<void>;
}

export function createTranscribeSerializer(): TranscribeSerializer {
  // Verkettung der Läufe: jeder neue exklusive Lauf hängt sich hinter das aktuelle
  // `gate`. Die Kette bricht bei Fehlern NICHT ab (jedes Warteglied hat .catch).
  let gate: Promise<void> = Promise.resolve();
  // Synchron geführter Zähler aktiver+wartender Läufe. Wird VOR dem ersten await
  // erhöht, sodass ein zweiter, im selben Tick gestarteter Lauf die Belegung sieht.
  let besetzt = 0;

  return {
    istBesetzt: () => besetzt > 0,

    async run<T>(fn: () => Promise<T>, opts?: { skipIfBusy?: boolean }): Promise<SerializerRun<T>> {
      if (opts?.skipIfBusy && besetzt > 0) return { skipped: true };

      besetzt += 1;
      const vorher = gate;
      let freigeben!: () => void;
      gate = new Promise<void>((resolve) => {
        freigeben = resolve;
      });

      await vorher.catch(() => {}); // auf Ende des vorherigen Laufs warten (Fehler ignorieren)
      try {
        const value = await fn();
        return { skipped: false, value };
      } finally {
        besetzt -= 1;
        freigeben();
      }
    },

    async leerlauf(): Promise<void> {
      // Vollständig leeren: bis auch nachträglich eingereihte Läufe fertig sind.
      while (besetzt > 0) {
        await gate.catch(() => {});
      }
    },
  };
}
