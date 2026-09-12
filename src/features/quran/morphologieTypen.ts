// Typen für die Wort-Morphologie- und Syntaxdaten des Korans (QAC-Segmentierung).
//
// Herkunft: eigene Pipeline (Parallel-Agent), ausgeliefert über R2 unter
// morphologie/v3/<sure>.json — ein Schema pro Sure, siehe ladeMorphologie in
// ./morphologie.ts. Die Typen hier bilden GENAU das dort festgelegte Schema
// ab (schema: 3) und werden von der Lade-Schicht sowie von der reinen
// Grammatik-Logik (./grammatik.ts) gemeinsam genutzt.
//
// Schema-Historie:
// - v1: Bestimmtheit (`state`) nur aus Al+-Präfix bzw. PN-Tag hergeleitet.
// - v2: zusätzlich aus Mudaf-Stellung (Kopf einer Poss-Relation) und
//   angehängtem Possessivpronomen hergeleitet (build-morphologie.mjs,
//   bestimmtheitErgaenzen) — schließt eine 9.000+ Segmente große Lücke, in
//   der grammatisch eindeutig bestimmte Wörter `state: null` zeigten.
// - v3: fünf der sechs unter v2 in `bekannteLuecken` protokollierten
//   Buckwalter-Sonderzeichen aufgelöst (Uthmani-Kleinbuchstaben-Markierungen
//   ':' ';' '-' '!' '%', je gegen den echten Vers via api.quran.com
//   text_uthmani geprüft — siehe BUCKWALTER-Tabelle in build-morphologie.mjs).
//   Der URL-Pfad trägt die Version mit (siehe morphologie.ts), weil die
//   Auslieferung "immutable" gecacht ist.

/** Segmentposition im Wort: Präfix (z. B. و/ال/ب), Wortstamm, Suffix (z. B. Pronomen). */
export type MorphSegmentKind = 'prefix' | 'stem' | 'suffix';

/** Grammatische Merkmale eines Segments — jedes Feld ist `null`, wenn das
 * Merkmal für dieses Segment nicht zutrifft (z. B. `person` bei einem Nomen). */
export interface MorphFeatures {
  person: '1' | '2' | '3' | null;
  gender: 'm' | 'f' | null;
  number: 'sg' | 'du' | 'pl' | null;
  case: 'nom' | 'acc' | 'gen' | null;
  state: 'definite' | 'indefinite' | null;
  mood: 'ind' | 'sub' | 'juss' | null;
  tense: 'perfect' | 'imperfect' | 'imperative' | null;
  voice: 'active' | 'passive' | null;
  /** Verbform I–X (arabisch: erster bis zehnter Stamm), oder `null` bei Nicht-Verben. */
  verbForm: number | null;
  derivation: 'activeParticiple' | 'passiveParticiple' | 'verbalNoun' | null;
}

/** Schlüssel von {@link MorphFeatures} — genutzt für das `derived`-Array. */
export type MorphFeatureKey = keyof MorphFeatures;

/** Ein Morphem innerhalb eines Wortes. */
export interface MorphSegment {
  text: string;
  kind: MorphSegmentKind;
  /** QAC-Wortart-Tag, unverändert aus dem Korpus übernommen (z. B. "CONJ", "PERF", "N"). */
  pos: string;
  features: MorphFeatures;
  /** Merkmale in {@link features}, die NICHT explizit im Korpus stehen, sondern
   * per grammatischer Konvention hergeleitet wurden (z. B. Verbform I ohne
   * eigenes Präfix/Suffix, das sie markiert). Teilmenge von {@link MorphFeatureKey}. */
  derived: MorphFeatureKey[];
  /** Roh-Tag-String aus dem Quellkorpus, unverändert — für Debugging/Fallback. */
  raw: string;
}

/** Syntaktische Abhängigkeit eines Wortes (Dependenzgrammatik, QAC-Terminologie). */
export interface MorphSyntax {
  /** QAC-Relationstag, unverändert (z. B. "conj", "App" für Badal, "mid" …). */
  relation: string;
  /** Arabische Bezeichnung der Relation, wie im Korpus geliefert. */
  relationAr: string;
  /** Position (1-basiert, siehe {@link MorphWord.position}) des Bezugsworts,
   * oder `null`, wenn die Pipeline keine Position im selben Vers auflösen
   * konnte (elidiertes/implizites Bezugswort oder Bezug außerhalb des Verses
   * — zusammen 4.622 Fälle, siehe `grenzfaelle` in meta.json bzw.
   * build-morphologie.mjs). NIE geraten — echte Fälle, z. B. Fixture 1:3:1. */
  head: number | null;
}

/** Ein Wort eines Verses mit vollständiger morphologischer Aufschlüsselung. */
export interface MorphWord {
  /** 1-basierte Position im Vers. */
  position: number;
  text: string;
  /** Dreikonsonantige (o. ä.) Wurzel, oder `null` wenn keine Wurzel zugeordnet ist. */
  root: string | null;
  lemma: string;
  segments: MorphSegment[];
  /** Fehlt für Wörter, für die die Pipeline keine Dependenzrelation liefert
   * (z. B. Basmala-Bestandteile) — daher optional, nicht `null`. */
  syntax?: MorphSyntax;
}

/** Verse einer Sure, Schlüssel = Vers-Nummer als String (1-basiert), wie im JSON. */
export type MorphVerses = Record<string, MorphWord[]>;

/** Eine vollständige morphologie/<sure>.json-Datei. */
export interface MorphologieDatei {
  schema: number;
  surah: number;
  verses: MorphVerses;
}

/** Aktuell unterstützte Schema-Version — siehe `istGueltig` in ./morphologie.ts.
 * Bestimmt auch das R2-URL-Präfix (MORPHOLOGIE_BASIS_URL in ./morphologie.ts). */
export const MORPHOLOGIE_SCHEMA_VERSION = 3;

// ---------- Wurzeln (roots.json) ----------

/** Vorkommen eines Wortes: [Sure, Vers, Wortposition] (jeweils 1-basiert). */
export type MorphVorkommen = [number, number, number];

/** Ein Eintrag in roots.json — alle Vorkommen und zugehörigen Lemmata einer Wurzel. */
export interface WurzelEintrag {
  count: number;
  lemmas: string[];
  occurrences: MorphVorkommen[];
}

/** Die vollständige roots.json — Schlüssel = Wurzel (arabisch, z. B. "سمو"). */
export type WurzelnDatei = Record<string, WurzelEintrag>;

// ---------- Lemmata (lemmas.json) ----------

/** Ein Eintrag in lemmas.json — alle Vorkommen eines Lemmas. */
export interface LemmaEintrag {
  count: number;
  occurrences: MorphVorkommen[];
}

/** Die vollständige lemmas.json — Schlüssel = Lemma (arabisch, z. B. "ٱللَّه"). */
export type LemmataDatei = Record<string, LemmaEintrag>;

// ---------- Meta (meta.json) ----------

/** Herkunftsangabe einer Quelldatei der Pipeline. */
export interface MetaQuelle {
  datei: string;
  sha256: string;
  url: string;
}

/** Eine bekannte Lücke/Unregelmäßigkeit im Quellkorpus (z. B. Tippfehler im
 * QAC-Rohtext), von der Pipeline dokumentiert statt stillschweigend ignoriert. */
export interface MetaBekannteLuecke {
  zeichen: string;
  wert: string;
  /** "sure:vers:wort:segment", 1-basiert. */
  location: string;
}

/** Die vollständige meta.json — Statistik und Herkunftsnachweis der Pipeline. */
export interface MetaDatei {
  schema: number;
  /** ISO-8601-Zeitstempel des Pipeline-Laufs. */
  gebaut: string;
  quellen: Record<string, MetaQuelle>;
  gesamt: {
    segmente: number;
    woerter: number;
    verse: number;
    suren: number;
    wurzeln: number;
    lemmata: number;
  };
  /** Häufigkeit je QAC-POS-Tag über den gesamten Korpus, siehe grammatik.ts. */
  posHaeufigkeit: Record<string, number>;
  /** Häufigkeit je QAC-Relationslabel über den gesamten Korpus, siehe grammatik.ts. */
  relationHaeufigkeit: Record<string, number>;
  grenzfaelle: {
    keineRelation: number;
    kopfUnbekannt: number;
    kopfGetilgtesWort: number;
    kopfAndererVers: number;
  };
  bekannteLuecken: MetaBekannteLuecke[];
  attribution: Record<string, string>;
}
