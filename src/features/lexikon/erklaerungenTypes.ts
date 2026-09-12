// Typen für die Lehrtext-Dateien des Reiters "Grammatik & Sarf"
// (data/erklaerungen/de-*.json) und die Paradigmen-Tabellen
// (data/paradigmen.json, data/paradigmen-verben.json), auf die ihr
// `tabellen`-Feld verweist. Bildet GENAU das Schema ab, das
// data/erklaerungen/de-*.test.ts und data/paradigmen*.test.ts bereits
// gegenprüfen — keine eigene Struktur erfinden.

export type ErklaerungenBereich = 'nomen' | 'verb' | 'partikel-syntax';

export interface ErklaerungBeleg {
  sure: number;
  vers: number;
  wort: number;
  zeigt: string;
  warum: string;
}

export interface ErklaerungEintrag {
  titel: string;
  ar: string;
  umschrift: string;
  erklaerung: string[];
  erkennung: string[];
  belege: ErklaerungBeleg[];
  lernen: string[];
  tabellen: string[];
  siehe: string[];
}

export interface ErklaerungenDatei {
  schema: number;
  lang: string;
  bereich: ErklaerungenBereich;
  eintraege: Record<string, ErklaerungEintrag>;
}

// ---------- Paradigmen-Tabellen (data/paradigmen.json, data/paradigmen-verben.json) ----------

export type ParadigmZelle = { ar: string; de: string } | null;

export interface ParadigmSpalte {
  id: string;
  labelDe: string;
  labelAr?: string;
}

export interface ParadigmZeile {
  id: string;
  labelDe: string;
  labelAr?: string;
}

export interface ParadigmTabelle {
  id: string;
  kind: string;
  titleDe: string;
  termAr?: string;
  columns: ParadigmSpalte[];
  rows: ParadigmZeile[];
  cells: Record<string, Record<string, ParadigmZelle>>;
  notes?: string[];
  source: { file: string; page: number };
}

export interface ParadigmenDatei {
  schema: number;
  tables: ParadigmTabelle[];
}
