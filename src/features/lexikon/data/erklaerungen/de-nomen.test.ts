import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import deNomenRoh from './de-nomen.json';
import paradigmenRoh from '../paradigmen.json';
import paradigmenVerbenRoh from '../paradigmen-verben.json';

/**
 * Gegenprobe für die Lehrtext-Einträge des Nomen-Bereichs im Grammatik-Lexikon.
 *
 * Warum das nötig ist: Jeder Eintrag ist ein Handout-Kapitel zum Durcharbeiten
 * (Erklärung + Erkennungsmerkmale + Lernanweisung), und jede Koranstelle in
 * `belege` muss wirklich existieren und wirklich zeigen, was `zeigt` behauptet
 * — sonst lernt jemand mit einer erfundenen oder falsch zugeordneten Stelle.
 * Diese Datei prüft das strukturell (keine leeren Felder, gültige Querverweise,
 * gültige Tabellen-IDs) UND inhaltlich (jede Beleg-Koordinate existiert im
 * echten Morphologie-Korpus, und wo prüfbar, trägt das Wort auch das
 * behauptete Merkmal).
 */

interface Beleg {
  sure: number;
  vers: number;
  wort: number;
  zeigt: string;
  warum: string;
}

interface Eintrag {
  titel: string;
  ar: string;
  umschrift: string;
  erklaerung: string[];
  erkennung: string[];
  belege: Beleg[];
  lernen: string[];
  tabellen: string[];
  siehe: string[];
}

interface DeNomenDatei {
  schema: number;
  lang: string;
  bereich: string;
  eintraege: Record<string, Eintrag>;
}

const deNomen = deNomenRoh as unknown as DeNomenDatei;

const ARABISCH = /[؀-ۿ]/;

describe('de-nomen.json — Struktur', () => {
  it('hat Schema 1, Sprache de, Bereich nomen', () => {
    expect(deNomen.schema).toBe(1);
    expect(deNomen.lang).toBe('de');
    expect(deNomen.bereich).toBe('nomen');
  });

  it('hat mindestens 15 Einträge (die Kernbegriffe des Nomen-Bereichs)', () => {
    expect(Object.keys(deNomen.eintraege).length).toBeGreaterThanOrEqual(15);
  });

  for (const [id, eintrag] of Object.entries(deNomen.eintraege)) {
    describe(`Eintrag "${id}"`, () => {
      it('hat nicht-leeren Titel, Umschrift und arabischen Begriff', () => {
        expect(eintrag.titel.trim().length).toBeGreaterThan(0);
        expect(eintrag.umschrift.trim().length).toBeGreaterThan(0);
        expect(eintrag.ar.trim().length).toBeGreaterThan(0);
      });

      it('"ar" enthält arabische Zeichen', () => {
        expect(ARABISCH.test(eintrag.ar)).toBe(true);
      });

      it('hat 2-5 Erklärungs-Absätze, alle nicht-leer', () => {
        expect(eintrag.erklaerung.length).toBeGreaterThanOrEqual(2);
        expect(eintrag.erklaerung.length).toBeLessThanOrEqual(5);
        for (const absatz of eintrag.erklaerung) {
          expect(absatz.trim().length).toBeGreaterThan(20);
        }
      });

      it('hat mindestens 2 Erkennungsmerkmale, alle nicht-leer', () => {
        expect(eintrag.erkennung.length).toBeGreaterThanOrEqual(2);
        for (const merkmal of eintrag.erkennung) {
          expect(merkmal.trim().length).toBeGreaterThan(10);
        }
      });

      it('hat mindestens 3 Lernanweisungen, alle nicht-leer und konkret (kein Leersatz)', () => {
        expect(eintrag.lernen.length).toBeGreaterThanOrEqual(3);
        for (const hinweis of eintrag.lernen) {
          expect(hinweis.trim().length).toBeGreaterThan(15);
        }
      });

      it('hat mindestens 2 Belege', () => {
        expect(eintrag.belege.length).toBeGreaterThanOrEqual(2);
      });

      it('jeder Beleg hat plausible sure/vers/wort-Koordinaten und nicht-leere zeigt/warum-Texte', () => {
        for (const beleg of eintrag.belege) {
          expect(Number.isInteger(beleg.sure)).toBe(true);
          expect(beleg.sure).toBeGreaterThanOrEqual(1);
          expect(beleg.sure).toBeLessThanOrEqual(114);
          expect(Number.isInteger(beleg.vers)).toBe(true);
          expect(beleg.vers).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(beleg.wort)).toBe(true);
          expect(beleg.wort).toBeGreaterThanOrEqual(1);
          expect(beleg.zeigt.trim().length).toBeGreaterThan(5);
          expect(beleg.warum.trim().length).toBeGreaterThan(15);
        }
      });
    });
  }
});

describe('de-nomen.json — Querverweise (siehe)', () => {
  // Alle "siehe"-Verweise in diesem Bereich zeigen bewusst nur auf andere
  // Einträge derselben Datei (kein bereichsübergreifender Verweis nötig) —
  // diese Liste bliebe der Ort für eine dokumentierte Ausnahme, falls das
  // sich künftig ändert.
  const BEKANNTE_AUSNAHMEN_AUSSERHALB_DIESER_DATEI = new Set<string>([]);

  const gueltigeIds = new Set(Object.keys(deNomen.eintraege));

  for (const [id, eintrag] of Object.entries(deNomen.eintraege)) {
    it(`"${id}": jeder siehe-Verweis zeigt auf einen existierenden Eintrag`, () => {
      for (const verweis of eintrag.siehe) {
        const gueltig = gueltigeIds.has(verweis) || BEKANNTE_AUSNAHMEN_AUSSERHALB_DIESER_DATEI.has(verweis);
        expect(gueltig).toBe(true);
      }
      // Ein Eintrag verweist nicht auf sich selbst.
      expect(eintrag.siehe).not.toContain(id);
    });
  }
});

describe('de-nomen.json — Tabellen-Verweise', () => {
  const paradigmenTabellenIds = new Set(
    (paradigmenRoh as { tables: { id: string }[] }).tables.map((t) => t.id),
  );
  const paradigmenVerbenTabellenIds = new Set(
    (paradigmenVerbenRoh as { tables: { id: string }[] }).tables.map((t) => t.id),
  );

  for (const [id, eintrag] of Object.entries(deNomen.eintraege)) {
    it(`"${id}": jede tabellen-ID existiert wirklich in paradigmen.json oder paradigmen-verben.json`, () => {
      for (const tabelleId of eintrag.tabellen) {
        const existiert = paradigmenTabellenIds.has(tabelleId) || paradigmenVerbenTabellenIds.has(tabelleId);
        expect(existiert).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Belegprüfung gegen die echten Korpusdaten (.daten-cache/out/morphologie).
// Der Cache ist gitignored; ist er nicht vorhanden, wird der Block
// übersprungen statt die Suite rot zu machen.
// ---------------------------------------------------------------------------

// Pfad-Ermittlung über den gemeinsamen Helfer (morphologieCachePfad.ts) statt
// einer eigenen Kopie — siehe Kopf-Kommentar dort: eine lokale Kopie dieses
// Pfades war genau die Ursache, warum diese Gegenprobe nach einem Sprung auf
// eine neue Schema-Version (z. B. v2 -> v3) still übersprungen wurde, ohne
// dass es auffiel.
const MOBILE_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MORPHOLOGIE_DIR = morphologieCacheVorhanden(MOBILE_ROOT) ? morphologieCacheVerzeichnis(MOBILE_ROOT) : null;

interface KorpusFeatures {
  person: string | null;
  gender: string | null;
  number: string | null;
  case: string | null;
  state: string | null;
  mood: string | null;
  tense: string | null;
  voice: string | null;
  verbForm: number | null;
  derivation: string | null;
}
interface KorpusSegment {
  text: string;
  kind: string;
  pos: string;
  features: KorpusFeatures;
  derived: string[];
  raw: string;
}
interface KorpusWort {
  position: number;
  text: string;
  root: string | null;
  lemma: string | null;
  segments: KorpusSegment[];
  syntax: { relation: string; relationAr: string; head: number };
}
interface KorpusDatei {
  schema: number;
  surah: number;
  verses: Record<string, KorpusWort[]>;
}

const surahCache = new Map<number, KorpusDatei>();

function ladeSure(sure: number): KorpusDatei | null {
  if (!MORPHOLOGIE_DIR) return null;
  if (surahCache.has(sure)) return surahCache.get(sure)!;
  const pfad = join(MORPHOLOGIE_DIR, `${sure}.json`);
  if (!existsSync(pfad)) return null;
  const datei = JSON.parse(readFileSync(pfad, 'utf8')) as KorpusDatei;
  surahCache.set(sure, datei);
  return datei;
}

function findeWort(beleg: Beleg): KorpusWort | undefined {
  const datei = ladeSure(beleg.sure);
  if (!datei) return undefined;
  const woerter = datei.verses[String(beleg.vers)];
  if (!woerter) return undefined;
  return woerter.find((w) => w.position === beleg.wort);
}

// Schlüsselwort -> erwartetes Merkmal, das mindestens ein Segment des Worts
// tragen muss. Nur Merkmale, die sich eindeutig und ohne Interpretationsspiel-
// raum aus dem "zeigt"-Text ableiten lassen, werden geprüft.
const MERKMAL_HINWEISE: { muster: RegExp; pruef: (f: KorpusFeatures) => boolean; bezeichnung: string }[] = [
  { muster: /Rafʿ|Nominativ/i, pruef: (f) => f.case === 'nom', bezeichnung: 'case=nom' },
  { muster: /Nasb|Akkusativ/i, pruef: (f) => f.case === 'acc', bezeichnung: 'case=acc' },
  { muster: /Dscharr|Genitiv/i, pruef: (f) => f.case === 'gen', bezeichnung: 'case=gen' },
  { muster: /Dual|Zweizahl/i, pruef: (f) => f.number === 'du', bezeichnung: 'number=du' },
  { muster: /unbestimmt|indefinit/i, pruef: (f) => f.state === 'indefinite', bezeichnung: 'state=indefinite' },
  { muster: /Aktiv-Partizip/i, pruef: (f) => f.derivation === 'activeParticiple', bezeichnung: 'derivation=activeParticiple' },
  { muster: /Passiv-Partizip/i, pruef: (f) => f.derivation === 'passiveParticiple', bezeichnung: 'derivation=passiveParticiple' },
  { muster: /Masdar|Verbalnomen/i, pruef: (f) => f.derivation === 'verbalNoun', bezeichnung: 'derivation=verbalNoun' },
];

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-nomen.json — Belege gegen den echten Morphologie-Korpus', () => {
  for (const [id, eintrag] of Object.entries(deNomen.eintraege)) {
    describe(`Eintrag "${id}"`, () => {
      for (const beleg of eintrag.belege) {
        const bezeichnung = `${beleg.sure}:${beleg.vers}:${beleg.wort}`;

        it(`${bezeichnung} existiert im Korpus`, () => {
          const wort = findeWort(beleg);
          expect(wort).toBeDefined();
        });

        it(`${bezeichnung}: wo aus "zeigt" ableitbar, trägt mindestens ein Segment das behauptete Merkmal`, () => {
          const wort = findeWort(beleg);
          if (!wort) return; // vom vorigen it() bereits als Fehler markiert
          for (const hinweis of MERKMAL_HINWEISE) {
            if (hinweis.muster.test(beleg.zeigt)) {
              const trifftZu = wort.segments.some((s) => hinweis.pruef(s.features));
              expect(trifftZu).toBe(true);
            }
          }
        });
      }
    });
  }

  it('Selbstkontrolle: mindestens 40 Belege wurden tatsächlich gegen den Korpus geprüft', () => {
    let anzahl = 0;
    for (const eintrag of Object.values(deNomen.eintraege)) {
      anzahl += eintrag.belege.length;
    }
    expect(anzahl).toBeGreaterThanOrEqual(40);
  });
});

if (!MORPHOLOGIE_DIR) {
  console.warn(
    `[de-nomen.test.ts] Morphologie-Korpus nicht gefunden (erwartet unter ${morphologieCacheVerzeichnis(MOBILE_ROOT)}) — ` +
      'Belegprüfung gegen den echten Korpus wird übersprungen. ' +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
