import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import paradigmenVerbenRoh from './paradigmen-verben.json';

/**
 * Gegenprobe für die Verb-Personenmatrizen und Bab-Tabellen aus handout.pdf.
 *
 * Warum das nötig ist: jede arabische Form hier muss zeichengenau aus einer
 * maschinellen Quelle stammen (gerendertes Seitenbild von handout.pdf) —
 * kein Vokalzeichen darf von Hand „aus dem Gedächtnis" ergänzt sein. Diese
 * Datei prüft das strukturell (jede Zelle zeigt auf eine echte Zeile/Spalte,
 * jede Form ist vokalisiertes Arabisch), stellt das vom Handout verlangte
 * 5×3-Raster (Person × Plural/Dual/Singular) für die sechs Personenmatrizen
 * fest UND prüft inhaltlich gegen das Quranic-Arabic-Corpus.
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

const paradigmenVerben = paradigmenVerbenRoh as unknown as ParadigmenDatei;

const ARABISCH = /[؀-ۿ]/;
const LATEINISCH = /[A-Za-z]/;
const HARAKAT = /[ً-ْ]/;

// Die sechs Personenmatrizen, die laut Handout (Abbildung 29 u.a., S. 64)
// exakt dem Raster "5 Zeilen (Person) × 3 Spalten (Plural/Dual/Singular)"
// folgen müssen.
const PERSONENMATRIZEN = [
  'verb-madi-nasara-aktiv-matrix',
  'verb-mudari-nasara-aktiv-matrix',
  'verb-madi-nasara-passiv-matrix',
  'verb-mudari-nasara-passiv-matrix',
  'amr-nasara-matrix',
  'nahy-nasara-matrix',
];

const ERWARTETE_ZEILEN_REIHENFOLGE = ['3-m', '3-f', '2-m', '2-f', '1'];
const ERWARTETE_SPALTEN_REIHENFOLGE = ['plural', 'dual', 'singular'];

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
  const t = paradigmenVerben.tables.find((x) => x.id === id);
  if (!t) throw new Error(`Tabelle ${id} fehlt in paradigmen-verben.json`);
  return t;
}

describe('paradigmen-verben.json — Struktur', () => {
  it('hat Schema 1 und mindestens 8 Tabellen', () => {
    expect(paradigmenVerben.schema).toBe(1);
    expect(paradigmenVerben.tables.length).toBeGreaterThanOrEqual(8);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmenVerben.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte und eine Zeile', () => {
    for (const t of paradigmenVerben.tables) {
      expect(t.id).toBeTruthy();
      expect(t.titleDe).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.file).toBeTruthy();
      expect(t.source?.page).toBeGreaterThan(0);
    }
  });

  it('Zeilen- und Spalten-IDs sind je Tabelle eindeutig', () => {
    for (const t of paradigmenVerben.tables) {
      expect(new Set(t.rows.map((r) => r.id)).size).toBe(t.rows.length);
      expect(new Set(t.columns.map((c) => c.id)).size).toBe(t.columns.length);
    }
  });

  it('jede in cells referenzierte Zeilen-/Spalten-ID existiert wirklich (kein Verweis ins Leere)', () => {
    for (const t of paradigmenVerben.tables) {
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

describe('paradigmen-verben.json — arabische Formen', () => {
  // Aus fehlenden Zellen (Amr/Nahy: nur 2. Person; 1. Person: kein Dual)
  // folgt kein Harakat-Verstoß, weil es dafür schlicht keine `ar`-Zelle
  // gibt — hier geht es nur um vorhandene Zellen.
  for (const t of paradigmenVerben.tables) {
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
// Handout-Raster: Die sechs Personenmatrizen müssen exakt das Raster aus
// handout.pdf S. 64 (Abbildung 29: "Tabelle für passive Verben in der
// Vergangenheit") abbilden — Spalten Plural|Dual|Singular|Person (Person als
// Zeilenbeschriftung, RTL rechts), Zeilen 3.m/3.f/2.m/2.f/1. in dieser
// Reihenfolge. Dieser Test nagelt das fest, damit ein künftiger Umbau nicht
// versehentlich wieder auf eine flache Liste zurückfällt.
// ---------------------------------------------------------------------------

describe('paradigmen-verben.json — Handout-Raster der sechs Personenmatrizen', () => {
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
  }

  it('1. Person hat in allen sechs Matrizen keinen Dual (Zelle "1"/"dual" ist null) — mit Begründung in notes', () => {
    for (const id of PERSONENMATRIZEN) {
      const t = findeTabelle(id);
      expect(t.cells['1'].dual).toBeNull();
      // Bei den vier Verbmatrizen (Madi/Mudari, Aktiv/Passiv) gibt es eine
      // eigene Begründung, warum NUR der Dual der 1. Person fehlt. Bei Amr/
      // Nahy ist die ganze Zeile "1" null (Imperativ/Verbot kennt nur die
      // 2. Person) — dort steht die Begründung in der allgemeineren Notiz.
      const hatSpezifischeBegruendung = (t.notes ?? []).some((n) => n.includes('1. Person') && n.includes('Dual'));
      const hatAllgemeineBegruendung = (t.notes ?? []).some((n) => n.includes('"1"') && n.toLowerCase().includes('null'));
      expect(hatSpezifischeBegruendung || hatAllgemeineBegruendung).toBe(true);
    }
  });

  it('Amr und Nahy: 3. Person und 1. Person sind vollständig null (Imperativ/Verbot kennt nur die 2. Person)', () => {
    for (const id of ['amr-nasara-matrix', 'nahy-nasara-matrix']) {
      const t = findeTabelle(id);
      for (const rowId of ['3-m', '3-f', '1']) {
        for (const colId of ERWARTETE_SPALTEN_REIHENFOLGE) {
          expect(t.cells[rowId][colId]).toBeNull();
        }
      }
      // 2. Person ist dagegen vollständig befüllt.
      for (const rowId of ['2-m', '2-f']) {
        for (const colId of ERWARTETE_SPALTEN_REIHENFOLGE) {
          expect(t.cells[rowId][colId]).not.toBeNull();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Regressionsschutz gegen versehentliches Duplizieren beim Umbau: Aktiv- und
// Passiv-Vergangenheitsmatrix dürfen sich in KEINER Zelle gleichen (Aktiv:
// نَصَرَ-Formen mit Fatha auf dem 1. Radikal, Passiv: نُصِرَ-Formen mit
// Damma/Kasra).
// ---------------------------------------------------------------------------

describe('paradigmen-verben.json — Regressionsschutz: Aktiv ≠ Passiv (Vergangenheit)', () => {
  it('jede Zelle von verb-madi-nasara-aktiv-matrix unterscheidet sich von der entsprechenden Zelle in verb-madi-nasara-passiv-matrix', () => {
    const aktiv = findeTabelle('verb-madi-nasara-aktiv-matrix');
    const passiv = findeTabelle('verb-madi-nasara-passiv-matrix');
    let verglichen = 0;
    for (const rowId of ERWARTETE_ZEILEN_REIHENFOLGE) {
      for (const colId of ERWARTETE_SPALTEN_REIHENFOLGE) {
        const a = aktiv.cells[rowId][colId];
        const p = passiv.cells[rowId][colId];
        if (a === null && p === null) continue; // beide leer (1/dual) — kein Duplikat-Risiko
        verglichen++;
        expect(a).not.toBeNull();
        expect(p).not.toBeNull();
        expect((a as { ar: string }).ar).not.toBe((p as { ar: string }).ar);
      }
    }
    expect(verglichen).toBe(14); // 15 Zellen minus die gemeinsame 1/dual-Lücke
  });

  it('jede Zelle von verb-mudari-nasara-aktiv-matrix unterscheidet sich von der entsprechenden Zelle in verb-mudari-nasara-passiv-matrix', () => {
    const aktiv = findeTabelle('verb-mudari-nasara-aktiv-matrix');
    const passiv = findeTabelle('verb-mudari-nasara-passiv-matrix');
    let verglichen = 0;
    for (const rowId of ERWARTETE_ZEILEN_REIHENFOLGE) {
      for (const colId of ERWARTETE_SPALTEN_REIHENFOLGE) {
        const a = aktiv.cells[rowId][colId];
        const p = passiv.cells[rowId][colId];
        if (a === null && p === null) continue;
        verglichen++;
        expect(a).not.toBeNull();
        expect(p).not.toBeNull();
        expect((a as { ar: string }).ar).not.toBe((p as { ar: string }).ar);
      }
    }
    expect(verglichen).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe: نصر (Verbparadigma) gegen das Quranic Arabic Corpus.
// Datenquelle: apps/mobile/.daten-cache/out/morphologie/*.json (per
// `node scripts/build-morphologie.mjs` erzeugt, siehe paradigmen.test.ts für
// dieselbe Infrastruktur). Diese Dateien liegen NICHT im Git; fehlt der
// Cache, wird der Block übersprungen statt die Suite rot zu machen.
// ---------------------------------------------------------------------------

// Pfad-Ermittlung über den gemeinsamen Helfer (morphologieCachePfad.ts) statt
// einer eigenen Kopie — siehe Kopf-Kommentar dort: eine lokale Kopie dieses
// Pfades war genau die Ursache, warum diese Gegenprobe nach dem Sprung auf
// den versionierten Cache (v2) still übersprungen wurde, ohne dass es auffiel.
const MOBILE_DIR = join(__dirname, '..', '..', '..', '..');
const MORPHOLOGIE_DIR = morphologieCacheVerzeichnis(MOBILE_DIR);

function normalisiereSkelett(text: string): string {
  return text
    .replace(/ٱ/g, 'ا') // Alif wasla -> Alif (Quranische vs. moderne Orthographie)
    .replace(/ٰ/g, 'ا') // Dagger-Alif -> Alif (dieselbe Lautung, andere Schreibung)
    .replace(/[ً-ْٓ-ٕۖ-ۭـ]/g, ''); // restliche Harakat/Tatweel
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

const morphologieVorhanden = morphologieCacheVorhanden(MOBILE_DIR);
// Sprechender Name im Skip-Fall: ein describe.skip mit demselben Namen wie im
// Erfolgsfall sieht in der CI-Ausgabe wie eine harmlos leere Suite aus, nicht
// wie ein unbeprüfter Block — siehe morphologieCachePfad.ts.
const KORPUS_SUITE_NAME = morphologieVorhanden
  ? 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus'
  : 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus — ÜBERSPRUNGEN (Cache fehlt, siehe console.warn unten)';

(morphologieVorhanden ? describe : describe.skip)(KORPUS_SUITE_NAME, () => {
  // Nur bei vorhandenem Cache lesen: eine describe.skip-Hülle allein schützt
  // NICHT davor, dass Jest den describe-Rumpf trotzdem ausführt (nur die
  // einzelnen `it`s werden übersprungen) — ein unbedingter Aufruf hier würde
  // bei fehlendem Cache mit ENOENT abstürzen statt zu überspringen.
  const nasrFormen = morphologieVorhanden ? ladeWortformenFuerWurzel('نصر') : new Set<string>();
  const nasrSkelette = [...nasrFormen].map(normalisiereSkelett);

  it('findet für die Wurzel نصر überhaupt Belegformen im Korpus (Selbstkontrolle)', () => {
    expect(nasrFormen.size).toBeGreaterThan(20);
  });

  // Formen, die im Koran für نصر in dieser exakten Konjugation nicht belegt
  // sind — kein Fehler, sondern eine dokumentierte Abweichung (2. Person
  // und 1. Person sowie einige Dual-Formen kommen für نصر im Korantext
  // schlicht nicht in dieser Weise vor; identisch mit den bereits in
  // paradigmen.test.ts dokumentierten Ausnahmen für dieselbe Wurzel, nur
  // hier auf die zusätzlichen Dual-/Passiv-/Amr-/Nahy-Formen erweitert).
  const ERWARTETE_AUSNAHMEN: Record<string, Set<string>> = {
    // Alle folgenden Listen wurden empirisch per Testlauf gegen
    // .daten-cache/out/morphologie ermittelt, nicht geraten: die jeweils
    // NICHT gelisteten Formen sind (ggf. skelettgleich) im Korpus belegt.
    'verb-madi-nasara-aktiv-matrix': new Set([
      'نَصَرَتْ',
      'نَصَرَتَا',
      'نَصَرْتَ',
      'نَصَرْتُمَا',
      'نَصَرْتُمْ',
      'نَصَرْتِ',
      'نَصَرْتُنَّ',
      'نَصَرْتُ',
    ]),
    'verb-mudari-nasara-aktiv-matrix': new Set(['أَنْصُرُ', 'تَنْصُرَانِ', 'تَنْصُرِينَ', 'يَنْصُرَانِ']),
    'verb-madi-nasara-passiv-matrix': new Set([
      'نُصِرَتَا',
      'نُصِرَتْ',
      'نُصِرْتَ',
      'نُصِرْتُ',
      'نُصِرْتُمَا',
      'نُصِرْتُمْ',
      'نُصِرْتُنَّ',
      'نُصِرْتِ',
    ]),
    'verb-mudari-nasara-passiv-matrix': new Set(['أُنْصَرُ', 'تُنْصَرَانِ', 'تُنْصَرِينَ', 'يُنْصَرَانِ']),
    'amr-nasara-matrix': new Set(['اُنْصُرَا', 'اُنْصُرِي']),
    'nahy-nasara-matrix': new Set(['لَا تَنْصُرْ', 'لَا تَنْصُرِي', 'لَا تَنْصُرَا', 'لَا تَنْصُرُوا', 'لَا تَنْصُرْنَ']),
  };

  function pruefeTabelle(id: string) {
    const t = findeTabelle(id);
    const formen = alleZellen(t)
      .filter((z) => z.zelle !== null)
      .map((z) => (z.zelle as { ar: string }).ar);
    const tatsaechlicheAusnahmen = formen.filter((f) => !imKorpusBelegt(f, nasrFormen, nasrSkelette));
    expect(new Set(tatsaechlicheAusnahmen)).toEqual(ERWARTETE_AUSNAHMEN[id]);
  }

  for (const id of PERSONENMATRIZEN) {
    it(`${id}: jede Form außer der dokumentierten Ausnahmeliste ist im Korpus belegt`, () => {
      pruefeTabelle(id);
    });
  }
});

// ---------------------------------------------------------------------------
// Bab-Tabellen (Kapitel 8): Struktur- und Korpus-Gegenprobe.
//
// Alle Bab-Tabellen (Form I bis X, Mahmooz) folgen im Original demselben
// 3×5-Raster ohne gedruckte Kopfzeile (siehe Notes in paradigmen-verben.json):
// Zeilen aktiv/passiv/imperativ, Spalten madhi/mudari/masdar/ism (die
// gedruckte, aber inhaltsleere "fahuwa"-Spalte wird nicht übernommen).
// ---------------------------------------------------------------------------

const BAB_TABELLEN = [
  'bab-fataha-mahmooz-qaraa',
  'bab-samia-mahmooz-amina',
  'bab-daraba-mahmooz-abaqa',
  'bab-nasara-mahmooz-akala',
  'bab-tafil2-mahmooz-ajjara',
  'bab-mufaala3-mahmooz-aakhadha',
  'bab-ifal4-mahmooz-aamana',
  'bab-tafaul5-mahmooz-taammala',
  'bab-tafaul6-mahmooz-taamara',
  'bab-iftial8-mahmooz-itamara',
  'bab-istifal10-mahmooz-istajara',
];

const BAB_SPALTEN_REIHENFOLGE = ['madhi', 'mudari', 'masdar', 'ism'];
const BAB_ZEILEN_REIHENFOLGE = ['aktiv', 'passiv', 'imperativ'];

describe('paradigmen-verben.json — Bab-Tabellen (Kapitel 8): einheitliches 3×5-Raster', () => {
  for (const id of BAB_TABELLEN) {
    const t = findeTabelle(id);

    it(`${id}: hat genau die Spalten madhi, mudari, masdar, ism`, () => {
      expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
    });

    it(`${id}: hat genau die Zeilen aktiv, passiv, imperativ`, () => {
      expect(t.rows.map((r) => r.id)).toEqual(BAB_ZEILEN_REIHENFOLGE);
    });

    it(`${id}: aktiv und passiv sind vollständig befüllt; imperativ hat keinen Masdar`, () => {
      for (const rowId of ['aktiv', 'passiv']) {
        for (const colId of BAB_SPALTEN_REIHENFOLGE) {
          expect(t.cells[rowId][colId]).not.toBeNull();
        }
      }
      // Der Imperativ hat im Original keine Masdar-Zelle (Imperativ bildet
      // keinen eigenen Verbalnomen) — bei allen elf Bab-Tabellen so aus dem
      // gerenderten Bild übernommen, nicht geraten.
      expect(Object.prototype.hasOwnProperty.call(t.cells.imperativ, 'masdar')).toBe(false);
      expect(t.cells.imperativ.madhi).not.toBeNull();
      expect(t.cells.imperativ.mudari).not.toBeNull();
      expect(t.cells.imperativ.ism).not.toBeNull();
    });
  }

  it('jede Bab-Tabelle unterscheidet Aktiv-Madhi von Passiv-Madhi (Regressionsschutz gegen Duplizieren)', () => {
    for (const id of BAB_TABELLEN) {
      const t = findeTabelle(id);
      expect((t.cells.aktiv.madhi as { ar: string }).ar).not.toBe((t.cells.passiv.madhi as { ar: string }).ar);
    }
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe für die Bab-Tabellen: pro Tabelle die Wurzel im
// roots.json-Index nachschlagen (Wurzeln dort mit blossem Alif statt Hamza
// geführt, z.B. "امن" für أمن/آمن, "قرا" für قرأ) und jede Form gegen die im
// Koran belegten Wortformen derselben Wurzel gegenprüfen. Abgeleitete Formen
// (Mudari, Masdar, Ism, verstärkte Formen II/III/IV/V/VI/VIII/X) sind im
// Koran oft nicht in exakt dieser Konjugation belegt — das ist keine
// Fehlerquelle, sondern wird hier als Ausnahmeliste dokumentiert (empirisch
// per Testlauf gegen den lokalen Morphologie-Cache ermittelt, nicht
// geraten: nicht gelistete Formen sind im Korpus belegt).
// ---------------------------------------------------------------------------

const BAB_WURZELN: Record<string, string> = {
  'bab-fataha-mahmooz-qaraa': 'قرا',
  'bab-samia-mahmooz-amina': 'امن',
  'bab-daraba-mahmooz-abaqa': 'ابق',
  'bab-nasara-mahmooz-akala': 'اكل',
  'bab-tafil2-mahmooz-ajjara': 'اجر',
  'bab-mufaala3-mahmooz-aakhadha': 'اخذ',
  'bab-ifal4-mahmooz-aamana': 'امن',
  'bab-tafaul5-mahmooz-taammala': 'امل',
  'bab-tafaul6-mahmooz-taamara': 'امر',
  'bab-iftial8-mahmooz-itamara': 'امر',
  'bab-istifal10-mahmooz-istajara': 'اجر',
};

const BAB_ERWARTETE_AUSNAHMEN: Record<string, Set<string>> = {
  'bab-fataha-mahmooz-qaraa': new Set([
    'يَقْرَأُ',
    'قِرَاءَةً',
    'قَارِئ',
    'يُقْرَأُ',
    'مَقْرُوء',
    'لَا تَقْرَأْ',
    'مَقْرَأ',
  ]),
  'bab-samia-mahmooz-amina': new Set(['آمِن', 'إِيْمَنْ', 'لَا تَأْمَنْ']),
  'bab-daraba-mahmooz-abaqa': new Set([
    'يَأْبِقُ',
    'إِبَاقًا',
    'آبِق',
    'يُؤْبَقُ',
    'مَأْبُوْق',
    'اِيْبِقْ',
    'لَا تَأْبِقْ',
    'مَأْبَق',
  ]),
  'bab-nasara-mahmooz-akala': new Set(['آكِل', 'يُؤْكَلُ', 'لَا تَأْكُلْ', 'مَأْكَل']),
  'bab-tafil2-mahmooz-ajjara': new Set([
    'يُؤَجِّرُ',
    'تَأْجِيْرًا',
    'مُؤَجِّر',
    'يُؤَجَّرُ',
    'مُؤَجَّر',
    'لَا تُؤَجِّرْ',
  ]),
  'bab-mufaala3-mahmooz-aakhadha': new Set([
    'آخَذَ',
    'مُؤَاخَذَة',
    'مُؤَاخِذ',
    'أُوْخِذَ',
    'مُؤَاخَذ',
    'آخِذ',
    'لَا تُؤَاخِذْ',
  ]),
  'bab-ifal4-mahmooz-aamana': new Set(['آمَنَ', 'أُوْمِنَ', 'آمِن', 'لَا تُؤْمِنْ']),
  'bab-tafaul5-mahmooz-taammala': new Set([
    'تَأَمَّلَ',
    'يَتَأَمَّلُ',
    'تَأَمُّلًا',
    'مُتَأَمِّل',
    'تُؤُمِّلَ',
    'يُتَأَمَّلُ',
    'مُتَأَمَّل',
    'تَأَمَّلْ',
    'لَا تَتَأَمَّلْ',
  ]),
  'bab-tafaul6-mahmooz-taamara': new Set([
    'تَآمَرَ',
    'يَتَآمَرُ',
    'تَآمُرًا',
    'مُتَآمِر',
    'تُؤُوْمِرَ',
    'يُتَآمَرُ',
    'مُتَآمَر',
    'تَآمَرْ',
    'لَا تَتَآمَرْ',
  ]),
  'bab-iftial8-mahmooz-itamara': new Set([
    'اِيْتَمَرَ',
    'اِيْتِمَارًا',
    'مُؤْتَمِر',
    'أُوْتُمِرَ',
    'يُؤْتَمَرُ',
    'مُؤْتَمَر',
    'اِيْتَمِرْ',
    'لَا تَأْتَمِرْ',
  ]),
  'bab-istifal10-mahmooz-istajara': new Set([
    'اِسْتَأْجَرَ',
    'يَسْتَأْجِرُ',
    'اِسْتِئْجَارًا',
    'مُسْتَأْجِر',
    'اُسْتُؤْجِرَ',
    'يُسْتَأْجَرُ',
    'مُسْتَأْجَر',
    'اِسْتَأْجِرْ',
    'لَا تَسْتَأْجِرْ',
  ]),
};

(morphologieVorhanden ? describe : describe.skip)(
  morphologieVorhanden
    ? 'Bab-Tabellen — Korpus-Gegenprobe gegen das Quranic Arabic Corpus'
    : 'Bab-Tabellen — Korpus-Gegenprobe gegen das Quranic Arabic Corpus — ÜBERSPRUNGEN (Cache fehlt)',
  () => {
    function pruefeBabTabelle(id: string) {
      const wurzel = BAB_WURZELN[id];
      const formenSet = morphologieVorhanden ? ladeWortformenFuerWurzel(wurzel) : new Set<string>();
      const skelette = [...formenSet].map(normalisiereSkelett);
      const t = findeTabelle(id);
      const formen = alleZellen(t)
        .filter((z) => z.zelle !== null)
        .map((z) => (z.zelle as { ar: string }).ar);
      const tatsaechlicheAusnahmen = formen.filter((f) => !imKorpusBelegt(f, formenSet, skelette));
      expect(new Set(tatsaechlicheAusnahmen)).toEqual(BAB_ERWARTETE_AUSNAHMEN[id]);
    }

    for (const id of BAB_TABELLEN) {
      it(`${id}: jede Form außer der dokumentierten Ausnahmeliste ist im Korpus (Wurzel ${BAB_WURZELN[id]}) belegt`, () => {
        pruefeBabTabelle(id);
      });
    }
  },
);

if (!morphologieVorhanden) {
  // eslint-disable-next-line no-console
  console.warn(
    `Korpus-Gegenprobe übersprungen: ${MORPHOLOGIE_DIR} fehlt. ` +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
