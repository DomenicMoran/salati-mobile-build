import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import dePartikelRoh from './de-partikel-syntax.json';
import paradigmenRoh from '../paradigmen.json';
import paradigmenVerbenRoh from '../paradigmen-verben.json';
import { relationBasis } from '../../../quran/grammatik';

/**
 * Gegenprobe für die Lehrtext-Einträge des Partikel-/Syntax-Bereichs im
 * Grammatik-Lexikon (Harf, Präpositionen, Konjunktionen, Verneinung, Kaana/
 * Inna und ihre Schwestern, Satzglieder/Iʿrab).
 *
 * Struktur- und Belegprüfung folgen demselben Muster wie
 * de-nomen.test.ts (Struktur, Querverweise, Tabellen-Verweise, Existenz jeder
 * Beleg-Koordinate im echten Korpus). Zusätzlich prüft dieser Bereich, wo es
 * um eine konkrete Satzrolle geht, dass das Beleg-Wort im Korpus wirklich die
 * behauptete `syntax.relation` (bzw. bei Kaana/Inna: denselben Basiswert nach
 * relationBasis()) oder das behauptete POS-Tag trägt — nicht nur irgendein
 * Wort an der genannten Stelle. Das ist hier besonders wichtig, weil der
 * gesamte Bereich aus Satzrollen und Partikel-Funktionen besteht, die sich
 * nur über die Korpus-Syntax (nicht über Wortmerkmale wie bei Nomen) belegen
 * lassen.
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

interface DePartikelDatei {
  schema: number;
  lang: string;
  bereich: string;
  eintraege: Record<string, Eintrag>;
}

const dePartikel = dePartikelRoh as unknown as DePartikelDatei;

const ARABISCH = /[؀-ۿ]/;

describe('de-partikel-syntax.json — Struktur', () => {
  it('hat Schema 1, Sprache de, Bereich partikel-syntax', () => {
    expect(dePartikel.schema).toBe(1);
    expect(dePartikel.lang).toBe('de');
    expect(dePartikel.bereich).toBe('partikel-syntax');
  });

  it('hat mindestens 20 Einträge (Harf allgemein, Präpositionen, Konjunktionen inkl. der beiden Faa-Sonderformen, Verneinung, Lam al-Amr, Nahy, Fragepartikeln, Bedingungssätze, Kaana/Inna, und die geforderten Iʿrab-Rollen)', () => {
    expect(Object.keys(dePartikel.eintraege).length).toBeGreaterThanOrEqual(20);
  });

  for (const [id, eintrag] of Object.entries(dePartikel.eintraege)) {
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

describe('de-partikel-syntax.json — Querverweise (siehe)', () => {
  // Alle "siehe"-Verweise in diesem Bereich zeigen bewusst nur auf andere
  // Einträge derselben Datei (kein bereichsübergreifender Verweis nötig) —
  // diese Liste bliebe der Ort für eine dokumentierte Ausnahme, falls das
  // sich künftig ändert.
  const BEKANNTE_AUSNAHMEN_AUSSERHALB_DIESER_DATEI = new Set<string>([]);

  const gueltigeIds = new Set(Object.keys(dePartikel.eintraege));

  for (const [id, eintrag] of Object.entries(dePartikel.eintraege)) {
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

describe('de-partikel-syntax.json — Tabellen-Verweise', () => {
  const paradigmenTabellenIds = new Set((paradigmenRoh as { tables: { id: string }[] }).tables.map((t) => t.id));
  const paradigmenVerbenTabellenIds = new Set(
    (paradigmenVerbenRoh as { tables: { id: string }[] }).tables.map((t) => t.id),
  );

  for (const [id, eintrag] of Object.entries(dePartikel.eintraege)) {
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
// dass es auffiel. Hinweis: diese Datei liegt (wie de-nomen.test.ts und
// de-verb.test.ts) unter data/erklaerungen/ — fünf Ebenen bis zum
// apps/mobile-Wurzelverzeichnis, nicht vier (die vorige lokale Kopie zählte
// sich hier falsch und zeigte dadurch auf apps/mobile/src/... statt
// apps/mobile/..., weshalb dieser Block bislang IMMER übersprungen wurde,
// unabhängig von v2/v3).
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
  syntax: { relation: string; relationAr: string; head: number | null };
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

function findeVersWoerter(sure: number, vers: number): KorpusWort[] | undefined {
  const datei = ladeSure(sure);
  return datei?.verses[String(vers)];
}

function findeWort(beleg: Beleg): KorpusWort | undefined {
  return findeVersWoerter(beleg.sure, beleg.vers)?.find((w) => w.position === beleg.wort);
}

// ---------------------------------------------------------------------------
// Merkmalsprüfung: welches Merkmal muss jeder Beleg tragen? Die Reihenfolge
// je Eintrag entspricht exakt der Reihenfolge der Belege in der JSON-Datei
// (per Konstruktion dieser Datei bewusst so gehalten, siehe Kommentare
// unten). "relation" prüft syntax.relation direkt (Kaana-/Inna-Sonderformen
// ausgenommen), "relationBasis" prüft relationBasis(relation).basis
// (optional zusätzlich "regens"), "pos" prüft, ob mindestens ein Segment
// dieses POS-Tag trägt.
// ---------------------------------------------------------------------------

type Erwartung =
  | { art: 'relation'; wert: string }
  | { art: 'relationBasis'; basis: string; regens?: string[] }
  | { art: 'pos'; wert: string }
  | { art: 'nichtHarfNeutral' }; // Sammelfall für den allgemeinen "harf"-Eintrag: irgendein Harf-Segment

// POS-Tags, die im Korpus tatsächlich für Partikel-Segmente stehen (siehe
// meta.json -> posHaeufigkeit) — alles, was NICHT Ism/Fiʿl/Pronomen/Artikel
// ist. Für den allgemeinen "harf"-Eintrag reicht der Nachweis, dass
// mindestens ein Segment eines dieser Tags trägt.
const HARF_POS = new Set([
  'P',
  'CONJ',
  'NEG',
  'REM',
  'EMPH',
  'T',
  'COND',
  'INTG',
  'SUB',
  'LOC',
  'RES',
  'CERT',
  'VOC',
  'RSLT',
  'PRO',
  'PRP',
  'CIRC',
  'SUP',
  'PREV',
  'FUT',
  'RET',
  'EXP',
  'INC',
  'CAUS',
  'IMPV',
  'EXL',
  'AMD',
  'INT',
  'ANS',
  'EXH',
  'SUR',
  'AVR',
  'INL',
  'EQ',
  'COM',
  'IMPN',
]);

const ERWARTUNGEN: Record<string, Erwartung[]> = {
  harf: [{ art: 'nichtHarfNeutral' }, { art: 'nichtHarfNeutral' }],
  'huruf-jarr': [{ art: 'pos', wert: 'P' }, { art: 'pos', wert: 'P' }],
  'huruf-atf': [
    { art: 'relationBasis', basis: 'conj' },
    { art: 'relationBasis', basis: 'conj' },
    { art: 'relationBasis', basis: 'conj' },
    { art: 'relationBasis', basis: 'conj' },
  ],
  'faa-sababiyya': [{ art: 'pos', wert: 'CAUS' }, { art: 'pos', wert: 'CAUS' }],
  'faa-jawab': [{ art: 'pos', wert: 'RSLT' }, { art: 'pos', wert: 'RSLT' }],
  // verneinung wird unten gesondert geprüft (Kontrastpaar echte
  // Verneinung / KEINE Verneinung) statt über dieses generische Schema.
  'lam-al-amr': [{ art: 'pos', wert: 'IMPV' }, { art: 'pos', wert: 'IMPV' }],
  nahy: [{ art: 'relation', wert: 'Pro' }, { art: 'relation', wert: 'Pro' }],
  istifham: [{ art: 'pos', wert: 'INTG' }, { art: 'pos', wert: 'INTG' }],
  shart: [{ art: 'relationBasis', basis: 'cond' }, { art: 'relationBasis', basis: 'rslt' }],
  'kaana-wa-akhawatuha': [
    { art: 'relationBasis', basis: 'pred', regens: ['kan'] },
    { art: 'relationBasis', basis: 'subj', regens: ['ykon'] },
  ],
  'inna-wa-akhawatuha': [
    { art: 'relationBasis', basis: 'subj', regens: ['in'] },
    { art: 'relationBasis', basis: 'pred', regens: ['in'] },
  ],
  faail: [{ art: 'relation', wert: 'Subj' }, { art: 'relation', wert: 'Subj' }],
  'naib-al-fail': [{ art: 'relation', wert: 'Pass' }, { art: 'relation', wert: 'Pass' }],
  'maful-bihi': [{ art: 'relation', wert: 'Obj' }, { art: 'relation', wert: 'Obj' }],
  'maful-mutlaq': [{ art: 'relation', wert: 'cog' }, { art: 'relation', wert: 'cog' }],
  'maful-liajlihi': [{ art: 'relation', wert: 'prp' }, { art: 'relation', wert: 'prp' }],
  // mubtada wird unten gesondert geprüft (strukturelle Kopf-Eigenschaft
  // statt einer eigenen Relation, die es im Korpus nicht gibt).
  khabar: [{ art: 'relation', wert: 'Pred' }, { art: 'relation', wert: 'Pred' }],
  sifah: [{ art: 'relation', wert: 'Adj' }, { art: 'relation', wert: 'Adj' }],
  haal: [{ art: 'relation', wert: 'circ' }, { art: 'relation', wert: 'circ' }],
  tamyiz: [{ art: 'relation', wert: 'Spec' }, { art: 'relation', wert: 'Spec' }],
  badal: [
    { art: 'relationBasis', basis: 'App' },
    { art: 'relationBasis', basis: 'App' },
  ],
  'mudaf-ilayh': [{ art: 'relation', wert: 'Poss' }, { art: 'relation', wert: 'Poss' }],
  munada: [{ art: 'relation', wert: 'voc' }, { art: 'relation', wert: 'voc' }],
  mustathna: [{ art: 'relation', wert: 'exp' }, { art: 'relation', wert: 'exp' }],
  taukid: [{ art: 'relation', wert: 'emph' }, { art: 'relation', wert: 'emph' }],
};

function pruefeErwartung(wort: KorpusWort, erwartung: Erwartung): boolean {
  switch (erwartung.art) {
    case 'relation':
      return wort.syntax?.relation === erwartung.wert;
    case 'relationBasis': {
      const { basis, regens } = relationBasis(wort.syntax?.relation ?? '');
      if (basis !== erwartung.basis) return false;
      if (erwartung.regens && (!regens || !erwartung.regens.includes(regens))) return false;
      return true;
    }
    case 'pos':
      return wort.segments.some((s) => s.pos === erwartung.wert);
    case 'nichtHarfNeutral':
      return wort.segments.some((s) => HARF_POS.has(s.pos));
    default:
      return false;
  }
}

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-partikel-syntax.json — Belege gegen den echten Morphologie-Korpus', () => {
  for (const [id, eintrag] of Object.entries(dePartikel.eintraege)) {
    describe(`Eintrag "${id}"`, () => {
      eintrag.belege.forEach((beleg, index) => {
        const bezeichnung = `${beleg.sure}:${beleg.vers}:${beleg.wort}`;

        it(`${bezeichnung} existiert im Korpus`, () => {
          const wort = findeWort(beleg);
          expect(wort).toBeDefined();
        });

        const erwartung = ERWARTUNGEN[id]?.[index];
        if (erwartung) {
          it(`${bezeichnung}: trägt das für "${id}" (Beleg ${index + 1}) behauptete Merkmal (${erwartung.art})`, () => {
            const wort = findeWort(beleg);
            if (!wort) return; // vom vorigen it() bereits als Fehler markiert
            expect(pruefeErwartung(wort, erwartung)).toBe(true);
          });
        }
      });
    });
  }

  it('Selbstkontrolle: mindestens 40 Belege wurden tatsächlich gegen den Korpus geprüft', () => {
    let anzahl = 0;
    for (const eintrag of Object.values(dePartikel.eintraege)) {
      anzahl += eintrag.belege.length;
    }
    expect(anzahl).toBeGreaterThanOrEqual(40);
  });

  // -------------------------------------------------------------------------
  // Badal (App) und 'Atf (conj) sind vom Nutzer ausdrücklich als die beiden
  // Begriffe genannt, die "besonders ausführlich" belegt sein müssen — dieser
  // Block prüft zusätzlich zur generischen Schleife oben explizit UND
  // unabhängig, dass jeder Badal-Beleg wirklich relationBasis().basis "App"
  // trägt und jeder 'Atf-Beleg wirklich "conj" — nicht nur irgendein Wort an
  // der Stelle.
  // -------------------------------------------------------------------------
  describe('Badal (بدل) — jeder Beleg trägt wirklich Basiswert "App"', () => {
    const badal = dePartikel.eintraege['badal'];
    for (const beleg of badal.belege) {
      it(`${beleg.sure}:${beleg.vers}:${beleg.wort}`, () => {
        const wort = findeWort(beleg);
        expect(wort).toBeDefined();
        expect(relationBasis(wort!.syntax.relation).basis).toBe('App');
      });
    }
  });

  describe('Harf al-\'Atf (عطف) — jeder Beleg trägt wirklich Basiswert "conj"', () => {
    const atf = dePartikel.eintraege['huruf-atf'];
    for (const beleg of atf.belege) {
      it(`${beleg.sure}:${beleg.vers}:${beleg.wort}`, () => {
        const wort = findeWort(beleg);
        expect(wort).toBeDefined();
        expect(relationBasis(wort!.syntax.relation).basis).toBe('conj');
      });
    }
  });

  // -------------------------------------------------------------------------
  // Verneinung: Kontrastpaar. Das erste مَا (2:9) MUSS eine echte Verneinung
  // sein, das zweite مَا (2:29) — im "zeigt"-Text ausdrücklich als
  // Relativpronomen benannt — DARF KEINE Verneinung sein. Der ganze Witz
  // dieses Eintrags (die Warnung, dass مَا oft keine Verneinung ist) wäre
  // wertlos, wenn beide Belege zufällig doch verneinen würden.
  // -------------------------------------------------------------------------
  describe('Verneinung — Kontrastpaar مَا: echte Verneinung vs. Relativpronomen', () => {
    const verneinung = dePartikel.eintraege['verneinung'];

    it('2:9:6 (يَخْدَعُونَ) trägt die Relation neg — echte Verneinung', () => {
      const beleg = verneinung.belege.find((b) => b.sure === 2 && b.vers === 9 && b.wort === 6);
      expect(beleg).toBeDefined();
      const wort = findeWort(beleg!);
      expect(wort?.syntax.relation).toBe('neg');
    });

    it('2:29:5 (مَّا) trägt NICHT die Relation neg, sondern Obj — kein Verneinungswort', () => {
      const beleg = verneinung.belege.find((b) => b.sure === 2 && b.vers === 29 && b.wort === 5);
      expect(beleg).toBeDefined();
      const wort = findeWort(beleg!);
      expect(wort?.syntax.relation).not.toBe('neg');
      expect(wort?.syntax.relation).toBe('Obj');
      expect(wort?.segments.some((s) => s.pos === 'REL')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Mubtada: Es gibt im Korpus keine eigene "Mubtada"-Relation — der Mubtada
  // ist strukturell der Kopf, auf den ein Chabar mit Relation Pred (bzw.
  // pred<<...>> bei Kaana/Inna) per head zurückverweist. Diese Prüfung
  // verifiziert genau das, statt nur die reine Existenz der Wortstelle.
  // -------------------------------------------------------------------------
  describe('Mubtada — jedes Beleg-Wort ist wirklich Kopf eines Chabar (Pred-Relation)', () => {
    const mubtada = dePartikel.eintraege['mubtada'];
    for (const beleg of mubtada.belege) {
      it(`${beleg.sure}:${beleg.vers}:${beleg.wort} hat im selben Vers ein Wort mit Pred-Relation, dessen head auf dieses Wort zeigt`, () => {
        const woerter = findeVersWoerter(beleg.sure, beleg.vers);
        expect(woerter).toBeDefined();
        const hatChabar = woerter!.some((w) => w.syntax?.head === beleg.wort && relationBasis(w.syntax.relation).basis === 'Pred');
        expect(hatChabar).toBe(true);
      });
    }
  });
});

if (!MORPHOLOGIE_DIR) {
  console.warn(
    `[de-partikel-syntax.test.ts] Morphologie-Korpus nicht gefunden (erwartet unter ${morphologieCacheVerzeichnis(MOBILE_ROOT)}) — ` +
      'Belegprüfung gegen den echten Korpus wird übersprungen. ' +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
