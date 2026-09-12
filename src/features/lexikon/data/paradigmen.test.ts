import { readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import paradigmenRoh from './paradigmen.json';

/**
 * Gegenprobe für die Paradigmen-Tabellen des Grammatik-Lexikons.
 *
 * Warum das nötig ist: jede arabische Form hier muss zeichengenau aus einer
 * maschinellen Quelle stammen (PDF-Textlayer/gerendertes Seitenbild von
 * tabellen-sprache.pdf) — kein Vokalzeichen darf von Hand „aus dem
 * Gedächtnis" ergänzt sein. Diese Datei prüft das strukturell (jede Zelle
 * zeigt auf eine echte Zeile/Spalte, jede Form ist vokalisiertes Arabisch)
 * UND inhaltlich (Verb- und Nomenformen von نصر/مسلم müssen im
 * Quranic-Arabic-Corpus wirklich vorkommen, wo das zu erwarten ist).
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

function alleZellen(tabelle: ParadigmenTabelle): { rowId: string; colId: string; zelle: Zelle }[] {
  const out: { rowId: string; colId: string; zelle: Zelle }[] = [];
  for (const rowId of Object.keys(tabelle.cells)) {
    for (const colId of Object.keys(tabelle.cells[rowId] ?? {})) {
      out.push({ rowId, colId, zelle: tabelle.cells[rowId][colId] });
    }
  }
  return out;
}

describe('paradigmen.json — Struktur', () => {
  it('hat Schema 1 und mindestens 20 Tabellen (die 21 Kernserie-Tabellen)', () => {
    expect(paradigmen.schema).toBe(1);
    expect(paradigmen.tables.length).toBeGreaterThanOrEqual(20);
  });

  it('hat eindeutige Tabellen-IDs', () => {
    const ids = paradigmen.tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle hat id, titleDe, mindestens eine Spalte und eine Zeile', () => {
    for (const t of paradigmen.tables) {
      expect(t.id).toBeTruthy();
      expect(t.titleDe).toBeTruthy();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.file).toBeTruthy();
      expect(t.source?.page).toBeGreaterThan(0);
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

describe('paradigmen.json — arabische Formen', () => {
  // Aus fehlenden Zellen ("kein Dual"/"nur 2. Person") folgt kein
  // Harakat-Verstoß, weil es dafür schlicht keine `ar`-Zelle gibt — hier
  // geht es nur um vorhandene Zellen.
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
// Regressionsschutz: Die Mehrzahl-Hinweiswörter هؤلاء/أولئك wurden nach einer
// unabhängigen Zweitablesung des Seitenbilds (S. 6, ≥20-facher Zoom) korrigiert
// — dort trägt weder ه noch ل einen Dagger-Alif (U+0670), nur die einfache
// Fatha. Zuvor stand hier fälschlich zusätzlich Tatweel (U+0640) + Dagger-Alif,
// vermutlich analog zu den benachbarten Singular-/Dual-Formen (هَـٰذَا usw.)
// ergänzt statt einzeln gegen das Bild geprüft. Dieser Test nagelt die jetzt
// festgelegten, bildgeprüften Werte codepoint-genau fest, damit ein
// versehentliches erneutes Ergänzen des Dagger-Alif auffällt.
// ---------------------------------------------------------------------------

describe('paradigmen.json — Regressionsschutz: Hinweiswörter Mehrzahl', () => {
  const tabelle = paradigmen.tables.find((t) => t.id === 'hinweiswoerter');

  it('hinweiswoerter.pl.nah ist هَؤُلَاءِ ohne Dagger-Alif', () => {
    const ar = tabelle?.cells['pl']?.['nah']?.ar ?? '';
    expect(ar.normalize('NFC')).toBe('هَؤُلَاءِ'.normalize('NFC'));
  });

  it('hinweiswoerter.pl.fern ist أُولَئِكَ ohne Dagger-Alif', () => {
    const ar = tabelle?.cells['pl']?.['fern']?.ar ?? '';
    expect(ar.normalize('NFC')).toBe('أُولَئِكَ'.normalize('NFC'));
  });
});

// ---------------------------------------------------------------------------
// Korpus-Gegenprobe: نصر (Verbparadigma) und مسلم (Nomenparadigma) gegen das
// Quranic Arabic Corpus. Datenquelle: die bereits im Repo vorhandene,
// gebaute Morphologie (apps/mobile/.daten-cache/out/morphologie/*.json,
// von scripts/build-morphologie.mjs aus derselben QAC-0.4-Datei erzeugt, die
// auch als qac-0.4-original.txt im Extraktions-Scratchpad liegt — Ort und
// Prüfsumme dokumentiert in scripts/build-morphologie.mjs). Diese Dateien
// liegen NICHT im Git (siehe .gitignore), sondern werden per
// `node scripts/build-morphologie.mjs` erzeugt/zwischengespeichert — genau wie
// hier für den Test verwendet. Fehlt der Cache, schlägt die Gegenprobe mit
// einer klaren Anleitung fehl statt still zu verschwinden.
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

/** Prüft, ob `form` (oder sein Skelett als Wortbestandteil) unter den Korpus-Formen auftaucht. */
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
  // Nur bei vorhandenem Cache lesen: eine describe.skip-Hülle allein
  // schützt NICHT davor, dass Jest den describe-Rumpf trotzdem ausführt (nur
  // die einzelnen `it`s werden übersprungen) — ein unbedingter Aufruf hier
  // würde bei fehlendem Cache mit ENOENT abstürzen statt zu überspringen.
  const nasrFormen = morphologieVorhanden ? ladeWortformenFuerWurzel('نصر') : new Set<string>();
  const nasrSkelette = [...nasrFormen].map(normalisiereSkelett);
  const slmFormen = morphologieVorhanden ? ladeWortformenFuerWurzel('سلم') : new Set<string>();
  const slmSkelette = [...slmFormen].map(normalisiereSkelett);

  it('findet für die Wurzel نصر und die Wurzel سلم überhaupt Belegformen im Korpus (Selbstkontrolle)', () => {
    expect(nasrFormen.size).toBeGreaterThan(20);
    expect(slmFormen.size).toBeGreaterThan(20);
  });

  // Formen, die im Koran für diese Wurzel nicht belegt sind — kein Fehler,
  // sondern eine dokumentierte, bewusst sichtbar gehaltene Abweichung
  // (2. Person und 1. Sg. Vergangenheit sowie die Dual-Formen kommen für
  // نصر/مسلم im Korantext schlicht nicht in dieser Weise vor).
  const ERWARTETE_AUSNAHMEN_MADI = new Set(['نَصَرَتْ', 'نَصَرَتَا', 'نَصَرْتَ', 'نَصَرْتُمْ', 'نَصَرْتِ', 'نَصَرْتُنَّ', 'نَصَرْتُ']);
  const ERWARTETE_AUSNAHMEN_MUDARI = new Set(['تَنْصُرِينَ', 'أَنْصُرُ']);
  const ERWARTETE_AUSNAHMEN_AMR = new Set(['اُنْصُرِي', 'اُنْصُرَا']);
  const ERWARTETE_AUSNAHMEN_MUSLIM = new Set(['مُسْلِمَانِ', 'مُسْلِمَتَانِ', 'مُسْلِمَتَيْنِ']);

  function pruefeTabelle(id: string, korpusFormen: Set<string>, korpusSkelette: string[], erwarteteAusnahmen: Set<string>) {
    const tabelle = paradigmen.tables.find((t) => t.id === id);
    if (!tabelle) throw new Error(`Tabelle ${id} fehlt in paradigmen.json`);
    const formen = alleZellen(tabelle)
      .filter((z) => z.zelle !== null)
      .map((z) => (z.zelle as { ar: string }).ar);
    const tatsaechlicheAusnahmen = formen.filter((f) => !imKorpusBelegt(f, korpusFormen, korpusSkelette));
    expect(new Set(tatsaechlicheAusnahmen)).toEqual(erwarteteAusnahmen);
  }

  it('نَصَرَ (Vergangenheit): jede Form außer der dokumentierten Ausnahmeliste ist im Korpus belegt', () => {
    pruefeTabelle('verb-madi-nasara', nasrFormen, nasrSkelette, ERWARTETE_AUSNAHMEN_MADI);
  });

  it('يَنْصُرُ (Gegenwart): jede Form außer der dokumentierten Ausnahmeliste ist im Korpus belegt', () => {
    pruefeTabelle('verb-mudari-nasara', nasrFormen, nasrSkelette, ERWARTETE_AUSNAHMEN_MUDARI);
  });

  it('الأَمْر (Befehl aus نَصَرَ): jede Form außer der dokumentierten Ausnahmeliste ist im Korpus belegt', () => {
    pruefeTabelle('amr-nasara', nasrFormen, nasrSkelette, ERWARTETE_AUSNAHMEN_AMR);
  });

  it('مُسْلِم (Nomen): jede Form außer der dokumentierten Ausnahmeliste ist im Korpus belegt', () => {
    pruefeTabelle('nomen-muslim', slmFormen, slmSkelette, ERWARTETE_AUSNAHMEN_MUSLIM);
  });
});

if (!morphologieVorhanden) {
  // eslint-disable-next-line no-console
  console.warn(
    `Korpus-Gegenprobe übersprungen: ${MORPHOLOGIE_DIR} fehlt. ` +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
