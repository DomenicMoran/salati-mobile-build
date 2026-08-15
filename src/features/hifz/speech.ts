// Native Variante des "Schnell-Modus" — Gegenstück zu speech.web.ts (Browser-
// SpeechRecognition-API).
//
// Entscheidung (siehe Abschluss-Bericht für die volle Begründung): KEIN
// zweites natives Spracherkennungs-Paket (z. B. @react-native-voice/voice
// oder expo-speech-recognition). Stattdessen leitet der Schnell-Modus intern
// auf dieselbe on-device-Whisper-Pipeline wie whisperCheck.ts (Präzisions-
// Modus) um — gleiches Modell, gleiche Mikrofon-Aufnahme
// (@fugood/react-native-audio-pcm-stream), EIN Transkriptions-Pass statt
// zwei Tempo-Varianten. Gründe: (1) keine zweite native Dependency = kleinere
// Angriffsfläche für genau die Art von Build-Bruch, vor der die Aufgabe
// ausdrücklich warnt (Kotlin-Plugin-Kollisionen etc.), (2) beide Modi liefern
// dadurch konsistente, vom selben Modell stammende Ergebnisse, (3) das
// bestehende Modus-Umschalten in app/hifz/[surah].tsx setzt ohnehin
// `whisperSupported() && recognitionAvailable()` voraus, um beide Chips
// anzuzeigen — mit getrennten Engines müssten beide unabhängig verfügbar UND
// beide Modelle geladen sein, was den Erst-Download verdoppelt hätte.
//
// Unterschied zum Präzisions-Modus: recognizeArabicAlternatives() hat (wie
// die Browser-SpeechRecognition-API) KEINE explizite stop()-Kontrolle vom
// Aufrufer (app/hifz/[surah].tsx ruft nur `await recognizeArabicAlternatives()`
// ohne Recorder-Referenz) — die Aufnahme muss also selbst erkennen, wann der
// Nutzer fertig ist. Einfache Energie-basierte Sprachpausen-Erkennung
// (RMS-Schwellwert + Stille-Debounce), kein echtes VAD-Modell — für kurze
// Einzelvers-Rezitationen ausreichend, siehe SILENCE_MS/MAX_LISTEN_MS unten.
//
// NICHT auf einem echten Android/iOS-Build verifiziert (siehe
// whisperCheck.ts-Kopfkommentar und Abschluss-Bericht).

import {
  CONTINUOUS_WINDOW_SEC,
  SAMPLE_RATE,
  WhisperError,
  WhisperFehler,
  loadWhisperContext,
  startPcmCapture,
  transcribePcm,
  trimSilence,
  whisperSupported,
  type WhisperProgress,
} from './whisperCheck';
import { ReciteProgress, overlappingWindows, type RevealedWord } from './reciteProgress';
import { createEnergyVadGate, trimSilenceAdaptive } from './vad';

// Sprach-/Stille-Erkennung während der Aufnahme läuft jetzt über den adaptiven
// Energie-Gate (createEnergyVadGate, s. vad.ts) statt eines festen RMS-
// Schwellwerts: adaptive Schwelle über einer mitlaufenden Rausch-Untergrenze +
// Mindest-Sprachdauer. Die absolute Untergrenze im Gate (ABS_MIN_RMS = 0.01)
// hält das bisherige Verhalten für leise Quellen in Stille bei (User-Report:
// Wiedergabe vom 2. Handy / leises Rezitieren), hebt die Schwelle aber über
// gemessenes Hintergrundrauschen und ignoriert einen einzelnen Klick/Huster.
// Wie lange Stille NACH erkannter Sprache toleriert wird, bevor automatisch
// gestoppt wird. Etwas länger (1200 ms), damit natürliche Vers-Pausen nicht
// vorschnell abbrechen.
const SILENCE_MS = 1200;
// Harte Obergrenze, falls nie Stille erkannt wird (Mikrofon-Rauschen o. Ä.).
const MAX_LISTEN_MS = 15000;
// Poll-Intervall der Stille-Prüfung.
const CHECK_INTERVAL_MS = 150;

export function recognitionAvailable(): boolean {
  return whisperSupported();
}

export async function recognizeArabicOnce(): Promise<string> {
  const alternatives = await recognizeArabicAlternatives();
  return alternatives[0] ?? '';
}

export interface RecognizeOptions {
  /** Erwarteter Ayah-Text als Conditioning-Prompt (s. transcribePcm). */
  expectedText?: string;
  onProgress?: (p: WhisperProgress) => void;
}

export interface StreamingOptions extends RecognizeOptions {
  /**
   * Wird während der Aufnahme wiederholt mit dem BISHER erkannten Text
   * aufgerufen — damit die UI den Vers Wort für Wort füllen kann ("leerer
   * Mushaf", app/hifz/[surah].tsx). Rein additiv: die finale Bewertung nutzt
   * weiter den vollständigen Durchlauf am Ende (unverändert robust).
   */
  onPartial?: (transcript: string) => void;
}

// Abstand zwischen Zwischen-Transkriptionen während der Aufnahme. Bewusst nicht
// zu klein: jede Transkription kostet Rechenzeit; das busy-Flag überspringt
// zudem Läufe, solange der vorige noch rechnet.
const PARTIAL_INTERVAL_MS = 1400;

/**
 * Wie recognizeArabicAlternatives, aber mit Live-Zwischenständen (onPartial)
 * während des Sprechens. Auto-Stopp per Sprechpause wie gehabt; die Rückgabe
 * ist das finale, vollständige Transkript (für die Bewertung).
 */
export async function recognizeArabicStreaming(options: StreamingOptions): Promise<string[]> {
  if (!recognitionAvailable()) throw new WhisperError(WhisperFehler.unavailable, 'recognitionAvailable() === false (whisperSupported false)');

  const contextReady = loadWhisperContext(options.onProgress);
  let ctx: Awaited<ReturnType<typeof loadWhisperContext>> | null = null;
  contextReady.then((c) => (ctx = c)).catch(() => {});

  let hasSpeech = false;
  let lastVoicedAt = Date.now();
  const startedAt = Date.now();

  const gate = createEnergyVadGate();
  const capture = await startPcmCapture((chunk) => {
    const { voiced, speechConfirmed } = gate.push(chunk);
    // voiced steuert den Stille-Timeout, speechConfirmed (>= Mindest-Sprachdauer)
    // erst schaltet die Aufnahme scharf → ein einzelner Klick startet nichts.
    if (voiced) lastVoicedAt = Date.now();
    if (speechConfirmed) hasSpeech = true;
  });

  // Live-Zwischen-Transkription: nur EIN Lauf gleichzeitig (busy), damit sich
  // nichts staut; erst ab ~0,6 s Audio sinnvoll.
  let partialBusy = false;
  const partialTimer = setInterval(() => {
    if (partialBusy || !ctx || !hasSpeech || !options.onPartial) return;
    const pcm16 = capture.snapshot();
    if (pcm16.length < SAMPLE_RATE * 0.6) return;
    partialBusy = true;
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
    // Live-Zwischenstand: greedy (`fast`) für den ~1,4-s-Takt. Ein einzelner
    // Ayah ist kurz (< Fensterlänge, < 224 Prompt-Tokens) → hier reicht der
    // ganze Ayah-Text als Prompt, kein gleitendes Fenster nötig. Die finale
    // Bewertung unten bleibt der volle Beam-5-Durchlauf.
    // skipIfBusy: falls die vorige Transkription (Tick oder der finale Durchlauf)
    // noch auf dem geteilten Kontext läuft, diesen Tick verwerfen statt „already
    // transcribing" zu riskieren — der globale Serializer ist die maßgebliche
    // Absicherung, partialBusy nur die günstige Vor-Prüfung.
    transcribePcm(trimSilence(float32), ctx, 'hifz-partial.wav', options.expectedText, { fast: true, skipIfBusy: true })
      .then((t) => {
        if (t && options.onPartial) options.onPartial(t);
      })
      .catch((e) => {
        console.warn('[hifz recite] Live-Zwischen-Transkription fehlgeschlagen:', String(e));
      })
      .finally(() => {
        partialBusy = false;
      });
  }, PARTIAL_INTERVAL_MS);

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const now = Date.now();
      const silentLongEnough = hasSpeech && now - lastVoicedAt >= SILENCE_MS;
      const timedOut = now - startedAt >= MAX_LISTEN_MS;
      if (silentLongEnough || timedOut) {
        clearInterval(interval);
        resolve();
      }
    }, CHECK_INTERVAL_MS);
  });
  clearInterval(partialTimer);

  const pcm16 = capture.stopCapture();
  if (!hasSpeech) return [];
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
  // Finaler Bewertungs-Durchlauf: adaptive VAD-Trimmung (s. vad.ts) statt festem
  // Schwellwert — weniger Halluzinationsfläche an leisen Rändern.
  const trimmed = trimSilenceAdaptive(float32);
  const whisperContext = await contextReady;
  // KEIN erwarteter-Vers-Prompt für die FINALE Bewertung (Ehrlichkeit): eine
  // empirische Messung des tatsächlichen On-Device-Modells (tarteel-base GGML,
  // eigene Konvertierung) gegen 46 echte Rezitations-Clips zeigte, dass das
  // Konditionieren auf den erwarteten Vers die Transkription BIAST (Prompt-Echo):
  // Wort-Recall fiel 80→73 %, CER stieg — und kritischer, das Modell kann
  // erwartete Wörter HALLUZINIEREN → falsch-positives „richtig". Die Bewertung
  // muss unvoreingenommen transkribieren und ERST DANACH gegen den erwarteten
  // Text matchen (alignWords). Der bewegte Prompt bleibt nur bei den Live-Partials
  // (Positions-Tracking, disposable), nicht in der Score-Quelle.
  const text = await transcribePcm(trimmed, whisperContext, 'hifz-final-rec.wav');
  return text ? [text] : [];
}

export interface ContinuousController {
  /** Beendet die kontinuierliche Erkennung und liefert das finale Transkript. */
  stop: () => Promise<string>;
}

export interface ContinuousOptions {
  /** Erwarteter Text (ganze Sure) als Conditioning-Prompt. */
  expectedText?: string;
  onProgress?: (p: WhisperProgress) => void;
  /**
   * Wiederholt mit (a) dem bisher erkannten Fenster-Text und (b) den
   * POSITIONS-gekoppelten Aufdeck-Treffern (globaler Wort-Index + hit/near).
   * Die UI (recite-surah.tsx) deckt AUSSCHLIESSLICH anhand von `reveals` auf —
   * nicht mehr per globalem alignWords(partial, ganzeSure). So kann ein Wort aus
   * Vers 1 nie ein gleichlautendes Wort in Vers 7 „treffen" (User-Bug
   * 2026-07-22), weil das Alignment auf ein enges Fenster um die aktuelle Front
   * beschränkt ist (reciteProgress.ts windowedReveal).
   */
  onPartial: (transcript: string, reveals: RevealedWord[]) => void;
}

// Kontinuierliche Erkennung für den „leeren Mushaf ganze Sure" (K): das Modell
// läuft DURCHGEHEND (kein Auto-Stopp bei Sprechpausen), transkribiert das bisher
// Gesagte periodisch und meldet es via onPartial — bis der Aufrufer stop()
// aufruft (Sure fertig / Nutzer drückt Stopp). Voraussetzung: Modell bereits
// geladen (der Screen gated darauf, s. app/hifz/recite-surah.tsx) — hier kein
// Download-während-Aufnahme.
const CONTINUOUS_INTERVAL_MS = 1500;
// LIVE-Fenster bewusst KÜRZER als das Final-Fenster (16 statt 24 s): ein
// greedy-Durchlauf über 24 s Audio kann auf dem Handy > 1,5 s dauern → die
// meisten Live-Ticks würden per skipIfBusy verworfen und das Aufdecken hinkt
// spürbar hinterher (User: „erst am Ende"). 16 s halbieren die Dekodier-Latenz
// nahezu, überlappen bei 1,5-s-Takt weiter massiv (kein Wortverlust) und decken
// die aktuelle Rezitationsstelle bequem ab. Die VOLLSTÄNDIGKEIT sichert der
// Final-Pass (unten, 24 s Beam-5 über die ganze Aufnahme) — nicht der Live-Pass.
const LIVE_WINDOW_SEC = 16;
const LIVE_WINDOW_SAMPLES = LIVE_WINDOW_SEC * SAMPLE_RATE;
// FINALE Voll-Auswertung: Fenster + 50-%-Überlappung (hop = window/2), damit an
// keiner Fenstergrenze ein Wort verloren geht. Beam-5 (volle Genauigkeit) —
// Latenz beim Stopp unkritisch. Bewusst weiter die vollen 24 s (mehr Kontext
// pro Block = genauere Dekodierung, wo Tempo egal ist).
const FINAL_WINDOW_SAMPLES = CONTINUOUS_WINDOW_SEC * SAMPLE_RATE;
const FINAL_HOP_SAMPLES = Math.floor(FINAL_WINDOW_SAMPLES / 2);

export async function recognizeArabicContinuous(options: ContinuousOptions): Promise<ContinuousController> {
  if (!recognitionAvailable()) throw new WhisperError(WhisperFehler.unavailable, 'recognitionAvailable() === false (whisperSupported false)');

  const whisperContext = await loadWhisperContext(options.onProgress);
  const capture = await startPcmCapture();

  // Gleitender erwarteter-Text-Prompt statt einmaligem Ganz-Sure-Prompt: der
  // Prompt zeigt immer auf die als-nächstes-erwarteten Wörter ab der zuletzt
  // sicher erkannten Position (reciteProgress.ts). Verhindert, dass whisper
  // nach den ersten ~224 Prompt-Tokens ohne erwarteten-Text-Anker weiterläuft
  // und „den Faden verliert" (Kern-Fix, s. reciteProgress.ts-Kopfkommentar).
  const progress = options.expectedText ? new ReciteProgress(options.expectedText) : null;

  let stopped = false;
  let busy = false;
  // Anfang (Sample-Offset) des Live-Fensters — MONOTON steigend. Anti-Skip-Fix
  // (User-Report „erkennt noch nicht alles" bei langer Sure): das Fenster rückt
  // NUR dann von den früh gesprochenen Versen weg (Richtung Live-Kante), wenn die
  // Front tatsächlich VORGERÜCKT ist — also die alten Verse bereits bestätigt
  // wurden. Steht die Front (Erkennung hinkt hinterher), bleibt liveStart stehen
  // und dasselbe Audio-Fenster wird erneut ausgewertet (mit dem Front-Prompt), bis
  // es sitzt — statt dass die frühen Verse unerkannt aus dem 24-s-Tail fallen.
  // Kommt die Erkennung mit, verhält es sich exakt wie das bisherige Tail-Fenster.
  let liveStart = 0;
  const timer = setInterval(() => {
    if (busy || stopped) return;
    const pcm16 = capture.snapshot();
    if (pcm16.length < SAMPLE_RATE * 0.6) return;
    busy = true;
    const total = pcm16.length;
    const float32 = new Float32Array(total);
    for (let i = 0; i < total; i++) float32[i] = pcm16[i] / 0x8000;
    // Fenster [liveStart, liveStart+24s) — bounded Latenz + mitwandernder Prompt.
    const windowEnd = Math.min(total, liveStart + LIVE_WINDOW_SAMPLES);
    const windowed = trimSilence(float32.subarray(liveStart, windowEnd));
    const prompt = progress ? progress.prompt() : options.expectedText;
    const frontierBefore = progress ? progress.position : 0;
    // skipIfBusy: kontinuierlicher Takt darf nie parallel transkribieren — läuft
    // noch ein Lauf (Tick oder der finale Durchlauf aus stop()), Tick verwerfen
    // statt „already transcribing" (globaler Serializer, s. transcribeSerializer.ts).
    transcribePcm(windowed, whisperContext, 'hifz-surah-partial.wav', prompt, { fast: true, skipIfBusy: true })
      .then((t) => {
        if (t && !stopped) {
          // ingest() rückt die Front positions-gekoppelt vor (steuert den Prompt
          // des NÄCHSTEN Fensters) UND liefert die global indizierten Aufdeck-
          // Treffer. Die UI deckt nur diese Treffer auf — ein Fenster-Transkript,
          // das frühe Verse nicht mehr enthält, macht dank monotoner UI-Aufdeckung
          // nichts rückgängig; ein spätes Wort kann keinen frühen/späteren Vers
          // außerhalb des Fensters mehr fälschlich treffen.
          const reveals = progress ? progress.ingest(t) : [];
          options.onPartial(t, reveals);
          // Nur bei echtem Fortschritt die früh gesprochenen Verse „loslassen" und
          // das Fenster Richtung Live-Kante schieben (monoton). Bleibt die Front
          // stehen, hält liveStart und dasselbe Fenster bekommt einen neuen Versuch.
          // Ohne erwarteten Text (kein progress) gibt es keine Front → klassisches
          // Tail-Verhalten beibehalten (Fenster folgt der Live-Kante).
          if (!progress || progress.position > frontierBefore) {
            liveStart = Math.max(liveStart, total - LIVE_WINDOW_SAMPLES);
          }
        }
      })
      .catch((e) => {
        // Nicht verschlucken: Zwischen-Transkriptionsfehler sichtbar machen
        // (halfen bisher, die Ursache des „nicht verfügbar" zu verbergen). Der
        // Lauf ist unkritisch (nächstes Fenster folgt), daher nur warn.
        console.warn('[hifz recite-surah] Zwischen-Transkription fehlgeschlagen:', String(e));
      })
      .finally(() => {
        busy = false;
      });
  }, CONTINUOUS_INTERVAL_MS);

  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      const pcm16 = capture.stopCapture();
      if (pcm16.length < SAMPLE_RATE * 0.4) return '';
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
      // FINALE VOLL-AUSWERTUNG: nicht nur das Tail-Fenster, sondern die GESAMTE
      // Aufnahme in überlappenden 24-s-Blöcken (50 % Überlappung) von vorne bis
      // hinten durch whisper (Beam-5) — mit dem mitwandernden Sure-Prompt. So wird
      // JEDER korrekt rezitierte Vers ausgewertet und aufgedeckt, auch die früh
      // gesprochenen, die aus dem Live-Fenster gefallen waren → „die Sure löst sich
      // am Ende auf". Die Front wandert über die Blöcke monoton bis zum Ende; früher
      // Aufgedecktes bleibt dank monotoner UI-Aufdeckung erhalten.
      //
      // FRISCHE Fortschritts-Front für den Final-Sweep (Robustheits-Fix ganze
      // Sure): der Sweep läuft von vorne durchs Audio, die Live-`progress`-Front
      // steht aber irgendwo mittendrin (wo die Live-Erkennung hängen blieb) — mit
      // ihr bekäme der ERSTE Block (frühes Audio) den Prompt der SPÄTEN Verse und
      // sein Alignment-Fenster läge fern der frühen Wörter → frühe Verse blieben
      // unaufgedeckt. Eine bei 0 startende Front wandert synchron mit den Blöcken
      // durchs Audio: jeder Block bekommt den zu SEINER Stelle passenden Prompt und
      // deckt seine Verse auf. Monotones UI-Aufdecken macht bereits Aufgedecktes
      // nie rückgängig; die Live-`progress`-Front wird hier bewusst nicht weiter
      // benutzt.
      const finalProgress = options.expectedText ? new ReciteProgress(options.expectedText) : null;
      const windows = overlappingWindows(float32.length, FINAL_WINDOW_SAMPLES, FINAL_HOP_SAMPLES);
      let lastText = '';
      for (const w of windows) {
        // Adaptive VAD-Trimmung des Blocks (Rausch-Floor + Mindest-Sprachdauer,
        // s. vad.ts) statt festem Schwellwert — schneidet leise Ränder/Rauschen
        // und reduziert Halluzination an Block-Grenzen.
        const chunk = trimSilenceAdaptive(float32.subarray(w.start, w.end));
        // Zu kurze/stille Blöcke (z. B. eine Schluss-Pause) überspringen.
        if (chunk.length < SAMPLE_RATE * 0.3) continue;
        // KEIN erwarteter-Text-Prompt für die finale Block-Transkription
        // (Ehrlichkeit, s. recognizeArabicStreaming): der Prompt biast die
        // Transkription (Prompt-Echo) und kann erwartete Wörter halluzinieren →
        // falsch aufgedeckte Verse. Frei (greedy) transkribieren; das
        // Positions-Tracking + Aufdecken übernimmt finalProgress.ingest() durch
        // ALIGNMENT des freien Transkripts gegen den erwarteten Text — die Front
        // braucht den Prompt nicht (sie folgt der Block-Reihenfolge + dem
        // Alignment). Der bewegte Prompt bleibt nur im LIVE-Fenster oben.
        // Kein skipIfBusy: die Final-Blöcke reihen sich im Serializer ein (dürfen
        // nicht verworfen werden) und laufen strikt nacheinander.
        const text = await transcribePcm(chunk, whisperContext, 'hifz-surah-final.wav').catch((e) => {
          console.warn('[hifz recite-surah] Final-Block-Transkription fehlgeschlagen:', String(e));
          return '';
        });
        if (text) {
          lastText = text;
          const reveals = finalProgress ? finalProgress.ingest(text) : [];
          options.onPartial(text, reveals);
        }
      }
      return lastText;
    },
  };
}

/**
 * Nimmt bis zur erkannten Sprechpause (oder MAX_LISTEN_MS) auf und
 * transkribiert danach EINEN Durchlauf (kein Tempo-Varianten-Trick wie im
 * Präzisions-Modus — "schnell" bewusst leichtgewichtiger).
 */
export async function recognizeArabicAlternatives(
  options?: RecognizeOptions,
): Promise<string[]> {
  if (!recognitionAvailable()) throw new WhisperError(WhisperFehler.unavailable, 'recognitionAvailable() === false (whisperSupported false)');

  // onProgress durchreichen — beim ersten Aufruf lädt sich das (grosse)
  // Koran-Modell herunter; der Aufrufer zeigt damit den Download-Fortschritt.
  const contextReady = loadWhisperContext(options?.onProgress);
  let hasSpeech = false;
  let lastVoicedAt = Date.now();
  const startedAt = Date.now();

  const gate = createEnergyVadGate();
  const capture = await startPcmCapture((chunk) => {
    const { voiced, speechConfirmed } = gate.push(chunk);
    if (voiced) lastVoicedAt = Date.now();
    if (speechConfirmed) hasSpeech = true;
  });

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const now = Date.now();
      const silentLongEnough = hasSpeech && now - lastVoicedAt >= SILENCE_MS;
      const timedOut = now - startedAt >= MAX_LISTEN_MS;
      if (silentLongEnough || timedOut) {
        clearInterval(interval);
        resolve();
      }
    }, CHECK_INTERVAL_MS);
  });

  const pcm16 = capture.stopCapture();
  if (!hasSpeech) return [];

  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
  const trimmed = trimSilenceAdaptive(float32);

  const whisperContext = await contextReady;
  // Kein erwarteter-Vers-Prompt für die Bewertung (s. recognizeArabicStreaming:
  // empirisch senkt der Prompt Recall und erzeugt falsch-positive Treffer). Frei
  // transkribieren, danach gegen den erwarteten Text matchen.
  const text = await transcribePcm(trimmed, whisperContext, 'hifz-fast-rec.wav');
  return text ? [text] : [];
}
