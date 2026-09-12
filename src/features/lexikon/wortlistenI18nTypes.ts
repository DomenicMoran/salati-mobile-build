// Typen für die Übersetzungsbündel unter data/wortlisten-i18n/<lang>.json —
// die Bedeutungs-/Beschriftungsfelder von data/wortlisten.json (siehe
// wortlistenTypes.ts) in den 13 Nicht-Deutsch-Sprachen der App. Bewusst NICHT
// dieselbe Struktur wie WortlistenDatei: eine Übersetzungsdatei wiederholt
// weder die arabischen Formen noch die Umschriften (die sind sprachunabhängig
// und bleiben ausschließlich in wortlisten.json), sondern hält je Sprache nur
// die übersetzten Strings, an denselben IDs/Indizes wie das deutsche Original
// aufgehängt — WortlistenKatalogView.tsx/WortlisteView.tsx kombinieren beide
// Quellen beim Rendern (Arabisch/Umschrift aus wortlisten.json, Bedeutung aus
// der aktiven Übersetzungsdatei, mit Deutsch als Fallback).
export interface WortlistenUebersetzungListe {
  title: string;
  /** Parallel zu `Wortliste.entries` — gleicher Index, gleiche Länge. */
  entries: string[];
  /** Parallel zu `Wortliste.beispiele` — nur vorhanden, wenn die deutsche
   *  Liste selbst `beispiele` hat. */
  beispiele?: string[];
}

export interface WortlistenUebersetzungBeispielsatzEintrag {
  beschreibung: string;
  beispiel: string;
}

export interface WortlistenUebersetzungBeispielsatzliste {
  title: string;
  /** Parallel zu `Beispielsatzliste.entries`. */
  entries: WortlistenUebersetzungBeispielsatzEintrag[];
}

export interface WortlistenUebersetzungAblaufschema {
  title: string;
  /** Parallel zu `Ablaufschema.schritte` (je `kastenDe`). */
  schritte: string[];
  /** Nur vorhanden, wenn `Ablaufschema.beispielDe` gesetzt ist. */
  beispiel?: string;
}

export interface WortlistenUebersetzungVergleichstabelle {
  title: string;
  /** Spalten-ID -> übersetzte Beschriftung, für ALLE Spalten der Tabelle. */
  columns: Record<string, string>;
  /** Zeilen-ID -> übersetzte Beschriftung, nur für Zeilen mit `labelDe`. */
  rows?: Record<string, string>;
  /** Zeilen-ID -> Spalten-ID -> übersetzter Zellenwert, nur für Zellen, die
   *  im Original ein `de`-Feld tragen (rein arabische Zellen bleiben
   *  unübersetzt, siehe VergleichsZelle in wortlistenTypes.ts). */
  cells?: Record<string, Record<string, string>>;
}

export interface WortlistenUebersetzung {
  schema: number;
  lang: string;
  /** Deutscher Kapitel-String (Wortliste.kapitel/Beispielsatzliste.kapitel/
   *  Ablaufschema.kapitel/Vergleichstabelle.kapitel) -> übersetzte Fassung. */
  kapitel: Record<string, string>;
  /** Schlüssel: Wortliste.id */
  wortlisten: Record<string, WortlistenUebersetzungListe>;
  /** Schlüssel: Beispielsatzliste.id */
  beispielsatzlisten: Record<string, WortlistenUebersetzungBeispielsatzliste>;
  /** Schlüssel: Ablaufschema.id */
  ablaufschemata: Record<string, WortlistenUebersetzungAblaufschema>;
  /** Schlüssel: Vergleichstabelle.id */
  vergleichstabellen: Record<string, WortlistenUebersetzungVergleichstabelle>;
}
