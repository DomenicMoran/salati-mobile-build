// Native Variante des "Präzisions-Modus" (On-Device-Whisper) — Gegenstück zu
// whisperCheck.web.ts (transformers.js/WASM im Browser). Gleiches Prinzip,
// andere Runtime: whisper.rn (React Native Binding von whisper.cpp) statt
// transformers.js, GGML-Modell statt ONNX.
//
// Modell-Wahl (siehe whisperModel.ts für die volle Begründung): Anders als
// die Web-Version nutzt dies NICHT das Koran-Finetune tarteel-ai/
// whisper-base-ar-quran (dafür existiert keine fertige GGML-Konvertierung,
// und eine eigene Konvertierung ist ein eigenständiger Offline-Asset-Schritt,
// hier nicht blind gebaut) — sondern das offizielle generische mehrsprachige
// whisper.cpp-"base"-Modell (q5_1-quantisiert). Ehrlich benannt: dadurch
// etwas ungenauer bei tajwid-spezifischen Ausspracheformen als die
// Web-Version, aber für reine Wort-Erkennung funktionsfähig.
//
// Aufnahme-Architektur: whisper.rn selbst bietet für Mikrofon-Aufnahmen nur
// den RealtimeTranscriber-Pfad (braucht zusätzlich eine VAD und ist auf
// kontinuierliches Slicing ausgelegt) — für "einmal aufnehmen, am Ende
// transkribieren" (wie MediaRecorder im Web) reicht das nicht direkt. Daher
// hier direkt @fugood/react-native-audio-pcm-stream (liefert rohe 16-Bit-PCM-
// Chunks als Base64 über ein 'data'-Event, plattformübergreifend), die
// Sample-Sammlung + WAV-Kodierung passiert selbst (siehe encodeWav/writeWavFile
// unten) — exakt das gleiche Prinzip wie MediaRecorder→decodeAudioData im Web,
// nur dass wir hier den PCM-Puffer direkt bekommen statt ihn zu dekodieren.
//
// WICHTIG (ehrlich, siehe Abschluss-Bericht): NICHT auf einem echten
// Android/iOS-Build verifiziert (kein Android-SDK auf diesem Rechner
// installiert) — nur gegen die whisper.rn-/audio-pcm-stream-Quellen auf
// GitHub geprüft (Native-Modul-Quellcode gelesen, um die tatsächliche
// stop()/on('data')-Semantik zu verifizieren, da die mitgelieferten
// TypeScript-Typen dort teilweise irreführend sind — siehe die
// declare-module-Ambient-Deklaration weiter unten für Details).

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import {
  istWhisperModellHeruntergeladen,
  whisperModellHerunterladen,
  whisperModellLoeschen,
  whisperModellPfad,
} from './whisperModel';
import { WhisperError, WhisperFehler } from './whisperError';
import { createTranscribeSerializer } from './transcribeSerializer';
import { trimSilenceAdaptive } from './vad';

// Beide nativen Pakete werden bewusst per require() statt per import geladen
// und auf selbst geschriebene (gegen die tatsächlichen Quellen verifizierte)
// Interfaces gecastet — nicht aus Stil-Vorliebe, sondern weil beide
// mitgelieferten Typ-Auflösungen für DIESES Projekt (Expo-SDK-57-
// tsconfig.base mit `moduleResolution:"bundler"` + `customConditions:
// ["react-native"]`) nachweislich kaputt sind:
//
// 1) whisper.rn@0.7.0: package.json "exports" listet je Subpath die
//    Bedingung "react-native" VOR "types" → tsc lädt (wegen der
//    customConditions-Einstellung) die ROHE TS-Quelle (src/index.ts) statt
//    der vorkompilierten lib/typescript/*.d.ts. Diese Quelle setzt eine
//    RN-eigene Build-Umgebung voraus (u. a. den globalen `global`-Typ ohne
//    Ambient-Deklaration) und lässt sich außerhalb von whisper.rns eigenem
//    tsconfig nicht typprüfen (TS2304 "Cannot find name 'global'", live
//    reproduziert 2026-07-20). Es gibt auch KEINEN "."-Export-Eintrag, ein
//    bare `import ... from 'whisper.rn'` scheitert daher zusätzlich an der
//    Modulauflösung selbst (TS2307) — sowohl in tsc als auch in Metro
//    (unstable_enablePackageExports ist in dieser Metro-Version Default-true).
// 2) @fugood/react-native-audio-pcm-stream: mitgelieferte .d.ts deklariert
//    den FALSCHEN Modulnamen "react-native-live-audio-stream" (Upstream-Fork-
//    Rest) UND ist sachlich falsch (`stop: () => Promise<string>`,
//    `wavFile`-Option) — gegen den echten nativen Quellcode (Android
//    RNLiveAudioStreamModule.java, iOS RNLiveAudioStream.m, GitHub geprüft
//    2026-07-20) falsifiziert: `stop()` ist dort ein reines `void`-
//    @ReactMethod, `wavFile` wird auf keiner Plattform gelesen. Deshalb baut
//    startPcmCapture() unten die WAV-Datei selbst statt sich auf
//    `wavFile`/`stop()`-Rückgabewerte zu verlassen.
//
// require() lässt tsc beide Pakete komplett ungeprüft (liefert `any`) — die
// Casts unten sind die einzige Typ-Quelle, jeweils gegen die echte API
// verifiziert (whisper.rn: src/NativeRNWhisper.ts; audio-pcm-stream: android/
// RNLiveAudioStreamModule.java + ios/RNLiveAudioStream.m).
interface WhisperTranscribeResult {
  result: string;
  // whisper.rn liefert isAborted:true, wenn die Dekodierung abgebrochen wurde
  // (z. B. stop() während des Laufs, oder ein interner Abbruch) — dann ist
  // `result` unvollständig/leer. Vorher ignoriert → als „nichts erkannt" oder
  // generischer Fehler getarnt. Jetzt explizit erkannt + geloggt.
  isAborted?: boolean;
}
interface WhisperTranscribeHandle {
  // whisper.rn 0.7.0: stop() ruft nativ whisperAbortTranscribe und ist async
  // (src/index.ts runTranscription) — gegen die echte Quelle verifiziert, nicht
  // das frühere synchrone `() => void`. Wird für den Kontext-Cleanup awaited.
  stop: () => Promise<void>;
  promise: Promise<WhisperTranscribeResult>;
}
// Optionen 1:1 gegen die echte whisper.rn-0.7.0-API getypt (lib/typescript/
// NativeRNWhisper.d.ts → TranscribeOptions) und gegen die native Auswertung in
// cpp/jsi/RNWhisperJSI.cpp (createTranscribeConfig) verifiziert: Property-Namen
// sind camelCase (maxThreads, temperatureInc, beamSize, bestOf, maxContext) und
// werden dort auf die whisper.cpp-params gemappt.
interface WhisperTranscribeOptions {
  language?: string;
  // Genauigkeit: Beam-Search statt Greedy-Dekodierung. whisper.rn/whisper.cpp
  // unterstützt beides — beamSize>0 aktiviert die (deutlich genauere, etwas
  // langsamere) Strahlsuche. temperature 0 = deterministisch.
  beamSize?: number;
  bestOf?: number;
  temperature?: number;
  // Temperatur-Fallback: schlägt eine Dekodierung die Qualitätsschwellen von
  // whisper.cpp (compression_ratio/avg_logprob) → Wiederholung/Halluzination,
  // wird mit temperature += temperatureInc neu versucht. Gerade bei starkem
  // Prompt wichtig, damit das Modell nicht in eine Prompt-Echo-Schleife läuft.
  temperatureInc?: number;
  // Rechen-Threads. whisper.rn-Default ist konservativ (2 auf 4-Kern-Geräten) —
  // mehr Threads = schnellere Dekodierung = die Live-Erkennung hält mit dem
  // Rezitieren Schritt statt „den Faden zu verlieren".
  maxThreads?: number;
  // Obergrenze der Prompt-/Kontext-Tokens (whisper.cpp n_max_text_ctx, zusätzlich
  // hart auf n_text_ctx/2 = 224 beim base-Modell gedeckelt).
  maxContext?: number;
  // Conditioning: der erwartete Ayah-Text als Prior. whisper.cpp nutzt den
  // Prompt als vorangestellten Kontext, sodass die Dekodierung stark auf
  // die korrekten Koran-Wörter/Diakritika gezogen wird (Tarteel-Prinzip).
  // Steigert die Erkennung korrekter Rezitation deutlich; s.
  // transcribePcm(expectedText).
  prompt?: string;
}
interface WhisperContext {
  transcribe: (filePathOrBase64: string, options?: WhisperTranscribeOptions) => WhisperTranscribeHandle;
}
interface InitWhisperOptions {
  filePath: string;
  // iOS: Metal-GPU-Beschleunigung (Android: no-op, wird nativ ignoriert). Deutlich
  // schnellere Dekodierung auf iPhones → Live-Beam hält Schritt. useCoreMLIos wird
  // bei aktivem GPU nativ ignoriert (wir bündeln ohnehin keine CoreML-Assets).
  useGpu?: boolean;
  // Flash-Attention — nur mit GPU sinnvoll (whisper.rn-Empfehlung).
  useFlashAttn?: boolean;
}
interface WhisperModule {
  initWhisper: (options: InitWhisperOptions) => Promise<WhisperContext>;
}
interface AudioPcmStreamOptions {
  sampleRate: number;
  channels: 1 | 2;
  bitsPerSample: 8 | 16;
  bufferSize?: number;
}
interface AudioPcmStreamSubscription {
  remove: () => void;
}
interface AudioPcmStream {
  init: (options: AudioPcmStreamOptions) => Promise<void>;
  start: () => void;
  stop: () => void;
  on: (event: 'data', callback: (base64Chunk: string) => void) => AudioPcmStreamSubscription;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- s.o., bewusster Bypass kaputter Typ-Auflösung
const { initWhisper } = require('whisper.rn/index') as WhisperModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- s.o., bewusster Bypass kaputter Typ-Auflösung
const AudioRecordModule = require('@fugood/react-native-audio-pcm-stream').default as AudioPcmStream;

export type WhisperProgress = { status: 'downloading'; percent: number } | { status: 'ready' };

// Distinkte Fehler-Codes + Fehlerklasse leben jetzt in whisperError.ts (geteilt
// mit dem Web-Pfad und der UI). Hier nur re-exportiert, damit bestehende Importe
// aus '@/features/hifz/whisperCheck' unverändert weiterlaufen.
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

export interface WhisperRecorder {
  /** Beendet die Aufnahme und liefert Transkript-Varianten (Original + beschleunigt). */
  stop: () => Promise<string[]>;
  /** Bricht ab, ohne zu transkribieren. */
  cancel: () => void;
}

export const SAMPLE_RATE = 16000;
const MAX_RECORDING_MS = 45000;
// Rechen-Threads für whisper.cpp. Der whisper.rn-Default ist konservativ (2 auf
// 4-Kern-Geräten). 4 ist auf modernen Handys (≥6 Kerne) der Sweet-Spot — mehr
// Threads bringen bei whisper kaum noch etwas (bandbreitengebunden), 4 hebt aber
// spürbar die Low-End-Latenz an, wo der Default nur 2 nutzt.
const WHISPER_THREADS = 4;
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Native Plattform (iOS/Android) mit gelinktem whisper.rn-Modul — anders als
 * beim Web-Pendant (das echte Browser-API-Verfügbarkeit prüft) hängt "geht
 * das technisch" hier nicht vom Modell-Download ab: Download+Laden passiert
 * transparent beim ersten startWhisperRecording()-Aufruf (Fortschritt über
 * onProgress, exakt wie loadWhisper() im Web). Würde whisperSupported() statt
 * dessen "Modell bereits heruntergeladen" bedeuten, könnte der Mikro-Button
 * (dessen Sichtbarkeit in app/hifz/[surah].tsx von whisperSupported()
 * abhängt) vor dem allerersten Download nie erscheinen — ein Deadlock, aus
 * dem die Funktion nie hätte starten können. Ersetzt den früheren
 * permanenten `return false`-Stub durch ein echtes Capability-Signal.
 */
export function whisperSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export interface WhisperDiagnose {
  /** Ist das GGML-Modell vollständig + mit gültigem Header vorhanden? */
  modellVorhanden: boolean;
  /** Mikrofon-Freigabe: 'granted' | 'denied' | 'undetermined' (ohne Nachfrage geprüft). */
  mikrofonStatus: string;
  /** Ist das native Audio-Modul überhaupt eingebunden? */
  audioModulGelinkt: boolean;
}

/**
 * Momentaufnahme für die On-Screen-Diagnose (Modell da? Mikrofon erlaubt?
 * Audio-Modul gelinkt?) — fragt die Freigabe NICHT an, liest sie nur. Wirft nie;
 * ein Fehler beim Lesen liefert konservative Defaults.
 */
export async function whisperDiagnose(): Promise<WhisperDiagnose> {
  let modellVorhanden = false;
  try {
    modellVorhanden = await istWhisperModellHeruntergeladen();
  } catch {
    modellVorhanden = false;
  }
  let mikrofonStatus = 'unknown';
  try {
    const p = await getRecordingPermissionsAsync();
    mikrofonStatus = p.status;
  } catch {
    mikrofonStatus = 'unknown';
  }
  return {
    modellVorhanden,
    mikrofonStatus,
    audioModulGelinkt: !!AudioRecordModule && typeof AudioRecordModule.init === 'function',
  };
}

let whisperContextPromise: Promise<WhisperContext> | null = null;

// App-weite Serialisierung ALLER Transkriptionen auf dem geteilten Singleton-
// Kontext. whisper.rn erlaubt pro Kontext nur EINE transcribe() gleichzeitig —
// ein zweiter Aufruf, solange der vorige Job läuft, wirft nativ „Context is
// already transcribing" (Gerät-Report 2026-07-22). Genau EIN Serializer für den
// EINEN Kontext (s. transcribeSerializer.ts). transcribePcm() läuft ausschließlich
// durch diesen; Live-Ticks nutzen skipIfBusy, Final-Durchläufe reihen sich ein.
const transcribeSerializer = createTranscribeSerializer();
// Handle der GERADE laufenden Transkription (für sauberen Abbruch beim Verlassen
// des Screens). null = kein Lauf aktiv.
let aktivesHandle: WhisperTranscribeHandle | null = null;

/** True, solange eine Transkription auf dem geteilten Kontext läuft oder eingereiht ist. */
export function transkriptionLaeuft(): boolean {
  return transcribeSerializer.istBesetzt();
}

/**
 * Bricht eine evtl. laufende Transkription ab und wartet, bis der geteilte
 * Kontext wieder frei ist. Für Screen-Cleanup (unmount / Vers-Wechsel), damit
 * der Singleton-Kontext nie „busy" hängen bleibt und der nächste Lauf sofort
 * starten kann. Wirft nie.
 */
export async function transkriptionenAbbrechen(): Promise<void> {
  try {
    await aktivesHandle?.stop();
  } catch {
    /* stop() ist best-effort — ein Fehler beim Abbrechen darf den Cleanup nicht stoppen */
  }
  await transcribeSerializer.leerlauf();
}

/** Lädt (bei Bedarf herunterladend) das GGML-Modell einmalig; parallele Aufrufe teilen sich das Laden. */
export function loadWhisperContext(onProgress?: (p: WhisperProgress) => void): Promise<WhisperContext> {
  if (!whisperContextPromise) {
    whisperContextPromise = (async () => {
      // 1) Modell sicherstellen. istWhisperModellHeruntergeladen prüft jetzt auch
      //    den GGML-Header (n_text_ctx=448) — ein größenmäßig vollständiger, aber
      //    beschädigter File wird als „nicht da" gemeldet und hier neu geladen.
      if (!(await istWhisperModellHeruntergeladen())) {
        try {
          await whisperModellHerunterladen((p) =>
            onProgress?.({ status: 'downloading', percent: Math.round(p.anteil * 100) }),
          );
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          console.error('[whisper] Modell-Download/Verifikation fehlgeschlagen', {
            pfad: whisperModellPfad(),
            fehler: detail,
          });
          throw new WhisperError(WhisperFehler.modelDownload, detail);
        }
      }
      // 2) Kontext initialisieren. Schlägt das trotz gültigem Header/Size fehl,
      //    ist der File real inkompatibel/kaputt → löschen, damit der NÄCHSTE
      //    Versuch frisch lädt (statt dauerhaft am selben File zu scheitern).
      try {
        // useGpu: auf iOS Metal-Beschleunigung (Android ignoriert es nativ) —
        // schnellere Dekodierung, damit die Live-Erkennung Schritt hält. Kein
        // useFlashAttn (nur mit stabilem GPU-Pfad empfohlen; konservativ aus).
        const ctx = await initWhisper({ filePath: whisperModellPfad(), useGpu: true });
        onProgress?.({ status: 'ready' });
        return ctx;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error('[whisper] initWhisper fehlgeschlagen — Modell wird verworfen', {
          pfad: whisperModellPfad(),
          fehler: detail,
        });
        await whisperModellLoeschen().catch(() => {});
        throw new WhisperError(WhisperFehler.modelInit, detail);
      }
    })().catch((e) => {
      whisperContextPromise = null; // nächster Versuch darf neu laden
      throw e;
    });
  }
  return whisperContextPromise;
}

// ---------------------------------------------------------------------------
// Roh-PCM-Hilfsfunktionen (byteweise Base64, KEIN UTF-8-Text — die
// UTF-8-sichere Kodierung in features/sync/base64.ts ist für Sync-Codes
// gedacht und würde Audio-Binärdaten korrumpieren, siehe deren Kopfkommentar).
// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  const out = new Uint8Array(Math.ceil((b64.length * 3) / 4));
  let outIdx = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64.charCodeAt(i);
    const idx = BASE64_CHARS.indexOf(b64[i]);
    if (c === 61 /* '=' */ || idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIdx++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIdx);
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    result += BASE64_CHARS[(chunk >> 18) & 0x3f];
    result += BASE64_CHARS[(chunk >> 12) & 0x3f];
    result += b1 !== undefined ? BASE64_CHARS[(chunk >> 6) & 0x3f] : '=';
    result += b2 !== undefined ? BASE64_CHARS[chunk & 0x3f] : '=';
  }
  return result;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  // Auf gerade Byte-Länge kappen (16-Bit-Samples brauchen Paare) — ein
  // einzelnes überzähliges Byte an einer Chunk-Grenze wird verworfen.
  return out.subarray(0, total - (total % 2));
}

function bytesToInt16(bytes: Uint8Array): Int16Array {
  // Little-Endian auf beiden Plattformen (Android AudioRecord.read() und iOS
  // AudioQueue mit linearem PCM ohne BigEndian-Flag) — Quellcode beider
  // Native-Module geprüft, siehe Kommentar oben.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Int16Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true);
  return out;
}

function int16ToFloat32(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}

function float32ToInt16(pcm: Float32Array): Int16Array {
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Stille am Anfang/Ende abschneiden — Pendant zu trimSilence() in whisperCheck.web.ts. */
export function trimSilence(pcm: Float32Array, threshold = 0.01, sampleRate = SAMPLE_RATE): Float32Array {
  const pad = Math.floor(sampleRate * 0.2);
  let start = 0;
  while (start < pcm.length && Math.abs(pcm[start]) < threshold) start++;
  let end = pcm.length - 1;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;
  if (start >= end) return pcm;
  return pcm.subarray(Math.max(0, start - pad), Math.min(pcm.length, end + pad));
}

// Rollendes Audio-Fenster für die kontinuierliche Ganz-Sure-Erkennung: nur die
// letzten CONTINUOUS_WINDOW_SEC Sekunden werden je Durchlauf transkribiert
// (statt des immer länger werdenden Gesamt-Puffers). Grund: (1) O(n²)-Kosten +
// mit der Sure wachsende Latenz vermeiden, damit die Live-Erkennung mit dem
// Rezitierenden Schritt hält; (2) das Fenster deckt die AKTUELLE Rezitations-
// stelle ab, sodass der gleitende erwarteter-Text-Prompt (reciteProgress.ts)
// zum tatsächlich gehörten Audio passt. Aufeinanderfolgende Fenster (Intervall
// ~1,5 s « Fensterlänge) überlappen stark → keine verlorenen Wörter an den
// Fenstergrenzen. Für kurze Suren (< Fensterlänge) unverändert = ganzer Puffer.
export const CONTINUOUS_WINDOW_SEC = 24;

/** Letzte `seconds` Sekunden der Aufnahme (oder alles, falls kürzer). */
export function tailWindow(pcm: Float32Array, seconds: number, sampleRate = SAMPLE_RATE): Float32Array {
  const maxSamples = Math.floor(seconds * sampleRate);
  if (pcm.length <= maxSamples) return pcm;
  return pcm.subarray(pcm.length - maxSamples);
}

/** Lineares Resampling auf ein Tempo-Vielfaches — Pendant zu speedUp() in whisperCheck.web.ts. */
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

/** Baut eine minimale 16-Bit-Mono-WAV-Datei (44-Byte-RIFF-Header + PCM-Daten). */
function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const byteLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM-Chunk-Größe
  view.setUint16(20, 1, true); // Audio-Format = PCM
  view.setUint16(22, 1, true); // Kanäle = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte-Rate
  view.setUint16(32, 2, true); // Block-Align
  view.setUint16(34, 16, true); // Bits pro Sample
  writeStr(36, 'data');
  view.setUint32(40, byteLength, true);
  new Int16Array(buffer, 44).set(samples);
  return new Uint8Array(buffer);
}

async function writeWavFile(path: string, samples: Int16Array, sampleRate: number): Promise<void> {
  const wavBytes = encodeWav(samples, sampleRate);
  await FileSystem.writeAsStringAsync(path, bytesToBase64(wavBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

// ---------------------------------------------------------------------------
// Roh-PCM-Aufnahme — von speech.ts (fast mode) wiederverwendet, siehe dort.
// ---------------------------------------------------------------------------

export interface PcmCapture {
  /** Beendet die native Aufnahme (Event-Listener wird entfernt) und liefert die gesammelten PCM16-Samples. */
  stopCapture: () => Int16Array;
  /** Liefert die BISHER gesammelten Samples, OHNE die Aufnahme zu beenden (für Live-/Zwischen-Transkription). */
  snapshot: () => Int16Array;
}

/**
 * Startet die rohe Mikrofon-Aufnahme (16 kHz/16-Bit/mono). Wirft
 * 'whisper_permission_denied', wenn die Mikrofon-Berechtigung fehlt.
 */
export async function startPcmCapture(onChunk?: (pcm: Int16Array) => void): Promise<PcmCapture> {
  // Native-Modul-Guard: ist @fugood/react-native-audio-pcm-stream nicht in den
  // Build gelinkt (z. B. Expo Go / fehlgeschlagenes Prebuild), ist das Default-
  // Objekt zwar da, aber seine Methoden rufen ein undefined NativeModule auf und
  // werfen kryptisch. Lieber sofort ein klares „nicht verfügbar" mit Detail.
  if (!AudioRecordModule || typeof AudioRecordModule.init !== 'function') {
    throw new WhisperError(
      WhisperFehler.unavailable,
      'Natives Audio-Modul (RNLiveAudioStream) nicht gelinkt — Dev-/Prebuild ohne das Modul?',
    );
  }

  // Mikrofon-Freigabe EXPLIZIT zur Laufzeit anfragen (löst unter Android/iOS den
  // System-Dialog aus, falls noch nicht entschieden). Ohne diese Anfrage schlägt
  // die native AudioRecord-Initialisierung stumm fehl → wirkte wie „nicht
  // verfügbar". Bei Verweigerung: distinkter Code + Status im Detail.
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    const detail = `status=${permission.status}; canAskAgain=${permission.canAskAgain}`;
    console.error('[whisper] Mikrofon-Berechtigung nicht erteilt', {
      status: permission.status,
      canAskAgain: permission.canAskAgain,
    });
    throw new WhisperError(WhisperFehler.permission, detail);
  }

  try {
    // Der native init() lehnt (Android) mit „AudioRecord initialization failed"
    // ab, wenn das AudioRecord-Objekt nicht in den Zustand STATE_INITIALIZED
    // kommt — typische reale Ursachen: Freigabe erst gerade erteilt aber Hardware
    // noch belegt, ein anderes App/OS-Objekt hält das Mikro, oder eine nicht
    // unterstützte Sample-Rate. Als distinkter audioInit-Code melden statt roh.
    await AudioRecordModule.init({ sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[whisper] Audio-Aufnahme konnte nicht initialisiert werden', {
      sampleRate: SAMPLE_RATE,
      fehler: detail,
    });
    throw new WhisperError(WhisperFehler.audioInit, detail);
  }
  const chunks: Uint8Array[] = [];
  const subscription = AudioRecordModule.on('data', (b64: string) => {
    const bytes = base64ToBytes(b64);
    chunks.push(bytes);
    if (onChunk && bytes.length >= 2) onChunk(bytesToInt16(bytes.subarray(0, bytes.length - (bytes.length % 2))));
  });
  AudioRecordModule.start();

  let stopped = false;
  return {
    stopCapture: () => {
      if (!stopped) {
        stopped = true;
        AudioRecordModule.stop();
        subscription.remove();
      }
      return bytesToInt16(concatBytes(chunks));
    },
    // Kopie der bisher gesammelten Chunks (Aufnahme läuft weiter). concatBytes
    // kappt auf gerade Byte-Länge, sodass jederzeit ein valides PCM16 entsteht.
    snapshot: () => bytesToInt16(concatBytes(chunks)),
  };
}

/**
 * Transkribiert Float32-PCM-Samples (16 kHz mono) über das geladene
 * Whisper-Modell.
 *
 * `expectedText` (der erwartete Ayah-Text) wird als `prompt` mitgegeben —
 * Tarteel-Prinzip: das Modell kennt den Kontext und zieht die Dekodierung auf
 * die korrekten Koran-Wörter/Diakritika. Das hebt die Erkennung korrekter
 * Rezitation massiv (User-Report: "erkennt kaum meine Worte"). Die
 * Fehlererkennung bleibt intakt, weil der Abgleich (alignWords in
 * similarity.ts) das ERKANNTE gegen das erwartete Wort prüft — der Prompt ist
 * ein weicher Prior, kein Zwang: falsch Rezitiertes wird weiter falsch
 * transkribiert. Ohne expectedText (Modus ohne Zielvers) wie bisher ohne Prompt.
 */
export async function transcribePcm(
  pcm: Float32Array,
  whisperContext: WhisperContext,
  tempFileName: string,
  expectedText?: string,
  // `fast`: greedy (beamSize 1) statt Beam-Search-5 — für Live-Zwischenstände
  // während der Aufnahme, die im ~1,5-s-Takt kommen müssen (Beam-5 auf einem
  // 24-s-Fenster ist auf dem Handy zu langsam, die Live-Erkennung würde
  // hinterherhinken → „verliert den Faden"). Der FINALE Bewertungs-Durchlauf
  // bleibt bewusst Beam-5 (höhere Genauigkeit, Latenz dort unkritisch).
  //
  // `skipIfBusy`: für Live-Ticks (Streaming/kontinuierlich). Läuft bereits eine
  // Transkription auf dem geteilten Kontext, wird DIESER Tick verworfen (liefert
  // '') statt parallel gestartet — sonst „Context is already transcribing". Die
  // FINALEN Durchläufe lassen skipIfBusy weg und reihen sich stattdessen ein
  // (warten auf den letzten Live-Tick), damit ihr Ergebnis nie verloren geht.
  opts?: { fast?: boolean; skipIfBusy?: boolean },
): Promise<string> {
  const path = `${FileSystem.cacheDirectory}${tempFileName}`;
  let dateiGeschrieben = false;
  try {
    // Exklusiv durch den Serializer: nie zwei transcribe() gleichzeitig auf dem
    // geteilten Kontext (Kern-Fix „already transcribing", s. transcribeSerializer.ts).
    // WAV-Schreiben passiert INNERHALB der exklusiven Sektion — ein
    // übersprungener (skipIfBusy) Tick schreibt gar nicht erst.
    const run = await transcribeSerializer.run(
      async () => {
        await writeWavFile(path, float32ToInt16(pcm), SAMPLE_RATE);
        dateiGeschrieben = true;
        // Arabisch fest vorgeben (ISO-639-1 'ar') statt 'auto' — das Zielpublikum
        // rezitiert immer Koran-Arabisch, Sprach-Autodetektion bei kurzen/leisen
        // Aufnahmen ist unnötig fehleranfällig. temperature 0 = deterministisch.
        const handle = whisperContext.transcribe(path, {
          language: 'ar',
          // Live-Tick: greedy (beamSize 1) für Tempo. Finale Bewertung: Beam-5
          // + bestOf 5 (mehr Kandidaten, Latenz dort unkritisch) = genaueste
          // Dekodierung der ganzen Aufnahme.
          beamSize: opts?.fast ? 1 : 5,
          bestOf: opts?.fast ? 1 : 5,
          // temperature 0 = deterministisch; temperatureInc 0.2 aktiviert den
          // whisper.cpp-Fallback, der bei Wiederholung/Halluzination (u. a.
          // Prompt-Echo bei starkem Prompt) die Temperatur schrittweise anhebt
          // und neu dekodiert — bricht Endlos-Wiederholungen auf.
          temperature: 0,
          temperatureInc: 0.2,
          // Mehr Threads als der konservative whisper.rn-Default (2 auf 4-Kern-
          // Geräten) → schnellere Dekodierung, Live-Erkennung hält Schritt.
          maxThreads: WHISPER_THREADS,
          ...(expectedText ? { prompt: expectedText } : {}),
        });
        aktivesHandle = handle;
        try {
          return await handle.promise;
        } finally {
          // Kontext ist wieder frei — Handle freigeben, damit ein Cleanup-Abbruch
          // nicht auf ein bereits beendetes Handle zielt.
          if (aktivesHandle === handle) aktivesHandle = null;
        }
      },
      { skipIfBusy: opts?.skipIfBusy },
    );

    // Tick übersprungen (Kontext war belegt): keine Aktualisierung — der nächste
    // Tick folgt. Für den Aufrufer unkritisch (leerer String = „nichts Neues").
    if (run.skipped) return '';

    const result = run.value;
    // isAborted: die Dekodierung lief nicht durch → Ergebnis unvollständig.
    // Nicht als generischen Fehler tarnen, aber sichtbar loggen (half bisher
    // die Ursachenanalyse zu verschleiern).
    if (result?.isAborted) {
      console.warn('[whisper] Transkription abgebrochen (isAborted)', { datei: tempFileName });
    }
    return result?.result?.trim() ?? '';
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[whisper] Transkription fehlgeschlagen', {
      datei: tempFileName,
      fast: opts?.fast ?? false,
      fehler: detail,
    });
    throw new WhisperError(WhisperFehler.transcribe, detail);
  } finally {
    // Nur löschen, wenn tatsächlich geschrieben (übersprungener Tick schrieb nichts).
    if (dateiGeschrieben) await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Öffentliches Interface — identisch zu whisperCheck.web.ts.
// ---------------------------------------------------------------------------

/** Startet eine Mikrofon-Aufnahme; stop() transkribiert lokal per Whisper (Original + beschleunigte Variante). */
export async function startWhisperRecording(
  onProgress?: (p: WhisperProgress) => void,
): Promise<WhisperRecorder> {
  // Modell parallel zum Sprechen laden/aufwärmen — exakt wie im Web.
  const contextReady = loadWhisperContext(onProgress);
  const capture = await startPcmCapture();

  let cancelled = false;
  let finishPromise: Promise<string[]> | null = null;

  async function finish(): Promise<string[]> {
    clearTimeout(safety);
    const pcm16 = capture.stopCapture();
    if (cancelled) return [];
    const float32 = int16ToFloat32(pcm16);
    // Adaptive VAD-Trimmung (Rausch-Floor-Schätzung + Mindest-Sprachdauer) statt
    // festem 0.01-Schwellwert: schneidet leises Dauerrauschen/Stille an den
    // Rändern weg → weniger Halluzinationsfläche für whisper, ohne echte (auch
    // leise) Rezitation zu verlieren (fällt bei reiner Stille auf das Signal
    // zurück, nie leer). trimSilence bleibt für den Web-Pfad + Fallback erhalten.
    const trimmed = trimSilenceAdaptive(float32);
    const whisperContext = await contextReady;
    if (cancelled) return [];
    // NUR EIN Transkriptions-Pass (früher zusätzlich eine 1,5x-beschleunigte
    // Variante) — der zweite Pass verdoppelte die spürbare Wartezeit nach dem
    // Sprechen, ohne dass er mit dem Koran-Finetune-Modell (whisperModel.ts)
    // noch nennenswert bessere Treffer brachte. speedUp() bleibt exportiert
    // (Web-Pfad + Tests) und kann als gezielter Zweitversuch reaktiviert
    // werden, falls ein Ergebnis unter einem Schwellwert liegt.
    const text = await transcribePcm(trimmed, whisperContext, 'hifz-rec-0.wav');
    return text ? [text] : [];
  }

  // Memoisiert: egal ob der Sicherheits-Timeout oder stop()/cancel() zuerst
  // greift, alle Aufrufer bekommen dasselbe (einzige) Ergebnis der Aufnahme.
  function getFinishPromise(): Promise<string[]> {
    if (!finishPromise) finishPromise = finish();
    return finishPromise;
  }

  const safety = setTimeout(() => {
    getFinishPromise().catch(() => {});
  }, MAX_RECORDING_MS);

  return {
    cancel: () => {
      cancelled = true;
      getFinishPromise().catch(() => {});
    },
    stop: getFinishPromise,
  };
}
