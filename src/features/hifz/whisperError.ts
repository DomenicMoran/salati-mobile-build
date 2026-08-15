// Gemeinsame (plattform-unabhängige) Fehler-Typen für die Hifz-Rezitations-
// Erkennung. Bewusst OHNE native/Web-Importe, damit sowohl whisperCheck.ts
// (native, whisper.rn) als auch whisperCheck.web.ts (transformers.js) daraus
// re-exportieren können und die UI (app/hifz/*) genau EINE Quelle für Codes,
// Fehlerklasse und die Klartext-Aufschlüsselung hat.
//
// Hintergrund (User-Report, wiederholt): die On-Device-Erkennung meldete am
// echten Gerät nur die generische Meldung „Spracherkennung nicht verfügbar oder
// abgebrochen", ohne dass die tatsächliche Ursache (fehlende Mikrofon-Freigabe,
// Modell-Init, Aufnahme-Start …) je auf dem Screen sichtbar wurde — ohne Logcat
// war das nicht diagnostizierbar. Deshalb trägt jeder Fehler jetzt (a) einen
// distinkten Code UND (b) den rohen Ausnahme-Text (`detail`), den die UI in
// einem aufklappbaren Detail zeigt, damit der Nutzer ihn 1:1 durchgeben kann.

/** Distinkte Fehler-Codes — statt eines einzigen generischen „nicht verfügbar". */
export const WhisperFehler = {
  /** Plattform/Native-Modul kann die Erkennung nicht laden (Web-Fallback / Modul nicht gelinkt). */
  unavailable: 'speech_recognition_unavailable',
  /** Mikrofon-Berechtigung fehlt/abgelehnt (Laufzeit-Anfrage verweigert). */
  permission: 'whisper_permission_denied',
  /** Native Audio-Aufnahme (AudioRecord) ließ sich nicht initialisieren/starten. */
  audioInit: 'whisper_audio_init_failed',
  /** Modell-Download fehlgeschlagen/unvollständig/Header ungültig. */
  modelDownload: 'whisper_model_download_failed',
  /** initWhisper hat den Kontext nicht erstellt (Modell beschädigt/inkompatibel/JSI). */
  modelInit: 'whisper_model_init_failed',
  /** transcribe() selbst hat geworfen. */
  transcribe: 'whisper_transcribe_failed',
  /** Aufnahme lief, aber es wurde keine Sprache erkannt (leerer/zu leiser Puffer). */
  noSpeech: 'whisper_no_speech',
} as const;

export type WhisperFehlerCode = (typeof WhisperFehler)[keyof typeof WhisperFehler];

const ALL_CODES: string[] = Object.values(WhisperFehler);

/**
 * Fehler mit distinktem Code UND rohem Detailtext. `message` = Code (damit
 * bestehende `e.message`-Vergleiche weiter funktionieren), `detail` = die
 * ursprüngliche Ausnahme/der Kontext für die aufklappbare Diagnose.
 */
export class WhisperError extends Error {
  readonly code: WhisperFehlerCode;
  readonly detail?: string;
  constructor(code: WhisperFehlerCode, detail?: string) {
    super(code);
    this.name = 'WhisperError';
    this.code = code;
    this.detail = detail;
  }
}

/** Den distinkten Code aus einem beliebigen Fehler ziehen (oder null). */
export function fehlerCode(e: unknown): WhisperFehlerCode | null {
  if (e instanceof WhisperError) return e.code;
  const msg = e instanceof Error ? e.message : String(e);
  return ALL_CODES.includes(msg) ? (msg as WhisperFehlerCode) : null;
}

/** Roh-Detailtext (Original-Ausnahme) für die aufklappbare Diagnose. */
export function fehlerDetail(e: unknown): string | undefined {
  if (e instanceof WhisperError) return e.detail ?? undefined;
  if (e instanceof Error) return e.message;
  const s = String(e);
  return s && s !== 'undefined' ? s : undefined;
}

/** Ist der Fehler ein Modell-Problem (Download/Init/Header)? → UI kann Modell neu anbieten. */
export function istModellFehler(e: unknown): boolean {
  const c = fehlerCode(e);
  return c === WhisperFehler.modelDownload || c === WhisperFehler.modelInit;
}

export interface WhisperFehlerInfo {
  /** Distinkter Code (null, wenn ein völlig fremder Fehler durchschlug). */
  code: WhisperFehlerCode | null;
  /** i18n-Suffix für die Klartext-Meldung: hifz.speechError.<key>Msg. */
  i18nKey: string;
  /** Roher Ausnahme-Text für das aufklappbare Detail. */
  detail?: string;
}

const CODE_TO_KEY: Record<WhisperFehlerCode, string> = {
  [WhisperFehler.unavailable]: 'unavailable',
  [WhisperFehler.permission]: 'permission',
  [WhisperFehler.audioInit]: 'audioInit',
  [WhisperFehler.modelDownload]: 'modelDownload',
  [WhisperFehler.modelInit]: 'modelInit',
  [WhisperFehler.transcribe]: 'transcribe',
  [WhisperFehler.noSpeech]: 'noSpeech',
};

/**
 * Schlüsselt einen Fehler für die UI auf: distinkter Code, i18n-Key für die
 * konkrete Klartext-Erklärung und der rohe Detailtext für die Diagnose.
 */
export function beschreibeWhisperFehler(e: unknown): WhisperFehlerInfo {
  const code = fehlerCode(e);
  return {
    code,
    i18nKey: code ? CODE_TO_KEY[code] : 'unknown',
    detail: fehlerDetail(e),
  };
}
