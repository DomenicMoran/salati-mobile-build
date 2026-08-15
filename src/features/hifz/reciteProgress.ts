// Gleitendes Prompt-Fenster + monotone Fortschritts-Front für die
// kontinuierliche Ganz-Sure-Erkennung (s. speech.ts / recite-surah.tsx).
//
// WARUM (Kern der Tarteel-Parität): whisper.rn reicht `initialPrompt` an
// whisper.cpp durch. Dort landet der Prompt bei ausgeschaltetem
// `carry_initial_prompt` (whisper.rn stellt die Option NICHT zur Verfügung →
// Default false) im DYNAMISCHEN Kontext `prompt_past1` und wird — begrenzt auf
// `n_text_ctx/2` (= 224 Tokens beim base-Modell) — nach den ersten ~224
// dekodierten Tokens vom eigenen Modell-Output verdrängt (whisper.cpp
// whisper_full_with_state, Zeilen ~6962 + ~7131). Folge: ein EINMALIGER
// Ganz-Sure-Prompt konditioniert nur die ersten Verse; danach rezitiert das
// Modell ohne erwarteten-Text-Anker weiter und „verliert den Faden" (exakt der
// User-Report). Lösung wie bei Tarteel: pro Erkennungsfenster einen KURZEN,
// mit dem Fortschritt MITWANDERNDEN Prompt (die nächsten erwarteten Wörter ab
// der zuletzt sicheren Position) neu setzen, statt einmal die ganze Sure.
//
// ZWEITER (getrennter) Hebel — POSITIONS-Kopplung des Matchings (User-Bug
// 2026-07-22 „ein Wort aus Vers 1 wird beim Vers 7 als Treffer gewertet"):
// Das Aufdecken darf ein gesprochenes Wort NUR einem erwarteten Wort NAHE der
// aktuellen Rezitationsstelle zuordnen — nicht global der ganzen Sure. Sonst
// trifft ein (gleichlautendes) Wort irgendwo weit vorne/hinten. Deshalb wird
// das Alignment auf ein enges Fenster um die Front beschränkt (windowedReveal)
// statt global über den kompletten Sure-Text (früher: alignWords(partial,
// expectedFull) in recite-surah.tsx). Bewusst ZWEI Fenster: eng fürs Matching,
// weit für den Prompt (mehr Vorschau schadet der Konditionierung nicht).
//
// Reine Funktionen + eine kleine Zustandsklasse — testbar ohne Whisper/Mikro.

import { alignWords, normalizeArabic } from './similarity';

export interface WindowConfig {
  /** Wörter Kontext HINTER der Front (Kontinuität). */
  lookBehind: number;
  /** Wörter Vorschau AB der Front. */
  lookAhead: number;
}

// Enges Fenster für die POSITIONS-Kopplung des Matchings + der Fortschritts-
// Front. Bewusst klein: ein gesprochenes Wort darf nur als Treffer eines
// erwarteten Wortes NAHE der aktuellen Stelle zählen — nie als Treffer eines
// weit entfernten gleichlautenden Wortes. lookBehind hält den Übergang stabil,
// lookAhead gibt genug Spielraum für flüssiges Rezitieren, ohne die ganze Sure
// zu öffnen. lookAhead großzügiger (18): ein zügig Rezitierender spricht in
// einem ~1,5-s-Live-Takt + Transkriptionszeit leicht 10+ Wörter vor der Front —
// ein zu enges Fenster ließ die Front dann hinterherhinken („erkennt noch nicht
// alles"). 18 bleibt klar unter typischen Vers-Wiederholungsabständen, koppelt
// also weiter eng genug gegen den Gleichlaut-Bug.
export const DEFAULT_MATCH_WINDOW: WindowConfig = { lookBehind: 4, lookAhead: 18 };

// Weites Fenster NUR für den Conditioning-Prompt (whisper.cpp-Kontext) — hier
// hilft mehr Vorschau, s. Kopfkommentar. Bleibt klar unter den 224 Prompt-
// Tokens (arabische Wörter ≈ 2–4 Tokens).
export const DEFAULT_PROMPT_WINDOW: WindowConfig = { lookBehind: 8, lookAhead: 40 };

export interface RevealedWord {
  /** Globaler Wort-Index in der Sure (über alle Verse hinweg). */
  index: number;
  status: 'hit' | 'near';
}

export interface AudioWindow {
  /** Sample-Index (inklusive) des Fenster-Anfangs im Gesamt-Puffer. */
  start: number;
  /** Sample-Index (exklusive) des Fenster-Endes im Gesamt-Puffer. */
  end: number;
}

/**
 * Zerlegt eine Gesamt-Sample-Länge in überlappende Fenster [start,end) für die
 * FINALE Voll-Auswertung der ganzen Aufnahme (s. speech.ts stop()). Anders als
 * das reine Tail-Fenster (whisperCheck.tailWindow), das nur die letzten Sekunden
 * abdeckt, überstreicht diese Zerlegung die GESAMTE Aufnahme vom Anfang bis zum
 * Ende — so wird am Ende jeder korrekt rezitierte Vers ausgewertet und aufgedeckt
 * ("die Sure löst sich auf"), auch die früh gesprochenen, die längst aus dem
 * Live-Tail-Fenster gefallen waren.
 *
 * Aufeinanderfolgende Fenster überlappen (hop < window), damit an keiner
 * Fenstergrenze ein Wort verloren geht. Das letzte Fenster endet immer exakt bei
 * `totalSamples`. Reine Funktion — testbar ohne Audio/Whisper.
 */
export function overlappingWindows(
  totalSamples: number,
  windowSamples: number,
  hopSamples: number,
): AudioWindow[] {
  if (totalSamples <= 0 || windowSamples <= 0) return [];
  if (totalSamples <= windowSamples) return [{ start: 0, end: totalSamples }];
  const hop = Math.max(1, hopSamples);
  const out: AudioWindow[] = [];
  for (let start = 0; start < totalSamples; start += hop) {
    const end = Math.min(totalSamples, start + windowSamples);
    out.push({ start, end });
    if (end >= totalSamples) break;
  }
  return out;
}

/** Zerlegt den erwarteten Text in Roh-Wörter (mit Diakritika, für Prompt/Anzeige). */
export function splitExpectedWords(expectedText: string): string[] {
  return expectedText.split(/\s+/).filter(Boolean);
}

/**
 * Prompt-Fenster [frontier-lookBehind, frontier+lookAhead) als zusammenhängender
 * Text — die als-nächstes-erwarteten Wörter, mit denen whisper.cpp das aktuelle
 * Audio-Fenster konditioniert.
 */
export function promptWindow(
  expectedWords: string[],
  frontier: number,
  cfg: WindowConfig = DEFAULT_PROMPT_WINDOW,
): string {
  const start = Math.max(0, frontier - cfg.lookBehind);
  const end = Math.min(expectedWords.length, frontier + cfg.lookAhead);
  return expectedWords.slice(start, end).join(' ');
}

/**
 * Richtet ein Teil-Transkript NUR innerhalb des Fensters
 * [frontier-lookBehind, frontier+lookAhead) an den erwarteten Wörtern aus und
 * liefert globale Treffer (hit/near) + die neue, monoton fortschreitende Front.
 *
 * Kern der Positions-Kopplung: außerhalb des Fensters liegende (auch
 * gleichlautende) Wörter können NICHT getroffen/aufgedeckt werden — ein Wort
 * aus Vers 1 kann so nie ein Wort in Vers 7 „treffen".
 *
 * Front-Vorrücken (monoton, nie zurück) auf ZWEI Wegen — der Kern-Fix gegen das
 * „verliert den Faden / erkennt noch nicht alles" (User 2026-07-22):
 *  (1) Bis zum letzten EXAKTEN Treffer (hit) im Fenster (lastHit+1) — wie bisher;
 *      ein einzelner near-„Loch" wird von einem späteren hit übersprungen.
 *  (2) Über eine ZUSAMMENHÄNGENDE Kette von Treffern (hit ODER near), die GENAU
 *      an der aktuellen Front beginnt. Rezitiert jemand korrekt, aber die
 *      Quran-ASR gibt sein Wort systematisch nur „fast" (near) wieder (Dialekt,
 *      Madd, Anfänger), blieb die Front früher an diesem near hängen und ALLES
 *      danach blieb verdeckt. Eine near-Kette DIREKT an der Front ist starke
 *      Evidenz echten Fortschritts → die Front darf mit. Ein ISOLIERTER near
 *      irgendwo weiter im Fenster (nicht an der Front) rückt die Front NICHT vor
 *      (bleibt gelb sichtbar, aber kein verfrühtes Überspringen ungesprochener
 *      Wörter) — so bleibt der Schutz gegen Gleichlaut-Fehltreffer erhalten.
 * Die finale Voll-Auswertung (Beam-5) deckt ohnehin alles nach, monotones
 * Aufdecken macht nie etwas rückgängig.
 */
export function windowedReveal(
  partial: string,
  expectedWords: string[],
  frontier: number,
  cfg: WindowConfig = DEFAULT_MATCH_WINDOW,
): { reveals: RevealedWord[]; frontier: number } {
  if (!partial || normalizeArabic(partial) === '') return { reveals: [], frontier };
  const start = Math.max(0, frontier - cfg.lookBehind);
  const end = Math.min(expectedWords.length, frontier + cfg.lookAhead);
  if (start >= end) return { reveals: [], frontier };

  const windowText = expectedWords.slice(start, end).join(' ');
  const aligned = alignWords(partial, windowText);

  const reveals: RevealedWord[] = [];
  let lastHit = -1;
  for (let k = 0; k < aligned.length; k++) {
    const st = aligned[k]?.status;
    if (st === 'hit') {
      reveals.push({ index: start + k, status: 'hit' });
      lastHit = k;
    } else if (st === 'near') {
      reveals.push({ index: start + k, status: 'near' });
    }
  }

  // (1) Vorrücken bis zum letzten exakten Treffer.
  let candidate = lastHit >= 0 ? start + lastHit + 1 : frontier;

  // (2) Zusammenhängende hit/near-Kette AB der Front. Lokaler Index der Front im
  // Fenster (start entspricht frontier-lookBehind, außer am Sure-Anfang geklemmt).
  const frontierLocal = frontier - start;
  if (frontierLocal >= 0 && frontierLocal < aligned.length) {
    let k = frontierLocal;
    while (k < aligned.length && (aligned[k]?.status === 'hit' || aligned[k]?.status === 'near')) k++;
    // k = erstes NICHT-getroffenes Wort ab der Front → Front bis dorthin ziehen.
    const runCandidate = start + k;
    if (runCandidate > candidate) candidate = runCandidate;
  }

  return { reveals, frontier: candidate > frontier ? candidate : frontier };
}

/**
 * Verfolgt die monoton fortschreitende Position innerhalb der erwarteten Sure
 * und liefert daraus (a) das gleitende Prompt-Fenster und (b) je Teil-Transkript
 * die positions-gekoppelten Aufdeck-Treffer.
 */
export class ReciteProgress {
  readonly expectedWords: string[];
  private frontier = 0;

  constructor(
    expectedText: string,
    private readonly matchCfg: WindowConfig = DEFAULT_MATCH_WINDOW,
    private readonly promptCfg: WindowConfig = DEFAULT_PROMPT_WINDOW,
  ) {
    this.expectedWords = splitExpectedWords(expectedText);
  }

  /** Aktuelle Wort-Position (Index NACH dem letzten sicher erkannten Wort). */
  get position(): number {
    return this.frontier;
  }

  /** Prompt für das NÄCHSTE Erkennungsfenster (mitwandernd, weites Fenster). */
  prompt(): string {
    return promptWindow(this.expectedWords, this.frontier, this.promptCfg);
  }

  /**
   * Verarbeitet ein neues Teil-Transkript: rückt die Front positions-gekoppelt
   * und monoton vor und gibt die in DIESEM Fenster erkannten Wörter (global
   * indiziert, hit/near) für die UI-Aufdeckung zurück.
   */
  ingest(partial: string): RevealedWord[] {
    const { reveals, frontier } = windowedReveal(
      partial,
      this.expectedWords,
      this.frontier,
      this.matchCfg,
    );
    this.frontier = frontier;
    return reveals;
  }

  /**
   * Nur die Front vorrücken (Rückgabe = neue Position), ohne die Reveals zu
   * nutzen — dünner Wrapper um ingest() für Aufrufer, die lediglich den Prompt
   * mitführen wollen.
   */
  update(partial: string): number {
    this.ingest(partial);
    return this.frontier;
  }
}
