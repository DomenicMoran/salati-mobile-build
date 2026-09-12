import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import { normalisiereOrthografieSkelett, skelettImKorpusBelegt } from '../orthografieSkelett';
import paradigmenRoh from './paradigmen-bab-murakkab.json';

/**
 * Gegenprobe für die Murakkab-Bab-Tabellen (Kapitel 8.9 von handout.pdf,
 * Abbildungen 122–142, S. 127–132 — kombinierte Verbschwächen: Mithal/Ajwaf/
 * Naqis/Lafif jeweils zusammen mit Mahmuz, sowie zwei Mithal+Muda"af-Fälle
 * ohne Hamza). Siehe LUECKEN.md, Abschnitt "Murakkab". Gleiches Prinzip wie
 * paradigmen-bab-naqis-lafif-mudaaf.test.ts: jede arabische Form muss
 * zeichengenau aus dem gerenderten Seitenbild stammen, nichts wird aus dem
 * Gedächtnis ergänzt.
 *
 * NACHTRAG (dieser Lauf): Der ursprüngliche Verzicht auf eine Korpus-
 * Gegenprobe (Begründung: die Qur'an-Uthmani-Orthographie weicht bei
 * Hamza-Buchstaben systematisch von der Druck-/Naskh-Orthographie des
 * Handouts ab, z. B. Korpus "جَآءَ" mit Madda-Zeichen U+0622 vs. Handout
 * "جَاءَ" mit getrenntem Alif+Hamza) ist mit der neuen, gemeinsamen
 * Normalisierungs-Hilfsfunktion `normalisiereOrthografieSkelett`
 * (../orthografieSkelett.ts) NICHT MEHR nötig: sie löst sowohl die Madda als
 * auch — empirisch beim ersten Testlauf DIESER Gegenprobe entdeckt — den
 * Uthmani-Dagger-Alif (ٰ, U+0670) auf ein gewöhnliches Alif auf und
 * vereinheitlicht zusätzlich alle Hamza-Träger (أ إ آ ٱ ؤ ئ) auf die
 * Grundform. Damit liefert die Gegenprobe unten für jede der 21 Tabellen
 * eine ECHTE, informative Ausnahmeliste (die meisten Madhi-Grundformen sind
 * belegt, viele abgeleitete Formen und durchweg die verneinten Nahy-Formen
 * nicht) statt einer für praktisch jede Zelle "falsch positiven" Ausnahme.
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
  if (!t) throw new Error(`Tabelle ${id} fehlt in paradigmen-bab-murakkab.json`);
  return t;
}

describe('paradigmen-bab-murakkab.json — Struktur', () => {
  it('hat Schema 1 und 21 Tabellen (Abbildungen 122–142)', () => {
    expect(paradigmen.schema).toBe(1);
    expect(paradigmen.tables.length).toBe(21);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmen.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte und eine Zeile sowie eine gültige Quelle (S. 127–132)', () => {
    for (const t of paradigmen.tables) {
      expect(t.id).toBeTruthy();
      expect(t.titleDe).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.file).toBe('handout.pdf');
      expect(t.source?.page).toBeGreaterThanOrEqual(127);
      expect(t.source?.page).toBeLessThanOrEqual(132);
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

describe('paradigmen-bab-murakkab.json — arabische Formen', () => {
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
// Bab-Tabellen-Raster: alle 21 Tabellen folgen demselben Grundmuster
// (Zeilen aktiv/passiv/imperativ, Spalten madhi/mudari/masdar/ism), mit der
// EINEN durchgehenden Abweichung, dass die Imperativ-Zeile bei ALLEN
// Murakkab-Tabellen nur 'madhi' (Amr) und 'mudari' (Nahy) besitzt — anders
// als bei den einfachen Naqis-Tabellen (dort zusätzlich eine Ism-Ableitung),
// aber wie bei Lafif/Muda"af in paradigmen-bab-naqis-lafif-mudaaf.json.
// ---------------------------------------------------------------------------

const ALLE_IDS = paradigmen.tables.map((t) => t.id);
const BAB_SPALTEN_REIHENFOLGE = ['madhi', 'mudari', 'masdar', 'ism'];

describe('paradigmen-bab-murakkab.json — einheitliches Spaltenraster', () => {
  for (const id of ALLE_IDS) {
    it(`${id}: hat genau die Spalten madhi, mudari, masdar, ism`, () => {
      const t = findeTabelle(id);
      expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
    });

    it(`${id}: hat die Zeilen aktiv, passiv, imperativ`, () => {
      const t = findeTabelle(id);
      expect(t.rows.map((r) => r.id)).toEqual(['aktiv', 'passiv', 'imperativ']);
    });

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

    it(`${id}: imperativ hat NUR Madhi (Amr) und Mudari (Nahy), keinen Masdar und kein Ism`, () => {
      const t = findeTabelle(id);
      expect(Object.keys(t.cells.imperativ).sort()).toEqual(['madhi', 'mudari']);
      expect(t.cells.imperativ.madhi).not.toBeNull();
      expect(t.cells.imperativ.mudari).not.toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// Regressionsschutz: Aktiv-Madhi und Passiv-Madhi unterscheiden sich in
// JEDER der 21 Tabellen (keine dokumentierte Ausnahme in dieser Datei).
// ---------------------------------------------------------------------------

describe('paradigmen-bab-murakkab.json — Regressionsschutz: Aktiv-Madhi ≠ Passiv-Madhi', () => {
  for (const id of ALLE_IDS) {
    it(`${id}: Aktiv-Madhi unterscheidet sich von Passiv-Madhi`, () => {
      const t = findeTabelle(id);
      const aktivMadhi = (t.cells.aktiv.madhi as { ar: string }).ar;
      const passivMadhi = (t.cells.passiv.madhi as { ar: string }).ar;
      expect(aktivMadhi).not.toBe(passivMadhi);
    });
  }
});

// ---------------------------------------------------------------------------
// Dokumentierte Homographie (wie bei den bereits erfassten reinen
// Muda"af-Bab-Tabellen in paradigmen-bab-naqis-lafif-mudaaf.json): bei
// bab-mufaala3-murakkab-mithal-mudaaf-wadda (Form III von ودد) sind
// Aktiv-Mudari/Passiv-Mudari sowie Ism Fa'il/Ism Maf'ul im Original
// BUCHSTABENGLEICH gedruckt, weil der unterscheidende Innenvokal genau auf
// dem beim Idgham verschmelzenden Dal liegt.
// ---------------------------------------------------------------------------

describe('paradigmen-bab-murakkab.json — dokumentierte Muda"af-Homographen (Aktiv=Passiv bei Mudari/Ism)', () => {
  it("bab-mufaala3-murakkab-mithal-mudaaf-wadda: Aktiv-Mudari und Passiv-Mudari sind identisch (يُوَادُّ)", () => {
    const t = findeTabelle('bab-mufaala3-murakkab-mithal-mudaaf-wadda');
    expect((t.cells.aktiv.mudari as { ar: string }).ar).toBe('يُوَادُّ');
    expect((t.cells.passiv.mudari as { ar: string }).ar).toBe('يُوَادُّ');
  });

  it("bab-mufaala3-murakkab-mithal-mudaaf-wadda: Ism Fa'il und Ism Maf'ul sind identisch (مُوَادٌّ)", () => {
    const t = findeTabelle('bab-mufaala3-murakkab-mithal-mudaaf-wadda');
    expect((t.cells.aktiv.ism as { ar: string }).ar).toBe('مُوَادٌّ');
    expect((t.cells.passiv.ism as { ar: string }).ar).toBe('مُوَادٌّ');
  });
});

// ---------------------------------------------------------------------------
// Dokumentierte Zufallshomographie über Tabellengrenzen hinweg: der Amr von
// bab-daraba-murakkab-mithal-mahmuz-waada (Wurzel وأد) und der Amr von
// bab-daraba-murakkab-ajwaf-mahmuz-aada (Wurzel أيد) sind zeichengleich
// (إِدْ), weil beide Wurzeln im Jussiv/Apokopat auf denselben
// zweikonsonantigen Rest (Hamza+Dal) reduziert werden. Kein Kopierfehler —
// beide Bilder einzeln bei ≥45-fachem Zoom gegengeprüft (siehe notes).
// ---------------------------------------------------------------------------

describe('paradigmen-bab-murakkab.json — dokumentierte Amr-Homographie über zwei Wurzeln hinweg', () => {
  it('bab-daraba-murakkab-mithal-mahmuz-waada und bab-daraba-murakkab-ajwaf-mahmuz-aada haben denselben Amr (إِدْ)', () => {
    const a = findeTabelle('bab-daraba-murakkab-mithal-mahmuz-waada');
    const b = findeTabelle('bab-daraba-murakkab-ajwaf-mahmuz-aada');
    expect((a.cells.imperativ.madhi as { ar: string }).ar).toBe('إِدْ');
    expect((b.cells.imperativ.madhi as { ar: string }).ar).toBe('إِدْ');
  });
});

// ---------------------------------------------------------------------------
// Extremfall Lafif Mafruq + Mahmuz al-'Ain (bab-daraba-murakkab-lafif-mahmuz-waaa,
// Wurzel وأي): der Amr besteht im Original nur aus einem einzigen Buchstaben.
// ---------------------------------------------------------------------------

describe("paradigmen-bab-murakkab.json — Extremfall einbuchstabiger Amr (Lafif Mafruq + Mahmuz al-'Ain)", () => {
  it('bab-daraba-murakkab-lafif-mahmuz-waaa: Amr ist ein einziger Buchstabe (إِ)', () => {
    const t = findeTabelle('bab-daraba-murakkab-lafif-mahmuz-waaa');
    const amr = (t.cells.imperativ.madhi as { ar: string }).ar;
    expect(amr).toBe('إِ');
    expect(amr.length).toBe(2); // Hamza-auf-Alif + Kasra-Diakritikum
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe (NEU in diesem Lauf) über normalisiereOrthografieSkelett/
// skelettImKorpusBelegt aus ../orthografieSkelett.ts — siehe Kopf-Kommentar.
// Datenquelle: apps/mobile/.daten-cache/out/morphologie/v<N> (aktuelle
// Schemaversion, siehe MORPHOLOGIE_SCHEMA_VERSION; per
// `node scripts/build-morphologie.mjs` erzeugt, gitignored). Fehlt der
// Cache, wird der Block übersprungen statt die Suite rot zu machen.
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

// Wurzel je Tabelle, in der im roots.json-Index üblichen Schreibung (Hamza
// auf Alif reduziert, wie im Korpus üblich — z. B. "واد" für وأد, "راي" für
// رأي). bab-samia-murakkab-naqis-mahmuz-asiya nutzt "اسو" statt "اسي": die
// Tabellen-`notes` selbst dokumentieren bereits, dass der Korpus-Index diese
// Wurzel als Nebenform اسو/أسي führt (belegt in Sure 57:23) — hier 1:1
// übernommen, nicht neu geraten.
const WURZELN: Record<string, string> = {
  'bab-daraba-murakkab-mithal-mahmuz-waada': 'واد',
  'bab-istifal10-murakkab-mithal-mahmuz-istayasa': 'ياس',
  'bab-samia-murakkab-mithal-mahmuz-watia': 'وطا',
  'bab-iftial8-murakkab-mithal-mahmuz-ittakaa': 'وكا',
  'bab-samia-murakkab-mithal-mudaaf-wadda': 'ودد',
  'bab-mufaala3-murakkab-mithal-mudaaf-wadda': 'ودد',
  'bab-daraba-murakkab-ajwaf-mahmuz-aada': 'ايد',
  'bab-nasara-murakkab-ajwaf-mahmuz-aala': 'اول',
  'bab-samia-murakkab-ajwaf-mahmuz-shaaa': 'شيا',
  'bab-daraba-murakkab-ajwaf-mahmuz-jaaa': 'جيا',
  'bab-nasara-murakkab-ajwaf-mahmuz-baaa': 'بوا',
  'bab-fataha-murakkab-naqis-mahmuz-abaa': 'ابي',
  'bab-samia-murakkab-naqis-mahmuz-asiya': 'اسو',
  'bab-daraba-murakkab-naqis-mahmuz-ataa': 'اتي',
  'bab-nasara-murakkab-naqis-mahmuz-alaa': 'الو',
  'bab-tafil2-murakkab-naqis-mahmuz-addaa': 'ادي',
  'bab-fataha-murakkab-naqis-mahmuz-raaa': 'راي',
  'bab-mufaala3-murakkab-naqis-mahmuz-raaa': 'راي',
  'bab-ifal4-murakkab-naqis-mahmuz-araa': 'راي',
  'bab-daraba-murakkab-lafif-mahmuz-awaa': 'اوي',
  'bab-daraba-murakkab-lafif-mahmuz-waaa': 'واي',
};

// Empirisch per Testlauf gegen den lokalen Morphologie-Cache ermittelt
// (NICHT geraten): die jeweils NICHT gelisteten Formen sind im Korpus belegt.
// Zwei Wurzeln (واد, واي) kommen im Korpus praktisch (واد: 1 Beleg, der zu
// keiner der sechs Zellen passt) bzw. vollständig (واي: 0 Belege) nicht in
// dieser Tabelle vor — beides bereits in den jeweiligen `notes` der JSON
// dokumentiert, hier nur empirisch bestätigt statt neu behauptet.
const ERWARTETE_AUSNAHMEN: Record<string, Set<string>> = {
  'bab-daraba-murakkab-mithal-mahmuz-waada': new Set(['يَئِدُ', 'وَأْدًا', 'وَائِدٌ', 'يُوأَدُ', 'مَوْءُودٌ', 'لَا تَئِدْ']),
  'bab-istifal10-murakkab-mithal-mahmuz-istayasa': new Set([
    'اِسْتَيْأَسَ',
    'يَسْتَيْئِسُ',
    'اِسْتِيْئَاسًا',
    'مُسْتَيْئِسٌ',
    'اُسْتُوْئِسَ',
    'يُسْتَيْأَسُ',
    'مُسْتَيْأَسٌ',
    'اِسْتَيْئِسْ',
    'لَا تَسْتَيْئِسْ',
  ]),
  'bab-samia-murakkab-mithal-mahmuz-watia': new Set(['يَطَأُ', 'وَاطِئٌ', 'يُوطَأُ', 'مَوْطُوْءٌ', 'لَا تَطَأْ']),
  'bab-iftial8-murakkab-mithal-mahmuz-ittakaa': new Set([
    'اِتَّكَأَ',
    'يَتَّكِئُ',
    'اِتِّكَاءً',
    'اُتُّكِئَ',
    'يُتَّكَأُ',
    'اِتَّكِئْ',
    'لَا تَتَّكِئْ',
  ]),
  'bab-samia-murakkab-mithal-mudaaf-wadda': new Set(['مَوْدُوْدٌ', 'لَا تَوَدَّ']),
  'bab-mufaala3-murakkab-mithal-mudaaf-wadda': new Set(['مُوَادَّةً', 'مُوَادٌّ', 'لَا تُوَادَّ']),
  'bab-daraba-murakkab-ajwaf-mahmuz-aada': new Set([
    'آدَ',
    'أَيْدًا',
    'آئِدٌ',
    'أُوْيِدَ',
    'يُؤَادُ',
    'مَئِيدٌ',
    'إِدْ',
    'لَا تَئِدْ',
  ]),
  'bab-nasara-murakkab-ajwaf-mahmuz-aala': new Set(['يَؤُولُ', 'يُؤَالُ', 'مَؤُولٌ', 'لَا تَؤُلْ']),
  'bab-samia-murakkab-ajwaf-mahmuz-shaaa': new Set(['مَشِيْئَةً', 'مَشِيْءٌ', 'لَا تَشَأْ']),
  'bab-daraba-murakkab-ajwaf-mahmuz-jaaa': new Set(['يَجِيْءُ', 'مَجِيْئًا', 'جِيْءَ', 'يُجَاءُ', 'مَجِيْءٌ', 'لَا تَجِئْ']),
  'bab-nasara-murakkab-ajwaf-mahmuz-baaa': new Set(['يَبُوْءُ', 'بِيْءَ', 'يُبَاءُ', 'لَا تَبُؤْ']),
  'bab-fataha-murakkab-naqis-mahmuz-abaa': new Set(['إِبَاءً', 'مَأْبِيٌّ', 'إِيْبَ', 'لَا تَأْبَ']),
  'bab-samia-murakkab-naqis-mahmuz-asiya': new Set(['يَأْسَى', 'يُؤْسَى', 'مَأْسِيٌّ', 'إِيْسَ', 'لَا تَأْسَ']),
  'bab-daraba-murakkab-naqis-mahmuz-ataa': new Set(['لَا تَأْتِ']),
  'bab-nasara-murakkab-naqis-mahmuz-alaa': new Set(['أَلْوًا', 'أُلِيَ', 'يُؤْلَى', 'مَأْلُوٌّ', 'لَا تَأْلُ']),
  'bab-tafil2-murakkab-naqis-mahmuz-addaa': new Set([
    'أَدَّى',
    'يُؤَدِّي',
    'تَأْدِيَةً',
    'مُؤَدٍّ',
    'أُدِّيَ',
    'يُؤَدَّى',
    'مُؤَدًّى',
    'لَا تُؤَدِّ',
  ]),
  'bab-fataha-murakkab-naqis-mahmuz-raaa': new Set(['رُؤْيَةً', 'مَرْئِيٌّ', 'لَا تَرَ']),
  'bab-mufaala3-murakkab-naqis-mahmuz-raaa': new Set([
    'رَاءَى',
    'يُرَائِي',
    'مُرَاءَاةً',
    'مُرَاءٍ',
    'رُوْئِيَ',
    'يُرَاءَى',
    'مُرَاءًى',
    'لَا تُرَاءِ',
  ]),
  'bab-ifal4-murakkab-naqis-mahmuz-araa': new Set(['إِرَاءَةً', 'مُرٍ', 'مُرًى', 'لَا تُرِ']),
  'bab-daraba-murakkab-lafif-mahmuz-awaa': new Set(['يَأْوِي', 'أَيًّا', 'يُؤْوَى', 'إِيْوِ', 'لَا تَأْوُ']),
  'bab-daraba-murakkab-lafif-mahmuz-waaa': new Set([
    'وَأَى',
    'يَئِي',
    'وَأْيًا',
    'وَاءٍ',
    'وُئِيَ',
    'يُوْأَى',
    'مَوْئِيٌّ',
    'إِ',
    'لَا تَئِ',
  ]),
};

const KORPUS_SUITE_NAME = morphologieVorhanden
  ? 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus (über orthografieSkelett.ts)'
  : 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus (über orthografieSkelett.ts) — ÜBERSPRUNGEN (Cache fehlt)';

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

  it('findet für die Wurzel اتي (murakkab Naqis+Mahmuz, رأي-Verwandte أتي) reichlich Belegformen (Selbstkontrolle)', () => {
    expect(ladeWortformenFuerWurzel('اتي').size).toBeGreaterThan(100);
  });

  for (const id of ALLE_IDS) {
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
