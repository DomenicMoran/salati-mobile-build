import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import paradigmenRoh from './paradigmen-bab-mithal-ajwaf.json';

/**
 * Gegenprobe für die Bab-Tabellen der Familien Mithal Wawi (Kap. 8,
 * Abbildungen 52–62), Mithal Ya'i (Abbildungen 63–72) und Ajwaf
 * (Abbildungen 73–83) aus handout.pdf.
 *
 * Warum das nötig ist: jede arabische Form hier muss zeichengenau aus einer
 * maschinellen Quelle stammen (gerendertes Seitenbild von handout.pdf) —
 * kein Vokalzeichen darf von Hand „aus dem Gedächtnis" ergänzt sein. Diese
 * Datei prüft das strukturell (jede Zelle zeigt auf eine echte Zeile/Spalte,
 * jede Form ist vokalisiertes Arabisch), nagelt das gemeinsame 3×4-Raster
 * fest UND prüft inhaltlich gegen das Quranic-Arabic-Corpus.
 *
 * Gleiches Muster wie paradigmen-verben.test.ts (Mahmooz-Familie), auf diese
 * drei zusätzlichen Familien übertragen.
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

const paradigmen = paradigmenRoh as unknown as ParadigmenDatei;

const ARABISCH = /[؀-ۿ]/;
const LATEINISCH = /[A-Za-z]/;
const HARAKAT = /[ً-ْ]/;

const BAB_SPALTEN_REIHENFOLGE = ['madhi', 'mudari', 'masdar', 'ism'];
const BAB_ZEILEN_REIHENFOLGE = ['aktiv', 'passiv', 'imperativ'];

// Die beiden Verben, bei denen das Original selbst eine unvollständige Zeile
// druckt (keine Extraktionslücke, siehe jeweilige `notes` in der JSON-Datei):
// - yatama (يتم, "Waise sein"): intransitives Zustandsverb ohne Passiv.
// - inqaada (اِنْقَادَ, Form VII): inhärent reflexiv-passivische Bedeutung,
//   daher keine eigene Passivform und keine Ableitung im Original.
const SPARSE_ZEILEN: Record<string, Partial<Record<string, string[]>>> = {
  'bab-daraba-mithalyai-yatama': { passiv: ['masdar'], imperativ: ['madhi', 'mudari'] },
  'bab-infial7-ajwaf-inqaada': { passiv: ['masdar'], imperativ: ['madhi', 'mudari'] },
};

function erwarteteSpalten(tabelleId: string, zeileId: string): string[] {
  const sonderfall = SPARSE_ZEILEN[tabelleId]?.[zeileId];
  if (sonderfall) return sonderfall;
  if (zeileId === 'imperativ') return ['madhi', 'mudari', 'ism'];
  return BAB_SPALTEN_REIHENFOLGE;
}

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
  if (!t) throw new Error(`Tabelle ${id} fehlt in paradigmen-bab-mithal-ajwaf.json`);
  return t;
}

describe('paradigmen-bab-mithal-ajwaf.json — Struktur', () => {
  it('hat Schema 1 und genau 32 Tabellen (11 Mithal Wawi + 10 Mithal Ya\'i + 11 Ajwaf)', () => {
    expect(paradigmen.schema).toBe(1);
    expect(paradigmen.tables.length).toBe(32);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmen.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte und eine Zeile, sowie eine gültige Quelle', () => {
    for (const t of paradigmen.tables) {
      expect(t.id).toBeTruthy();
      expect(t.titleDe).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.file).toBe('handout.pdf');
      expect(t.source?.page).toBeGreaterThanOrEqual(106);
      expect(t.source?.page).toBeLessThanOrEqual(115);
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

  it('jede Tabelle hat genau die Spalten madhi, mudari, masdar, ism und die Zeilen aktiv, passiv, imperativ (in dieser Reihenfolge)', () => {
    for (const t of paradigmen.tables) {
      expect(t.columns.map((c) => c.id)).toEqual(BAB_SPALTEN_REIHENFOLGE);
      expect(t.rows.map((r) => r.id)).toEqual(BAB_ZEILEN_REIHENFOLGE);
    }
  });
});

describe('paradigmen-bab-mithal-ajwaf.json — arabische Formen', () => {
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
// Gemeinsames Raster: aktiv immer vollständig (madhi/mudari/masdar/ism);
// passiv und imperativ vollständig AUSSER bei den beiden dokumentierten
// Sonderfällen (SPARSE_ZEILEN), wo das Original selbst Zellen frei lässt.
// Imperativ hat nirgends eine Masdar-Zelle (Imperativ bildet grammatisch
// keinen eigenen Verbalnomen).
// ---------------------------------------------------------------------------

describe('paradigmen-bab-mithal-ajwaf.json — Raster je Zeile', () => {
  for (const t of paradigmen.tables) {
    it(`${t.id}: Zeile 'aktiv' ist vollständig befüllt (madhi/mudari/masdar/ism)`, () => {
      for (const colId of BAB_SPALTEN_REIHENFOLGE) {
        expect(t.cells.aktiv?.[colId]).toBeTruthy();
      }
    });

    it(`${t.id}: Zeile 'passiv' hat genau die erwarteten Spalten befüllt`, () => {
      const erwartet = erwarteteSpalten(t.id, 'passiv');
      const vorhanden = Object.keys(t.cells.passiv ?? {});
      expect(new Set(vorhanden)).toEqual(new Set(erwartet));
      for (const colId of erwartet) {
        expect(t.cells.passiv?.[colId]).toBeTruthy();
      }
    });

    it(`${t.id}: Zeile 'imperativ' hat genau die erwarteten Spalten befüllt (nie Masdar)`, () => {
      const erwartet = erwarteteSpalten(t.id, 'imperativ');
      const vorhanden = Object.keys(t.cells.imperativ ?? {});
      expect(new Set(vorhanden)).toEqual(new Set(erwartet));
      expect(vorhanden).not.toContain('masdar');
      for (const colId of erwartet) {
        expect(t.cells.imperativ?.[colId]).toBeTruthy();
      }
    });
  }

  it('genau zwei Tabellen haben eine unvollständige Passiv-/Imperativ-Zeile, mit Begründung in notes', () => {
    for (const id of Object.keys(SPARSE_ZEILEN)) {
      const t = findeTabelle(id);
      const text = (t.notes ?? []).join(' ');
      expect(text.length).toBeGreaterThan(0);
      // Beide dokumentierten Sonderfälle begründen die Lücke grammatisch.
      expect(text).toMatch(/(Passiv|passivisch|reflexiv)/);
    }
  });
});

// ---------------------------------------------------------------------------
// Regressionsschutz gegen versehentliches Duplizieren: Aktiv-Madhi und
// Passiv-Madhi dürfen sich in keiner Tabelle gleichen (dort, wo beide
// existieren). Masdar darf dagegen absichtlich identisch sein (der Masdar
// ändert sich grammatisch nicht zwischen Aktiv und Passiv).
// ---------------------------------------------------------------------------

describe('paradigmen-bab-mithal-ajwaf.json — Regressionsschutz: Aktiv-Madhi ≠ Passiv-Madhi', () => {
  for (const t of paradigmen.tables) {
    const passivMadhi = t.cells.passiv?.madhi;
    if (!passivMadhi) continue; // die zwei dokumentierten Sonderfälle ohne Passiv-Madhi
    it(`${t.id}: Aktiv-Madhi und Passiv-Madhi unterscheiden sich`, () => {
      expect((t.cells.aktiv.madhi as { ar: string }).ar).not.toBe((passivMadhi as { ar: string }).ar);
    });
  }
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe: pro Tabelle die Wurzel im roots.json-Index nachschlagen
// (Wurzeln dort in normalisierter Schreibung, blosses Alif statt Hamza) und
// jede Form gegen die im Koran belegten Wortformen derselben Wurzel
// gegenprüfen. Grundformen (Madhi) sind meist belegt; abgeleitete/verstärkte
// Formen sind es oft nicht — das ist keine Fehlerquelle, sondern wird hier
// als Ausnahmeliste dokumentiert (empirisch per Testlauf gegen den
// lokalen Morphologie-Cache ermittelt, nicht geraten).
// ---------------------------------------------------------------------------

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
  if (!eintrag) return formen; // Wurzel kommt im Korpus gar nicht vor (z.B. نول, قود)
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
const KORPUS_SUITE_NAME = morphologieVorhanden
  ? 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus'
  : 'Korpus-Gegenprobe gegen das Quranic Arabic Corpus — ÜBERSPRUNGEN (Cache fehlt, siehe console.warn unten)';

// Wurzel je Tabelle, in der im Korpus verwendeten normalisierten Schreibung
// (blosses Alif statt Hamza). نول (Mufa'ala III, Mithal Ya'i) und قود
// (Infi'al VII, Ajwaf) kommen in dieser Form im Quran-Korpus nicht vor —
// dort sind daher ALLE Formen der Tabelle als Ausnahme gelistet (keine
// Extraktionslücke, sondern ein leerer Korpus-Treffer für diese Wurzel).
const BAB_WURZELN: Record<string, string> = {
  'bab-fataha-mithalwawi-wadaa': 'وضع',
  'bab-samia-mithalwawi-wajila': 'وجل',
  'bab-daraba-mithalwawi-waada': 'وعد',
  'bab-hasiba-mithalwawi-waratha': 'ورث',
  'bab-tafil2-mithalwawi-wahhada': 'وحد',
  'bab-mufaala3-mithalwawi-wasala': 'وصل',
  'bab-ifal4-mithalwawi-awsala': 'وصل',
  'bab-tafaul5-mithalwawi-tawakkala': 'وكل',
  'bab-tafaul6-mithalwawi-tawatara': 'وتر',
  'bab-iftial8-mithalwawi-ittasaa': 'وسع',
  'bab-istifal10-mithalwawi-istawqada': 'وقد',
  'bab-fataha-mithalyai-yanaa': 'ينع',
  'bab-samia-mithalyai-yabisa': 'يبس',
  'bab-daraba-mithalyai-yatama': 'يتم',
  'bab-tafil2-mithalyai-yassara': 'يسر',
  'bab-mufaala3-mithalyai-yasara': 'يسر',
  'bab-ifal4-mithalyai-ayqana': 'يقن',
  'bab-tafaul5-mithalyai-tayassara': 'يسر',
  'bab-tafaul6-mithalyai-tayamana': 'يمن',
  'bab-iftial8-mithalyai-ittasara': 'يسر',
  'bab-istifal10-mithalyai-istayqana': 'يقن',
  'bab-samia-ajwaf-khafa': 'خوف',
  'bab-daraba-ajwaf-baaa': 'بيع',
  'bab-nasara-ajwaf-qaala': 'قول',
  'bab-tafil2-ajwaf-sawwara': 'صور',
  'bab-mufaala3-ajwaf-nawala': 'نول',
  'bab-ifal4-ajwaf-araada': 'رود',
  'bab-tafaul5-ajwaf-tabayyana': 'بين',
  'bab-tafaul6-ajwaf-tahawara': 'حور',
  'bab-infial7-ajwaf-inqaada': 'قود',
  'bab-iftial8-ajwaf-ihtaaja': 'حوج',
  'bab-istifal10-ajwaf-istaqaama': 'قوم',
};

// Alle folgenden Listen wurden empirisch per Testlauf gegen den lokalen
// Morphologie-Cache ermittelt, nicht geraten: die jeweils
// NICHT gelisteten Formen sind (ggf. skelettgleich) im Korpus belegt.
const BAB_ERWARTETE_AUSNAHMEN: Record<string, Set<string>> = {
  'bab-fataha-mithalwawi-wadaa': new Set(['وَضْعًا', 'يُوضَع', 'لَا تَضَع', 'مَوْضَع']),
  'bab-samia-mithalwawi-wajila': new Set(['يَوْجَل', 'وَاجِل', 'يُوجَل', 'مَوْجُوْل', 'اِيْجَل', 'لَا تَوْجَل', 'مَوْجَل']),
  'bab-daraba-mithalwawi-waada': new Set(['لَا تَعِد']),
  'bab-hasiba-mithalwawi-waratha': new Set(['وِرَاثَة', 'مَوْرُوْث', 'لَا تَرِث', 'مَوْرِث']),
  'bab-tafil2-mithalwawi-wahhada': new Set(['يُوَحِّد', 'تَوْحِيْدًا', 'مُوَحِّد', 'يُوَحَّد', 'مُوَحَّد', 'لَا تُوَحِّد']),
  'bab-mufaala3-mithalwawi-wasala': new Set([
    'وَاصَلَ',
    'يُوَاصِل',
    'مُوَاصَلَة',
    'مُوَاصِل',
    'وُوْصِلَ',
    'يُوَاصَل',
    'مُوَاصَل',
    'وَاصِل',
    'لَا تُوَاصِل',
  ]),
  'bab-ifal4-mithalwawi-awsala': new Set([
    'أَوْصَلَ',
    'إِيْصَالًا',
    'مُوْصِل',
    'أُوْصِلَ',
    'مُوْصَل',
    'أَوْصِل',
    'لَا تُوْصِل',
  ]),
  'bab-tafaul5-mithalwawi-tawakkala': new Set(['تَوَكُّلًا', 'لَا تَتَوَكَّل']),
  'bab-tafaul6-mithalwawi-tawatara': new Set([
    'تَوَاتَرَ',
    'يَتَوَاتَر',
    'تَوَاتُرًا',
    'مُتَوَاتِر',
    'تُوُوْتِرَ',
    'يُتَوَاتَر',
    'مُتَوَاتَر',
    'تَوَاتَر',
    'لَا تَتَوَاتَر',
  ]),
  'bab-iftial8-mithalwawi-ittasaa': new Set([
    'اِتَّسَعَ',
    'يَتَّسِع',
    'اِتِّسَاعًا',
    'مُتَّسِع',
    'اُتُّسِعَ',
    'يُتَّسَع',
    'مُتَّسَع',
    'اِتَّسِع',
    'لَا تَتَّسِع',
  ]),
  'bab-istifal10-mithalwawi-istawqada': new Set([
    'يَسْتَوْقِد',
    'اِسْتِيْقَادًا',
    'مُسْتَوْقِد',
    'يُسْتَوْقَد',
    'مُسْتَوْقَد',
    'لَا تَسْتَوْقِد',
  ]),
  'bab-fataha-mithalyai-yanaa': new Set([
    'يَيْنَع',
    'يَنْعًا',
    'يَانِع',
    'يُونَع',
    'مَيْنُوْع',
    'اِيْنَع',
    'لَا تَيْنَع',
    'مَيْنَع',
  ]),
  'bab-samia-mithalyai-yabisa': new Set(['يَيْبَس', 'يُوبَس', 'مَيْبُوْس', 'اِيْبَس', 'لَا تَيْبَس', 'مَيْبَس']),
  'bab-daraba-mithalyai-yatama': new Set(['يَتَمَ', 'يَيْتِم', 'يُتْمًا', 'اِيْتِم', 'لَا تَيْتِم']),
  'bab-tafil2-mithalyai-yassara': new Set(['يُيَسِّر', 'تَيْسِيْرًا', 'يُيَسَّر', 'لَا تُيَسِّر']),
  'bab-mufaala3-mithalyai-yasara': new Set([
    'يَاسَرَ',
    'يُيَاسِر',
    'مُيَاسَرَة',
    'مُيَاسِر',
    'يُوْسِرَ',
    'يُيَاسَر',
    'مُيَاسَر',
    'يَاسِر',
    'لَا تُيَاسِر',
  ]),
  'bab-ifal4-mithalyai-ayqana': new Set(['أَيْقَنَ', 'إِيْقَانًا', 'أُوْقِنَ', 'أَيْقِن', 'لَا تُوْقِن']),
  'bab-tafaul5-mithalyai-tayassara': new Set([
    'يَتَيَسَّر',
    'تَيَسُّرًا',
    'مُتَيَسِّر',
    'يُتَيَسَّر',
    'مُتَيَسَّر',
    'لَا تَتَيَسَّر',
  ]),
  'bab-tafaul6-mithalyai-tayamana': new Set([
    'تَيَامَنَ',
    'يَتَيَامَن',
    'تَيَامُنًا',
    'مُتَيَامِن',
    'تُيُوْمِنَ',
    'يُتَيَامَن',
    'مُتَيَامَن',
    'تَيَامَن',
    'لَا تَتَيَامَن',
  ]),
  'bab-iftial8-mithalyai-ittasara': new Set([
    'اِتَّسَرَ',
    'يَتَّسِر',
    'اِتِّسَارًا',
    'مُتَّسِر',
    'اُتُّسِرَ',
    'يُتَّسَر',
    'مُتَّسَر',
    'اِتَّسِر',
    'لَا تَتَّسِر',
  ]),
  'bab-istifal10-mithalyai-istayqana': new Set(['اِسْتِيْقَانًا', 'اُسْتُوْقِنَ', 'لَا تَسْتَيْقِن']),
  'bab-samia-ajwaf-khafa': new Set(['مَخُوْف', 'لَا تَخَفْ', 'مَخَاف']),
  'bab-daraba-ajwaf-baaa': new Set([
    'بَاعَ',
    'يَبِيْعُ',
    'بَيْعًا',
    'بَائِع',
    'يُبَاعُ',
    'مَبِيْع',
    'بِعْ',
    'لَا تَبِعْ',
  ]),
  'bab-nasara-ajwaf-qaala': new Set(['مَقُوْل', 'لَا تَقُلْ', 'مَقَال']),
  'bab-tafil2-ajwaf-sawwara': new Set(['تَصْوِيْرًا', 'لَا تُصَوِّرْ']),
  'bab-mufaala3-ajwaf-nawala': new Set([
    'نَاوَلَ',
    'يُنَاوِلُ',
    'مُنَاوَلَةً',
    'مُنَاوِل',
    'نُوْوِلَ',
    'يُنَاوَلُ',
    'مُنَاوَل',
    'نَاوِلْ',
    'لَا تُنَاوِلْ',
  ]),
  'bab-ifal4-ajwaf-araada': new Set(['إِرَادَة', 'مُرِيْد', 'مُرَاد', 'لَا تُرِدْ']),
  'bab-tafaul5-ajwaf-tabayyana': new Set(['تَبَيُّنًا', 'مُتَبَيِّن', 'مُتَبَيَّن', 'لَا تَتَبَيَّنْ']),
  'bab-tafaul6-ajwaf-tahawara': new Set([
    'يَتَحَاوَرُ',
    'تَحَاوُرًا',
    'مُتَحَاوِر',
    'تُحُوْوِرَ',
    'يُتَحَاوَرُ',
    'مُتَحَاوَر',
    'لَا تَتَحَاوَرْ',
  ]),
  'bab-infial7-ajwaf-inqaada': new Set(['اِنْقَادَ', 'يَنْقَادُ', 'اِنْقِيَادًا', 'مُنْقَاد', 'اِنْقَدْ', 'لَا تَنْقَدْ']),
  'bab-iftial8-ajwaf-ihtaaja': new Set([
    'اِحْتَاجَ',
    'يَحْتَاجُ',
    'اِحْتِيَاجًا',
    'مُحْتَاج',
    'أُحْتِيْجَ',
    'يُحْتَاجُ',
    'اِحْتَجْ',
    'لَا تَحْتَجْ',
  ]),
  'bab-istifal10-ajwaf-istaqaama': new Set([
    'اِسْتِقَامَة',
    'أُسْتُقِيْمَ',
    'يُسْتَقَامُ',
    'مُسْتَقَام',
    'لَا تَسْتَقِمْ',
  ]),
};

(morphologieVorhanden ? describe : describe.skip)(KORPUS_SUITE_NAME, () => {
  it('jede Tabelle hat eine im BAB_WURZELN-Verzeichnis eingetragene Wurzel', () => {
    for (const t of paradigmen.tables) {
      expect(BAB_WURZELN[t.id]).toBeTruthy();
      expect(BAB_ERWARTETE_AUSNAHMEN[t.id]).toBeTruthy();
    }
  });

  function pruefeTabelle(id: string) {
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

  for (const t of paradigmen.tables) {
    it(`${t.id}: jede Form außer der dokumentierten Ausnahmeliste ist im Korpus (Wurzel ${BAB_WURZELN[t.id]}) belegt`, () => {
      pruefeTabelle(t.id);
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
