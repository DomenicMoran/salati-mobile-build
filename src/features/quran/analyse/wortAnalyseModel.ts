// Reine Anzeige-Logik für das Wortanalyse-Sheet (WortAnalyseSheet.tsx):
// verknüpft die reine Grammatik-Logik (../grammatik.ts) mit den i18n-Texten
// unter `grammatik.*`/`quran.wortAnalyse.*` in src/locales/*.json.
//
// Bewusst ohne React-Abhängigkeit (keine Hooks, kein JSX) — nimmt `t` als
// Parameter entgegen statt selbst useTranslation() aufzurufen. Dadurch bleibt
// die Zuordnungslogik (welcher Schlüssel für welches Merkmal, Fallback auf
// posTags bei den generischen Sammelrollen, {wort}-Platzhalter der
// kaana-/inna-Familien) isoliert testbar, ohne eine Komponente zu rendern.
import {
  farbGruppe,
  fragmentRolle,
  ismEigenschaften,
  istVerneinung,
  relationBasis,
  verbEigenschaften,
  wortart,
  wurzelTyp,
  type FarbGruppe,
  type FragmentRolle,
  type Herkunft,
  type MerkmalMitHerkunft,
  type Wortart,
  type WurzelTypKategorie,
} from '../grammatik';
import type { MorphSegment, MorphWord } from '../morphologieTypen';

/** Übersetzungsfunktion — dieselbe Signatur wie `useTranslation().t`. */
export type Uebersetzer = (key: string) => string;

function ersetze(text: string, platzhalter: string, wert: string): string {
  return text.replace(platzhalter, wert);
}

// ---------- Fragment-Anzeige ----------

const KIND_KEY: Record<MorphSegment['kind'], string> = {
  prefix: 'quran.wortAnalyse.segmentKind.prefix',
  stem: 'quran.wortAnalyse.segmentKind.stem',
  suffix: 'quran.wortAnalyse.segmentKind.suffix',
};

// Rollen mit eigenem i18n-Eintrag unter grammatik.fragmentrollen. Die beiden
// generischen Sammelrollen aus fragmentRolle() (sonstigerHarf/sonstigesAffix)
// haben dort BEWUSST keinen eigenen Eintrag (siehe grammatik.ts) — für sie
// fällt onWurzelOeffnen unten auf grammatik.posTags[segment.pos] zurück, das
// alle 45 im Korpus vorkommenden POS-Tags abdeckt.
const ROLLE_HAT_EIGENEN_EINTRAG = new Set<FragmentRolle>([
  'konjunktion',
  'praeposition',
  'artikel',
  'pronomenSuffix',
  'verneinung',
  'fragepartikel',
  'stamm',
]);

export interface FragmentAnzeige {
  segment: MorphSegment;
  kind: MorphSegment['kind'];
  kindLabel: string;
  farbGruppe: FarbGruppe;
  rolle: FragmentRolle;
  name: string;
  ar: string;
  info: string;
}

/** Anzeigedaten für EIN Fragment (Segment) eines Wortes. */
export function fragmentAnzeige(segment: MorphSegment, t: Uebersetzer): FragmentAnzeige {
  const rolle = fragmentRolle(segment);
  const basisSchluessel = ROLLE_HAT_EIGENEN_EINTRAG.has(rolle)
    ? `grammatik.fragmentrollen.${rolle}`
    : `grammatik.posTags.${segment.pos}`;
  return {
    segment,
    kind: segment.kind,
    kindLabel: t(KIND_KEY[segment.kind]),
    farbGruppe: farbGruppe(segment),
    rolle,
    name: t(`${basisSchluessel}.name`),
    ar: t(`${basisSchluessel}.ar`),
    info: t(`${basisSchluessel}.info`),
  };
}

/** Alle Fragmente eines Wortes, in Lesereihenfolge (= Reihenfolge in `segments`). */
export function fragmentListe(word: MorphWord, t: Uebersetzer): FragmentAnzeige[] {
  return word.segments.map((s) => fragmentAnzeige(s, t));
}

// ---------- Wortart des Wortes (über das Stamm-Segment) ----------

/** Das tragende Stamm-Segment eines Wortes — Grundlage für die Wortart-Karte.
 * Fällt auf das erste Segment zurück, falls (unerwartet) kein `stem`-Segment
 * vorhanden ist, statt gar nichts anzuzeigen. */
export function stammSegment(word: MorphWord): MorphSegment {
  return word.segments.find((s) => s.kind === 'stem') ?? word.segments[0];
}

export function wortWortart(word: MorphWord): Wortart | null {
  return wortart(stammSegment(word).pos);
}

// ---------- Merkmale mit Beleg-/Herleitungs-Kennzeichnung ----------

export interface MerkmalAnzeige {
  schluessel: string;
  label: string;
  ar: string;
  info: string;
  wert: string;
  wertName: string;
  wertAr: string;
  herkunft: Herkunft;
  herkunftLabel: string;
  herkunftInfo: string;
}

function merkmalAnzeige(
  basisSchluessel: string,
  merkmal: MerkmalMitHerkunft<string | number> | null,
  t: Uebersetzer,
): MerkmalAnzeige | null {
  if (!merkmal) return null;
  const wert = String(merkmal.wert);
  return {
    schluessel: basisSchluessel,
    label: t(`${basisSchluessel}.name`),
    ar: t(`${basisSchluessel}.ar`),
    info: t(`${basisSchluessel}.info`),
    wert,
    wertName: t(`${basisSchluessel}.werte.${wert}.name`),
    wertAr: t(`${basisSchluessel}.werte.${wert}.ar`),
    herkunft: merkmal.herkunft,
    herkunftLabel: t(`grammatik.herkunft.${merkmal.herkunft}.label`),
    herkunftInfo: t(`grammatik.herkunft.${merkmal.herkunft}.info`),
  };
}

export interface IsmEigenschaftenAnzeige {
  genus: MerkmalAnzeige | null;
  numerus: MerkmalAnzeige | null;
  bestimmtheit: MerkmalAnzeige | null;
  kasus: MerkmalAnzeige | null;
}

/** Die vier Ism-Eigenschaften (Genus, Numerus, Bestimmtheit, Kasus) als
 * fertige Anzeigedaten, jede mit Beleg-/Herleitungs-Kennzeichnung. */
export function ismEigenschaftenAnzeige(segment: MorphSegment, t: Uebersetzer): IsmEigenschaftenAnzeige {
  const e = ismEigenschaften(segment);
  return {
    genus: merkmalAnzeige('grammatik.ismEigenschaften.genus', e.genus, t),
    numerus: merkmalAnzeige('grammatik.ismEigenschaften.numerus', e.numerus, t),
    bestimmtheit: merkmalAnzeige('grammatik.ismEigenschaften.bestimmtheit', e.bestimmtheit, t),
    kasus: merkmalAnzeige('grammatik.ismEigenschaften.kasus', e.kasus, t),
  };
}

export interface VerbformAnzeige {
  label: string;
  ar: string;
  formName: string;
  formAr: string;
  formInfo: string;
  herkunft: Herkunft;
  herkunftLabel: string;
  herkunftInfo: string;
}

export interface VerbEigenschaftenAnzeige {
  tempus: MerkmalAnzeige | null;
  modus: MerkmalAnzeige | null;
  genusVerbi: MerkmalAnzeige | null;
  verbform: VerbformAnzeige | null;
  // Genus/Numerus des Subjekts teilen sich bewusst dieselben Werte-Übersetzungen
  // wie die Ism-Eigenschaften (m/f, sg/du/pl sind dieselben Begriffe) — kein
  // doppelter i18n-Eintrag für dieselbe Bedeutung.
  person: MerkmalAnzeige | null;
  genus: MerkmalAnzeige | null;
  numerus: MerkmalAnzeige | null;
}

/** Tempus (mit Begründung), Genus verbi, Modus, Verbform (mit typischer
 * Bedeutung) sowie Person/Genus/Numerus als fertige Anzeigedaten. */
export function verbEigenschaftenAnzeige(segment: MorphSegment, t: Uebersetzer): VerbEigenschaftenAnzeige {
  const e = verbEigenschaften(segment);
  const verbform: VerbformAnzeige | null = e.verbform
    ? {
        label: t('grammatik.verbEigenschaften.verbform.name'),
        ar: t('grammatik.verbEigenschaften.verbform.ar'),
        formName: t(`grammatik.verbEigenschaften.verbform.formen.${e.verbform.wert}.name`),
        formAr: t(`grammatik.verbEigenschaften.verbform.formen.${e.verbform.wert}.ar`),
        formInfo: t(`grammatik.verbEigenschaften.verbform.formen.${e.verbform.wert}.info`),
        herkunft: e.verbform.herkunft,
        herkunftLabel: t(`grammatik.herkunft.${e.verbform.herkunft}.label`),
        herkunftInfo: t(`grammatik.herkunft.${e.verbform.herkunft}.info`),
      }
    : null;
  return {
    tempus: merkmalAnzeige('grammatik.verbEigenschaften.tempus', e.tempus, t),
    modus: merkmalAnzeige('grammatik.verbEigenschaften.modus', e.modus, t),
    genusVerbi: merkmalAnzeige('grammatik.verbEigenschaften.genusVerbi', e.genusVerbi, t),
    verbform,
    // grammatik.verbEigenschaften.person fehlt aktuell in den Locale-Dateien
    // (siehe Bericht des bauenden Agenten) — bis dahin liefert t() den rohen
    // Schlüssel zurück (ehrlicher Fallback von translate(), kein Absturz).
    person: merkmalAnzeige('grammatik.verbEigenschaften.person', e.person, t),
    genus: merkmalAnzeige('grammatik.ismEigenschaften.genus', e.genus, t),
    numerus: merkmalAnzeige('grammatik.ismEigenschaften.numerus', e.numerus, t),
  };
}

export interface HarfAnzeige {
  name: string;
  ar: string;
  info: string;
}

/** Art und Funktion der Partikel — über den POS-Tag des Stamm-Segments. */
export function harfAnzeige(word: MorphWord, t: Uebersetzer): HarfAnzeige {
  const seg = stammSegment(word);
  return {
    name: t(`grammatik.posTags.${seg.pos}.name`),
    ar: t(`grammatik.posTags.${seg.pos}.ar`),
    info: t(`grammatik.posTags.${seg.pos}.info`),
  };
}

// ---------- Verbtyp (schwache/unregelmäßige Verben, Sprung ins Lexikon) ----------

// Ordnet jede WurzelTypKategorie (grammatik.ts) ihrem Eintrag unter
// grammatik.schwacheVerben in den Locale-Dateien zu. lafifMafruq/lafifMaqrun
// teilen sich bewusst EINEN Eintrag ('lafif') — dieselbe Zusammenfassung wie
// in @/features/lexikon/paradigmenKategorien.ts (VerbFamilie), die App zeigt
// "Lafīf" als eine einzige Gliederungsebene, nicht die beiden Untermuster.
const SCHWACHE_VERBEN_KEY: Record<WurzelTypKategorie, string> = {
  sahih: 'sahih',
  mahmuz: 'mahmuz',
  mithal: 'mithal',
  ajwaf: 'ajwaf',
  naaqis: 'naqis',
  lafifMafruq: 'lafif',
  lafifMaqrun: 'lafif',
  mudaaf: 'mudaaf',
  rubai: 'rubai',
};

export interface VerbTypAnzeige {
  /** Zum Absprung `/lexikon/verbtyp/<kategorie>` — der Aufrufer navigiert. */
  kategorie: WurzelTypKategorie;
  name: string;
  ar: string;
  info: string;
}

/**
 * Verbtyp(en) der Wurzel dieses Wortes — NUR wenn das Wort ein Verb ist UND
 * eine Wurzel hat, sonst eine leere Liste (kein leerer Abschnitt im Sheet).
 * `wurzelTyp()` liefert mehrere Einträge, wenn mehrere Kategorien gleichzeitig
 * zutreffen (z. B. mahmūz UND nāqiṣ) — hier unverändert als Liste
 * durchgereicht, damit der Aufrufer den Nutzer wählen lassen kann, statt
 * willkürlich einen Treffer auszuwählen.
 */
export function verbTypAnzeige(word: MorphWord, t: Uebersetzer): VerbTypAnzeige[] {
  if (wortWortart(word) !== 'fiil') return [];
  const eintraege = wurzelTyp(word.root);
  if (!eintraege) return [];
  return eintraege.map((eintrag) => {
    const schluessel = SCHWACHE_VERBEN_KEY[eintrag.kategorie];
    return {
      kategorie: eintrag.kategorie,
      name: t(`grammatik.schwacheVerben.${schluessel}.name`),
      ar: t(`grammatik.schwacheVerben.${schluessel}.ar`),
      info: t(`grammatik.schwacheVerben.${schluessel}.info`),
    };
  });
}

// ---------- Verneinung ----------

export interface VerneinungAnzeige {
  segmentText: string;
  form: string;
  name: string;
  ar: string;
  info: string;
}

export function verneinungAnzeige(word: MorphWord, t: Uebersetzer): VerneinungAnzeige | null {
  const treffer = istVerneinung(word);
  if (!treffer) return null;
  return {
    segmentText: treffer.segment.text,
    form: treffer.form,
    name: t('grammatik.fragmentrollen.verneinung.name'),
    ar: t('grammatik.fragmentrollen.verneinung.ar'),
    info: t('grammatik.fragmentrollen.verneinung.info'),
  };
}

// ---------- Satzrolle (Iʿrab) ----------

export interface RelationAnzeige {
  name: string;
  ar: string;
  info: string;
  /** Position des Bezugsworts, oder `null` — nie geraten, direkt aus `syntax.head`. */
  head: number | null;
  /** Arabischer Text des Bezugsworts, wenn es im selben Vers gefunden wurde. */
  headText: string | null;
}

/**
 * Anzeigedaten für die syntaktische Relation eines Wortes. `null`, wenn das
 * Wort keine `syntax` trägt (z. B. Basmala-Bestandteile) — der Aufrufer zeigt
 * dann ehrlich "keine Syntaxdaten" statt hier etwas zu konstruieren.
 *
 * `verseWords`: alle Wörter desselben Verses, um das Bezugswort (`head`, eine
 * 1-basierte Position IM VERS) benennen zu können — ohne sie bleibt nur die
 * nackte Positionsnummer übrig (siehe `headText`-Fallback im Aufrufer).
 */
export function relationAnzeige(
  word: MorphWord,
  verseWords: MorphWord[] | undefined,
  t: Uebersetzer,
): RelationAnzeige | null {
  const syntax = word.syntax;
  if (!syntax) return null;
  const { basis, regens } = relationBasis(syntax.relation);
  const headWord = syntax.head != null ? verseWords?.find((w) => w.position === syntax.head) : undefined;
  const headText = headWord?.text ?? null;
  // Platzhalter-Text fürs {wort}: bevorzugt der tatsächliche Wortlaut aus dem
  // Vers, sonst (Vers noch nicht geladen) das QAC-Regens-Kürzel als ehrlicher
  // Rückfall — niemals eine erfundene Übersetzung.
  const platzhalterWort = headText ?? regens ?? String(syntax.head ?? '');

  if (regens) {
    const musterSchluessel = basis === 'pred' ? 'predOf' : 'subjOf';
    const basisSchluessel = `grammatik.relationen.muster.${musterSchluessel}`;
    return {
      name: ersetze(t(`${basisSchluessel}.name`), '{wort}', platzhalterWort),
      ar: t(`${basisSchluessel}.ar`),
      info: ersetze(t(`${basisSchluessel}.info`), '{wort}', platzhalterWort),
      head: syntax.head,
      headText,
    };
  }
  const basisSchluessel = `grammatik.relationen.${basis}`;
  return {
    name: t(`${basisSchluessel}.name`),
    ar: t(`${basisSchluessel}.ar`),
    info: t(`${basisSchluessel}.info`),
    head: syntax.head,
    headText,
  };
}
