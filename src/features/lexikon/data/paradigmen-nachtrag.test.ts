import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import { normalisiereOrthografieSkelett, skelettImKorpusBelegt } from '../orthografieSkelett';
import paradigmenNachtragRoh from './paradigmen-nachtrag.json';

/**
 * Gegenprobe für paradigmen-nachtrag.json — schließt die beiden letzten
 * konkret identifizierten Lücken außerhalb Kapitel 8 (H-16 "Freie Pronomen,
 * Nasb-Status" und H-25 "Zeigewörter im Dual, alle drei Status", siehe
 * LUECKEN.md) sowie zwei beim Durchgehen der ungeprüften Reintext-Fragmente
 * als echte Bab-Tabellen erkannte Verbparadigmen der "Kleinen Familie"
 * (Kapitel 5.3, H-51/H-52: نَصَرَ als Referenzverb, كَرُمَ als einzige
 * Ausnahme-Untergruppe ohne Passiv).
 *
 * Gleiches Prinzip wie paradigmen-weitere.test.ts: jede arabische Form muss
 * zeichengenau aus dem gerenderten Seitenbild stammen; Struktur UND (wo
 * sinnvoll) Korpus-Gegenprobe werden geprüft.
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

const paradigmenNachtrag = paradigmenNachtragRoh as unknown as ParadigmenDatei;

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
  const t = paradigmenNachtrag.tables.find((x) => x.id === id);
  if (!t) throw new Error(`Tabelle ${id} fehlt in paradigmen-nachtrag.json`);
  return t;
}

describe('paradigmen-nachtrag.json — Struktur', () => {
  it('hat Schema 1 und genau 4 Tabellen', () => {
    expect(paradigmenNachtrag.schema).toBe(1);
    expect(paradigmenNachtrag.tables.length).toBe(4);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmenNachtrag.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte/Zeile und eine gültige Quelle', () => {
    for (const t of paradigmenNachtrag.tables) {
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
    for (const t of paradigmenNachtrag.tables) {
      expect(new Set(t.rows.map((r) => r.id)).size).toBe(t.rows.length);
      expect(new Set(t.columns.map((c) => c.id)).size).toBe(t.columns.length);
    }
  });

  it('jede in cells referenzierte Zeilen-/Spalten-ID existiert wirklich (kein Verweis ins Leere)', () => {
    for (const t of paradigmenNachtrag.tables) {
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

describe('paradigmen-nachtrag.json — arabische Formen', () => {
  for (const t of paradigmenNachtrag.tables) {
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
// freie-pronomen-nasb-status (H-16): 5×3-Raster wie die Verb-Personenmatrizen
// (Spalten plural/dual/singular, Zeilen 3-m/3-f/2-m/2-f/1, 1. Person ohne
// Dual) — im Original identisch abgedruckt.
// ---------------------------------------------------------------------------

const ERWARTETE_ZEILEN_REIHENFOLGE = ['3-m', '3-f', '2-m', '2-f', '1'];
const ERWARTETE_SPALTEN_REIHENFOLGE = ['plural', 'dual', 'singular'];

describe('paradigmen-nachtrag.json — freie-pronomen-nasb-status (H-16)', () => {
  const t = findeTabelle('freie-pronomen-nasb-status');

  it('hat genau 5 Zeilen in der Reihenfolge 3-m, 3-f, 2-m, 2-f, 1 und 3 Spalten plural, dual, singular', () => {
    expect(t.rows.map((r) => r.id)).toEqual(ERWARTETE_ZEILEN_REIHENFOLGE);
    expect(t.columns.map((c) => c.id)).toEqual(ERWARTETE_SPALTEN_REIHENFOLGE);
  });

  it('1. Person hat keinen Dual (Zelle "1"/"dual" ist null)', () => {
    expect(t.cells['1'].dual).toBeNull();
  });

  it('jede Form beginnt mit dem Träger إِيَّا (Akkusativ-Betonungsform)', () => {
    for (const { zelle } of alleZellen(t).filter((z) => z.zelle !== null) as { zelle: { ar: string } }[]) {
      expect(zelle.ar.startsWith('إِيَّا')).toBe(true);
    }
  });

  it('2. Person Dual ist für maskulin und feminin identisch (إِيَّاكُمَا) — wie bei allen bisherigen Personenmatrizen', () => {
    expect((t.cells['2-m'].dual as { ar: string }).ar).toBe('إِيَّاكُمَا');
    expect((t.cells['2-f'].dual as { ar: string }).ar).toBe((t.cells['2-m'].dual as { ar: string }).ar);
  });

  it('3. Person Dual ist für maskulin und feminin identisch (إِيَّاهُمَا)', () => {
    expect((t.cells['3-m'].dual as { ar: string }).ar).toBe('إِيَّاهُمَا');
    expect((t.cells['3-f'].dual as { ar: string }).ar).toBe((t.cells['3-m'].dual as { ar: string }).ar);
  });
});

// ---------------------------------------------------------------------------
// zeigewoerter-dual-status (H-25): 3×4-Raster (Status × Nah/Fern × m/f).
// Nasb und Jarr sind im Dual grammatisch identisch.
// ---------------------------------------------------------------------------

describe('paradigmen-nachtrag.json — zeigewoerter-dual-status (H-25)', () => {
  const t = findeTabelle('zeigewoerter-dual-status');

  it('hat genau die Zeilen raf, nasb, jarr und Spalten nah-m, nah-f, fern-m, fern-f', () => {
    expect(t.rows.map((r) => r.id)).toEqual(['raf', 'nasb', 'jarr']);
    expect(t.columns.map((c) => c.id)).toEqual(['nah-m', 'nah-f', 'fern-m', 'fern-f']);
  });

  it('Nasb und Jarr sind für alle vier Spalten zeichengleich (Dual kennt nur zwei Statusformen)', () => {
    for (const colId of ['nah-m', 'nah-f', 'fern-m', 'fern-f']) {
      expect((t.cells.nasb[colId] as { ar: string }).ar).toBe((t.cells.jarr[colId] as { ar: string }).ar);
    }
  });

  it('Raf\' unterscheidet sich von Nasb/Jarr in jeder Spalte (kein genereller Kollaps)', () => {
    for (const colId of ['nah-m', 'nah-f', 'fern-m', 'fern-f']) {
      expect((t.cells.raf[colId] as { ar: string }).ar).not.toBe((t.cells.nasb[colId] as { ar: string }).ar);
    }
  });

  it('Raf\'-Zeile ist zeichengenau هَذَانِ/هَتَانِ/ذَانِكَ/تَانِكَ (ohne Dagger-Alif, anders als die Raf\'-Dual-Formen in "hinweiswoerter")', () => {
    expect((t.cells.raf['nah-m'] as { ar: string }).ar).toBe('هَذَانِ');
    expect((t.cells.raf['nah-f'] as { ar: string }).ar).toBe('هَتَانِ');
    expect((t.cells.raf['fern-m'] as { ar: string }).ar).toBe('ذَانِكَ');
    expect((t.cells.raf['fern-f'] as { ar: string }).ar).toBe('تَانِكَ');
  });
});

// ---------------------------------------------------------------------------
// kleine-familie-nasara / kleine-familie-karama (H-51/H-52): dasselbe
// 3×4-Bab-Raster (madhi/mudari/masdar/ism) wie die Bab-Tabellen in
// paradigmen-verben.json/paradigmen-weitere.json — kāma hat KEINE
// passiv-Zeile (laut Fließtext im Original ausdrücklich ohne Passiv).
// ---------------------------------------------------------------------------

const BAB_SPALTEN_REIHENFOLGE = ['madhi', 'mudari', 'masdar', 'ism'];

describe('paradigmen-nachtrag.json — kleine-familie-nasara (H-51)', () => {
  const t = findeTabelle('kleine-familie-nasara');

  it('hat die Spalten madhi, mudari, masdar, ism und Zeilen aktiv, passiv, imperativ', () => {
    expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
    expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'passiv', 'imperativ']);
  });

  it('aktiv und passiv sind vollständig befüllt (madhi/mudari/masdar/ism)', () => {
    for (const rowId of ['aktiv', 'passiv']) {
      for (const colId of BAB_SPALTEN_REIHENFOLGE) {
        expect(t.cells[rowId][colId]).not.toBeNull();
      }
    }
  });

  it('imperativ hat KEINE masdar-Zelle (wie bei allen übrigen Bab-Tabellen dieses Bestands)', () => {
    expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'masdar')).toBe(false);
    expect(t.cells.imperativ.madhi).not.toBeNull();
    expect(t.cells.imperativ.mudari).not.toBeNull();
    expect(t.cells.imperativ.ism).not.toBeNull();
  });

  it('Aktiv- und Passiv-Masdar sind identisch (نَصْرًا, wiederverwendet)', () => {
    expect((t.cells.aktiv.masdar as { ar: string }).ar).toBe('نَصْرًا');
    expect((t.cells.passiv.masdar as { ar: string }).ar).toBe((t.cells.aktiv.masdar as { ar: string }).ar);
  });

  it('Ism Fa\'il (ناصِرٌ) und Ism Maf\'ul (مَنْصُورٌ) unterscheiden sich', () => {
    expect((t.cells.aktiv.ism as { ar: string }).ar).toBe('نَاصِرٌ');
    expect((t.cells.passiv.ism as { ar: string }).ar).toBe('مَنْصُورٌ');
  });

  it('Imperativ-Ism ist eine aus drei Wörtern zusammengesetzte Ableitung (Ism Makan/Zaman, keiner der Waw-Verbinder trägt hier eine Fatha)', () => {
    expect((t.cells.imperativ.ism as { ar: string }).ar).toBe('مَنْصِرٌ ومَنْصَرٌ ومَنْصَرَةٌ');
  });
});

describe('paradigmen-nachtrag.json — kleine-familie-karama (H-52)', () => {
  const t = findeTabelle('kleine-familie-karama');

  it('hat die Spalten madhi, mudari, masdar, ism, aber NUR die Zeilen aktiv und imperativ (keine passiv-Zeile)', () => {
    expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
    expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'imperativ']);
    expect(Object.prototype.hasOwnProperty.call(t.cells, 'passiv')).toBe(false);
  });

  it('aktiv ist vollständig befüllt, imperativ ohne masdar-Zelle', () => {
    for (const colId of BAB_SPALTEN_REIHENFOLGE) {
      expect(t.cells.aktiv[colId]).not.toBeNull();
    }
    expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'masdar')).toBe(false);
  });

  it('Ism Fa\'il folgt dem unregelmäßigen فَعِيل-Muster (كَرِيْمٌ), nicht dem فَاعِل-Muster von نَصَرَ', () => {
    expect((t.cells.aktiv.ism as { ar: string }).ar).toBe('كَرِيْمٌ');
  });

  it('Imperativ-Ism ist wie bei kleine-familie-nasara eine Drei-Wort-Ableitung — der ERSTE Waw-Verbinder trägt hier abweichend eine Fatha (وَ), der zweite nicht', () => {
    const ism = (t.cells.imperativ.ism as { ar: string }).ar;
    expect(ism).toBe('مَكْرِمٌ وَمَكْرَمٌ ومَكْرَمَةٌ');
    // Regressionsschutz gegen versehentliches Angleichen an die
    // strukturell parallele Zelle in kleine-familie-nasara.
    const nasara = findeTabelle('kleine-familie-nasara');
    expect(ism).not.toBe((nasara.cells.imperativ.ism as { ar: string }).ar);
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe gegen das Quranic Arabic Corpus, über die gemeinsame
// Hilfsfunktion normalisiereOrthografieSkelett/skelettImKorpusBelegt aus
// ../orthografieSkelett.ts. NUR für die beiden Verb-Bab-Tabellen (نصر/كرم
// haben dreiradikalige Wurzeln) — freie-pronomen-nasb-status und
// zeigewoerter-dual-status sind Funktionswörter ohne Wurzel und werden
// ebenso wie 'pronomen-frei'/'hinweiswoerter' in paradigmen.test.ts nicht
// gegen das Korpus geprüft (siehe deren `notes`).
//
// Datenquelle: apps/mobile/.daten-cache/out/morphologie/v<N> (aktuelle
// Schemaversion, siehe MORPHOLOGIE_SCHEMA_VERSION; per `node
// scripts/build-morphologie.mjs` erzeugt, gitignored). Fehlt der Cache, wird
// der Block übersprungen statt die Suite rot zu machen.
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

const WURZELN: Record<string, string> = {
  'kleine-familie-nasara': 'نصر',
  'kleine-familie-karama': 'كرم',
};

// Empirisch per Testlauf gegen den lokalen Morphologie-Cache ermittelt
// (nicht geraten): die jeweils NICHT gelisteten Formen sind im Korpus belegt
// (ggf. als Teilstring eines längeren Tokens).
const ERWARTETE_AUSNAHMEN: Record<string, Set<string>> = {
  // Nur die verneinte Nahy-Form (لَا davor macht sie zu einem längeren Token,
  // wie bei jeder anderen Bab-Tabelle dieses Bestands) und die
  // zusammengesetzte Drei-Wort-Ism-Ableitung (kein einzelnes Korpus-Token)
  // sind für نصر nicht als Substring belegt — Madhi/Mudari/Masdar/Ism sind
  // es sowohl aktiv als auch passiv, ebenso der Amr.
  'kleine-familie-nasara': new Set(['لَا تَنْصُرْ', 'مَنْصِرٌ ومَنْصَرٌ ومَنْصَرَةٌ']),
  // Wurzel كرم kommt im Qur'an-Korpus fast ausschließlich in Form II/IV
  // (كَرَّمْنَا/أَكْرَمَكُمْ) sowie als Adjektiv كَرِيم vor — das einfache
  // Form-I-Mudari (يَكْرُمُ) und sein Masdar (كَرَامَةً) sind dort nicht
  // belegt; dazu wie bei نصر die verneinte Nahy-Form und die zusammengesetzte
  // Ism-Ableitung.
  'kleine-familie-karama': new Set(['يَكْرُمُ', 'كَرَامَةً', 'لَا تَكْرُمْ', 'مَكْرِمٌ وَمَكْرَمٌ ومَكْرَمَةٌ']),
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

  it('findet für die Wurzel كرم überhaupt Belegformen im Korpus (Selbstkontrolle)', () => {
    expect(ladeWortformenFuerWurzel('كرم').size).toBeGreaterThan(10);
  });

  for (const id of Object.keys(WURZELN)) {
    it(`${id}: jede Form außer der dokumentierten Ausnahmeliste ist im Korpus (Wurzel ${WURZELN[id]}) belegt`, () => {
      pruefeTabelle(id);
    });
  }
});

if (!morphologieVorhanden) {
  // eslint-disable-next-line no-console
  console.warn(
    `Korpus-Gegenprobe übersprungen: ${MORPHOLOGIE_DIR} fehlt. ` +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
