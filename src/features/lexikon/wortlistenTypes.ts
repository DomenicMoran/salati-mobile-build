// Typen für data/wortlisten.json — Vokabel-/Partikellisten, eine
// Beispielsatzliste, zwei Flussdiagramme und (seit dieser Sitzung) die
// Balagah-Vergleichstabellen aus handout.pdf, die laut data/LUECKEN.md
// ("Abschnitt C: Vokabellisten/Rhetorik-Beispiele" bzw. "H-14/H-39 …
// Flussdiagramme" bzw. "H-165/167-184 … Vergleichstabellen") KEINE
// Flexionsparadigmen sind und deshalb NICHT in das {columns,rows,cells}-
// Raster von ParadigmTabelle (siehe erklaerungenTypes.ts) passen: eine
// Vokabelliste hat keine Person-/Numerus-/Kasus-Achse, sondern ist eine
// reine Liste aus (arabischem Wort, Umschrift, Bedeutung) — ein eigener,
// einfacherer Datentyp statt einer erzwungenen 1-Spalten-Tabelle.
//
// WICHTIG (Sprachen): Dieses Schema selbst bleibt einsprachig Deutsch — `de`
// ist und bleibt hier die einzige Bedeutungssprache (Arabisch/Umschrift sind
// ohnehin sprachunabhängig). Die Bedeutungs-/Beschriftungsfelder (Listen-/
// Kapiteltitel, Vokabelbedeutungen, Beispielsätze, Ablaufschema-Kästchen,
// Vergleichstabellen-Zellen) sind in die anderen 13 App-Sprachen übersetzt,
// aber NICHT hier hineingemischt, sondern in eigenen Bündeln unter
// data/wortlisten-i18n/<lang>.json (siehe wortlistenI18nTypes.ts,
// wortlistenI18nLoader.ts) — an denselben IDs/Indizes wie hier aufgehängt.
// WortlistenKatalogView.tsx/WortlisteView.tsx kombinieren beide Quellen beim
// Rendern und fallen für `de` sowie für eine (noch) nicht übersetzte Sprache
// auf die deutschen Felder hier zurück.

import type { ParadigmSpalte, ParadigmZeile } from './erklaerungenTypes';

export interface WortlistenEintrag {
  ar: string;
  umschrift: string;
  de: string;
}

/** Ein im Original abgedrucktes Beispiel-Wort/-Phrase mit Übersetzung —
 *  z. B. die drei Anwendungsbeispiele unter H-20 ("Besondere Mudhaafs") oder
 *  die acht Beispielsätze unter H-56 ("Fragewörter"). Getrennt von
 *  `WortlistenEintrag`, weil eine Beispielphrase keine Wörterbuch-Bedeutung
 *  hat, sondern eine Satzübersetzung. */
export interface WortlistenBeispiel {
  ar: string;
  umschrift: string;
  de: string;
}

export interface Wortliste {
  id: string;
  kind: 'vokabelliste' | 'partikelliste';
  titleDe: string;
  /** Grobe thematische Gruppierung nach Handout-Kapitel — für die
   *  Katalog-Gliederung (siehe WortlistenKatalogView.tsx), nicht Teil der
   *  Handout-Kopfzeile selbst. */
  kapitel: string;
  entries: WortlistenEintrag[];
  beispiele?: WortlistenBeispiel[];
  notes?: string[];
  source: { file: string; page: number };
}

/** Ein Beispielsatz-Eintrag der Beispielsatzliste (H-55, "Liste der
 *  Verbindungsbuchstaben") — anders als `Wortliste` steht hier ein ganzer,
 *  aus dem Qur'an zitierter Beispielsatz samt Übersetzung im Zentrum, nicht
 *  eine Wörterbuch-Bedeutung. */
export interface BeispielsatzEintrag {
  ar: string;
  umschrift: string;
  beschreibung: string;
  beispielAr: string;
  beispielDe: string;
}

export interface Beispielsatzliste {
  id: string;
  titleDe: string;
  kapitel: string;
  entries: BeispielsatzEintrag[];
  notes?: string[];
  source: { file: string; page: number };
}

/** Ein Kästchen/eine Frage im Ablaufschema, in gedruckter Reihenfolge. */
export interface AblaufSchritt {
  kastenDe: string;
  kastenAr?: string;
}

/** Ein vom automatischen Tabellenfinder fälschlich als Tabelle erkanntes
 *  Flussdiagramm (H-14, H-39, siehe LUECKEN.md) — als Entscheidungsfolge in
 *  Textform wiedergegeben (Kästchen + ggf. Zwischenfrage), plus optionalem
 *  Beispiel. */
export interface Ablaufschema {
  id: string;
  titleDe: string;
  kapitel: string;
  schritte: AblaufSchritt[];
  beispielAr?: string;
  beispielDe?: string;
  notes?: string[];
  source: { file: string; page: number };
}

/** Eine Zelle einer Vergleichstabelle (siehe `Vergleichstabelle`) — anders
 *  als `ParadigmZelle` (erklaerungenTypes.ts), die IMMER ein Arabisch+
 *  Deutsch-Paar erwartet, drucken die Balagah-Vergleichstabellen pro Zelle
 *  oft nur EINEN Wert: entweder ein arabisches Wort/eine Phrase (`ar`) ODER
 *  einen deutschen/transliterierten Fachbegriff wie "erwähnt"/"Sababiyya"
 *  (`de`) — beide Felder sind deshalb optional statt eines erzwungenen
 *  Paares; `null` markiert eine im Original leere Zelle ("-"). */
export type VergleichsZelle = { ar?: string; de?: string } | null;

/** Eine Rhetorik-Vergleichstabelle aus Kapitel 9 (Balagah), z. B. die
 *  Tashbih-Raster "Mushabbah | Adat at-Tashbih | Mushabbah bihi | Wajh
 *  ash-Shabah" oder die Majaz-Raster "Wörtliche Bedeutung | 'Alaqa |
 *  Metaphorische Bedeutung" (siehe data/LUECKEN.md, H-165/H-167…H-183).
 *  Bewusst SEHR NAH an `ParadigmTabelle` gehalten (dieselben `columns`/
 *  `rows`-Typen aus erklaerungenTypes.ts, dasselbe {id,titleDe,notes,source}
 *  -Gerüst) — nur `cells` ist gelockert (siehe `VergleichsZelle`), weil
 *  diese Tabellen kein Person-/Numerus-/Kasus-Flexionsraster sind, sondern
 *  ein freies Vergleichs-/Klassifikationsraster mit wechselnden, pro
 *  Tabelle eigenen Spaltenüberschriften. */
export interface Vergleichstabelle {
  id: string;
  titleDe: string;
  kapitel: string;
  columns: ParadigmSpalte[];
  rows: ParadigmZeile[];
  cells: Record<string, Record<string, VergleichsZelle>>;
  notes?: string[];
  source: { file: string; page: number };
}

export interface WortlistenDatei {
  schema: number;
  wortlisten: Wortliste[];
  beispielsatzlisten: Beispielsatzliste[];
  ablaufschemata: Ablaufschema[];
  vergleichstabellen: Vergleichstabelle[];
}
