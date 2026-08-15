// Energie-basierte Voice-Activity-Detection (VAD) für den Hifz-Rezitations-Check.
//
// WARUM NICHT whisper.rn-VAD: whisper.rn 0.7.0 bietet zwar echtes VAD
// (initWhisperVad / WhisperVadContext.detectSpeech, s. node_modules/whisper.rn/
// src/index.ts), aber `VadContextOptions.filePath` verlangt ein SEPARATES
// Silero-VAD-GGML-Modell-Asset (NativeRNWhisper.ts NativeVadContextOptions),
// das diese App weder bündelt noch herunterlädt — und ein weiterer
// Modell-Download ließe sich hier ohne echtes Gerät nicht verifizieren und
// vergrößerte die Erst-Download-Last. Deshalb (wie in der Aufgabe als Fallback
// vorgegeben) die JS-seitige Energie-VAD DEUTLICH verbessert statt des simplen
// festen RMS-Schwellwerts: adaptive Schwelle über einer geschätzten Rausch-
// Untergrenze (noise floor) + Mindest-Sprachdauer, damit ein einzelner Klick/
// Huster keine Sprache auslöst und dauerhaftes Hintergrundrauschen nicht als
// Sprache zählt.
//
// Reine Funktionen + eine kleine Zustandsklasse — testbar ohne Whisper/Mikro.

/** Rahmenlänge für die Energie-Analyse (30 ms bei 16 kHz = 480 Samples). */
export const FRAME_MS = 30;
/**
 * Absolute Untergrenze der Sprach-Schwelle — identisch zum bisherigen festen
 * Schwellwert (trimSilence/VOICE_RMS_THRESHOLD 0.01). Dadurch kann die adaptive
 * Schwelle NIE UNTER das bisherige Verhalten fallen: eine leise, aber saubere
 * Quelle in ruhiger Umgebung (User-Report: Wiedergabe vom 2. Handy) wird
 * weiterhin erkannt; erst messbares Hintergrundrauschen hebt die Schwelle an.
 */
export const ABS_MIN_RMS = 0.01;
/** Vielfaches der Rausch-Untergrenze, ab dem ein Rahmen als Sprache gilt. */
const NOISE_RATIO = 2.0;
/** Perzentil der Rahmen-Energien, das als Rausch-Untergrenze geschätzt wird. */
const NOISE_PERCENTILE = 0.1;
/** Mindestdauer zusammenhängender Sprache, damit eine Region zählt (Anti-Klick). */
export const MIN_SPEECH_MS = 200;
/** Kontext-Polster vor/nach der Sprachregion (wie trimSilence: 200 ms). */
const PAD_MS = 200;

/** RMS (Effektivwert) eines Float32-PCM-Abschnitts [from,to). 0 für leeren Abschnitt. */
export function frameRms(pcm: Float32Array, from: number, to: number): number {
  const end = Math.min(to, pcm.length);
  if (end <= from) return 0;
  let sum = 0;
  for (let i = from; i < end; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / (end - from));
}

/** Zerlegt das Signal in nicht-überlappende Rahmen und liefert je Rahmen den RMS. */
export function computeFrameEnergies(
  pcm: Float32Array,
  frameSamples: number,
): Float32Array {
  if (frameSamples <= 0 || pcm.length === 0) return new Float32Array(0);
  const count = Math.ceil(pcm.length / frameSamples);
  const out = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    out[f] = frameRms(pcm, f * frameSamples, f * frameSamples + frameSamples);
  }
  return out;
}

/**
 * Schätzt die Rausch-Untergrenze als niedriges Perzentil der Rahmen-Energien.
 * Robust gegen Sprache (Sprach-Rahmen sind die HOHEN Energien und liegen weit
 * über dem Perzentil). Leere Eingabe → 0.
 */
export function estimateNoiseFloor(
  energies: Float32Array,
  percentile: number = NOISE_PERCENTILE,
): number {
  if (energies.length === 0) return 0;
  const sorted = Array.from(energies).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
  return sorted[idx];
}

/**
 * Adaptive Sprach-Schwelle: das Maximum aus (a) der absoluten Untergrenze und
 * (b) einem Vielfachen der geschätzten Rausch-Untergrenze. So bleibt eine leise
 * Quelle in Stille erkennbar (Schwelle = ABS_MIN_RMS), während in lauter
 * Umgebung die Schwelle über das Rauschen gehoben wird.
 */
export function speechThreshold(
  noiseFloor: number,
  absMin: number = ABS_MIN_RMS,
  ratio: number = NOISE_RATIO,
): number {
  return Math.max(absMin, noiseFloor * ratio);
}

export interface SpeechBounds {
  /** Sample-Index (inklusive) des Sprach-Anfangs (bereits gepolstert, >= 0). */
  start: number;
  /** Sample-Index (exklusive) des Sprach-Endes (bereits gepolstert, <= length). */
  end: number;
}

export interface VadOptions {
  sampleRate?: number;
  absMin?: number;
  ratio?: number;
  minSpeechMs?: number;
  padMs?: number;
}

/**
 * Findet die zusammenhängende Sprach-Region [start,end) im Signal: adaptive
 * Schwelle (Rausch-Floor-Schätzung) + Mindest-Sprachdauer. Innenliegende kurze
 * Pausen bleiben erhalten (nur führende/folgende Stille wird beschnitten, wie
 * trimSilence). Liefert null, wenn KEINE Region die Mindestdauer erreicht
 * (reine Stille/Rauschen) — der Aufrufer behält dann das Originalsignal.
 */
export function detectSpeechBounds(
  pcm: Float32Array,
  opts: VadOptions = {},
): SpeechBounds | null {
  const sampleRate = opts.sampleRate ?? 16000;
  const frameSamples = Math.max(1, Math.floor((sampleRate * FRAME_MS) / 1000));
  const minSpeechFrames = Math.max(
    1,
    Math.round((opts.minSpeechMs ?? MIN_SPEECH_MS) / FRAME_MS),
  );
  const padSamples = Math.floor((sampleRate * (opts.padMs ?? PAD_MS)) / 1000);

  const energies = computeFrameEnergies(pcm, frameSamples);
  if (energies.length === 0) return null;
  const noiseFloor = estimateNoiseFloor(energies);
  const threshold = speechThreshold(noiseFloor, opts.absMin, opts.ratio);

  // Alle zusammenhängenden voiced-Läufe finden, die die Mindestdauer erreichen;
  // firstStart = Beginn des ersten qualifizierten Laufs, lastEnd = Ende des
  // letzten. Innenliegende kurze Pausen bleiben so im Intervall enthalten.
  let firstStart = -1;
  let lastEnd = -1;
  let runStart = -1;
  for (let f = 0; f <= energies.length; f++) {
    const voiced = f < energies.length && energies[f] >= threshold;
    if (voiced) {
      if (runStart === -1) runStart = f;
    } else if (runStart !== -1) {
      if (f - runStart >= minSpeechFrames) {
        if (firstStart === -1) firstStart = runStart;
        lastEnd = f;
      }
      runStart = -1;
    }
  }
  if (firstStart === -1) return null;

  const startSample = Math.max(0, firstStart * frameSamples - padSamples);
  const endSample = Math.min(pcm.length, lastEnd * frameSamples + padSamples);
  if (startSample >= endSample) return null;
  return { start: startSample, end: endSample };
}

/**
 * Beschneidet führende/folgende Stille per adaptiver VAD (s. detectSpeechBounds).
 * Bessere Version von trimSilence (fester 0.01-Schwellwert): schätzt die
 * Rausch-Untergrenze und schneidet auch leises Dauerrauschen weg, ohne echte
 * (auch leise) Sprache zu verlieren. Findet die VAD keine hinreichend lange
 * Sprachregion, wird — wie trimSilence bei reiner Stille — das UNVERÄNDERTE
 * Signal zurückgegeben (nie ein leeres Array).
 */
export function trimSilenceAdaptive(pcm: Float32Array, opts: VadOptions = {}): Float32Array {
  const bounds = detectSpeechBounds(pcm, opts);
  if (!bounds) return pcm;
  return pcm.subarray(bounds.start, bounds.end);
}

export interface GatePush {
  /** Ist DIESER Chunk über der (adaptiven) Sprach-Schwelle? */
  voiced: boolean;
  /** Wurde inzwischen genug zusammenhängende Sprache gesehen (Mindestdauer)? */
  speechConfirmed: boolean;
}

export interface EnergyVadGate {
  /** Verarbeitet einen rohen PCM16-Chunk und meldet voiced/speechConfirmed. */
  push(chunk: Int16Array): GatePush;
  /** Aktuelle Schätzung der Rausch-Untergrenze (für Tests/Diagnose). */
  noiseFloor(): number;
}

/**
 * Zustandsbehafteter Echtzeit-Gate für die streaming-Aufnahme (speech.ts):
 * ersetzt den festen RMS-Schwellwert durch eine adaptive Schwelle über einer
 * MITLAUFENDEN Rausch-Untergrenzen-Schätzung + Mindest-Sprachdauer.
 *
 * - Die Rausch-Untergrenze wird NUR aus nicht-gesprochenen (leisen) Chunks per
 *   langsamer EMA nachgeführt — Sprache hebt sie nicht an.
 * - `speechConfirmed` wird erst true, nachdem MIN_SPEECH_MS zusammenhängend
 *   voiced waren (ein einzelner Klick/Huster löst keine Erkennung aus).
 * - `voiced` steuert wie bisher den Stille-Timeout (lastVoicedAt).
 *
 * Die absolute Untergrenze (ABS_MIN_RMS) sorgt dafür, dass der Gate nie STRENGER
 * als der bisherige feste Schwellwert wird, solange kein Rauschen gemessen wird
 * → keine Regression für leise Quellen in ruhiger Umgebung.
 */
export function createEnergyVadGate(opts: VadOptions = {}): EnergyVadGate {
  const sampleRate = opts.sampleRate ?? 16000;
  const absMin = opts.absMin ?? ABS_MIN_RMS;
  const ratio = opts.ratio ?? NOISE_RATIO;
  const minSpeechMs = opts.minSpeechMs ?? MIN_SPEECH_MS;
  // Langsame Anpassung der Rausch-Untergrenze aus leisen Chunks.
  const NOISE_EMA_ALPHA = 0.1;

  let noiseFloor = 0;
  let voicedRunMs = 0;
  let speechConfirmed = false;

  function pcm16Rms(chunk: Int16Array): number {
    if (chunk.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) {
      const n = chunk[i] / 0x8000;
      sum += n * n;
    }
    return Math.sqrt(sum / chunk.length);
  }

  return {
    push(chunk: Int16Array): GatePush {
      const r = pcm16Rms(chunk);
      const durMs = (chunk.length / sampleRate) * 1000;
      const threshold = Math.max(absMin, noiseFloor * ratio);
      const voiced = r > 0 && r >= threshold;
      if (voiced) {
        voicedRunMs += durMs;
        if (voicedRunMs >= minSpeechMs) speechConfirmed = true;
      } else {
        voicedRunMs = 0;
        // Rausch-Untergrenze nur aus leisen Chunks nachführen.
        noiseFloor =
          noiseFloor === 0 ? r : noiseFloor * (1 - NOISE_EMA_ALPHA) + r * NOISE_EMA_ALPHA;
      }
      return { voiced, speechConfirmed };
    },
    noiseFloor: () => noiseFloor,
  };
}
