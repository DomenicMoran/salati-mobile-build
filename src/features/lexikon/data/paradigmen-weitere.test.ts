import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import { normalisiereOrthografieSkelett, skelettImKorpusBelegt } from '../orthografieSkelett';
import paradigmenWeitereRoh from './paradigmen-weitere.json';

/**
 * Gegenprobe für paradigmen-weitere.json — die letzten der in LUECKEN.md
 * ("Identifizierte, aber in diesem Lauf NICHT übernommene echte Lücken")
 * benannten Paradigmentabellen außerhalb Kapitel 8: Kāna-Matrix, Mudari
 * Mansub/Majzum-Matrizen, Nūn-at-Tawkīd-Formen, die acht Sarf-Großfamilien,
 * die "leichte" Muslimun-Deklination, Ism-Mawsul-Raster sowie zwei weitere
 * Nomen-Paradigmen (Flexibilitätsarten, gebrochener Plural), die beim
 * Durchgehen als echte Paradigmentabellen erkannt wurden.
 *
 * Gleiches Prinzip wie paradigmen-verben.test.ts: jede arabische Form muss
 * zeichengenau aus dem gerenderten Seitenbild stammen; Struktur UND Korpus-
 * Gegenprobe werden geprüft. Die Korpus-Gegenprobe nutzt hier erstmals die
 * gemeinsame Hilfsfunktion `normalisiereOrthografieSkelett` (siehe
 * ../orthografieSkelett.ts) statt einer lokalen Kopie von normalisiereSkelett.
 */

type Zelle = { ar: string; de: string } | null;

interface ParadigmenTabelle {
  id: string;
  kind: string;
  titleDe: string;
  termAr?: string;
  columns: { id: string; labelDe: string; labelAr?: string }[];
  rows: { id: string; labelDe: string; labelAr?: string }[];
  cells: Record<string, Record<string, Zelle>>;
  notes?: string[];
  source: { file: string; page: number };
}

interface ParadigmenDatei {
  schema: number;
  tables: ParadigmenTabelle[];
}

const paradigmenWeitere = paradigmenWeitereRoh as unknown as ParadigmenDatei;

const ARABISCH = /[؀-ۿ]/;
const LATEINISCH = /[A-Za-z]/;
const HARAKAT = /[ً-ْ]/;

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
  const t = paradigmenWeitere.tables.find((x) => x.id === id);
  if (!t) throw new Error(`Tabelle ${id} fehlt in paradigmen-weitere.json`);
  return t;
}

describe('paradigmen-weitere.json — Struktur', () => {
  it('hat Schema 1 und genau 17 Tabellen', () => {
    expect(paradigmenWeitere.schema).toBe(1);
    expect(paradigmenWeitere.tables.length).toBe(17);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmenWeitere.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte/Zeile und eine gültige Quelle', () => {
    for (const t of paradigmenWeitere.tables) {
      expect(t.id).toBeTruthy();
      expect(t.titleDe).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.file).toBe('handout.pdf');
      expect(t.source?.page).toBeGreaterThan(0);
      expect(Array.isArray(t.notes) && t.notes.length).toBeTruthy();
    }
  });

  it('Zeilen- und Spalten-IDs sind je Tabelle eindeutig', () => {
    for (const t of paradigmenWeitere.tables) {
      expect(new Set(t.rows.map((r) => r.id)).size).toBe(t.rows.length);
      expect(new Set(t.columns.map((c) => c.id)).size).toBe(t.columns.length);
    }
  });

  it('jede in cells referenzierte Zeilen-/Spalten-ID existiert wirklich (kein Verweis ins Leere)', () => {
    for (const t of paradigmenWeitere.tables) {
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

describe('paradigmen-weitere.json — arabische Formen', () => {
  for (const t of paradigmenWeitere.tables) {
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
      for (const { zelle } of zellen) {
        expect(ARABISCH.test(zelle.ar)).toBe(true);
        expect(LATEINISCH.test(zelle.ar)).toBe(false);
      }
    });

    it(`${t.id}: jede "ar"-Form ist vokalisiert (mind. ein Harakat-Zeichen)`, () => {
      for (const { zelle } of zellen) {
        expect(HARAKAT.test(zelle.ar)).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Die vier vollständigen Personenmatrizen (Kaana, Mudari Mansub, Mudari
// Majzum, Nun at-Tawkid Thaqila) folgen demselben 5×3-Raster wie die sechs
// Personenmatrizen in paradigmen-verben.json: Spalten plural/dual/singular,
// Zeilen 3-m/3-f/2-m/2-f/1, 1. Person ohne Dual.
// ---------------------------------------------------------------------------

const PERSONENMATRIZEN = [
  'kaana-matrix',
  'mudari-mansub-nasara-matrix',
  'mudari-majzum-nasara-matrix',
  'nun-tawkid-thaqila-nasara-matrix',
];

const ERWARTETE_ZEILEN_REIHENFOLGE = ['3-m', '3-f', '2-m', '2-f', '1'];
const ERWARTETE_SPALTEN_REIHENFOLGE = ['plural', 'dual', 'singular'];

describe('paradigmen-weitere.json — Raster der vier neuen Personenmatrizen', () => {
  for (const id of PERSONENMATRIZEN) {
    const t = findeTabelle(id);

    it(`${id}: hat genau 5 Zeilen in der Reihenfolge 3-m, 3-f, 2-m, 2-f, 1`, () => {
      expect(t.rows.map((r) => r.id)).toEqual(ERWARTETE_ZEILEN_REIHENFOLGE);
    });

    it(`${id}: hat genau 3 Spalten in der Reihenfolge plural, dual, singular`, () => {
      expect(t.columns.map((c) => c.id)).toEqual(ERWARTETE_SPALTEN_REIHENFOLGE);
    });

    it(`${id}: jede Zeile hat für jede der 3 Spalten einen Eintrag (Wert oder explizit null)`, () => {
      for (const rowId of ERWARTETE_ZEILEN_REIHENFOLGE) {
        expect(t.cells[rowId]).toBeDefined();
        for (const colId of ERWARTETE_SPALTEN_REIHENFOLGE) {
          expect(Object.prototype.hasOwnProperty.call(t.cells[rowId], colId)).toBe(true);
        }
      }
    });

    it(`${id}: 1. Person hat keinen Dual (Zelle "1"/"dual" ist null)`, () => {
      expect(t.cells['1'].dual).toBeNull();
    });
  }

  it('kaana-matrix: Zelle "1"/"plural" (كُنَّا) ist trotz Druckversatz im Original befüllt, nicht null', () => {
    const t = findeTabelle('kaana-matrix');
    expect(t.cells['1'].plural).not.toBeNull();
    expect((t.cells['1'].plural as { ar: string }).ar).toBe('كُنَّا');
  });
});

// ---------------------------------------------------------------------------
// Regressionsschutz: Mudari Mansub und Mudari Majzum unterscheiden sich NUR
// in der Singular-Spalte (Fatha vs. Sukun) — Dual/Plural sind je Person
// identisch (beide leiten sich aus derselben "leichten Form" ab, siehe
// notes). Ein versehentliches Kopieren einer ganzen Zeile würde das nicht
// verändern, ein versehentliches Vertauschen der Singular-Spalte schon.
// ---------------------------------------------------------------------------

describe('paradigmen-weitere.json — Regressionsschutz: Mansub vs. Majzum', () => {
  it('Dual ist für jede Person (sofern vorhanden) zwischen Mansub und Majzum identisch — beide verlieren dort gleichermaßen das Nūn', () => {
    const mansub = findeTabelle('mudari-mansub-nasara-matrix');
    const majzum = findeTabelle('mudari-majzum-nasara-matrix');
    for (const rowId of ERWARTETE_ZEILEN_REIHENFOLGE) {
      const a = mansub.cells[rowId].dual;
      const b = majzum.cells[rowId].dual;
      if (a === null && b === null) continue;
      expect((a as { ar: string }).ar).toBe((b as { ar: string }).ar);
    }
  });

  it('Plural ist bei 3-m/3-f/2-m/2-f zwischen Mansub und Majzum identisch (Nūn fällt in beiden Modi gleich weg)', () => {
    const mansub = findeTabelle('mudari-mansub-nasara-matrix');
    const majzum = findeTabelle('mudari-majzum-nasara-matrix');
    for (const rowId of ['3-m', '3-f', '2-m', '2-f']) {
      const a = mansub.cells[rowId].plural as { ar: string };
      const b = majzum.cells[rowId].plural as { ar: string };
      expect(a.ar).toBe(b.ar);
    }
  });

  it('1. Person Plural (نَحْنُ-Form) verhält sich dagegen wie ein Singular und unterscheidet sich (Fatha نَنْصُرَ vs. Sukun نَنْصُرْ) — Handout-Regel "Singular UND 1. Person Plural" ist wörtlich zu nehmen', () => {
    const mansub = findeTabelle('mudari-mansub-nasara-matrix');
    const majzum = findeTabelle('mudari-majzum-nasara-matrix');
    expect((mansub.cells['1'].plural as { ar: string }).ar).toBe('نَنْصُرَ');
    expect((majzum.cells['1'].plural as { ar: string }).ar).toBe('نَنْصُرْ');
  });

  it('Singular unterscheidet sich zwischen Mansub (Fatha) und Majzum (Sukun) für 3-m/3-f/2-m/1', () => {
    const mansub = findeTabelle('mudari-mansub-nasara-matrix');
    const majzum = findeTabelle('mudari-majzum-nasara-matrix');
    for (const rowId of ['3-m', '3-f', '2-m', '1']) {
      const singularMansub = mansub.cells[rowId].singular as { ar: string };
      const singularMajzum = majzum.cells[rowId].singular as { ar: string };
      expect(singularMansub.ar).not.toBe(singularMajzum.ar);
    }
  });

  it('2-f Singular ist AUSNAHMSWEISE identisch (تَنْصُرِيْ) — die Endung auf Ya lässt keinen Fatha/Sukun-Unterschied zu, da schon in der Grundform (Mudari Marfu) das Nūn fällt und nur Ya übrig bleibt', () => {
    const mansub = findeTabelle('mudari-mansub-nasara-matrix');
    const majzum = findeTabelle('mudari-majzum-nasara-matrix');
    const singularMansub = mansub.cells['2-f'].singular as { ar: string };
    const singularMajzum = majzum.cells['2-f'].singular as { ar: string };
    expect(singularMansub.ar).toBe('تَنْصُرِيْ');
    expect(singularMansub.ar).toBe(singularMajzum.ar);
  });
});

// ---------------------------------------------------------------------------
// ism-mawsul-raster: 2×3-Raster (Geschlecht × Anzahl).
// ---------------------------------------------------------------------------

describe('paradigmen-weitere.json — ism-mawsul-raster', () => {
  const t = findeTabelle('ism-mawsul-raster');

  it('hat genau die Zeilen m, f und Spalten plural, dual, singular', () => {
    expect(t.rows.map((r) => r.id)).toEqual(['m', 'f']);
    expect(t.columns.map((c) => c.id)).toEqual(ERWARTETE_SPALTEN_REIHENFOLGE);
  });

  it('stimmt mit den bereits verifizierten Werten der Tabelle "relativpronomen" (paradigmen.json) überein', () => {
    // paradigmen.json wird hier NICHT importiert (Datei-Grenze dieses
    // Auftrags), die sechs Werte stammen 1:1 aus dem dortigen JSON und aus
    // demselben gerenderten Seitenbild — reiner Konsistenz-Fingerabdruck.
    expect((t.cells.m.singular as { ar: string }).ar).toBe('الَّذِي');
    expect((t.cells.m.dual as { ar: string }).ar).toBe('اللَّذَانِ');
    expect((t.cells.m.plural as { ar: string }).ar).toBe('الَّذِيْنَ');
    expect((t.cells.f.singular as { ar: string }).ar).toBe('الَّتِي');
    expect((t.cells.f.dual as { ar: string }).ar).toBe('اللَّتَانِ');
    expect((t.cells.f.plural as { ar: string }).ar).toBe('اللَّاتِي');
  });
});

// ---------------------------------------------------------------------------
// leichte-muslimun-weiblich: dokumentierter Befund — der Singular ist in
// allen drei Status-Zeilen (Raf'/Nasb/Jarr) ZEICHENGLEICH (مُسْلِمَة ohne
// jedes Status-Vokalzeichen auf der Tā' marbūṭa), weil eine Tā' marbūṭa in
// Pausalform unabhängig vom Status als bloßes "-ah" gelesen wird. Dieser
// Test nagelt den Befund fest, damit ein künftiger Umbau ihn nicht
// versehentlich als "Kopierfehler" wegkorrigiert.
// ---------------------------------------------------------------------------

describe('paradigmen-weitere.json — leichte-muslimun-weiblich: Singular-Kollaps über alle drei Status', () => {
  it('Raf\', Nasb und Jarr des Singulars sind identisch (مُسْلِمَة, keine Status-Endung auf der Tā\' marbūṭa)', () => {
    const t = findeTabelle('leichte-muslimun-weiblich');
    const raf = (t.cells.raf.singular as { ar: string }).ar;
    const nasb = (t.cells.nasb.singular as { ar: string }).ar;
    const jarr = (t.cells.jarr.singular as { ar: string }).ar;
    expect(raf).toBe('مُسْلِمَة');
    expect(nasb).toBe(raf);
    expect(jarr).toBe(raf);
  });

  it('Plural und Dual unterscheiden Raf\' dagegen weiterhin von Nasb/Jarr (kein genereller Kollaps)', () => {
    const t = findeTabelle('leichte-muslimun-weiblich');
    expect((t.cells.raf.plural as { ar: string }).ar).not.toBe((t.cells.nasb.plural as { ar: string }).ar);
    expect((t.cells.nasb.plural as { ar: string }).ar).toBe((t.cells.jarr.plural as { ar: string }).ar);
    expect((t.cells.raf.dual as { ar: string }).ar).not.toBe((t.cells.nasb.dual as { ar: string }).ar);
    expect((t.cells.nasb.dual as { ar: string }).ar).toBe((t.cells.jarr.dual as { ar: string }).ar);
  });
});

// ---------------------------------------------------------------------------
// Die acht Sarf-Großfamilien (Kapitel 5.2): dasselbe 3×4-Bab-Raster wie in
// paradigmen-verben.json (Zeilen aktiv/passiv/imperativ, Spalten
// madhi/mudari/masdar/ism), MIT einer dokumentierten Ausnahme: Familie 6
// (Form VII, انكسر) hat laut Original KEINE Passiv-Zeile (grammatisch
// unmöglich bei einem bereits reflexiven Stamm).
// ---------------------------------------------------------------------------

const FAMILIEN_MIT_PASSIV = [
  'sarf-familie-1-allama',
  'sarf-familie-2-jaadala',
  'sarf-familie-3-akhbara',
  'sarf-familie-4-taallama',
  'sarf-familie-5-tasaaala',
  'sarf-familie-7-iqtaraba',
  'sarf-familie-8-istaghfara',
];
const BAB_SPALTEN_REIHENFOLGE = ['madhi', 'mudari', 'masdar', 'ism'];

describe('paradigmen-weitere.json — Sarf-Großfamilien: einheitliches Spaltenraster', () => {
  for (const id of [...FAMILIEN_MIT_PASSIV, 'sarf-familie-6-inkasara']) {
    it(`${id}: hat genau die Spalten madhi, mudari, masdar, ism`, () => {
      const t = findeTabelle(id);
      expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
    });
  }

  for (const id of FAMILIEN_MIT_PASSIV) {
    it(`${id}: hat die Zeilen aktiv, passiv, imperativ, jeweils vollständig befüllt (außer masdar bei imperativ)`, () => {
      const t = findeTabelle(id);
      expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'passiv', 'imperativ']);
      for (const rowId of ['aktiv', 'passiv']) {
        for (const colId of BAB_SPALTEN_REIHENFOLGE) {
          expect(t.cells[rowId][colId]).not.toBeNull();
        }
      }
      expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'masdar')).toBe(false);
      expect(t.cells.imperativ.madhi).not.toBeNull();
      expect(t.cells.imperativ.mudari).not.toBeNull();
      expect(t.cells.imperativ.ism).not.toBeNull();
    });

    it(`${id}: Aktiv-Madhi unterscheidet sich von Passiv-Madhi`, () => {
      const t = findeTabelle(id);
      expect((t.cells.aktiv.madhi as { ar: string }).ar).not.toBe((t.cells.passiv.madhi as { ar: string }).ar);
    });
  }

  it('sarf-familie-6-inkasara: hat NUR die Zeilen aktiv und imperativ, keine passiv-Zeile (Form VII ist reflexiv, kein eigenes Passiv)', () => {
    const t = findeTabelle('sarf-familie-6-inkasara');
    expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'imperativ']);
    expect(Object.prototype.hasOwnProperty.call(t.cells, 'passiv')).toBe(false);
    for (const colId of BAB_SPALTEN_REIHENFOLGE) {
      expect(t.cells.aktiv[colId]).not.toBeNull();
    }
    expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'masdar')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sarf-familie-4-taallama: Form V ist laut Original ausdrücklich Laazim
// (intransitiv) und hat "kein Passiv" — trotzdem druckt das Original alle
// vier Arabisch-Formen der Passiv-Zeile OHNE deutsche Bedeutungsangabe.
// Dieser Test nagelt fest, dass genau diese drei Zellen als bedeutungslos
// gekennzeichnet sind (und keine echte Übersetzung vortäuschen).
// ---------------------------------------------------------------------------

describe('paradigmen-weitere.json — sarf-familie-4-taallama: Passiv-Zeile ohne eigenständigen Sinn', () => {
  it('alle drei Passiv-Zellen (madhi/mudari/ism) tragen denselben Hinweistext statt einer echten Übersetzung', () => {
    const t = findeTabelle('sarf-familie-4-taallama');
    const hinweis = '(grammatisch gebildete Passivform ohne eigenständigen Sinn)';
    expect((t.cells.passiv.madhi as { ar: string; de: string }).de).toBe(hinweis);
    expect((t.cells.passiv.mudari as { ar: string; de: string }).de).toBe(hinweis);
    expect((t.cells.passiv.ism as { ar: string; de: string }).de).toBe(hinweis);
    // Die Arabisch-Formen selbst sind trotzdem zeichengenau aus dem Bild
    // übernommen, nicht ausgelassen.
    expect((t.cells.passiv.madhi as { ar: string }).ar).toBe('تُعُلِّمَ');
  });
});

// ---------------------------------------------------------------------------
// sarf-familie-5-tasaaala: Aktiv- und Passiv-Masdar sind im Original mit
// UNTERSCHIEDLICHEN Hamza-Trägern gedruckt (تَسَاؤُلًا vs. تَسَائُلًا) — als
// reine Zeichenketten also verschieden, nach Orthografie-Skelett aber
// gleich. Genau der Fall, für den orthografieSkelett.ts gebaut wurde.
// ---------------------------------------------------------------------------

describe('paradigmen-weitere.json — sarf-familie-5-tasaaala: Hamza-Träger-Unterschied Aktiv-/Passiv-Masdar', () => {
  it('Aktiv-Masdar (Waw-Träger ؤ) und Passiv-Masdar (Ya-Träger ئ) sind als Zeichenkette verschieden', () => {
    const t = findeTabelle('sarf-familie-5-tasaaala');
    const aktiv = (t.cells.aktiv.masdar as { ar: string }).ar;
    const passiv = (t.cells.passiv.masdar as { ar: string }).ar;
    expect(aktiv).toBe('تَسَاؤُلًا');
    expect(passiv).toBe('تَسَائُلًا');
    expect(aktiv).not.toBe(passiv);
  });

  it('...aber nach normalisiereOrthografieSkelett identisch (derselbe Laut, unterschiedlicher Hamza-Träger)', () => {
    const t = findeTabelle('sarf-familie-5-tasaaala');
    const aktiv = (t.cells.aktiv.masdar as { ar: string }).ar;
    const passiv = (t.cells.passiv.masdar as { ar: string }).ar;
    expect(normalisiereOrthografieSkelett(aktiv)).toBe(normalisiereOrthografieSkelett(passiv));
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe gegen das Quranic Arabic Corpus, über die gemeinsame
// Hilfsfunktion normalisiereOrthografieSkelett/skelettImKorpusBelegt aus
// ../orthografieSkelett.ts. Datenquelle: apps/mobile/.daten-cache/out/
// morphologie/v<N> (aktuelle Schemaversion, siehe
// MORPHOLOGIE_SCHEMA_VERSION; per `node scripts/build-morphologie.mjs`
// erzeugt, gitignored). Fehlt der Cache, wird der Block übersprungen statt
// die Suite rot zu machen — siehe morphologieCachePfad.ts.
// ---------------------------------------------------------------------------

const MOBILE_DIR = join(__dirname, '..', '..', '..', '..');
const MORPHOLOGIE_DIR = morphologieCacheVerzeichnis(MOBILE_DIR);
const morphologieVorhanden = morphologieCacheVorhanden(MOBILE_DIR);

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

const KORPUS_SUITE_NAME = morphologieVorhanden
  ? 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus (über orthografieSkelett.ts)'
  : 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus (über orthografieSkelett.ts) — ÜBERSPRUNGEN (Cache fehlt, siehe console.warn unten)';

// Wurzel je Tabelle (im roots.json-Index üblicher Schreibung: Alif statt
// Hamza, wie im Korpus üblich). Tabellen, deren Formen strukturell nicht als
// Korpus-Substring auftreten können (nun-tawkid-thaqila-nasara-matrix druckt
// Pronomen+Verb als EINEN String mit Leerzeichen; ism-mawsul-raster ist
// bereits über paradigmen.test.ts/relativpronomen gegengeprüft; die beiden
// Diptot-/Indeklinabel-Spalten von ism-flexibilitaet-arten zeigen
// Eigennamen, die im Korpus nicht als dreiradikalige Wurzel geführt werden)
// sind hier bewusst NICHT aufgeführt — siehe jeweilige `notes` in der JSON.
const WURZELN: Record<string, string> = {
  'kaana-matrix': 'كون',
  'mudari-mansub-nasara-matrix': 'نصر',
  'mudari-majzum-nasara-matrix': 'نصر',
  'sarf-familie-1-allama': 'علم',
  'sarf-familie-2-jaadala': 'جدل',
  'sarf-familie-3-akhbara': 'خبر',
  'sarf-familie-4-taallama': 'علم',
  'sarf-familie-5-tasaaala': 'سال',
  'sarf-familie-6-inkasara': 'كسر',
  'sarf-familie-7-iqtaraba': 'قرب',
  'sarf-familie-8-istaghfara': 'غفر',
  'leichte-muslimun-maennlich': 'سلم',
  'leichte-muslimun-weiblich': 'سلم',
};

// Alle Listen unten wurden empirisch per Testlauf gegen den lokalen
// Morphologie-Cache ermittelt (Skript in LUECKEN.md
// dokumentiert), NICHT geraten: die jeweils NICHT gelisteten Formen sind im
// Korpus belegt (ggf. als Teilstring eines längeren Tokens).
const ERWARTETE_AUSNAHMEN: Record<string, Set<string>> = {
  // Nur die 2. Person Dual (كُنْتُمَا, für m. und f. identisch) kommt im
  // Qur'an für كان nicht in dieser exakten Form vor — alle neun übrigen
  // Formen sind belegt, obwohl كان "nur" ein hohles (Ajwaf) Verb ist.
  'kaana-matrix': new Set(['كُنْتُمَا']),
  // Dual- und die weibliche 2.-Person-Singular-Form des Konjunktivs/Jussivs
  // kommen für نصر im Qur'an nicht in dieser exakten Konjugation vor —
  // identisch zu den bereits in paradigmen-verben.test.ts dokumentierten
  // Lücken für dieselbe Wurzel.
  'mudari-mansub-nasara-matrix': new Set(['يَنْصُرُوْا', 'يَنْصُرَا', 'تَنْصُرَا', 'تَنْصُرِيْ']),
  'mudari-majzum-nasara-matrix': new Set(['يَنْصُرُوْا', 'يَنْصُرَا', 'تَنْصُرَا', 'تَنْصُرِيْ']),
  // Masdar (Form-II-typisch تَعْلِيمًا) und die verneinte Nahy-Form (لَا
  // davor macht sie zu einem längeren Token) sind für علم nicht exakt so
  // belegt — alle anderen sieben Formen (inkl. Passiv) doch.
  'sarf-familie-1-allama': new Set(['تَعْلِيمًا', 'لَا تُعَلِّمْ']),
  // Form III von جدل (mit Doppel-Masdar, Ism Fa'il/Maf'ul und verneintem
  // Nahy) ist in genau diesen Konjugationen nicht belegt; Madhi/Mudari
  // (Aktiv UND Passiv) dagegen schon.
  'sarf-familie-2-jaadala': new Set(['جِدَالًا ومُجَادَلَةً', 'مُجَادِلٌ', 'جُوْدِلَ', 'مُجَادَلٌ', 'لَا تُجَادِلْ']),
  // Wurzel خبر kommt im Qur'an 13-mal vor, aber ausschließlich als Nomen/
  // Adjektiv (خَبِيرًا, أَخْبَارَكُمْ u. Ä.) — keine einzige konjugierte
  // Form IV (أَخْبَرَ/يُخْبِرُ) ist belegt. Alle neun Zellen sind daher
  // Ausnahmen; das ist keine Fehlerquelle, sondern eine echte Lücke im
  // Korantext für diese Konjugation.
  'sarf-familie-3-akhbara': new Set([
    'أَخْبَرَ',
    'يُخْبِرُ',
    'إِخْبَارًا',
    'مُخْبِرٌ',
    'أُخْبِرَ',
    'يُخْبَرُ',
    'مُخْبَرٌ',
    'أَخْبِرْ',
    'لَا تُخْبِرْ',
  ]),
  // Form V von علم: Masdar, beide Ism-Formen (grammatisch ohnehin ohne
  // eigenständigen Sinn, siehe notes) und die verneinte Nahy-Form sind
  // nicht belegt.
  'sarf-familie-4-taallama': new Set(['تَعَلُّمًا', 'مُتَعَلِّمٌ', 'مُتَعَلَّمٌ', 'لَا تَتَعَلَّمْ']),
  // Form VI von سأل (im Index als سال geführt): beide Masdar-Schreibungen,
  // Ism Fa'il/Maf'ul, Passiv-Madhi und verneinte Nahy-Form sind nicht belegt.
  'sarf-familie-5-tasaaala': new Set(['تَسَاؤُلًا', 'مُتَسَائِلٌ', 'تُسُؤِلَ', 'تَسَائُلًا', 'مُتَسَاءَلٌ', 'لَا تَتَسَاءَلْ']),
  // Wurzel كسر kommt im Qur'an-Korpus GAR NICHT vor (roots.json kennt sie
  // nicht) — zwangsläufig sind alle sechs Formen Ausnahmen, keine Fehlerquelle.
  'sarf-familie-6-inkasara': new Set(['اِنْكَسَرَ', 'يَنْكَسِرُ', 'اِنْكِسَارًا', 'مُنْكَسِرٌ', 'اِنْكَسِرْ', 'لَا تَنْكَسِرْ']),
  // Form VIII von قرب: Mudari/Masdar/Ism (Aktiv UND Passiv) sowie die
  // verneinte Nahy-Form sind nicht belegt; Madhi (Aktiv+Passiv) und Amr doch.
  'sarf-familie-7-iqtaraba': new Set(['يَقْتَرِبُ', 'اِقْتِرَابًا', 'مُقْتَرِبٌ', 'يُقْتَرَبُ', 'مُقْتَرَبٌ', 'لَا تَقْتَرِبْ']),
  // Form X von غفر: nur der Masdar und die verneinte Nahy-Form sind nicht
  // belegt — alle Madhi/Mudari/Ism-Formen (Aktiv UND Passiv) sowie Amr doch.
  'sarf-familie-8-istaghfara': new Set(['اِسْتِغْفَارًا', 'لَا تَسْتَغْفِرْ']),
  // Leichte Form, männlich: ALLE neun Formen sind im Korpus belegt (keine
  // Ausnahme) — die leere Menge ist hier ein positiver Befund, kein Fehler.
  'leichte-muslimun-maennlich': new Set(),
  // Leichte Form, weiblich: nur die beiden Dual-Formen sind nicht belegt
  // (Dual ist im Qur'an grundsätzlich selten) — Singular UND Plural (in
  // allen drei Status) sind es.
  'leichte-muslimun-weiblich': new Set(['مُسْلِمَتَا', 'مُسْلِمَتَيْ']),
};

(morphologieVorhanden ? describe : describe.skip)(KORPUS_SUITE_NAME, () => {
  function pruefeTabelle(id: string) {
    const wurzel = WURZELN[id];
    const formenSet = morphologieVorhanden ? ladeWortformenFuerWurzel(wurzel) : new Set<string>();
    const skelette = [...formenSet].map(normalisiereOrthografieSkelett);
    const t = findeTabelle(id);
    const formen = alleZellen(t)
      .filter((z) => z.zelle !== null)
      .map((z) => (z.zelle as { ar: string }).ar);
    const tatsaechlicheAusnahmen = formen.filter((f) => !skelettImKorpusBelegt(f, skelette));
    expect(new Set(tatsaechlicheAusnahmen)).toEqual(ERWARTETE_AUSNAHMEN[id]);
  }

  it('findet für die Wurzel نصر überhaupt Belegformen im Korpus (Selbstkontrolle)', () => {
    expect(ladeWortformenFuerWurzel('نصر').size).toBeGreaterThan(20);
  });

  it('findet für die Wurzel كون (كان) überhaupt Belegformen im Korpus (Selbstkontrolle)', () => {
    expect(ladeWortformenFuerWurzel('كون').size).toBeGreaterThan(20);
  });

  it('findet für die Wurzel كسر GAR KEINE Belegformen im Korpus (Selbstkontrolle für die dokumentierte Lücke)', () => {
    expect(ladeWortformenFuerWurzel('كسر').size).toBe(0);
  });

  for (const id of Object.keys(WURZELN)) {
    it(`${id}: jede Form außer der dokumentierten Ausnahmeliste ist im Korpus (Wurzel ${WURZELN[id]}) belegt`, () => {
      pruefeTabelle(id);
    });
  }
});

// ---------------------------------------------------------------------------
// ism-plural-muster-unregelmaessig: eigener Gegenprobe-Block, weil jede
// Zeile eine ANDERE Wurzel prüft (sechs verschiedene Plural-Muster-Beispiele)
// statt einer gemeinsamen Wurzel für die ganze Tabelle.
// ---------------------------------------------------------------------------

const PLURAL_MUSTER_WURZELN: Record<string, string> = {
  'fuul-qalb': 'قلب',
  'fial-jabal': 'جبل',
  'afal-bab': 'بوب',
  'fuul2-rasul': 'رسل',
  'fualaa-shahid': 'شهد',
  'afilaa-nabi': 'نبا',
};

// Je Zeile ist nur die Muster-Zelle selbst (z. B. فُعُولٌ) eine Ausnahme —
// sie ist eine abstrakte Wazn-Vorlage, kein tatsächlich im Qur'an
// vorkommendes Wort. Singular UND Plural sind in JEDER Zeile belegt.
const PLURAL_MUSTER_AUSNAHMEN: Record<string, Set<string>> = {
  'fuul-qalb': new Set(['فُعُولٌ']),
  'fial-jabal': new Set(['فِعَالٌ']),
  'afal-bab': new Set(['أَفْعَالٌ']),
  'fuul2-rasul': new Set(['فُعُلٌ']),
  'fualaa-shahid': new Set(['فُعَلَاءُ']),
  'afilaa-nabi': new Set(['أَفْعِلَاءُ']),
};

(morphologieVorhanden ? describe : describe.skip)(
  morphologieVorhanden
    ? 'Korpus-Gegenprobe: ism-plural-muster-unregelmaessig (je Zeile eine eigene Wurzel)'
    : 'Korpus-Gegenprobe: ism-plural-muster-unregelmaessig — ÜBERSPRUNGEN (Cache fehlt)',
  () => {
    const t = findeTabelle('ism-plural-muster-unregelmaessig');

    for (const rowId of Object.keys(PLURAL_MUSTER_WURZELN)) {
      it(`Zeile ${rowId}: Singular und Plural sind belegt, nur das Muster selbst ist Ausnahme (Wurzel ${PLURAL_MUSTER_WURZELN[rowId]})`, () => {
        const wurzel = PLURAL_MUSTER_WURZELN[rowId];
        const formenSet = ladeWortformenFuerWurzel(wurzel);
        const skelette = [...formenSet].map(normalisiereOrthografieSkelett);
        const formen = Object.values(t.cells[rowId])
          .filter((z): z is { ar: string; de: string } => z !== null)
          .map((z) => z.ar);
        const ausnahmen = formen.filter((f) => !skelettImKorpusBelegt(f, skelette));
        expect(new Set(ausnahmen)).toEqual(PLURAL_MUSTER_AUSNAHMEN[rowId]);
      });
    }
  },
);

// ---------------------------------------------------------------------------
// ism-flexibilitaet-arten: nur die Spalte "voll-flexibel" (مُسْلِمٌ-Formen)
// ist über eine dreiradikalige Wurzel (سلم) gegenprüfbar — "Halb-Flexibel"
// (إِبْرَاهِيمُ) und "Nicht-Flexibel" (مُوسَى) sind Eigennamen, die im
// roots.json-Index nicht als Wurzel geführt werden.
// ---------------------------------------------------------------------------

(morphologieVorhanden ? describe : describe.skip)(
  morphologieVorhanden
    ? 'Korpus-Gegenprobe: ism-flexibilitaet-arten (nur Spalte voll-flexibel, Wurzel سلم)'
    : 'Korpus-Gegenprobe: ism-flexibilitaet-arten — ÜBERSPRUNGEN (Cache fehlt)',
  () => {
    it('alle drei Status-Formen von مُسْلِمٌ (Raf/Nasb/Jarr) sind im Korpus belegt', () => {
      const t = findeTabelle('ism-flexibilitaet-arten');
      const formenSet = ladeWortformenFuerWurzel('سلم');
      const skelette = [...formenSet].map(normalisiereOrthografieSkelett);
      for (const rowId of ['raf', 'nasb', 'jarr']) {
        const form = (t.cells[rowId]['voll-flexibel'] as { ar: string }).ar;
        expect(skelettImKorpusBelegt(form, skelette)).toBe(true);
      }
    });
  },
);

if (!morphologieVorhanden) {
  // eslint-disable-next-line no-console
  console.warn(
    `Korpus-Gegenprobe übersprungen: ${MORPHOLOGIE_DIR} fehlt. ` +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
