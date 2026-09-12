// Kategorisierung der Paradigmen-Tabellen (data/paradigmen*.json) für den
// Katalog im Reiter "Grammatik & Ṣarf" (ParadigmKatalogView) UND für die
// Verbtyp-Route (app/lexikon/verbtyp/[typ].tsx), die aus dem Koran-Reader
// heraus auf die passende Bab-Familie verweisen soll (wurzelTyp() in
// @/features/quran/grammatik.ts, siehe dortiger Kopf-Kommentar für die
// linguistische Herleitung von Ṣaḥīḥ/Mahmūz/Miṯāl/Aǧwaf/Nāqiṣ/Lafīf/Muḍāʿaf).
//
// WARUM ID-BASIERT UND KEINE GERATENE HEURISTIK: jede Bab-Tabellen-ID trägt
// GENAU EINEN der Marker mahmooz/mithalwawi/mithalyai/ajwaf/naqis/lafif/mudaaf
// (gegen den tatsächlichen Bestand aller 108 Tabellen geprüft, Stand dieser
// Kategorisierung — kein Doppel-Marker, keine Marker-lose bab-*-ID). Die drei
// "kurzen" Sahih-Tabellen (verb-madi-nasara, verb-mudari-nasara, amr-nasara
// aus paradigmen.json) tragen keinen bab-Präfix, sind aber unzweideutig: sie
// zeigen exakt das Verb نصر (Bab Nasara, gesunde Wurzel), dem Referenzmuster,
// nach dem laut den `notes` der Mahmuz-/Bab-Tabellen ("Gleiche Tabellenstruktur
// wie die Mahmooz-Bab-Tabellen …") jede andere Bab-Familie modelliert ist —
// deshalb eine feste ID-Liste statt eines weiteren Musters. Käme künftig eine
// Bab-ID vor, die keinen der bekannten Marker trägt (namentlich die in Arbeit
// befindliche paradigmen-bab-murakkab.json für "kombinierte Fälle" — mehrere
// schwache/hamzierte Eigenschaften gleichzeitig), fällt sie bewusst in den
// eigenen Eimer 'murakkab' statt eine Tabelle unsichtbar zu verlieren (siehe
// auch verbFamilieVonBabTabelle() unten: paradigmen-bab-murakkab.json ist
// inzwischen eingetroffen — ihre IDs enthalten NEBEN "murakkab" zusätzlich
// einen der einzelnen Marker, "murakkab" muss deshalb zuerst geprüft werden).
import type { WurzelTypKategorie } from '@/features/quran/grammatik';

import type { ParadigmTabelle } from './erklaerungenTypes';

/** Verbstamm-Familie einer Bab-Tabelle — deckungsgleich mit den
 *  linguistischen Kategorien aus wurzelTyp(), nur 'lafifMafruq'/'lafifMaqrun'
 *  zu einer einzigen Anzeige-Familie 'lafif' zusammengefasst (der Auftrag
 *  verlangt "Lafīf" als EINE Gliederungsebene, nicht die beiden Untermuster). */
export type VerbFamilie = 'sahih' | 'mahmuz' | 'mithal' | 'ajwaf' | 'naaqis' | 'lafif' | 'mudaaf' | 'murakkab';

/** Anzeige-Reihenfolge der Verbstamm-Familien innerhalb "Verbstamm-Familien (Bab)". */
export const VERB_FAMILIE_ORDER: readonly VerbFamilie[] = ['sahih', 'mahmuz', 'mithal', 'ajwaf', 'naaqis', 'lafif', 'mudaaf', 'murakkab'];

/** Die "kurzen" Verb-Kurztabellen, die das gesunde (ṣaḥīḥ) Referenzverb نصر
 *  bzw. dessen einzige Ausnahme-Untergruppe كرم zeigen (siehe Kopf-
 *  Kommentar) — feste Liste statt Muster, weil es für "gesunde" Bab-IDs
 *  (anders als für die schwachen/hamzierten Familien) keinen eigenen
 *  ID-Marker gibt.
 *
 *  Die drei ersten stammen aus paradigmen.json (vollständige
 *  Personenmatrizen-Vorstufe). 'kleine-familie-nasara'/'kleine-familie-
 *  karama' (paradigmen-nachtrag.json) sind die Bab-Stil-Tabellen (Madhi/
 *  Mudari/Masdar/Ism) der "Kleinen Familie" aus Kapitel 5.3 — bewusst
 *  derselben Familie 'sahih' zugeordnet: sie zeigen dieselbe(n) gesunde(n)
 *  Form-I-Wurzel(n) نصر/كرم wie die drei erstgenannten, nur mit Masdar/Ism
 *  statt einer vollen Personenmatrix, und liegen auf DERSELBEN Achse
 *  (Wurzelgesundheit von Form I) wie die Bab-Familien aus Kapitel 8 — anders
 *  als die acht Sarf-Großfamilien (sarf-familie-1…8, siehe
 *  istSarfGrossfamilie() unten), die die ANDERE Achse (abgeleitete Form
 *  II–X) zeigen und deshalb bewusst NICHT hier einsortiert sind. */
const SAHIH_KURZTABELLEN_IDS = new Set([
  'verb-madi-nasara',
  'verb-mudari-nasara',
  'amr-nasara',
  'kleine-familie-nasara',
  'kleine-familie-karama',
]);

/** Liefert die Verbstamm-Familie einer Tabelle, oder `null` für Nicht-Verb-
 *  bzw. nicht zuordenbare Tabellen (z. B. die vollständigen Personenmatrizen
 *  — die gehören zur eigenen Kategorie "Verb: vollständige Personenmatrizen",
 *  nicht zu einer Bab-Familie, siehe kategorisiere() unten). */
export function verbFamilieVonBabTabelle(id: string): VerbFamilie | null {
  if (SAHIH_KURZTABELLEN_IDS.has(id)) return 'sahih';
  if (!id.startsWith('bab-')) return null;
  // WICHTIG: "murakkab" ZUERST prüfen. paradigmen-bab-murakkab.json (21
  // Tabellen, "kombinierte Fälle" — mehrere schwache/hamzierte Eigenschaften
  // gleichzeitig) kennzeichnet ihre IDs als "murakkab-<typ1>-<typ2>-..."
  // (z. B. "bab-daraba-murakkab-ajwaf-mahmuz-aada"), enthält also ZUSÄTZLICH
  // einen oder mehrere der einzelnen Marker unten (hier "ajwaf" UND
  // "mahmuz") — ohne diesen Vorrang würde jede murakkab-Tabelle in genau
  // EINE ihrer mehreren tatsächlichen Familien fehlsortiert statt in die
  // eigens dafür vorgesehene Kategorie "kombinierte Fälle".
  if (id.includes('murakkab')) return 'murakkab';
  if (id.includes('mahmooz')) return 'mahmuz';
  if (id.includes('mithalwawi') || id.includes('mithalyai')) return 'mithal';
  if (id.includes('ajwaf')) return 'ajwaf';
  if (id.includes('naqis')) return 'naaqis';
  if (id.includes('lafif')) return 'lafif';
  if (id.includes('mudaaf')) return 'mudaaf';
  // Bab-ID ohne jeden bekannten Marker — bewusst zugeordnet statt
  // verschwiegen, statt eine Tabelle unsichtbar zu verlieren.
  return 'murakkab';
}

/** WurzelTypKategorie (aus @/features/quran/grammatik.ts, per Wurzel-
 *  Analyse im Reader ermittelt) -> VerbFamilie dieses Katalogs, für die
 *  Verbtyp-Route (app/lexikon/verbtyp/[typ].tsx). `null` für 'rubai'
 *  (vierradikalige Wurzeln — dafür gibt es in den Paradigmen-Tabellen noch
 *  keine eigene Bab-Familie, siehe Kopf-Kommentar dort). Bewusst als
 *  vollständiges switch/case: fehlt hier ein Fall, meldet TypeScript das
 *  beim nächsten Erweitern von WurzelTypKategorie, statt still `undefined`
 *  zurückzugeben.
 */
export function verbFamilieVonWurzelTyp(kategorie: WurzelTypKategorie): VerbFamilie | null {
  switch (kategorie) {
    case 'sahih':
      return 'sahih';
    case 'mahmuz':
      return 'mahmuz';
    case 'mithal':
      return 'mithal';
    case 'ajwaf':
      return 'ajwaf';
    case 'naaqis':
      return 'naaqis';
    case 'lafifMafruq':
    case 'lafifMaqrun':
      return 'lafif';
    case 'mudaaf':
      return 'mudaaf';
    case 'rubai':
      return null;
  }
}

/** Alle 9 Werte von WurzelTypKategorie — dupliziert den Typ aus
 *  @/features/quran/grammatik.ts als Laufzeit-Liste (der Typ selbst ist nur
 *  zur Kompilierzeit vorhanden), damit die Verbtyp-Route einen rohen
 *  URL-Parameter validieren kann. Bei einer Erweiterung von
 *  WurzelTypKategorie macht der exhaustive switch in verbFamilieVonWurzelTyp()
 *  oben den fehlenden Fall sichtbar — diese Liste dann synchron nachziehen. */
export const WURZEL_TYP_KATEGORIEN: readonly WurzelTypKategorie[] = [
  'sahih',
  'mahmuz',
  'mithal',
  'ajwaf',
  'naaqis',
  'lafifMafruq',
  'lafifMaqrun',
  'mudaaf',
  'rubai',
];

export function istGueltigeWurzelTypKategorie(value: string): value is WurzelTypKategorie {
  return (WURZEL_TYP_KATEGORIEN as readonly string[]).includes(value);
}

/** Oberste Gliederungsebene des Tabellenkatalogs (siehe Bericht: 5
 *  Kategorien, aus dem tatsächlichen Bestand abgeleitet und geprüft).
 *
 *  Reihenfolge (PARADIGM_KATEGORIE_ORDER unten) vom Grundlegenden zum
 *  Aufbauenden: (1) Nomen & Pronomen — Grundwortarten ohne Verbmorphologie
 *  als Voraussetzung; (2) vollständige Personenmatrizen — die einfachste,
 *  vollständigste Konjugation eines EINZIGEN gesunden Referenzverbs (نصر),
 *  der Fixpunkt, an dem jede weitere Verb-Kategorie gemessen wird; (3)
 *  Verbstamm-Familien (Bab) — dieselbe Form I, jetzt über alle sieben
 *  Wurzel-Gesundheitstypen (Ṣaḥīḥ/Mahmūz/Miṯāl/…) hinweg, baut also auf (2)
 *  auf, indem sie deren Referenzmuster auf unregelmäßige Wurzeln überträgt;
 *  (4) Verbstamm-Ableitungen (Formen II–X) — wieder am gesunden
 *  Referenzwurzel-Typ aus (2)/(3), aber auf der ANDEREN Achse: nicht mehr
 *  Wurzel-Gesundheit, sondern die abgeleitete Verbform selbst, für die (2)
 *  und (3) das Fundament (Form I) legen; (5) Partikeln, Zahlen & Wortschatz
 *  — reiner Vokabelfundus ohne eigene Flexionsmorphologie, deshalb als
 *  Auffang-Kategorie zuletzt. */
export type ParadigmKategorie = 'nomenPronomen' | 'verbMatrizen' | 'verbstammFamilien' | 'verbstammAbleitungen' | 'partikelnZahlenWortschatz';

export const PARADIGM_KATEGORIE_ORDER: readonly ParadigmKategorie[] = [
  'nomenPronomen',
  'verbMatrizen',
  'verbstammFamilien',
  'verbstammAbleitungen',
  'partikelnZahlenWortschatz',
];

export interface ParadigmTabelleEingeordnet extends ParadigmTabelle {
  /** Datei, aus der diese Tabelle stammt (data/paradigmen*.json) — für
   *  Fehlersuche/Herkunftsnachweis, nicht für die Anzeige gedacht. */
  quelldatei: string;
  kategorie: ParadigmKategorie;
  /** Nur bei kategorie === 'verbstammFamilien' gesetzt. */
  verbFamilie: VerbFamilie | null;
}

/** Vollständige Personenmatrizen (paradigmen-verben.json, seit
 *  paradigmen-weitere.json zusätzlich kāna/Mudari-Mansub/Majzum/Nūn-at-
 *  Tawkīd): 5 Zeilen × 3 Numeri, IDs enden immer auf "-matrix" (Madi/Mudari
 *  je Aktiv/Passiv, Amr/Nahy) — eigene Kategorie, siehe Auftrag ("Verb: die
 *  vollständigen Personenmatrizen" separat von "Verbstamm-Familien (Bab)"). */
function istVollstaendigeMatrix(id: string): boolean {
  return id.endsWith('-matrix');
}

/** Ṣarf-Großfamilien (paradigmen-weitere.json, IDs "sarf-familie-1-…" bis
 *  "sarf-familie-8-…", geprüft: genau 8 Tabellen): die acht Muster für die
 *  abgeleiteten Verbformen II–X (ohne IX) am gesunden Referenzwurzel-Beispiel
 *  (allama, jaadala, …). Das ist eine ANDERE Achse als "Verbstamm-Familien
 *  (Bab)": Bab klassifiziert die WURZEL-Gesundheit von Form I
 *  (sahih/mahmuz/mithal/…), hier geht es um die abgeleitete FORM selbst
 *  (II–X), unabhängig von der Wurzel — verbFamilieVonBabTabelle() liefert
 *  für sie deshalb korrekt `null` (keine "bab-"-ID). Sie würden nicht in
 *  eine der acht Bab-Familien gezwungen (z. B. 'sahih', weil die meisten
 *  Beispielwurzeln gesund sind: das würde fälschlich die Bab-Achse
 *  behaupten und wäre auch technisch unsichtbar, weil die UI
 *  "Verbstamm-Familien" ausschließlich nach VerbFamilie gruppiert rendert —
 *  eine Tabelle mit verbFamilie=null in dieser Kategorie käme im Katalog
 *  nie zur Anzeige). Sie lagen deshalb behelfsweise bei "Verb: vollständige
 *  Personenmatrizen" (kein Personen-Raster im engeren Sinn, aber die
 *  einzige bestehende Verb-Kategorie, die flach ohne Verbfamilie-
 *  Unterordnung rendert) — inhaltlich unpassend und genau die
 *  Verwechslungsgefahr, die zur eigenen Kategorie "Verbstamm-Ableitungen
 *  (Formen II–X)" (kategorisiere() unten) geführt hat: der Name trägt
 *  bewusst "Ableitungen"/"Formen II–X" statt "Familien"/"Bab", damit die
 *  andere Achse schon an der Beschriftung erkennbar ist, nicht nur im
 *  Kopf-Kommentar hier. */
function istSarfGrossfamilie(id: string): boolean {
  return id.startsWith('sarf-familie-');
}

/** Wortschatz-Vokabellisten (wortschatz-himmel-erde usw., kind "noun") sind
 *  strukturell Nomen-Tabellen, gehören inhaltlich aber zur letzten Kategorie
 *  ("Partikeln, Zahlen, Wortschatz") — deshalb Sonderprüfung auf den
 *  ID-Präfix VOR der kind-basierten Einordnung. */
function istWortschatz(id: string): boolean {
  return id.startsWith('wortschatz-');
}

/** Ordnet eine einzelne Tabelle in genau eine der 5 Kategorien ein und
 *  ermittelt bei Verbstamm-Familien zusätzlich die Verbfamilie. */
export function kategorisiere(table: ParadigmTabelle, quelldatei: string): ParadigmTabelleEingeordnet {
  const verbFamilie = verbFamilieVonBabTabelle(table.id);

  let kategorie: ParadigmKategorie;
  if (istVollstaendigeMatrix(table.id)) {
    kategorie = 'verbMatrizen';
  } else if (istSarfGrossfamilie(table.id)) {
    kategorie = 'verbstammAbleitungen';
  } else if (verbFamilie !== null) {
    kategorie = 'verbstammFamilien';
  } else if (istWortschatz(table.id) || table.kind === 'particle' || table.kind === 'number') {
    kategorie = 'partikelnZahlenWortschatz';
  } else {
    // noun/pronoun/demonstrative, die keine Wortschatzliste sind.
    kategorie = 'nomenPronomen';
  }

  return { ...table, quelldatei, kategorie, verbFamilie: kategorie === 'verbstammFamilien' ? verbFamilie : null };
}
