// Abgeleitete Grammatik-Logik auf den Morphologie-/Syntaxdaten (./morphologieTypen.ts).
// Bewusst rein funktional, ohne React-Abhängigkeit — gut isoliert testbar, und
// später sowohl vom Reader-Overlay als auch von einem Such-/Filter-Feature
// wiederverwendbar, ohne einen Hook mitzuschleppen.
import type { MorphFeatureKey, MorphSegment, MorphWord } from './morphologieTypen';

// ---------- Wortart aus dem QAC-POS-Tag ----------
//
// Zuordnung der QAC-Wortart-Tags (corpus.quran.com-Morphologie) auf die drei
// klassischen arabischen Wortarten. Gegen die echten Daten (.daten-cache/out/
// morphologie/*.json, 128219 Segmente) geprüft: es kommen GENAU 45 verschiedene
// POS-Tags vor (siehe meta.json → posHaeufigkeit), alle unten aufgeführt — kein
// Tag liefert mehr `null`. `null` bleibt reserviert für ein künftig neu
// eingeführtes, heute unbekanntes QAC-Tag; ein falsch geratenes "ist ein Nomen"
// wäre im Reader (Farbmarkierung, Grammatik-Erklärung) irreführender als ein
// ehrliches "weiß ich nicht".
//
// Ism (deklinierbares Nomen im weiteren Sinn): Substantiv, Eigenname, Adjektiv,
// (unabhängiges + angehängtes) Pronomen, Demonstrativ-, Relativpronomen, die
// beiden Ortsangaben-Kategorien Zeit (T, ظرف زمان) und Ort (LOC, ظرف مكان) —
// beides klassisch Nomen im Akkusativ — sowie اسم فعل الأمر (IMPN). Letzteres
// GEGEN die frühere Einordnung beim Verb: gegen die echten Daten geprüft
// (qac-0.4.txt) kommt IMPN im gesamten Korpus GENAU 2× vor, beide Male als
// STEM ohne jede PGN-/Tempus-/Modus-Markierung im Feature-String —
// مِسَاسَ (20:97:10, "STEM|POS:IMPN|LEM:misaAs|ROOT:mss") und هَآؤُمُ
// (69:19:7, "STEM|POS:IMPN|LEM:haA^&umu") —, also morphologisch ein
// unflektiertes Nomen, keine Verbform. Die traditionelle arabische Grammatik
// (اسم الفعل, z. B. Ibn Mālik, Alfiyya) ordnet diese Kategorie folgerichtig
// als Unterart von اسم ein: es TRÄGT Befehls-BEDEUTUNG und ersetzt syntaktisch
// einen Imperativ, IST aber namentlich und morphologisch ein Nomen ("اسم"),
// kein Verb — anders als IMPV (siehe unten), das keine eigene Wortart ist,
// sondern ein Präfix AM Verb.
const ISM_TAGS = new Set(['N', 'PN', 'ADJ', 'PRON', 'DEM', 'REL', 'T', 'LOC', 'IMPN']);
// Fiʿl: ausschließlich das reguläre Verb (V — Tempus/Modus stecken in
// features.tense/mood, nicht im POS-Tag). IMPV steht NICHT hier (siehe
// HARF_TAGS) — es ist keine Verbform, sondern ein eigenes PRÄFIX-Segment.
const FIIL_TAGS = new Set(['V']);
// Harf: alle Partikeln — Präpositionen (P; PRP als Sonderfall "Lām des Zwecks"),
// Konjunktionen/Subjunktionen, Negations-, Frage-, Ausrufe-, Vokativ-, Emphase-,
// Verstärkungs- und sonstige Diskurspartikeln, der bestimmte Artikel (DET, ein
// eigenes Präfix-Segment — siehe fragmentRolle), die getrennt geschriebenen
// Buchstaben am Sure-Anfang (INL, حروف مقطعة: weder dekliniert noch konjugiert,
// daher in der Sammelkategorie) sowie IMPV (لام الأمر, die Befehls-Lām vor dem
// Imperfekt-Verb, z. B. "لِيَحْكُم" = لِ+يَحْكُم). Gegen die echten Daten geprüft
// (qac-0.4.txt): das TAG "IMPV" (Spalte 3, nicht die gleichnamige Marke im
// Feature-String eines V-Stamms) kommt GENAU 78× vor, AUSNAHMSLOS als eigenes
// PREFIX-Segment mit Text "لْ" und Feature-String "PREFIX|l:IMPV+" (z. B.
// 10:58:6, 106:3:1, 12:67:26) — eine Partikel, die an ein Verb tritt, nicht
// das Verb selbst. Die vorherige Einordnung bei FIIL_TAGS war falsch: sie
// hätte diese 78 Präfix-Segmente fälschlich als eigenständige Verben gezählt.
const HARF_TAGS = new Set([
  'ACC',
  'AMD',
  'ANS',
  'AVR',
  'CAUS',
  'CERT',
  'CIRC',
  'COM',
  'COND',
  'CONJ',
  'DET',
  'EMPH',
  'EQ',
  'EXH',
  'EXL',
  'EXP',
  'FUT',
  'IMPV',
  'INC',
  'INL',
  'INT',
  'INTG',
  'NEG',
  'P',
  'PREV',
  'PRO',
  'PRP',
  'REM',
  'RES',
  'RET',
  'RSLT',
  'SUB',
  'SUP',
  'SUR',
  'VOC',
]);

export type Wortart = 'ism' | 'fiil' | 'harf';

/** Ordnet einen rohen QAC-POS-Tag einer Wortart zu, oder `null` bei unbekanntem Tag. */
export function wortart(pos: string): Wortart | null {
  if (ISM_TAGS.has(pos)) return 'ism';
  if (FIIL_TAGS.has(pos)) return 'fiil';
  if (HARF_TAGS.has(pos)) return 'harf';
  return null;
}

/** true/false bei bekanntem Tag, `null` bei unbekanntem Tag (nicht raten). */
export function istIsm(segment: Pick<MorphSegment, 'pos'>): boolean | null {
  const w = wortart(segment.pos);
  return w === null ? null : w === 'ism';
}

export function istFiil(segment: Pick<MorphSegment, 'pos'>): boolean | null {
  const w = wortart(segment.pos);
  return w === null ? null : w === 'fiil';
}

export function istHarf(segment: Pick<MorphSegment, 'pos'>): boolean | null {
  const w = wortart(segment.pos);
  return w === null ? null : w === 'harf';
}

// ---------- Merkmale mit Beleg-/Herleitungs-Unterscheidung ----------

/** 'beleg' = Merkmal steht explizit im Korpus; 'hergeleitet' = per Konvention
 * ergänzt (im `derived`-Array des Segments gelistet, siehe morphologieTypen.ts). */
export type Herkunft = 'beleg' | 'hergeleitet';

export interface MerkmalMitHerkunft<T> {
  wert: T;
  herkunft: Herkunft;
}

function merkmal<K extends MorphFeatureKey>(
  segment: Pick<MorphSegment, 'features' | 'derived'>,
  schluessel: K,
): MerkmalMitHerkunft<NonNullable<MorphSegment['features'][K]>> | null {
  const wert = segment.features[schluessel];
  if (wert === null || wert === undefined) return null;
  return {
    wert: wert as NonNullable<MorphSegment['features'][K]>,
    herkunft: segment.derived.includes(schluessel) ? 'hergeleitet' : 'beleg',
  };
}

export interface IsmEigenschaften {
  genus: MerkmalMitHerkunft<'m' | 'f'> | null;
  numerus: MerkmalMitHerkunft<'sg' | 'du' | 'pl'> | null;
  bestimmtheit: MerkmalMitHerkunft<'definite' | 'indefinite'> | null;
  kasus: MerkmalMitHerkunft<'nom' | 'acc' | 'gen'> | null;
}

/** Die vier nominalen Eigenschaften (Genus, Numerus, Bestimmtheit, Kasus),
 * jeweils mit Beleg-/Herleitungs-Kennzeichnung. Liest reine Segmentdaten —
 * ruft NICHT selbst istIsm() auf, damit die Funktion auch für Grenzfälle
 * (unbekanntes POS-Tag) benutzbar bleibt, ohne vorher zu entscheiden, ob das
 * Segment "wirklich" ein Nomen ist. */
export function ismEigenschaften(segment: MorphSegment): IsmEigenschaften {
  return {
    genus: merkmal(segment, 'gender'),
    numerus: merkmal(segment, 'number'),
    bestimmtheit: merkmal(segment, 'state'),
    kasus: merkmal(segment, 'case'),
  };
}

export interface VerbEigenschaften {
  tempus: MerkmalMitHerkunft<'perfect' | 'imperfect' | 'imperative'> | null;
  modus: MerkmalMitHerkunft<'ind' | 'sub' | 'juss'> | null;
  genusVerbi: MerkmalMitHerkunft<'active' | 'passive'> | null;
  /** Verbform I–X. */
  verbform: MerkmalMitHerkunft<number> | null;
  person: MerkmalMitHerkunft<'1' | '2' | '3'> | null;
  genus: MerkmalMitHerkunft<'m' | 'f'> | null;
  numerus: MerkmalMitHerkunft<'sg' | 'du' | 'pl'> | null;
}

/** Tempus, Modus, Genus verbi, Verbform sowie Person/Genus/Numerus des Subjekts —
 * jeweils mit Beleg-/Herleitungs-Kennzeichnung (z. B. Verbform I ist im
 * Korpus so gut wie nie explizit markiert und daher fast immer "hergeleitet"). */
export function verbEigenschaften(segment: MorphSegment): VerbEigenschaften {
  return {
    tempus: merkmal(segment, 'tense'),
    modus: merkmal(segment, 'mood'),
    genusVerbi: merkmal(segment, 'voice'),
    verbform: merkmal(segment, 'verbForm'),
    person: merkmal(segment, 'person'),
    genus: merkmal(segment, 'gender'),
    numerus: merkmal(segment, 'number'),
  };
}

// ---------- Verneinung ----------

// Arabische Tashkil/Harakat-Zeichen — für den textbasierten Vergleich entfernt,
// da dieselbe Verneinungspartikel je nach Vokalisierung im Korpus mit
// unterschiedlichen Diakritika vorkommen kann (لَمْ vs. لَمّ vs. لم).
const DIAKRITIKA_RE = /[ً-ٰٟۖ-ۭ]/g;

function ohneDiakritika(text: string): string {
  return text.replace(DIAKRITIKA_RE, '');
}

// Gegen die echten Daten geprüft (128219 Segmente): pos === 'NEG' trifft
// GENAU 2688 Mal — exakt die in meta.json unter posHaeufigkeit.NEG
// ausgewiesene Zahl. Aufschlüsselung der getroffenen Texte: 1404x "laa",
// 705x "maa", 347x "lam", 106x "lan", 114x "in" (klassisches "in" = "nicht"),
// 7x "lammaa", je 2-3x zwei Kleinstformen. Ein zusätzlicher textbasierter
// Abgleich (frühere VERNEINUNGS_FORMEN-Liste: Text ist lam/lan/maa/laa nach
// Diakritika-Entfernung) wurde ENTFERNT statt nur ergänzt, weil er in der
// Praxis falsch-positiv schlägt: der Wortstamm von "linta" ("du warst sanft",
// Wurzel l-y-n, 3:159) ist nach Diakritika-Entfernung textgleich mit "lan",
// und der Stamm von "lumtunnani" ("ihr habt getadelt", Wurzel l-w-m, 12:32)
// ist textgleich mit "lam" — beides Verben (pos "V"), keine Verneinung.
// Umgekehrt ist "maa" an rund 1800 weiteren Stellen Relativ- (REL),
// Interrogativ- (INTG), Bedingungs- (COND) oder Vorspann-Partikel
// (PREV/SUB/SUP), und "laa" als Verbotspartikel (laa an-nahiya) trägt
// bewusst das eigene Tag "PRO" statt "NEG" — Text allein kann diese
// Funktionen nicht auseinanderhalten, pos === 'NEG' bildet exakt die
// Verneinungs-FUNKTION ab.
export interface VerneinungsTreffer {
  /** Das Segment, das die Verneinung trägt. */
  segment: MorphSegment;
  /** Erkannte Form ohne Diakritika. */
  form: string;
}

/** Erkennt, ob eines der Segmente eines Wortes eine Verneinungspartikel ist
 * (QAC-Tag NEG — siehe Beleg oben), und meldet zurück WELCHES Segment die
 * Verneinung trägt. `null`, wenn das Wort keine Verneinung enthält. */
export function istVerneinung(word: MorphWord): VerneinungsTreffer | null {
  for (const segment of word.segments) {
    if (segment.pos === 'NEG') return { segment, form: ohneDiakritika(segment.text) };
  }
  return null;
}

// ---------- Fragment-Rolle ----------

export type FragmentRolle =
  | 'konjunktion'
  | 'praeposition'
  | 'artikel'
  | 'pronomenSuffix'
  | 'verneinung'
  | 'fragepartikel'
  | 'stamm'
  | 'sonstigerHarf'
  | 'sonstigesAffix';

/** Kurze, maschinenlesbare Rolle eines einzelnen Fragments — Grundlage für
 * Erklärtexte im Reader ("dieses ـو ist eine Konjunktion" usw.). Liefert
 * IMMER einen Wert (kein `null`): unbekannte Fälle landen in den generischen
 * Sammelkategorien 'sonstigerHarf'/'sonstigesAffix' statt eine falsche
 * spezifische Rolle zu behaupten. */
export function fragmentRolle(segment: MorphSegment): FragmentRolle {
  if (segment.pos === 'NEG') return 'verneinung';
  if (segment.pos === 'CONJ') return 'konjunktion';
  if (segment.pos === 'P') return 'praeposition';
  if (segment.pos === 'INTG') return 'fragepartikel';
  if (segment.kind === 'suffix' && segment.pos === 'PRON') return 'pronomenSuffix';
  // Bestimmter Artikel: eigenes Präfix-Segment mit POS-Tag "DET" (8377 Belege
  // im Korpus, exakt meta.json -> posHaeufigkeit.DET). Der frühere textbasierte
  // Abgleich (Text ohne Diakritika === Alif+Lam) wurde entfernt statt nur
  // ergänzt: er hätte in der Praxis so gut wie NIE gegriffen. Ausgezählt über
  // alle 114 Suren (128219 Segmente): von 8377 DET-Segmenten strippt KEIN
  // EINZIGES nach Diakritika-Entfernung auf das einfache Alif+Lam (U+0627
  // U+0644) — der Artikel steht im Korpus fast immer mit Wasla (Alif Wasla,
  // U+0671) statt des einfachen Alif, in 4 Fällen mit Madda (U+0622). Nach
  // vorangestellter Lam-Präposition (z. B. "lil-muttaqin") verliert der
  // Artikel sein Alif sogar ganz und bleibt nur als Lam-Sukun übrig —
  // textbasiert also gar nicht mehr als Artikel erkennbar, während das eigene
  // DET-Segment weiterhin zuverlässig vorhanden ist.
  if (segment.pos === 'DET') return 'artikel';
  if (segment.kind === 'stem') return 'stamm';
  return istHarf(segment) === true ? 'sonstigerHarf' : 'sonstigesAffix';
}

// ---------- Relation normalisieren (kana-/inna-Familien) ----------

/** Ergebnis von {@link relationBasis}: die Grundrelation plus — nur bei den
 * kana-/inna-Sonderformen — das jeweils "regierende" Element (z. B. "kan"
 * für kaana, "in" für inna). `regens` ist `null` bei einer einfachen Relation. */
export interface RelationBasis {
  basis: string;
  regens: string | null;
}

// Von den 112 im Korpus vorkommenden Relationslabels (siehe meta.json ->
// relationHaeufigkeit) sind ~70 Varianten der Form "pred <<kan>>" / "subj<<in>>"
// / "pred<<lays>>" -- Prädikat bzw. Subjekt von kaana und seinen Schwestern
// (kaana, layta, laysa, asbaha, ...) sowie von inna und seinen Schwestern
// (inna, anna, lakinna, ...). Schreibweise im Korpus uneinheitlich: mal mit,
// mal ohne Leerzeichen vor "<<" (z. B. "pred <<kan>>" vs. "pred<<in>>"), aber
// nie mit Leerzeichen direkt nach "<<" bzw. vor ">>". Reduziert die 112
// Labels auf 46 verschiedene Basiswerte (44 einfache Relationen unverändert
// durchgereicht, plus die beiden Familien-Basiswerte "pred"/"subj") -- die UI
// braucht dadurch nur noch ~46 statt 112 Übersetzungen.
const RELATION_FAMILIE_RE = /^(\w+)\s*<<\s*(.+?)\s*>>$/;

/** Normalisiert ein rohes QAC-Relationslabel: einfache Labels ("conj", "Obj",
 * "App", ...) werden unverändert als `basis` durchgereicht (`regens: null`);
 * die kaana-/inna-Familienformen ("pred <<kan>>", "subj<<in>>", ...) werden in
 * `{ basis: "pred" | "subj", regens: "kan" | "in" | ... }` zerlegt. */
export function relationBasis(relation: string): RelationBasis {
  const treffer = RELATION_FAMILIE_RE.exec(relation);
  if (treffer) return { basis: treffer[1], regens: treffer[2] };
  return { basis: relation, regens: null };
}

// ---------- Farbgruppe (nur Schlüssel, keine Farbwerte) ----------

export type FarbGruppe =
  | 'fiil-perfect'
  | 'fiil-imperfect'
  | 'fiil-imperative'
  | 'fiil'
  | 'ism-definite'
  | 'ism-indefinite'
  | 'ism'
  | 'harf-konjunktion'
  | 'harf-praeposition'
  | 'harf-verneinung'
  | 'harf-fragepartikel'
  | 'harf'
  | 'affix-artikel'
  | 'affix-pronomenSuffix'
  | 'affix';

/** Gruppenschlüssel für die spätere Farbmarkierung im Reader — kombiniert
 * Wortart mit dem jeweils naheliegendsten Unterscheidungsmerkmal (Tempus bei
 * Verben, Bestimmtheit bei Nomen, Fragment-Rolle bei Partikeln/Affixen).
 * Liefert AUSSCHLIESSLICH den Schlüssel; die tatsächlichen Farben kommen aus
 * constants/theme.ts — diese Funktion kennt keine Farbwerte. */
export function farbGruppe(segment: MorphSegment): FarbGruppe {
  if (istFiil(segment) === true) {
    const { tense } = segment.features;
    if (tense === 'perfect') return 'fiil-perfect';
    if (tense === 'imperfect') return 'fiil-imperfect';
    if (tense === 'imperative') return 'fiil-imperative';
    return 'fiil';
  }
  if (istIsm(segment) === true) {
    const { state } = segment.features;
    if (state === 'definite') return 'ism-definite';
    if (state === 'indefinite') return 'ism-indefinite';
    return 'ism';
  }
  if (istHarf(segment) === true) {
    const rolle = fragmentRolle(segment);
    // Der bestimmte Artikel (DET) ist fachlich ein Harf, bekommt aber wie das
    // Pronomen-Suffix seine eigene, spezifischere Farbgruppe statt in der
    // generischen 'harf'-Sammelgruppe zu verschwinden.
    if (rolle === 'artikel') return 'affix-artikel';
    if (rolle === 'konjunktion') return 'harf-konjunktion';
    if (rolle === 'praeposition') return 'harf-praeposition';
    if (rolle === 'verneinung') return 'harf-verneinung';
    if (rolle === 'fragepartikel') return 'harf-fragepartikel';
    return 'harf';
  }
  // Wortart unbekannt (istIsm/istFiil/istHarf liefern null, z. B. unbekanntes
  // POS-Tag) — die Fragment-Rolle allein entscheidet noch über eine grobe Gruppe.
  const rolle = fragmentRolle(segment);
  if (rolle === 'artikel') return 'affix-artikel';
  if (rolle === 'pronomenSuffix') return 'affix-pronomenSuffix';
  return 'affix';
}

// ---------- Wurzeltyp (schwache/unregelmäßige Verben) ----------
//
// Klassische arabische Einteilung der Konsonantenwurzel (MorphWord.root bzw.
// Schlüssel in roots.json) in ZWEI unabhängige Dimensionen — rein aus den
// Radikalen selbst hergeleitet, keine neue Quelle nötig:
// - "Schwache" Dimension (genau EINE der folgenden, oder keine — daher
//   gegenseitig ausschließend): مثال miṯāl (1. Radikal و/ي), أجوف aǧwaf
//   (2. Radikal و/ي), ناقص nāqiṣ (3. Radikal و/ي), لفيف lafīf (ZWEI der drei
//   Radikale و/ي — مفروق mafrūq: 1.+3., مقرون maqrūn: 2.+3.). Kein schwacher
//   Radikal → صحيح ṣaḥīḥ.
// - Hamza-Dimension (unabhängig von der schwachen Dimension, kann mit jeder
//   der obigen kombinieren): مهموز mahmūz, wenn ein Radikal Hamza ist.
// - Verdopplungs-Dimension (ebenfalls unabhängig): مضاعف muḍāʿaf, wenn 2. und
//   3. Radikal identisch sind.
// Eine Wurzel kann daher MEHRERE Kategorien gleichzeitig tragen — z. B. امن
// (أمن) ist ṣaḥīḥ UND mahmūz, مدد ist ṣaḥīḥ UND muḍāʿaf — deshalb liefert
// wurzelTyp() eine Liste, keinen Einzelwert.
//
// WARUM EIN BLOSSES ALIF ('ا', KEIN Hamza-Trägerzeichen) ALS HAMZA GILT: Gegen
// die echten Daten geprüft (roots.json, 1642 Wurzeln aus dem gesamten Korpus):
// KEINE einzige Wurzel enthält ein Hamza-Trägerzeichen (ء/أ/إ/ؤ/ئ) — QAC
// normalisiert jeden Hamza-Radikal in der ROOT-Spalte auf bloßes Alif (Beleg:
// LEM "'aAmana" [أَامَنَ] aber ROOT "Amn" → hier "امن", NICHT "أمن"; LEM
// "sa>ala" [سَأَلَ] aber ROOT "sAl" → "سال", NICHT "سأل"). Die klassische
// Wurzellehre kennt kein bloßes Alif als eigenständigen Basis-Radikal (jeder
// etymologische Langvokal-Alif wird in der dreiradikaligen Zitierform als و
// oder ي geschrieben, z. B. قال als قول) — ein Alif an Radikal-Position MUSS
// also ein normalisierter Hamza sein. Betrifft 135 von 1642 Wurzeln (134 in
// Drei-Radikal-Wurzeln → mahmuz; 1 in einer Vier-Radikal-Wurzel, "لالا" →
// dort bewusst nicht zerlegt, siehe unten), u. a. die bekannten Hamza-Wurzeln
// اله/امن/اخر/اذن/امر/اكل/اخذ/سال/اجر/اسر/اهل.
//
// Wurzeln mit VIER Radikalen (رباعي, 40 von 1642) werden bewusst NICHT in die
// Drei-Radikal-Logik gepresst — dafür bräuchte es eine eigene, hier nicht
// verifizierte Konvention (z. B. welche Position bei رباعي als "schwach"
// zählt). Sie bekommen die eigene Kategorie 'rubai' ohne weitere Zerlegung.
//
// Grenzfall ohne klassischen Namen: schwache Radikale an Position 1+2 (statt
// des benannten لفيف-Musters 1+3 oder 2+3) — im Korpus GENAU 1 Beleg: يوم
// (Radikale ي-و-م). Statt einen Namen zu erfinden, wird das hier als
// eigenständige miṯāl- UND aǧwaf-Meldung ausgegeben (jede Einzeldefinition
// trifft ja tatsächlich zu), nicht als "lafif" fehletikettiert.
export type WurzelTypKategorie =
  | 'sahih'
  | 'mahmuz'
  | 'mithal'
  | 'ajwaf'
  | 'naaqis'
  | 'lafifMafruq'
  | 'lafifMaqrun'
  | 'mudaaf'
  | 'rubai';

export interface WurzelTypEintrag {
  kategorie: WurzelTypKategorie;
  /** Alle Radikale der Wurzel, in Reihenfolge (3 oder 4 Buchstaben). */
  radikale: string[];
  /** Position(en) (1-basiert) des/der auslösenden Radikal(e) — gesetzt bei
   * mithal/ajwaf/naaqis/lafifMafruq/lafifMaqrun/mahmuz, sonst weggelassen
   * (sahih/mudaaf/rubai betreffen keine EINZELNE Position). */
  positionen?: number[];
}

const WURZEL_SCHWACHE_BUCHSTABEN = new Set(['و', 'ي']);
/** Siehe Kopf-Kommentar oben: bloßes Alif markiert einen normalisierten Hamza-Radikal. */
const WURZEL_HAMZA_MARKER = 'ا';

/**
 * Klassifiziert eine Konsonantenwurzel (MorphWord.root) nach der klassischen
 * Einteilung schwacher/unregelmäßiger Wurzeln — siehe Kopf-Kommentar oben für
 * die vollständige Herleitung und die Belege gegen die echten Korpusdaten.
 * `null` bei fehlender Wurzel ODER bei einer Radikalanzahl, für die keine
 * verifizierte Konvention vorliegt (im gesamten Korpus kommen nur 3 und 4 vor
 * — nichts wird darüber hinaus geraten).
 */
export function wurzelTyp(root: string | null | undefined): WurzelTypEintrag[] | null {
  if (!root) return null;
  const radikale = [...root];
  if (radikale.length === 4) return [{ kategorie: 'rubai', radikale }];
  if (radikale.length !== 3) return null;

  const ergebnisse: WurzelTypEintrag[] = [];
  const schwachePositionen = radikale
    .map((r, i) => (WURZEL_SCHWACHE_BUCHSTABEN.has(r) ? i + 1 : null))
    .filter((p): p is number => p !== null);

  if (schwachePositionen.length === 0) {
    ergebnisse.push({ kategorie: 'sahih', radikale });
  } else if (schwachePositionen.length === 1) {
    const [pos] = schwachePositionen;
    const kategorie = pos === 1 ? 'mithal' : pos === 2 ? 'ajwaf' : 'naaqis';
    ergebnisse.push({ kategorie, radikale, positionen: [pos] });
  } else if (schwachePositionen[0] === 1 && schwachePositionen[1] === 3) {
    ergebnisse.push({ kategorie: 'lafifMafruq', radikale, positionen: schwachePositionen });
  } else if (schwachePositionen[0] === 2 && schwachePositionen[1] === 3) {
    ergebnisse.push({ kategorie: 'lafifMaqrun', radikale, positionen: schwachePositionen });
  } else {
    // Positionen 1+2 (oder theoretisch alle drei) schwach: kein klassischer
    // Name, siehe Kopf-Kommentar ("يوم", 1 Beleg im Korpus) — Einzelkategorien
    // statt erfundenem Sammelnamen.
    for (const pos of schwachePositionen) {
      ergebnisse.push({
        kategorie: pos === 1 ? 'mithal' : pos === 2 ? 'ajwaf' : 'naaqis',
        radikale,
        positionen: [pos],
      });
    }
  }

  const hamzaPositionen = radikale
    .map((r, i) => (r === WURZEL_HAMZA_MARKER ? i + 1 : null))
    .filter((p): p is number => p !== null);
  if (hamzaPositionen.length > 0) {
    ergebnisse.push({ kategorie: 'mahmuz', radikale, positionen: hamzaPositionen });
  }

  if (radikale[1] === radikale[2]) {
    ergebnisse.push({ kategorie: 'mudaaf', radikale });
  }

  return ergebnisse;
}
