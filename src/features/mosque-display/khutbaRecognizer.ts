import {
  loadWhisperContext,
  SAMPLE_RATE,
  startPcmCapture,
  tailWindow,
  transcribePcm,
  whisperSupported,
} from '@/features/hifz/whisperCheck';
import { trimSilenceAdaptive } from '@/features/hifz/vad';

export type KhutbaSourceLang = 'ar' | 'de' | 'tr' | 'en' | 'auto';

const MIN_CHUNK_MS = 3000;
const MAX_CHUNK_MS = 8000;

function int16ToFloat32(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
  return out;
}

export function khutbaRecognizerSupported(): boolean {
  return whisperSupported();
}

function whisperLang(code: KhutbaSourceLang): string | undefined {
  if (code === 'auto') return undefined;
  return code;
}

export type KhutbaStreamHandle = {
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
};

/** Kontinuierliche Khutba-ASR in 3–8-Sek.-Segmenten — Hifz-Pfad bleibt unberührt. */
export async function startKhutbaStreamingRecognizer(opts: {
  language: KhutbaSourceLang;
  onLine: (text: string) => void | Promise<void>;
}): Promise<KhutbaStreamHandle> {
  if (!khutbaRecognizerSupported()) throw new Error('khutba_asr_unavailable');
  const whisperContext = await loadWhisperContext();
  let paused = false;
  let stopped = false;
  let chunkStart = Date.now();
  let tick = 0;
  let transcribing = false;

  const capture = await startPcmCapture();

  const interval = setInterval(() => {
    if (stopped || paused || transcribing) return;
    const elapsed = Date.now() - chunkStart;
    if (elapsed < MIN_CHUNK_MS) return;
    const pcm16 = capture.snapshot();
    if (pcm16.length < SAMPLE_RATE * 0.8) return;
    const float32 = int16ToFloat32(pcm16);
    const trimmed = trimSilenceAdaptive(float32);
    if (trimmed.length < SAMPLE_RATE * 0.35) {
      if (elapsed >= MAX_CHUNK_MS) chunkStart = Date.now();
      return;
    }
    const window = tailWindow(trimmed, Math.min(8, trimmed.length / SAMPLE_RATE));
    transcribing = true;
    const file = `khutba-chunk-${tick++}.wav`;
    void (async () => {
      try {
        const text = await transcribePcm(window, whisperContext, file, undefined, {
          fast: true,
          skipIfBusy: true,
          language: whisperLang(opts.language),
        });
        if (text.trim() && !stopped && !paused) await opts.onLine(text.trim());
      } catch {
        /* Zwischenstands-Fehler nicht eskalieren */
      } finally {
        transcribing = false;
        chunkStart = Date.now();
      }
    })();
  }, 900);

  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      chunkStart = Date.now();
    },
    stop: async () => {
      stopped = true;
      clearInterval(interval);
      capture.stopCapture();
    },
  };
}