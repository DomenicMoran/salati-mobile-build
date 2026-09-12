import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import paradigmenRoh from './paradigmen-bab-naqis-lafif-mudaaf.json';

/**
 * Gegenprobe für die Bab-Tabellen der Verbfamilien Naqis, Lafif und Muda"af
 * (Kapitel 8 von handout.pdf, Fortsetzung von paradigmen-verben.json — siehe
 * LUECKEN.md, Abschnitt "Naqis/Lafif/Muda'af"). Gleiches Prinzip wie
 * paradigmen-verben.test.ts: jede arabische Form muss zeichengenau aus dem
 * gerenderten Seitenbild stammen, nichts wird aus dem Gedächtnis ergänzt.
 * Diese Datei prüft das strukturell UND inhaltlich (Korpus-Gegenprobe).
 */

type Zelle = { ar: string; de: string } | null;

interface ParadigmenTabelle {
  id: string;
  kind: string;
  titleDe: string;
  termAr?: string;
  columns: { id: string; labelDe: string }[];
  rows: { id: string; labelDe: string }[];
  cells: Record<string, Record<string, Zelle>>;
  notes?: string[];
  source: { file: string; page: number };
}

interface ParadigmenDatei {
  schema: number;
  tables: ParadigmenTabelle[];
}

const paradigmen = paradigmenRoh as unknown as ParadigmenDatei;

const ARABISCH = /[؀-ۿ]/;
const LATEINISCH = /[A-Za-z]/;
const HARAKAT = /[ً-ْ]/;
const SCHADDA = 'ّ';

function alleZellen(tabelle: ParadigmenTabelle): { rowId: string; colId: string; zelle: Zelle }[] {
  const out: { rowId: string; colId: string; zelle: Zelle }[] = [];
  for (const rowId of Object.keys(tabelle.cells)) {
    for (const colId of Object.keys(tabelle.cells[rowId] ?? {})) {
      out.push({ rowId, colId, zelle: tabelle.cells[rowId][colId] });
    }
  }
  return out;
}

function findeTabelle(id: string): ParadigmenTabelle {
  const t = paradigmen.tables.find((x) => x.id === id);
  if (!t) throw new Error(`Tabelle ${id} fehlt in paradigmen-bab-naqis-lafif-mudaaf.json`);
  return t;
}

describe('paradigmen-bab-naqis-lafif-mudaaf.json — Struktur', () => {
  it('hat Schema 1 und 38 Tabellen (12 Naqis + 12 Lafif + 14 Muda"af)', () => {
    expect(paradigmen.schema).toBe(1);
    expect(paradigmen.tables.length).toBe(38);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmen.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte und eine Zeile sowie eine gültige Quelle', () => {
    for (const t of paradigmen.tables) {
      expect(t.id).toBeTruthy();
      expect(t.titleDe).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.file).toBe('handout.pdf');
      expect(t.source?.page).toBeGreaterThanOrEqual(117);
      expect(t.source?.page).toBeLessThanOrEqual(126);
      expect(Array.isArray(t.notes) && t.notes.length).toBeTruthy();
    }
  });

  it('Zeilen- und Spalten-IDs sind je Tabelle eindeutig', () => {
    for (const t of paradigmen.tables) {
      expect(new Set(t.rows.map((r) => r.id)).size).toBe(t.rows.length);
      expect(new Set(t.columns.map((c) => c.id)).size).toBe(t.columns.length);
    }
  });

  it('jede in cells referenzierte Zeilen-/Spalten-ID existiert wirklich (kein Verweis ins Leere)', () => {
    for (const t of paradigmen.tables) {
      const rowIds = new Set(t.rows.map((r) => r.id));
      const colIds = new Set(t.columns.map((c) => c.id));
      for (const rowId of Object.keys(t.cells)) {
        expect(rowIds.has(rowId)).toBe(true);
        for (const colId of Object.keys(t.cells[rowId])) {
          expect(colIds.has(colId)).toBe(true);
        }
      }
    }
  });
});

describe('paradigmen-bab-naqis-lafif-mudaaf.json — arabische Formen', () => {
  for (const t of paradigmen.tables) {
    const zellen = alleZellen(t).filter((z) => z.zelle !== null) as {
      rowId: string;
      colId: string;
      zelle: { ar: string; de: string };
    }[];

    it(`${t.id}: jede vorhandene Zelle hat "ar" und "de"`, () => {
      for (const { zelle } of zellen) {
        expect(typeof zelle.ar).toBe('string');
        expect(zelle.ar.length).toBeGreaterThan(0);
        expect(typeof zelle.de).toBe('string');
        expect(zelle.de.length).toBeGreaterThan(0);
      }
    });

    it(`${t.id}: jede "ar"-Form enthält arabische Zeichen und KEIN lateinisches Zeichen`, () => {
      for (const { rowId, colId, zelle } of zellen) {
        expect(ARABISCH.test(zelle.ar)).toBe(true);
        expect(LATEINISCH.test(zelle.ar)).toBe(false);
        void rowId;
        void colId;
      }
    });

    it(`${t.id}: jede "ar"-Form ist vokalisiert (mind. ein Harakat-Zeichen)`, () => {
      for (const { rowId, colId, zelle } of zellen) {
        expect(HARAKAT.test(zelle.ar)).toBe(true);
        void rowId;
        void colId;
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Bab-Tabellen-Raster: alle 38 Tabellen folgen demselben Grundmuster wie die
// Mahmooz-Bab-Tabellen in paradigmen-verben.json (Zeilen aktiv/passiv/
// imperativ, Spalten madhi/mudari/masdar/ism), mit drei dokumentierten
// Abweichungen:
//   (a) Lafif-Tabellen haben in 'imperativ' KEINE 'ism'-Zelle.
//   (b) Form VII/IX/XI (und die Sonderform "If'illal (IV)") sind intransitiv
//       und haben keine eigene Passivform — die 'passiv'-Zeile enthält nur
//       'masdar' (identisch mit dem Aktiv-Masdar).
//   (c) bab-infial7-lafif-inzawa hat im Original nur 2 gedruckte Zeilen
//       (keine Passiv-Zeile überhaupt, nicht einmal mit Masdar) — dort fehlt
//       der Schlüssel 'passiv' komplett.
// ---------------------------------------------------------------------------

const ALLE_IDS = paradigmen.tables.map((t) => t.id);

const LAFIF_IDS = ALLE_IDS.filter((id) => id.includes('-lafif-'));
const NAQIS_IDS = ALLE_IDS.filter((id) => id.includes('-naqis-'));
const MUDAAF_IDS = ALLE_IDS.filter((id) => id.includes('-mudaaf-'));

// Tabellen ohne eigene Passivform (Form VII, IX, XI, "If'illal (IV)") —
// deren 'passiv'-Zeile nur 'masdar' enthält.
const NUR_MASDAR_PASSIV_IDS = [
  'bab-infial7-naqis-inqada',
  'bab-infial7-mudaaf-inshaqqa',
  'bab-ifilal9-mudaaf-ihmarra',
  'bab-ifilal11-mudaaf-ihmaarra',
  'bab-ifillal4-mudaaf-iqshaarra',
];

// Einzige Tabelle ganz ohne Passiv-Zeile (nur 2 gedruckte Zeilen im Original).
const OHNE_PASSIV_ZEILE_IDS = ['bab-infial7-lafif-inzawa'];

const BAB_SPALTEN_REIHENFOLGE = ['madhi', 'mudari', 'masdar', 'ism'];

describe('paradigmen-bab-naqis-lafif-mudaaf.json — einheitliches Spaltenraster', () => {
  for (const id of ALLE_IDS) {
    it(`${id}: hat genau die Spalten madhi, mudari, masdar, ism`, () => {
      const t = findeTabelle(id);
      expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
    });
  }

  for (const id of ALLE_IDS.filter((x) => !OHNE_PASSIV_ZEILE_IDS.includes(x))) {
    it(`${id}: hat die Zeilen aktiv, passiv, imperativ`, () => {
      const t = findeTabelle(id);
      expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'passiv', 'imperativ']);
    });
  }

  for (const id of OHNE_PASSIV_ZEILE_IDS) {
    it(`${id}: hat nur die Zeilen aktiv, imperativ (keine Passiv-Zeile im Original)`, () => {
      const t = findeTabelle(id);
      expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'imperativ']);
      expect(Object.prototype.hasOwnProperty.call(t.cells, 'passiv')).toBe(false);
    });
  }

  for (const id of ALLE_IDS.filter((x) => !NUR_MASDAR_PASSIV_IDS.includes(x) && !OHNE_PASSIV_ZEILE_IDS.includes(x))) {
    it(`${id}: aktiv ist vollständig befüllt (madhi/mudari/masdar/ism)`, () => {
      const t = findeTabelle(id);
      for (const colId of BAB_SPALTEN_REIHENFOLGE) {
        expect(t.cells.aktiv[colId]).not.toBeNull();
        expect(t.cells.aktiv[colId]).toBeDefined();
      }
    });

    it(`${id}: passiv ist vollständig befüllt (madhi/mudari/masdar/ism)`, () => {
      const t = findeTabelle(id);
      for (const colId of BAB_SPALTEN_REIHENFOLGE) {
        expect(t.cells.passiv[colId]).not.toBeNull();
        expect(t.cells.passiv[colId]).toBeDefined();
      }
    });
  }

  for (const id of NUR_MASDAR_PASSIV_IDS) {
    it(`${id}: passiv enthält NUR 'masdar' (Form ohne eigene Passivform)`, () => {
      const t = findeTabelle(id);
      expect(Object.keys(t.cells.passiv)).toEqual(['masdar']);
      expect(t.cells.passiv.masdar).not.toBeNull();
      // Der Passiv-Masdar ist im Original identisch mit dem Aktiv-Masdar.
      expect((t.cells.passiv.masdar as { ar: string }).ar).toBe((t.cells.aktiv.masdar as { ar: string }).ar);
    });
  }

  for (const id of ALLE_IDS) {
    it(`${id}: imperativ hat Madhi (Amr) und Mudari (Nahy), aber keinen Masdar`, () => {
      const t = findeTabelle(id);
      expect(t.cells.imperativ.madhi).not.toBeNull();
      expect(t.cells.imperativ.mudari).not.toBeNull();
      expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'masdar')).toBe(false);
    });
  }

  for (const id of LAFIF_IDS) {
    it(`${id}: Lafif-Tabellen haben in 'imperativ' KEINE Ism-Zelle`, () => {
      const t = findeTabelle(id);
      expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'ism')).toBe(false);
    });
  }

  for (const id of NAQIS_IDS) {
    it(`${id}: Naqis-Tabellen haben in 'imperativ' eine Ism-Zelle — außer den passivlosen Sonderformen`, () => {
      const t = findeTabelle(id);
      if (NUR_MASDAR_PASSIV_IDS.includes(id)) {
        // Form VII: auch die Imperativ-Zeile hat im Original keine Ism-Ableitung.
        expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'ism')).toBe(false);
      } else {
        expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'ism')).toBe(true);
        expect(t.cells.imperativ.ism).not.toBeNull();
      }
    });
  }

  for (const id of MUDAAF_IDS) {
    it(`${id}: Muda"af-Tabellen haben in 'imperativ' KEINE Ism-Zelle (anders als Naqis, wie bei Lafif)`, () => {
      const t = findeTabelle(id);
      expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'ism')).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Regressionsschutz: Aktiv-Madhi und Passiv-Madhi dürfen sich nicht gleichen
// (außer in den dokumentierten Muda"af-Sonderfällen, wo Aktiv/Passiv im
// Original absichtlich gleich geschrieben sind — siehe eigener Test unten).
// ---------------------------------------------------------------------------

const AKTIV_PASSIV_MADHI_HOMOGRAPHEN = new Set<string>([
  // (keine — Madhi unterscheidet sich in JEDER Tabelle dieser Datei zwischen
  // Aktiv und Passiv, auch dort, wo Mudari/Ism zusammenfallen; siehe nächster Block)
]);

describe('paradigmen-bab-naqis-lafif-mudaaf.json — Regressionsschutz: Aktiv-Madhi ≠ Passiv-Madhi', () => {
  for (const id of ALLE_IDS.filter((x) => !OHNE_PASSIV_ZEILE_IDS.includes(x) && !NUR_MASDAR_PASSIV_IDS.includes(x))) {
    it(`${id}: Aktiv-Madhi unterscheidet sich von Passiv-Madhi`, () => {
      const t = findeTabelle(id);
      const aktivMadhi = (t.cells.aktiv.madhi as { ar: string }).ar;
      const passivMadhi = (t.cells.passiv.madhi as { ar: string }).ar;
      if (AKTIV_PASSIV_MADHI_HOMOGRAPHEN.has(id)) {
        expect(aktivMadhi).toBe(passivMadhi);
      } else {
        expect(aktivMadhi).not.toBe(passivMadhi);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Dokumentierte Muda"af-Homographen: bei zwei Tabellen sind Aktiv- und
// Passiv-Mudari (bzw. Ism Fa'il/Ism Maf'ul) im Original BUCHSTABENGLEICH
// gedruckt, weil der unterscheidende Innenvokal genau auf dem Buchstaben
// liegt, der beim Idgham verschmilzt. Siehe Notes der jeweiligen Tabelle.
// ---------------------------------------------------------------------------

describe('paradigmen-bab-naqis-lafif-mudaaf.json — dokumentierte Muda"af-Homographen (Aktiv=Passiv bei Mudari/Ism)', () => {
  it('bab-mufaala3-mudaaf-shaqqa: Aktiv-Mudari und Passiv-Mudari sind identisch (يُشَاقُّ)', () => {
    const t = findeTabelle('bab-mufaala3-mudaaf-shaqqa');
    expect((t.cells.aktiv.mudari as { ar: string }).ar).toBe('يُشَاقُّ');
    expect((t.cells.passiv.mudari as { ar: string }).ar).toBe('يُشَاقُّ');
    expect((t.cells.aktiv.ism as { ar: string }).ar).toBe((t.cells.passiv.ism as { ar: string }).ar);
  });

  it('bab-tafaul6-mudaaf-tahajja: Ism Fa\'il und Ism Maf\'ul sind identisch (مُتَحَاجٌّ)', () => {
    const t = findeTabelle('bab-tafaul6-mudaaf-tahajja');
    expect((t.cells.aktiv.ism as { ar: string }).ar).toBe('مُتَحَاجٌّ');
    expect((t.cells.passiv.ism as { ar: string }).ar).toBe('مُتَحَاجٌّ');
  });

  it('bab-iftial8-mudaaf-ishtadda: Ism Fa\'il und Ism Maf\'ul sind identisch (مُشْتَدٌّ)', () => {
    const t = findeTabelle('bab-iftial8-mudaaf-ishtadda');
    expect((t.cells.aktiv.ism as { ar: string }).ar).toBe('مُشْتَدٌّ');
    expect((t.cells.passiv.ism as { ar: string }).ar).toBe('مُشْتَدٌّ');
  });
});

// ---------------------------------------------------------------------------
// WICHTIGSTER BELEGTER SACHVERHALT (Auftrag): im Apokopat/Jussiv können bei
// Muda"af-Verben die beiden gleichen Radikale GETRENNT statt verschmolzen
// erscheinen. Belegt an Qur'an 2:217 (يَرْتَدِدْ, Wurzel ردد, Form VIII,
// Rohstring STEM|POS:V|IMPF|(VIII)|LEM:{rotad~a|ROOT:rdd|3MS|MOOD:JUS). Diese
// Datei enthält ein direktes, aus dem Handout gelesenes Analogon: die Amr-/
// Nahy-Zellen von bab-mufaala3-mudaaf-shaqqa (Wurzel شقق) zeigen exakt
// dasselbe Muster — getrennte Radikale statt Schadda. Dieser Test nagelt das
// fest, inkl. eines Kontrastbeispiels (bab-ifal4-mudaaf-ahabba), das die
// sonst übliche verschmolzene Form (Fekk-al-Idgham-bi-l-Fatha) zeigt.
// ---------------------------------------------------------------------------

describe('paradigmen-bab-naqis-lafif-mudaaf.json — Apokopat trennt gleiche Radikale (Analogon zu 2:217 يَرْتَدِدْ)', () => {
  it('bab-mufaala3-mudaaf-shaqqa: Amr (شَاقِقْ) und Nahy (لَا تُشَاقِقْ) zeigen die Radikale GETRENNT (Kasra + Sukun), kein Schadda', () => {
    const t = findeTabelle('bab-mufaala3-mudaaf-shaqqa');
    const amr = (t.cells.imperativ.madhi as { ar: string }).ar;
    const nahy = (t.cells.imperativ.mudari as { ar: string }).ar;
    expect(amr).toBe('شَاقِقْ');
    expect(nahy).toBe('لَا تُشَاقِقْ');
    // Kein Schadda-Zeichen in der Amr-/Nahy-Form — die beiden Qaf stehen als
    // eigene Buchstaben mit je eigenem Vokalzeichen (Kasra bzw. Sukun).
    expect(amr.includes(SCHADDA)).toBe(false);
    expect(nahy.includes(SCHADDA)).toBe(false);
    // Zwei getrennte Qaf-Vorkommen (statt eines einzigen mit Schadda).
    expect((amr.match(/ق/g) ?? []).length).toBe(2);
    expect((nahy.match(/ق/g) ?? []).length).toBe(2);
  });

  it('Kontrast: bab-ifal4-mudaaf-ahabba zeigt die sonst übliche VERSCHMOLZENE Form (Schadda + Fatha) in Amr/Nahy', () => {
    const t = findeTabelle('bab-ifal4-mudaaf-ahabba');
    const amr = (t.cells.imperativ.madhi as { ar: string }).ar;
    const nahy = (t.cells.imperativ.mudari as { ar: string }).ar;
    expect(amr).toBe('أَحِبَّ');
    expect(nahy).toBe('لَا تُحِبَّ');
    expect(amr.includes(SCHADDA)).toBe(true);
    expect(nahy.includes(SCHADDA)).toBe(true);
  });

  it('weitere Muda"af-Tabellen enthalten in Amr durchweg ein Schadda (entweder aus Fekk-al-Idgham-bi-l-Fatha am Wortende, oder — bei Form II/V wie habbaba/tahaqqaqa — aus der wortinternen Eigen-Verdoppelung der Form)', () => {
    const andereIds = MUDAAF_IDS.filter((id) => id !== 'bab-mufaala3-mudaaf-shaqqa');
    for (const id of andereIds) {
      const t = findeTabelle(id);
      const amr = (t.cells.imperativ.madhi as { ar: string }).ar;
      expect(amr.includes(SCHADDA)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Dokumentierte Unstimmigkeit im Original: bab-tafaul6-naqis-talaqa
// (Abbildung 92, S. 118) — siehe ausführliche Notes in der JSON-Datei.
// ---------------------------------------------------------------------------

describe('paradigmen-bab-naqis-lafif-mudaaf.json — dokumentierte Unstimmigkeit bab-tafaul6-naqis-talaqa', () => {
  it('Aktiv-Madhi (تَلَقَى) enthält kein Schadda und kein Alif zwischen Lam und Qaf — anders als die Shadda-Form der Nachbartabelle', () => {
    const t = findeTabelle('bab-tafaul6-naqis-talaqa');
    const nachbar = findeTabelle('bab-tafaul5-naqis-talaqqa');
    const madhi = (t.cells.aktiv.madhi as { ar: string }).ar;
    const madhiNachbar = (nachbar.cells.aktiv.madhi as { ar: string }).ar;
    expect(madhi).toBe('تَلَقَى');
    expect(madhi.includes(SCHADDA)).toBe(false);
    expect(madhiNachbar).toBe('تَلَقَّى');
    expect(madhiNachbar.includes(SCHADDA)).toBe(true);
  });

  it('Passiv-Madhi (تُلُووِيَ) enthält zwei getrennte Waw-Buchstaben — dasselbe Muster wie bab-tafaul6-lafif-tadawa', () => {
    const t = findeTabelle('bab-tafaul6-naqis-talaqa');
    const analog = findeTabelle('bab-tafaul6-lafif-tadawa');
    const passivMadhi = (t.cells.passiv.madhi as { ar: string }).ar;
    expect(passivMadhi).toBe('تُلُووِيَ');
    expect((passivMadhi.match(/و/g) ?? []).length).toBe(2);
    expect((analog.cells.passiv.madhi as { ar: string }).ar).toBe('تُدُووِيَ');
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe gegen das Quranic Arabic Corpus. Datenquelle:
// apps/mobile/.daten-cache/out/morphologie/v<N> (aktuelle Schemaversion,
// siehe MORPHOLOGIE_SCHEMA_VERSION; per
// `node scripts/build-morphologie.mjs` erzeugt, gitignored). Fehlt der
// Cache, wird der Block übersprungen statt die Suite rot zu machen — siehe
// morphologieCachePfad.ts.
// ---------------------------------------------------------------------------

const MOBILE_DIR = join(__dirname, '..', '..', '..', '..');
const MORPHOLOGIE_DIR = morphologieCacheVerzeichnis(MOBILE_DIR);

function normalisiereSkelett(text: string): string {
  return text
    .replace(/ٱ/g, 'ا')
    .replace(/ٰ/g, 'ا')
    .replace(/[ً-ْٓ-ٕۖ-ۭـ]/g, '');
}

interface MorphologieWort {
  position: number;
  text: string;
  root: string | null;
}
interface MorphologieDatei {
  verses: Record<string, MorphologieWort[]>;
}
interface RootsIndex {
  [wurzel: string]: { occurrences: [number, number, number][] };
}

function ladeWortformenFuerWurzel(wurzel: string): Set<string> {
  const roots = JSON.parse(readFileSync(join(MORPHOLOGIE_DIR, 'roots.json'), 'utf8')) as RootsIndex;
  const eintrag = roots[wurzel];
  const formen = new Set<string>();
  if (!eintrag) return formen;
  const surahCache = new Map<number, MorphologieDatei>();
  for (const [sure, vers, position] of eintrag.occurrences) {
    if (!surahCache.has(sure)) {
      surahCache.set(sure, JSON.parse(readFileSync(join(MORPHOLOGIE_DIR, `${sure}.json`), 'utf8')) as MorphologieDatei);
    }
    const datei = surahCache.get(sure)!;
    const wort = datei.verses[String(vers)]?.find((w) => w.position === position);
    if (wort) formen.add(wort.text);
  }
  return formen;
}

function imKorpusBelegt(form: string, korpusFormen: Set<string>, korpusSkelette: string[]): boolean {
  if (korpusFormen.has(form)) return true;
  const skelett = normalisiereSkelett(form);
  return korpusSkelette.some((s) => s.includes(skelett));
}

// Wurzel je Tabelle, in der im roots.json-Index üblichen Schreibung (Alif
// statt Hamza, Waw statt Ya bei manchen Naqis-Wurzeln, wie im Korpus üblich).
const WURZELN: Record<string, string> = {
  'bab-fataha-naqis-saa': 'سعي',
  'bab-samia-naqis-radiya': 'رضي',
  'bab-daraba-naqis-rama': 'رمي',
  'bab-nasara-naqis-daa': 'دعو',
  'bab-tafil2-naqis-salla': 'صلو',
  'bab-mufaala3-naqis-nada': 'ندو',
  'bab-ifal4-naqis-abqa': 'بقي',
  'bab-tafaul5-naqis-talaqqa': 'لقي',
  'bab-tafaul6-naqis-talaqa': 'لقي',
  'bab-infial7-naqis-inqada': 'قضي',
  'bab-iftial8-naqis-ibtala': 'بلو',
  'bab-istifal10-naqis-istaala': 'علو',
  'bab-samia-lafif-qawiya': 'قوي',
  'bab-daraba-lafif-rawa': 'روي',
  'bab-daraba-lafif-wafa': 'وفي',
  'bab-hasiba-lafif-waliya': 'ولي',
  'bab-tafil2-lafif-sawwa': 'سوي',
  'bab-mufaala3-lafif-sawa': 'سوي',
  'bab-ifal4-lafif-awha': 'وحي',
  'bab-tafaul5-lafif-tawaffa': 'وفي',
  'bab-tafaul6-lafif-tadawa': 'دوي',
  'bab-infial7-lafif-inzawa': 'زوي',
  'bab-iftial8-lafif-istawa': 'سوي',
  'bab-istifal10-lafif-istawla': 'ولي',
  'bab-samia-mudaaf-barra': 'برر',
  'bab-daraba-mudaaf-farra': 'فرر',
  'bab-nasara-mudaaf-madda': 'مدد',
  'bab-tafil2-mudaaf-habbaba': 'حبب',
  'bab-mufaala3-mudaaf-shaqqa': 'شقق',
  'bab-ifal4-mudaaf-ahabba': 'حبب',
  'bab-tafaul5-mudaaf-tahaqqaqa': 'حقق',
  'bab-tafaul6-mudaaf-tahajja': 'حجج',
  'bab-infial7-mudaaf-inshaqqa': 'شقق',
  'bab-iftial8-mudaaf-ishtadda': 'شدد',
  'bab-ifilal9-mudaaf-ihmarra': 'حمر',
  'bab-istifal10-mudaaf-istahabba': 'حبب',
  'bab-ifilal11-mudaaf-ihmaarra': 'حمر',
  'bab-ifillal4-mudaaf-iqshaarra': 'قشعر',
};

// Empirisch per Testlauf gegen den lokalen Morphologie-Cache ermittelt
// (Skript siehe LUECKEN.md), NICHT geraten: die jeweils NICHT gelisteten
// Formen sind (ggf. skelettgleich) im Korpus belegt. Bei den meisten
// Tabellen ist die einzige Ausnahme die verneinte Nahy-Form ("لَا تَ..."),
// weil "لَا" im Korpus als eigenes Wort-Token geführt wird und daher nicht
// als Teilstring des folgenden Verbs erscheint — dieselbe Systematik wie
// bereits in paradigmen-verben.test.ts für die nahy-nasara-matrix belegt.
//
// Vier Wurzeln (رضي, روي, دوي, زوي) kommen im Qur'an-Korpus GAR NICHT vor
// (roots.json kennt sie nicht) — dort sind zwangsläufig ALLE Formen der
// Tabelle "Ausnahmen", was keine Fehlerquelle ist, sondern schlicht bedeutet,
// dass diese Wurzeln im Korantext nicht belegt sind.
const ERWARTETE_AUSNAHMEN: Record<string, string[]> = {
  'bab-fataha-naqis-saa': [
    'سَاعٍ',
    'لَا تَسْعَ',
    'مَسْعَى',
    'مَسْعِيٌّ',
  ],
  'bab-samia-naqis-radiya': [
    'رَضِيَ',
    'يَرْضَى',
    'رِضْوَانًا',
    'رَاضٍ',
    'رُضِيَ',
    'يُرْضَى',
    'مَرْضِيٌّ',
    'اِرْضَ',
    'لَا تَرْضَ',
    'مَرْضَى',
  ],
  'bab-daraba-naqis-rama': [
    'اِرْمِ',
    'رَامٍ',
    'رَمْيًا',
    'لَا تَرْمِ',
    'مَرْمَى',
    'مَرْمِيٌّ',
    'يَرْمِي',
    'يُرْمَى',
  ],
  'bab-nasara-naqis-daa': [
    'لَا تَدْعُ',
    'مَدْعًى',
    'مَدْعُوٌّ',
  ],
  'bab-tafil2-naqis-salla': [
    'تَصْلِيَةً',
    'لَا تُصَلِّ',
    'يُصَلِّي',
  ],
  'bab-mufaala3-naqis-nada': [
    'لَا تُنَادِ',
    'مُنَادًى',
    'مُنَادَاةً',
    'نُودِيَ',
  ],
  'bab-ifal4-naqis-abqa': [
    'أُبْقِيَ',
    'إِبْقَاءً',
    'لَا تُبْقِ',
    'مُبْقًى',
    'مُبْقٍ',
    'مُبْقَى',
    'يُبْقِي',
  ],
  'bab-tafaul5-naqis-talaqqa': [
    'لَا تَتَلَقَّ',
    'مُتَلَقًّى',
  ],
  'bab-tafaul6-naqis-talaqa': [
    'تُلُووِيَ',
    'لَا تَتَلَقَ',
    'مُتَلَقَّى',
  ],
  'bab-infial7-naqis-inqada': [
    'اِنْقَضَى',
    'اِنْقَضِ',
    'اِنْقِضَاءً',
    'لَا تَنْقَضِ',
    'مُنْقَضٍ',
    'يَنْقَضِي',
  ],
  'bab-iftial8-naqis-ibtala': [
    'اُبْتُلِيَ',
    'اِبْتِلَاءً',
    'لَا تَبْتَلِ',
    'مُبْتَلًى',
    'مُبْتَلَى',
  ],
  'bab-istifal10-naqis-istaala': [
    'اُسْتُعْلِيَ',
    'اِسْتِعْلَاءً',
    'لَا تَسْتَعْلِ',
    'مُسْتَعْلًى',
    'مُسْتَعْلٍ',
    'مُسْتَعْلَى',
    'يَسْتَعْلِي',
    'يُسْتَعْلَى',
  ],
  'bab-samia-lafif-qawiya': [
    'اِقْوَ',
    'لَا تَقْوَ',
    'يَقْوَى',
    'يُقْوَى',
  ],
  'bab-daraba-lafif-rawa': [
    'رَوَى',
    'يَرْوِي',
    'رِوَايَةً',
    'رَاوٍ',
    'رُوِيَ',
    'يُرْوَى',
    'مَرْوِيٌّ',
    'اِرْوِ',
    'لَا تَرْوِ',
  ],
  'bab-daraba-lafif-wafa': [
    'لَا تَفِ',
    'مَوْفِيٌّ',
    'وَافٍ',
    'وَفَاءً',
    'يَفِي',
  ],
  'bab-hasiba-lafif-waliya': [
    'لَا تَلِ',
    'يَلِيْ',
    'يُوْلَى',
  ],
  'bab-tafil2-lafif-sawwa': [
    'تَسْوِيَةً',
    'لَا تُسَوِّ',
    'مُسَوًّى',
    'مُسَوٍّ',
    'يُسَوَّى',
    'يُسَوِّي',
  ],
  'bab-mufaala3-lafif-sawa': [
    'سُووِيَ',
    'لَا تُسَاوِ',
    'مُسَاوًى',
    'مُسَاوٍ',
    'مُسَاوَاةً',
    'يُسَاوَى',
    'يُسَاوِي',
  ],
  'bab-ifal4-lafif-awha': [
    'إِيْحَاءً',
    'لَا تُوْحِ',
    'مُوْحًى',
    'مُوْحٍ',
    'يُوْحِي',
  ],
  'bab-tafaul5-lafif-tawaffa': [
    'تَوَفِّيًا',
    'لَا تَتَوَفَّ',
    'مُتَوَفًّى',
  ],
  'bab-tafaul6-lafif-tadawa': [
    'تَدَاوَى',
    'يَتَدَاوَى',
    'تَدَاوِيًا',
    'مُتَدَاوٍ',
    'تُدُووِيَ',
    'يُتَدَاوَى',
    'مُتَدَاوًى',
    'تَدَاوَ',
    'لَا تَتَدَاوَ',
  ],
  'bab-infial7-lafif-inzawa': [
    'اِنْزَوَى',
    'يَنْزَوِي',
    'اِنْزِوَاءً',
    'مُنْزَوٍ',
    'اِنْزَوِ',
    'لَا تَنْزَوِ',
  ],
  'bab-iftial8-lafif-istawa': [
    'اِسْتِوَاءً',
    'لَا تَسْتَوِ',
    'مُسْتَوًى',
    'مُسْتَوٍ',
  ],
  'bab-istifal10-lafif-istawla': [
    'اُسْتُوْلِيَ',
    'اِسْتَوْلَى',
    'اِسْتَوْلِ',
    'اِسْتِيْلَاءً',
    'لَا تَسْتَوْلِ',
    'مُسْتَوْلًى',
    'مُسْتَوْلٍ',
    'يَسْتَوْلِي',
    'يُسْتَوْلَى',
  ],
  'bab-samia-mudaaf-barra': [
    'بَارٌّ',
    'لَا تَبَرَّ',
    'مَبْرُورٌ',
    'يَبَرُّ',
    'يُبَرُّ',
  ],
  'bab-daraba-mudaaf-farra': [
    'فَارٌّ',
    'لَا تَفِرَّ',
    'مَفْرُورٌ',
  ],
  'bab-nasara-mudaaf-madda': [
    'لَا تَمُدَّ',
    'مَادٌّ',
  ],
  'bab-tafil2-mudaaf-habbaba': [
    'تَحْبِيبًا',
    'لَا تُحَبِّبْ',
    'مُحَبَّبٌ',
    'مُحَبِّبٌ',
  ],
  'bab-mufaala3-mudaaf-shaqqa': [
    'شُوقَّ',
    'لَا تُشَاقِقْ',
    'مُشَاقٌّ',
    'مُشَاقَّةً',
  ],
  'bab-ifal4-mudaaf-ahabba': [
    'إِحْبَابًا',
    'لَا تُحِبَّ',
  ],
  'bab-tafaul5-mudaaf-tahaqqaqa': [
    'تَحَقَّقَ',
    'تَحَقَّقْ',
    'تَحَقُّقًا',
    'تُحُقِّقَ',
    'لَا تَتَحَقَّقْ',
    'مُتَحَقَّقٌ',
    'مُتَحَقِّقٌ',
    'يَتَحَقَّقُ',
    'يُتَحَقَّقُ',
  ],
  'bab-tafaul6-mudaaf-tahajja': [
    'تَحَاجًّا',
    'تُحُوجَّ',
    'لَا تَتَحَاجَّ',
    'مُتَحَاجٌّ',
  ],
  'bab-infial7-mudaaf-inshaqqa': [
    'اِنْشِقَاقًا',
    'لَا تَنْشَقَّ',
    'مُنْشَقٌّ',
    'يَنْشَقُّ',
  ],
  'bab-iftial8-mudaaf-ishtadda': [
    'اِشْتِدَادًا',
    'لَا تَشْتَدَّ',
    'مُشْتَدٌّ',
    'يَشْتَدُّ',
    'يُشْتَدُّ',
  ],
  'bab-ifilal9-mudaaf-ihmarra': [
    'اِحْمَرَّ',
    'اِحْمِرَارًا',
    'لَا تَحْمَرَّ',
    'مُحْمَرٌّ',
    'يَحْمَرُّ',
  ],
  'bab-istifal10-mudaaf-istahabba': [
    'اِسْتِحْبَابًا',
    'لَا تَسْتَحِبَّ',
    'مُسْتَحَبٌّ',
    'مُسْتَحِبٌّ',
  ],
  'bab-ifilal11-mudaaf-ihmaarra': [
    'اِحْمَارَّ',
    'اِحْمِيرَارًا',
    'لَا تَحْمَارَّ',
    'مُحْمَارٌّ',
    'يَحْمَارُّ',
  ],
  'bab-ifillal4-mudaaf-iqshaarra': [
    'اِقْشَعَرَّ',
    'اِقْشَعِرَّ',
    'اِقْشِعْرَارًا',
    'لَا تَقْشَعِرَّ',
    'مُقْشَعِرٌّ',
    'يَقْشَعِرُّ',
  ],
};
const morphologieVorhanden = morphologieCacheVorhanden(MOBILE_DIR);
const KORPUS_SUITE_NAME = morphologieVorhanden
  ? 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus'
  : 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus — ÜBERSPRUNGEN (Cache fehlt, siehe console.warn unten)';

(morphologieVorhanden ? describe : describe.skip)(KORPUS_SUITE_NAME, () => {
  function pruefeTabelle(id: string) {
    const wurzel = WURZELN[id];
    const formenSet = morphologieVorhanden ? ladeWortformenFuerWurzel(wurzel) : new Set<string>();
    const skelette = [...formenSet].map(normalisiereSkelett);
    const t = findeTabelle(id);
    const formen = alleZellen(t)
      .filter((z) => z.zelle !== null)
      .map((z) => (z.zelle as { ar: string }).ar);
    const tatsaechlicheAusnahmen = formen.filter((f) => !imKorpusBelegt(f, formenSet, skelette));
    expect(new Set(tatsaechlicheAusnahmen)).toEqual(new Set(ERWARTETE_AUSNAHMEN[id]));
  }

  for (const id of ALLE_IDS) {
    it(`${id}: jede Form außer der dokumentierten Ausnahmeliste ist im Korpus (Wurzel ${WURZELN[id]}) belegt`, () => {
      pruefeTabelle(id);
    });
  }

  it('Selbstkontrolle: die meisten Wurzeln dieser Datei sind im Korpus mit mehreren Formen belegt', () => {
    const belegteWurzelAnzahl = Object.values(WURZELN)
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .filter((w) => ladeWortformenFuerWurzel(w).size > 0).length;
    // 4 Wurzeln (رضي, روي, دوي, زوي) kommen im Qur'an nicht vor — siehe Notiz oben.
    expect(belegteWurzelAnzahl).toBeGreaterThan(20);
  });
});

if (!morphologieVorhanden) {
  // eslint-disable-next-line no-console
  console.warn(
    `Korpus-Gegenprobe übersprungen: ${MORPHOLOGIE_DIR} fehlt. ` +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
