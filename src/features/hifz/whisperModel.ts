import * as FileSystem from 'expo-file-system/legacy';

import { logError } from '@/lib/errorLog';

// Modell-Download-Verwaltung für den Hifz-Rezitations-Check (whisper.rn, s.
// whisperCheck.ts). Modelle sind NICHT gebündelt (Store-Größenlimits), sondern
// werden einmalig ins Dokumentverzeichnis geladen und sind danach offline
// nutzbar.
//
// MODELL-WAHL (Nutzerwunsch 2026-07-22): Der Nutzer wählt in den Einstellungen
// (settings.recitationModel), welches Modell geladen wird — Kompromiss zwischen
// Genauigkeit, Download-Größe und Handy-Tempo. Auf dem Gerät ist immer nur EIN
// Modell gespeichert (beim Wechsel wird das alte gelöscht, s.
// whisperModellHerunterladen).
//
// Der eigentliche Genauigkeits-Hebel ist NICHT die Modellgröße, sondern die
// Alignment-Methode (s. speech.ts): der erwartete Vers-Text geht als
// `initialPrompt` ins Modell und wird Wort-für-Wort abgeglichen — das zieht
// selbst ein generisches Whisper stark auf die korrekten Koran-Wörter.
//
// KRITISCH (Header-Regel, s. Memory project_salati_whisper_model_ntextctx):
// Jedes GGML-Modell MUSS n_text_ctx=448 haben (Whisper-Standard), sonst kann
// whisper.rn es nicht laden. Beide Modelle unten wurden am Header geprüft.
//   base  = tarteel-ai/whisper-base-ar-quran, EIGENE GGML-Konvertierung
//           (q5_0, ~55 MB) — Koran-optimiert, klein, läuft flüssig auf JEDEM
//           Gerät. Standard.
//   turbo = Whisper large-v3-turbo (ggerganov, q5_0, ~574 MB) — distilliertes
//           Grossmodell, generisch (nicht Koran-tuned), für starke Geräte.
// (large-v3 wurde auf Nutzerwunsch 2026-07-22 wieder entfernt — 1 GB zu gross
// und als generisches Modell nicht koran-genauer; der Conditioning-Hebel wirkt
// modell-unabhängig.)
//
// HERKUNFT `base` (2026-07-27, s. docs/audit-2026-07-27/WHISPER-EIGENE-
// KONVERTIERUNG.md): Früher lag hier ein fremder HF-Spiegel
// (bashir-manafikhi/quran-whisper-ggml) ohne dokumentierte Herkunft. Jetzt
// konvertieren wir Tarteels Original (tarteel-ai/whisper-base-ar-quran,
// Apache-2.0) selbst mit whisper.cpp `models/convert-h5-to-ggml.py` nach GGML
// F16 und quantisieren es mit `whisper-quantize` auf q5_0; die Dateien liegen
// auf unserem eigenen R2. Beleg, dass es dieselben Gewichte sind: unsere F16-
// Konvertierung ist BYTE-IDENTISCH zur damaligen Fremddatei
// (sha256 aaebca10e2a65a6dda073a6b3ac59900f91887628acf872c565a0198ee850ead).
// q5_0 statt F16, weil 8 echte Alafasy-Rezitationen mit BEIDEN Dateien exakt
// dieselben Transkripte ergaben (WER 7,9 % mit initialPrompt, 9,2 % ohne) —
// gleiche Genauigkeit bei 63 % weniger Download.
// ACHTUNG beim Konvertieren: config.json von Tarteel enthält max_length=1024
// (ein Generations-Parameter); das Upstream-Skript schreibt genau diesen Wert
// als n_text_ctx. Richtig ist max_target_positions=448 — sonst entsteht ein
// GGML, das whisper.rn nicht lädt (genau die kaputten Community-Konversionen).
export type RecitationModelId = 'base' | 'turbo';

/** Eigener R2-Bucket (public) — Präfix models/whisper/. */
const R2_MODELS = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/models/whisper';
const GG = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

export interface RecitationModel {
  id: RecitationModelId;
  dateiname: string;
  url: string;
  /** Fallback für die Fortschrittsanzeige, falls der Server kein Content-Length liefert. */
  groesse: number;
}

export const RECITATION_MODELS: Record<RecitationModelId, RecitationModel> = {
  base: {
    id: 'base',
    dateiname: 'salati-tarteel-whisper-base-ar-quran-q5_0.bin',
    url: `${R2_MODELS}/salati-tarteel-whisper-base-ar-quran-q5_0.bin`,
    groesse: 55_295_433,
  },
  turbo: {
    id: 'turbo',
    dateiname: 'ggml-large-v3-turbo-q5_0.bin',
    url: `${GG}/ggml-large-v3-turbo-q5_0.bin`,
    groesse: 574_041_195,
  },
};

// In-Memory-Spiegel der Einstellung: der Settings-Store ruft setRecitationModel()
// beim Laden und bei jeder Änderung auf (store.tsx). So bleiben die Pfad-/
// Download-Funktionen synchron und müssen nicht bei jedem Aufruf AsyncStorage lesen.
let currentModelId: RecitationModelId = 'base';

export function setRecitationModel(id: RecitationModelId | undefined): void {
  if (id && id in RECITATION_MODELS) currentModelId = id;
}

export function getRecitationModel(): RecitationModel {
  return RECITATION_MODELS[currentModelId];
}

function whisperModellVerzeichnis(): string {
  return `${FileSystem.documentDirectory}whisper-modell/`;
}

export function whisperModellPfad(): string {
  return `${whisperModellVerzeichnis()}${getRecitationModel().dateiname}`;
}

/** Grösse des AKTUELL gewählten Modells (für Anzeige/Speicher). */
export function aktuelleModellGroesse(): number {
  return getRecitationModel().groesse;
}

// Toleranz: der lokale File kann minimal von der erwarteten Größe abweichen
// (Header/Server-Rundung). >= 98 % gilt als vollständig, < 98 % als Teil-Datei.
const VOLLSTAENDIG_ANTEIL = 0.98;

// GGML-Header-Prüfung (s. Memory project_salati_whisper_model_ntextctx).
// Ein GGML-whisper-Modell beginnt mit dem 4-Byte-Magic 'ggml' (LE 0x67676d6c),
// gefolgt von den hparams als int32 in fester Reihenfolge: n_vocab, n_audio_ctx,
// n_audio_state, n_audio_head, n_audio_layer, n_text_ctx, … → n_text_ctx liegt
// bei Byte-Offset 24. whisper.rn/whisper.cpp lädt NUR Modelle mit n_text_ctx=448
// (Whisper-base-Standard); ein größenmäßig „vollständiger", aber inhaltlich
// falscher/beschädigter File (z. B. eine fehlerhafte Community-Konvertierung mit
// n_text_ctx=1024 oder ein während des Downloads korrumpierter Puffer) lässt
// initWhisper mit generischem Fehler scheitern — genau der „nicht verfügbar"-
// Report. Deshalb wird der Header vor der Nutzung geprüft.
const GGML_MAGIC = 0x67676d6c;
export const REQUIRED_N_TEXT_CTX = 448;
const GGML_HEADER_BYTES = 48;
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Byteweises Base64-Decode NUR für den kurzen Binär-Header (kein UTF-8-Text). */
function decodeHeaderBase64(b64: string): Uint8Array {
  const out = new Uint8Array(Math.ceil((b64.length * 3) / 4));
  let outIdx = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const idx = B64_ALPHABET.indexOf(b64[i]);
    if (idx === -1) continue; // '=' und Whitespace überspringen
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIdx++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIdx);
}

export interface GgmlHeaderInfo {
  /** Konnte der Header überhaupt gelesen werden? (false = IO-Fehler, NICHT „ungültig") */
  lesbar: boolean;
  magicOk: boolean;
  nTextCtx: number | null;
}

/**
 * Liest die ersten Bytes des Modell-Files und prüft GGML-Magic + n_text_ctx.
 * Wirft NICHT — ein Lesefehler liefert `{ lesbar: false }`, damit ein
 * IO-Hiccup nicht fälschlich einen Re-Download auslöst.
 */
export async function pruefeGgmlHeader(pfad: string = whisperModellPfad()): Promise<GgmlHeaderInfo> {
  try {
    const b64 = await FileSystem.readAsStringAsync(pfad, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: GGML_HEADER_BYTES,
    });
    const bytes = decodeHeaderBase64(b64);
    if (bytes.length < 28) return { lesbar: false, magicOk: false, nTextCtx: null };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = view.getUint32(0, true);
    const nTextCtx = view.getInt32(24, true);
    return { lesbar: true, magicOk: magic === GGML_MAGIC, nTextCtx };
  } catch {
    return { lesbar: false, magicOk: false, nTextCtx: null };
  }
}

/**
 * true NUR, wenn die Datei existiert, (nahezu) die erwartete Modellgröße hat UND
 * einen gültigen GGML-Header (Magic + n_text_ctx=448) trägt.
 * WICHTIG (User-Bug): früher galt jede Datei > 0 Byte als „fertig" — ein
 * abgebrochener Download (z. B. 30 MB) wurde dann fälschlich als vollständiges
 * Modell behandelt und ließ sich nicht weiterladen. Zusätzlich gilt jetzt: ein
 * größenmäßig vollständiger, aber am Header ungültiger File (initWhisper würde
 * scheitern) wird als NICHT heruntergeladen gemeldet → die UI bietet den
 * Download erneut an, der alte kaputte File wird beim Neu-Download gelöscht
 * (self-healing statt Dauer-„nicht verfügbar").
 */
export async function istWhisperModellHeruntergeladen(): Promise<boolean> {
  const model = getRecitationModel();
  const info = await FileSystem.getInfoAsync(whisperModellPfad());
  if (!info.exists || (info.size ?? 0) < model.groesse * VOLLSTAENDIG_ANTEIL) return false;
  const header = await pruefeGgmlHeader();
  // Lesefehler (lesbar=false) NICHT als ungültig werten — sonst würde ein
  // transienter IO-Fehler einen unnötigen 148-MB-Re-Download erzwingen.
  if (!header.lesbar) return true;
  if (!header.magicOk || header.nTextCtx !== REQUIRED_N_TEXT_CTX) {
    console.error('[whisper] Modell-Header ungültig — Re-Download nötig', {
      dateiname: model.dateiname,
      magicOk: header.magicOk,
      nTextCtx: header.nTextCtx,
      erwartet: REQUIRED_N_TEXT_CTX,
    });
    return false;
  }
  return true;
}

export interface WhisperDownloadFortschritt {
  bytesGeladen: number;
  bytesGesamt: number;
  anteil: number; // 0..1
}

// Modul-Singleton: der Download läuft UNABHÄNGIG vom Screen, der ihn gestartet
// hat (User-Bug: Zurück-Navigieren brach den Download ab). Mehrere Screens
// (Einstellungen, Onboarding, Aufsagen) können denselben laufenden Download
// mit-beobachten; er läuft bis Ende weiter, egal welcher Screen gerade lebt.
interface LaufenderDownload {
  modelId: RecitationModelId;
  promise: Promise<void>;
  fortschritt: WhisperDownloadFortschritt;
  subscribers: Set<(p: WhisperDownloadFortschritt) => void>;
}
let laufenderDownload: LaufenderDownload | null = null;

/** Läuft aktuell ein Download (des aktuell gewählten Modells)? */
export function whisperDownloadLaeuft(): boolean {
  return laufenderDownload !== null && laufenderDownload.modelId === getRecitationModel().id;
}

/**
 * Lädt das GGML-Modell herunter — persistent (Modul-Singleton). Läuft schon ein
 * Download desselben Modells, wird er nur mit-abonniert (kein Neustart, kein
 * Abbruch). Nach dem Download wird die Dateigröße geprüft; ein unvollständiger
 * Download wird gelöscht und als Fehler gemeldet (nicht als „fertig").
 */
export function whisperModellHerunterladen(
  onProgress: (p: WhisperDownloadFortschritt) => void,
): Promise<void> {
  const model = getRecitationModel();

  if (laufenderDownload && laufenderDownload.modelId === model.id) {
    laufenderDownload.subscribers.add(onProgress);
    onProgress(laufenderDownload.fortschritt);
    return laufenderDownload.promise;
  }

  const dl: LaufenderDownload = {
    modelId: model.id,
    fortschritt: { bytesGeladen: 0, bytesGesamt: model.groesse, anteil: 0 },
    subscribers: new Set([onProgress]),
    promise: Promise.resolve(),
  };
  const emit = (p: WhisperDownloadFortschritt) => {
    dl.fortschritt = p;
    for (const s of dl.subscribers) {
      try {
        s(p);
      } catch {
        // Screen evtl. unmounted — egal, Download läuft weiter.
      }
    }
  };

  dl.promise = (async () => {
    // Verzeichnis leeren: unvollständige Reste + ein ANDERES Modell einer
    // früheren Wahl entfernen (immer nur EIN Modell auf dem Gerät).
    await FileSystem.deleteAsync(whisperModellVerzeichnis(), { idempotent: true }).catch(() => {});
    // intermediates:true → "existiert schon" wirft nicht. Was hier ankommt, ist
    // ein echtes Dateisystem-Problem und erklaert den folgenden Download-
    // Fehlschlag ("Spracherkennung nicht verfuegbar") — darum protokollieren.
    await FileSystem.makeDirectoryAsync(whisperModellVerzeichnis(), { intermediates: true }).catch(
      (err: unknown) => logError(err, 'whisper: Modellverzeichnis anlegen'),
    );
    const ziel = whisperModellPfad();

    const resumable = FileSystem.createDownloadResumable(model.url, ziel, {}, (data) => {
      const bytesGesamt =
        data.totalBytesExpectedToWrite > 0 ? data.totalBytesExpectedToWrite : model.groesse;
      emit({
        bytesGeladen: data.totalBytesWritten,
        bytesGesamt,
        anteil: Math.min(1, data.totalBytesWritten / bytesGesamt),
      });
    });

    const result = await resumable.downloadAsync();
    if (!result || result.status !== 200) {
      await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
      throw new Error(`Whisper-Modell-Download fehlgeschlagen (Status ${result?.status ?? 'unbekannt'})`);
    }
    // Vollständigkeit prüfen — sonst gilt eine Teil-Datei fälschlich als fertig.
    const info = await FileSystem.getInfoAsync(ziel);
    if (!info.exists || (info.size ?? 0) < model.groesse * VOLLSTAENDIG_ANTEIL) {
      await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
      throw new Error('Whisper-Modell-Download unvollständig');
    }
    // Header prüfen: ein größenmäßig vollständiger, aber am GGML-Header
    // ungültiger File (falsches Magic / n_text_ctx≠448) lässt initWhisper
    // scheitern → hier sofort verwerfen + klarer Fehler, statt ihn als „fertig"
    // durchzureichen und später am generischen „nicht verfügbar" zu scheitern.
    const header = await pruefeGgmlHeader(ziel);
    if (header.lesbar && (!header.magicOk || header.nTextCtx !== REQUIRED_N_TEXT_CTX)) {
      await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
      throw new Error(
        `Whisper-Modell-Header ungültig (magicOk=${header.magicOk}, n_text_ctx=${header.nTextCtx}, erwartet=${REQUIRED_N_TEXT_CTX})`,
      );
    }
    emit({ bytesGeladen: info.size ?? model.groesse, bytesGesamt: model.groesse, anteil: 1 });
  })().finally(() => {
    laufenderDownload = null;
  });

  laufenderDownload = dl;
  return dl.promise;
}

export async function whisperModellLoeschen(): Promise<void> {
  // Ganzes Verzeichnis: egal welches Modell gerade gewählt ist.
  await FileSystem.deleteAsync(whisperModellVerzeichnis(), { idempotent: true }).catch(() => {});
}
