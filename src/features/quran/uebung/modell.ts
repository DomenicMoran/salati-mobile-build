// Reine Logik der Analyse-Übung ("selbst zuordnen, dann mit dem Korpusbefund
// abgleichen") — bewusst ohne React-/i18n-Abhängigkeit, wie ../grammatik.ts
// und ../analyse/wortAnalyseModel.ts. Baut auf ../grammatik.ts (wortart,
// ismEigenschaften, verbEigenschaften, relationBasis) auf, nicht auf
// ../analyse/wortAnalyseModel.ts — dort arbeitet parallel ein anderer Agent
// an der Satzstruktur-Anzeige; diese Datei bleibt unabhängig davon.
//
// ---------- "Nicht bewertbar" statt "falsch" ----------
//
// Vorgabe: ein Lernender darf nie für eine Lücke der Datenlage bestraft
// werden. Diese Datei setzt das über ÜBERSPRINGEN um, nicht über eine
// nachträgliche "nicht gewertet"-Markierung: `aktiveDimensionen()` nimmt eine
// Dimension (Wortart/Kasus-Tempus/Satzrolle) für ein Wort nur dann in die
// Übung auf, wenn der Korpus dafür tatsächlich einen Wert liefert. Ein Wort
// ohne Satzrolle (z. B. Basmala-Bestandteile) wird auf Stufe 3 also gar nicht
// erst nach seiner Satzrolle gefragt — es bleibt bei den Dimensionen, die
// beantwortbar sind. `bewerteDimension()` kennt das Ergebnis 'nichtBewertet'
// zusätzlich als Sicherheitsnetz (z. B. für Direktaufrufe in Tests), im
// normalen Übungsablauf kommt es dank des Überspringens nie vor.
//
// Bewusst NUR Kasus/Tempus (nie Bestimmtheit/Numerus/Verbform) als
// Stufe-2-Dimension: gegen scripts/build-morphologie.mjs (parseFeatures)
// geprüft, landen AUSSCHLIESSLICH 'number', 'state' und 'verbForm' je im
// `derived`-Array — 'case' und 'tense' stehen IMMER explizit im
// QAC-Feature-String oder fehlen ganz (dann `null`, s. o.). Kasus/Tempus sind
// als Übungsfrage also nie "nur hergeleitet" — die Herkunfts-Sonderregel
// greift für sie gar nicht, macht die Bewertung entsprechend einfach.
import {
  ismEigenschaften,
  relationBasis,
  verbEigenschaften,
  wortart,
  type Wortart,
} from '../grammatik';
import type { MorphSegment, MorphWord } from '../morphologieTypen';

export type Schwierigkeitsgrad = 1 | 2 | 3;

export const SCHWIERIGKEITSGRADE: readonly Schwierigkeitsgrad[] = [1, 2, 3];

export type KasusTempusTyp = 'kasus' | 'tempus';

export interface KasusTempusMerkmal {
  typ: KasusTempusTyp;
  /** 'nom'|'acc'|'gen' bei typ 'kasus', 'perfect'|'imperfect'|'imperative' bei 'tempus'. */
  wert: string;
}

export interface UebungsWort {
  word: MorphWord;
  /** Tragendes Stamm-Segment — dieselbe Konvention wie stammSegment() im
   * Wortanalyse-Sheet (erstes 'stem'-Segment, sonst erstes Segment). */
  stamm: MorphSegment;
  wortart: Wortart | null;
  /** `null`, wenn das Wort ein Harf ist ODER der Korpus für Ism/Fiʿl keinen
   * Kasus-/Tempus-Wert liefert (z. B. ein Nomen ohne erkennbare Endvokalisierung). */
  kasusTempus: KasusTempusMerkmal | null;
  /** Normalisierte Grundrelation (relationBasis().basis), `null` wenn das Wort
   * keine Syntaxdaten trägt (z. B. Basmala-Bestandteile, s. MorphWord.syntax). */
  satzrolleBasis: string | null;
}

function stammSegment(word: MorphWord): MorphSegment {
  return word.segments.find((s) => s.kind === 'stem') ?? word.segments[0];
}

export function baueUebungsWort(word: MorphWord): UebungsWort {
  const stamm = stammSegment(word);
  const wa = wortart(stamm.pos);
  let kasusTempus: KasusTempusMerkmal | null = null;
  if (wa === 'ism') {
    const kasus = ismEigenschaften(stamm).kasus;
    if (kasus) kasusTempus = { typ: 'kasus', wert: kasus.wert };
  } else if (wa === 'fiil') {
    const tempus = verbEigenschaften(stamm).tempus;
    if (tempus) kasusTempus = { typ: 'tempus', wert: tempus.wert };
  }
  const satzrolleBasis = word.syntax ? relationBasis(word.syntax.relation).basis : null;
  return { word, stamm, wortart: wa, kasusTempus, satzrolleBasis };
}

export function baueUebungsWoerter(verseWords: MorphWord[]): UebungsWort[] {
  return verseWords.map(baueUebungsWort);
}

// ---------- Aktive Dimensionen je Stufe ----------

export type Dimension = 'wortart' | 'kasusTempus' | 'satzrolle';

/**
 * Welche Dimensionen für DIESES Wort bei der gewählten Stufe abgefragt
 * werden — nur, was der Korpus tatsächlich belegt (s. Kopf-Kommentar). Ein
 * Wort ohne jede abfragbare Dimension liefert ein leeres Array; solche
 * Wörter werden von `baueSchritte()` komplett aus der Übung entfernt.
 */
export function aktiveDimensionen(u: UebungsWort, stufe: Schwierigkeitsgrad): Dimension[] {
  const dims: Dimension[] = [];
  if (u.wortart !== null) dims.push('wortart');
  if (stufe >= 2 && u.kasusTempus !== null) dims.push('kasusTempus');
  if (stufe >= 3 && u.satzrolleBasis !== null) dims.push('satzrolle');
  return dims;
}

export interface UebungsSchritt {
  wort: UebungsWort;
  dimensionen: Dimension[];
}

/** Ein Übungsschritt je Wort, in Lesereihenfolge des Verses — Wörter ohne
 * eine einzige abfragbare Dimension bei der gewählten Stufe fallen ganz weg. */
export function baueSchritte(verseWords: MorphWord[], stufe: Schwierigkeitsgrad): UebungsSchritt[] {
  return baueUebungsWoerter(verseWords)
    .map((wort) => ({ wort, dimensionen: aktiveDimensionen(wort, stufe) }))
    .filter((schritt) => schritt.dimensionen.length > 0);
}

// ---------- Antwortoptionen ----------

export const WORTART_OPTIONEN: readonly Wortart[] = ['ism', 'fiil', 'harf'];
export const KASUS_OPTIONEN: readonly string[] = ['nom', 'acc', 'gen'];
export const TEMPUS_OPTIONEN: readonly string[] = ['perfect', 'imperfect', 'imperative'];

/** Nur Basiswerte, die einen eigenen Eintrag unter grammatik.relationen
 * haben (s. grammatik.ts relationBasis()/de.json) — Reserve-Distraktoren,
 * falls ein Vers für sich zu wenige unterschiedliche Satzrollen mitbringt,
 * um eine echte Auswahl zu sein (s. satzrolleOptionen()). */
const SATZROLLE_RESERVE_POOL: readonly string[] = ['Subj', 'Obj', 'gen', 'conj', 'Pred', 'Adj', 'Poss', 'circ'];

/** Mindestzahl an Satzrolle-Optionen, damit Raten durch Ausschluss (nur die
 * eine im Vers vorkommende Rolle stünde zur Auswahl) nicht trivial wird. */
const MIN_SATZROLLE_OPTIONEN = 3;

/**
 * Auswahlmöglichkeiten für die Satzrolle-Frage: alle im aktuellen Vers
 * tatsächlich vorkommenden Grundrelationen (garantiert korrekt, da direkt aus
 * den Übungsschritten gelesen), aufgefüllt mit Werten aus dem Reserve-Pool
 * bis mindestens `MIN_SATZROLLE_OPTIONEN` Optionen erreicht sind.
 */
export function satzrolleOptionen(schritte: UebungsSchritt[]): string[] {
  const vorhanden = new Set<string>();
  for (const schritt of schritte) {
    if (schritt.wort.satzrolleBasis !== null) vorhanden.add(schritt.wort.satzrolleBasis);
  }
  const optionen = [...vorhanden];
  for (const kandidat of SATZROLLE_RESERVE_POOL) {
    if (optionen.length >= MIN_SATZROLLE_OPTIONEN) break;
    if (!optionen.includes(kandidat)) optionen.push(kandidat);
  }
  return optionen.sort();
}

// ---------- Bewertung ----------

export type Bewertung = 'richtig' | 'falsch' | 'nichtBewertet';

export interface Antwort {
  wortart?: Wortart;
  kasusTempus?: string;
  satzrolle?: string;
}

export function bewerteDimension(u: UebungsWort, dimension: Dimension, antwort: Antwort): Bewertung {
  if (dimension === 'wortart') {
    if (u.wortart === null) return 'nichtBewertet';
    return antwort.wortart === u.wortart ? 'richtig' : 'falsch';
  }
  if (dimension === 'kasusTempus') {
    if (u.kasusTempus === null) return 'nichtBewertet';
    return antwort.kasusTempus === u.kasusTempus.wert ? 'richtig' : 'falsch';
  }
  if (u.satzrolleBasis === null) return 'nichtBewertet';
  return antwort.satzrolle === u.satzrolleBasis ? 'richtig' : 'falsch';
}

export interface BewertetesElement {
  wortPosition: number;
  wortText: string;
  wortRoot: string | null;
  dimension: Dimension;
  bewertung: Bewertung;
  antwort: string | undefined;
  korrekterWert: string | null;
}

export interface Ergebnis {
  richtig: number;
  falsch: number;
  nichtBewertet: number;
  elemente: BewertetesElement[];
}

function korrekterWert(u: UebungsWort, dimension: Dimension): string | null {
  if (dimension === 'wortart') return u.wortart;
  if (dimension === 'kasusTempus') return u.kasusTempus?.wert ?? null;
  return u.satzrolleBasis;
}

function antwortWert(antwort: Antwort, dimension: Dimension): string | undefined {
  if (dimension === 'wortart') return antwort.wortart;
  if (dimension === 'kasusTempus') return antwort.kasusTempus;
  return antwort.satzrolle;
}

/**
 * Wertet eine vollständige Übung aus. `antworten` ist je Wortposition (1-
 * basiert, s. MorphWord.position) die vom Nutzer gegebene Antwort. Fehlt ein
 * Wort in `antworten` (sollte im UI-Ablauf nicht vorkommen, da "Aufdecken"
 * erst nach vollständiger Auswahl aktiv wird), zählt das als 'falsch' —
 * niemals als 'nichtBewertet': eine fehlende NUTZER-Antwort ist etwas anderes
 * als eine fehlende KORPUS-Angabe.
 */
export function werteAus(schritte: UebungsSchritt[], antworten: Record<number, Antwort>): Ergebnis {
  const elemente: BewertetesElement[] = [];
  let richtig = 0;
  let falsch = 0;
  let nichtBewertet = 0;
  for (const schritt of schritte) {
    const antwort = antworten[schritt.wort.word.position] ?? {};
    for (const dimension of schritt.dimensionen) {
      const bewertung = bewerteDimension(schritt.wort, dimension, antwort);
      if (bewertung === 'richtig') richtig += 1;
      else if (bewertung === 'falsch') falsch += 1;
      else nichtBewertet += 1;
      elemente.push({
        wortPosition: schritt.wort.word.position,
        wortText: schritt.wort.word.text,
        wortRoot: schritt.wort.word.root,
        dimension,
        bewertung,
        antwort: antwortWert(antwort, dimension),
        korrekterWert: korrekterWert(schritt.wort, dimension),
      });
    }
  }
  return { richtig, falsch, nichtBewertet, elemente };
}

/** Trefferquote (0..1) — NUR über tatsächlich bewertete Elemente, 'nichtBewertet'
 * fließt weder in Zähler noch Nenner ein (s. Kopf-Kommentar). `0`, wenn keine
 * einzige Dimension bewertbar war (rein informativ, kein Absturz durch 0/0). */
export function trefferquote(ergebnis: Ergebnis): number {
  const bewertet = ergebnis.richtig + ergebnis.falsch;
  return bewertet === 0 ? 0 : ergebnis.richtig / bewertet;
}
