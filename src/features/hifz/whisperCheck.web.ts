// "Präzisions-Modus" der Rezitations-Prüfung (nur Web): On-Device-Whisper
// (onnx-community/whisper-base, quantisiert) via transformers.js aus dem
// jsDelivr-CDN. Läuft komplett lokal im Browser — keine Kosten, kein Account,
// keine Übertragung der Aufnahme an irgendeinen Server (Datenschutz!).
// Feasibility live verifiziert: echte Alafasy-Rezitation von 1:1 wurde
// headless korrekt zu "بسم الله الرحمن الرحيم" transkribiert (~4,5s).
//
// Grenze bleibt (ehrlich, auch im UI): Whisper transkribiert Wörter —
// Madd-Länge/Ghunna-Feinheiten bewertet auch dieses Modell nicht.

type Transcriber = (
  audio: Float32Array,
  options: { language?: string; task?: string; chunk_length_s?: number; stride_length_s?: number },
) => Promise<{ text: string }>;

export type WhisperProgress = { status: 'downloading'; percent: number } | { status: 'ready' };

// Parität zur nativen whisperCheck.ts, damit named-Importe (z. B. in
// app/hifz/[surah].tsx) auch im Web-Bundle existieren — geteilte Quelle in
// whisperError.ts.
export {
  WhisperFehler,
  WhisperError,
  istModellFehler,
  fehlerCode,
  fehlerDetail,
  beschreibeWhisperFehler,
  type WhisperFehlerCode,
  type WhisperFehlerInfo,
} from './whisperError';

export interface WhisperDiagnose {
  modellVorhanden: boolean;
  mikrofonStatus: string;
  audioModulGelinkt: boolean;
}

/** Web-Parität zu whisperCheck.ts::whisperDiagnose (Browser-Fähigkeiten prüfen). */
export async function whisperDiagnose(): Promise<WhisperDiagnose> {
  let mikrofonStatus = 'unknown';
  try {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      mikrofonStatus = p.state === 'prompt' ? 'undetermined' : p.state;
    }
  } catch {
    mikrofonStatus = 'unknown';
  }
  return {
    modellVorhanden: whisperSupported(),
    mikrofonStatus,
    audioModulGelinkt: whisperSupported(),
  };
}

// Metro darf den CDN-Import nicht statisch auflösen — Indirektion über
// Function. Sicherheit: der Function-Body ist ein KONSTANTES Literal ohne
// jede Interpolation; die URL kommt als Parameter herein und ist selbst
// eine Konstante (CDN_URL) — kein Injektionsvektor.
const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<{
  pipeline: (task: string, model: string, opts: object) => Promise<Transcriber>;
  env: { allowLocalModels: boolean; localModelPath: string; allowRemoteModels: boolean };
}>;

const CDN_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.1';
// 1. Wahl: KORAN-feingetuntes Whisper (tarteel-ai/whisper-base-ar-quran),
// selbst zu ONNX konvertiert (optimum) und auf der EIGENEN Webseite gehostet
// (/models/ im Static-Export) — kein HF-Account, keine Drittanbieter-Downloads.
// Headless validiert: transkribiert Husary-Rezitation exakt UND vollständig
// vokalisiert ("قُلْ أَعُوذُ بِرَبِّ النَّاسِ"), wo generisches whisper-base
// versagte. Achtung: arabisch-only-Modell — KEINE language/task-Optionen.
const QURAN_MODEL_ID = 'whisper-base-ar-quran';
// Fallback (z. B. Dev-Server ohne /models/): generisches mehrsprachiges Modell.
const FALLBACK_MODEL_ID = 'onnx-community/whisper-base';

let transcriberPromise: Promise<Transcriber> | null = null;
/** Braucht das geladene Modell language/task-Optionen? (nur das generische) */
let loadedNeedsLanguageOptions = false;

/**
 * Stille am Anfang/Ende abschneiden (einfacher Amplituden-Schwellwert) —
 * weniger Audio = schnellere Transkription und weniger Halluzinationsfläche
 * bei langen Pausen vor/nach der Rezitation.
 */
export function trimSilence(pcm: Float32Array, threshold = 0.01, sampleRate = 16000): Float32Array {
  const pad = Math.floor(sampleRate * 0.2); // 200ms Kontext behalten
  let start = 0;
  while (start < pcm.length && Math.abs(pcm[start]) < threshold) start++;
  let end = pcm.length - 1;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;
  if (start >= end) return pcm; // reine Stille — unverändert lassen
  return pcm.subarray(Math.max(0, start - pad), Math.min(pcm.length, end + pad));
}

export function whisperSupported(): boolean {
  return (
    typeof WebAssembly !== 'undefined' &&
    typeof AudioContext !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** Lädt Modell einmalig (Browser-Cache hält die Dateien für Folgebesuche). */
export function loadWhisper(onProgress?: (p: WhisperProgress) => void): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await dynamicImport(CDN_URL);
      const seen = new Map<string, number>();
      const progressCallback = (p: { status?: string; file?: string; progress?: number }) => {
        if (p.status === 'progress' && p.file && typeof p.progress === 'number') {
          seen.set(p.file, p.progress);
          const values = [...seen.values()];
          const percent = values.reduce((a, b) => a + b, 0) / values.length;
          onProgress?.({ status: 'downloading', percent: Math.round(percent) });
        }
      };
      const load = (modelId: string, device?: 'webgpu') =>
        pipeline('automatic-speech-recognition', modelId, {
          dtype: 'q8',
          ...(device ? { device } : {}),
          progress_callback: progressCallback,
        });

      // WebGPU ist um ein Mehrfaches schneller — aber nicht überall verfügbar
      // (Safari/ältere Browser); bei Fehlschlag sauber auf WASM zurückfallen.
      let transcriber: Transcriber;
      try {
        // Selbst gehostetes Koran-Modell (gleiche Origin, /models/).
        env.allowLocalModels = true;
        env.localModelPath = '/models/';
        env.allowRemoteModels = false;
        loadedNeedsLanguageOptions = false;
        try {
          transcriber = await load(QURAN_MODEL_ID, 'webgpu');
        } catch {
          transcriber = await load(QURAN_MODEL_ID);
        }
      } catch {
        // Fallback: generisches Modell vom HF-CDN (braucht language-Optionen).
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        loadedNeedsLanguageOptions = true;
        try {
          transcriber = await load(FALLBACK_MODEL_ID, 'webgpu');
        } catch {
          transcriber = await load(FALLBACK_MODEL_ID);
        }
      }
      onProgress?.({ status: 'ready' });
      return transcriber;
    })().catch((e) => {
      transcriberPromise = null; // nächster Versuch darf neu laden
      throw e;
    });
  }
  return transcriberPromise;
}

export interface WhisperRecorder {
  /**
   * Beendet die Aufnahme und liefert Transkripte in mehreren Tempo-Varianten
   * (Original + beschleunigt) — der Aufrufer wertet die beste gegen den
   * Zieltext. Grund: sehr langsames, gedehntes Silben-Lesen ("Vorschüler")
   * klingt für das Modell unnatürlich; die beschleunigte Variante gleicht
   * das aus, ohne schnelle Leser zu verschlechtern.
   */
  stop: () => Promise<string[]>;
  /** Bricht ab, ohne zu transkribieren. */
  cancel: () => void;
}

/** Einfaches lineares Resampling auf ein Tempo-Vielfaches (1.5 = schneller). */
export function speedUp(pcm: Float32Array, factor: number): Float32Array {
  const outLen = Math.max(1, Math.floor(pcm.length / factor));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * factor;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    out[i] = pcm[i0] * (1 - frac) + (pcm[i0 + 1] ?? pcm[i0]) * frac;
  }
  return out;
}

const MAX_RECORDING_MS = 45000;

/** Startet eine Mikrofon-Aufnahme; stop() transkribiert lokal per Whisper. */
export async function startWhisperRecording(
  onProgress?: (p: WhisperProgress) => void,
): Promise<WhisperRecorder> {
  // Modell parallel zum Sprechen laden/aufwärmen.
  const transcriberReady = loadWhisper(onProgress);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();
  const safety = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, MAX_RECORDING_MS);

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  function cleanup() {
    clearTimeout(safety);
    stream.getTracks().forEach((t) => t.stop());
  }

  return {
    cancel: () => {
      if (recorder.state === 'recording') recorder.stop();
      cleanup();
    },
    stop: async () => {
      if (recorder.state === 'recording') recorder.stop();
      await stopped;
      cleanup();
      const blob = new Blob(chunks);
      const buf = await blob.arrayBuffer();
      // 16 kHz mono — das Eingabeformat von Whisper; der AudioContext
      // resampelt beim Dekodieren automatisch.
      const ctx = new AudioContext({ sampleRate: 16000 });
      try {
        const decoded = await ctx.decodeAudioData(buf);
        const pcm = trimSilence(decoded.getChannelData(0));
        const transcriber = await transcriberReady;
        // chunk_length_s: Whisper verarbeitet 30s-Fenster — ohne Chunking
        // würden längere Aufnahmen stillschweigend abgeschnitten.
        // BEWUSST kein initial_prompt mit dem Zielvers: das würde das Modell
        // in Richtung des korrekten Textes "ziehen" und Fehler übertünchen —
        // für eine ehrliche Bewertung muss die Transkription unvoreingenommen sein.
        // Das Koran-Modell ist arabisch-only (language/task sind dort
        // unzulässig und werfen); nur das generische Fallback braucht sie.
        const options = {
          chunk_length_s: 30,
          stride_length_s: 5,
          ...(loadedNeedsLanguageOptions ? { language: 'arabic', task: 'transcribe' } : {}),
        };
        const transcripts: string[] = [];
        for (const variant of [pcm, speedUp(pcm, 1.5)]) {
          const out = await transcriber(variant, options);
          if (out.text?.trim()) transcripts.push(out.text);
        }
        return transcripts;
      } finally {
        ctx.close().catch(() => {});
      }
    },
  };
}
