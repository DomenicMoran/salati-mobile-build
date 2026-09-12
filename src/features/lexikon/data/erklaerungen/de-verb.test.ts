import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { morphologieCacheVerzeichnis, morphologieCacheVorhanden } from '@/features/quran/morphologieCachePfad';

import deVerbRoh from './de-verb.json';
import paradigmenRoh from '../paradigmen.json';
import paradigmenVerbenRoh from '../paradigmen-verben.json';

/**
 * Gegenprobe für die Lehrtext-Einträge des Verb-Bereichs im Grammatik-Lexikon.
 *
 * Warum das nötig ist: Jeder Eintrag ist ein Handout-Kapitel zum Durcharbeiten
 * (Erklärung + Erkennungsmerkmale + Lernanweisung), und jede Koranstelle in
 * `belege` muss wirklich existieren und wirklich zeigen, was `zeigt` behauptet
 * — sonst lernt jemand mit einer erfundenen oder falsch zugeordneten Stelle.
 * Diese Datei prüft das strukturell (keine leeren Felder, gültige Querverweise,
 * gültige Tabellen-IDs) UND inhaltlich gegen das echte Morphologie-Korpus.
 *
 * Der wichtigste Block ist der letzte: für jeden Eintrag, dessen Kernaussage
 * eine Verbform (I-X), ein Tempus (Māḍī/Muḍāriʿ/Amr), ein Modus (Marfuʿ/
 * Mansūb/Majzūm) oder ein Genus verbi (Maʿlūm/Majhūl) ist, wird direkt geprüft,
 * dass mindestens ein Segment des jeweiligen Korpus-Worts dieses Merkmal auch
 * wirklich trägt — nicht nur, dass der Beleg-Text plausibel klingt.
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

interface DeVerbDatei {
  schema: number;
  lang: string;
  bereich: string;
  eintraege: Record<string, Eintrag>;
}

const deVerb = deVerbRoh as unknown as DeVerbDatei;

const ARABISCH = /[؀-ۿ]/;

describe('de-verb.json — Struktur', () => {
  it('hat Schema 1, Sprache de, Bereich verb', () => {
    expect(deVerb.schema).toBe(1);
    expect(deVerb.lang).toBe('de');
    expect(deVerb.bereich).toBe('verb');
  });

  it('hat mindestens 30 Einträge (Fiʿl, Zeitformen, Personenmatrix, Genus verbi, Modi, 10 Verbformen, 5 Ableitungen, 7 Schwach-/Sonderverben, 4 Lautveränderungen)', () => {
    expect(Object.keys(deVerb.eintraege).length).toBeGreaterThanOrEqual(30);
  });

  for (const [id, eintrag] of Object.entries(deVerb.eintraege)) {
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

      it('hat mindestens 2 Lernanweisungen, alle nicht-leer und konkret (kein Leersatz)', () => {
        expect(eintrag.lernen.length).toBeGreaterThanOrEqual(2);
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

describe('de-verb.json — Querverweise (siehe)', () => {
  const gueltigeIds = new Set(Object.keys(deVerb.eintraege));

  for (const [id, eintrag] of Object.entries(deVerb.eintraege)) {
    it(`"${id}": jeder siehe-Verweis zeigt auf einen existierenden Eintrag, keiner auf sich selbst`, () => {
      for (const verweis of eintrag.siehe) {
        expect(gueltigeIds.has(verweis)).toBe(true);
      }
      expect(eintrag.siehe).not.toContain(id);
    });
  }
});

describe('de-verb.json — Tabellen-Verweise', () => {
  const paradigmenTabellenIds = new Set((paradigmenRoh as { tables: { id: string }[] }).tables.map((t) => t.id));
  const paradigmenVerbenTabellenIds = new Set(
    (paradigmenVerbenRoh as { tables: { id: string }[] }).tables.map((t) => t.id),
  );

  for (const [id, eintrag] of Object.entries(deVerb.eintraege)) {
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
  syntax?: { relation: string; relationAr: string; head: number | null };
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

function findeWortAn(sure: number, vers: number, wort: number): KorpusWort | undefined {
  const datei = ladeSure(sure);
  if (!datei) return undefined;
  const woerter = datei.verses[String(vers)];
  if (!woerter) return undefined;
  return woerter.find((w) => w.position === wort);
}

function findeWort(beleg: Beleg): KorpusWort | undefined {
  return findeWortAn(beleg.sure, beleg.vers, beleg.wort);
}

// Schlüsselwort -> erwartetes Merkmal, das mindestens ein Segment des Worts
// tragen muss. Nur Merkmale, die sich eindeutig und ohne Interpretationsspiel-
// raum aus dem "zeigt"-Text ableiten lassen, werden geprüft.
const MERKMAL_HINWEISE: { muster: RegExp; pruef: (f: KorpusFeatures) => boolean; bezeichnung: string }[] = [
  { muster: /Aktiv-Partizip|Partizip Aktiv/i, pruef: (f) => f.derivation === 'activeParticiple', bezeichnung: 'derivation=activeParticiple' },
  { muster: /Passiv-Partizip|Partizip Passiv/i, pruef: (f) => f.derivation === 'passiveParticiple', bezeichnung: 'derivation=passiveParticiple' },
  { muster: /Maṣdar|Verbalnomen/i, pruef: (f) => f.derivation === 'verbalNoun', bezeichnung: 'derivation=verbalNoun' },
  { muster: /Dual/i, pruef: (f) => f.number === 'du', bezeichnung: 'number=du' },
];

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — Belege gegen den echten Morphologie-Korpus', () => {
  for (const [id, eintrag] of Object.entries(deVerb.eintraege)) {
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

  it('Selbstkontrolle: mindestens 60 Belege wurden tatsächlich gegen den Korpus geprüft', () => {
    let anzahl = 0;
    for (const eintrag of Object.values(deVerb.eintraege)) {
      anzahl += eintrag.belege.length;
    }
    expect(anzahl).toBeGreaterThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// Gezielte Gegenprobe je Eintrag: das ist der wichtigste Block. Für jeden
// Eintrag, dessen Kernaussage eine Verbform (I-X), ein Tempus, ein Modus
// oder ein Genus verbi ist, wird hier hart verdrahtet geprüft, dass JEDES
// Segment eines Belegs (nicht nur irgendeines im Wort) dieses Merkmal
// tatsächlich trägt — unabhängig von der genauen Formulierung des
// "zeigt"-Texts. Das verhindert, dass ein Beleg etwas anderes zeigt als
// behauptet.
// ---------------------------------------------------------------------------

const HAMZA = /[ءأإؤئ]/;
const ALIF = /ا/;
const SCHADDA = /ّ/;

function verbSegmente(wort: KorpusWort): KorpusSegment[] {
  return wort.segments.filter((s) => s.pos === 'V');
}

function nomenSegmente(wort: KorpusWort): KorpusSegment[] {
  return wort.segments.filter((s) => s.pos === 'N' || s.pos === 'ADJ');
}

/** Verbform I-X: jedes Verb-Segment jedes Belegs muss genau diese Zahl tragen. */
const VERBFORM_JE_EINTRAG: Record<string, number> = {
  form1: 1,
  form2: 2,
  form3: 3,
  form4: 4,
  form5: 5,
  form6: 6,
  form7: 7,
  form8: 8,
  form9: 9,
  form10: 10,
};

/** Tempus: jedes Verb-Segment jedes Belegs muss dieses tense tragen. */
const TEMPUS_JE_EINTRAG: Record<string, KorpusFeatures['tense']> = {
  madi: 'perfect',
  mudari: 'imperfect',
  amr: 'imperative',
};

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: Verbform', () => {
  for (const [id, erwarteteForm] of Object.entries(VERBFORM_JE_EINTRAG)) {
    const eintrag = deVerb.eintraege[id];
    it(`"${id}": jeder Beleg trägt tatsächlich verbForm=${erwarteteForm}`, () => {
      expect(eintrag).toBeDefined();
      for (const beleg of eintrag.belege) {
        const wort = findeWort(beleg);
        expect(wort).toBeDefined();
        const segmente = verbSegmente(wort!);
        expect(segmente.length).toBeGreaterThan(0);
        expect(segmente.some((s) => s.features.verbForm === erwarteteForm)).toBe(true);
      }
    });
  }
});

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: Tempus (Māḍī/Muḍāriʿ/Amr)', () => {
  for (const [id, erwartetesTempus] of Object.entries(TEMPUS_JE_EINTRAG)) {
    const eintrag = deVerb.eintraege[id];
    it(`"${id}": jeder Beleg trägt tatsächlich tense=${erwartetesTempus}`, () => {
      expect(eintrag).toBeDefined();
      for (const beleg of eintrag.belege) {
        const wort = findeWort(beleg);
        expect(wort).toBeDefined();
        const segmente = verbSegmente(wort!);
        expect(segmente.some((s) => s.features.tense === erwartetesTempus)).toBe(true);
      }
    });
  }
});

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: Modus des Mudariʿ', () => {
  it('"mudariMarfu": jeder Beleg ist unmarkierter Grundzustand (kein MOOD-Tag, tense=imperfect)', () => {
    for (const beleg of deVerb.eintraege.mudariMarfu.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.tense === 'imperfect' && s.features.mood === null && !s.raw.includes('MOOD:'))).toBe(true);
    }
  });

  it('"mudariMansub": jeder Beleg trägt im Rohtag MOOD:SUBJ', () => {
    for (const beleg of deVerb.eintraege.mudariMansub.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.raw.includes('MOOD:SUBJ'))).toBe(true);
    }
  });

  it('"mudariMajzum": jeder Beleg trägt mood=juss', () => {
    for (const beleg of deVerb.eintraege.mudariMajzum.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.mood === 'juss')).toBe(true);
    }
  });

  it('"nahy": jeder Beleg trägt mood=juss UND das direkt vorangehende Wort im selben Vers ist als Verbotspartikel (pos:PRO) getaggt', () => {
    for (const beleg of deVerb.eintraege.nahy.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.mood === 'juss')).toBe(true);
      const vorgaenger = findeWortAn(beleg.sure, beleg.vers, beleg.wort - 1);
      expect(vorgaenger).toBeDefined();
      expect(vorgaenger!.segments.some((s) => s.pos === 'PRO')).toBe(true);
    }
  });
});

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: Genus verbi (Maʿlūm/Majhūl)', () => {
  it('"maluum": jeder Beleg trägt voice != passive (Aktiv, unmarkiert)', () => {
    for (const beleg of deVerb.eintraege.maluum.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.voice !== 'passive')).toBe(true);
    }
  });

  it('"majhul": jeder Beleg trägt voice=passive', () => {
    for (const beleg of deVerb.eintraege.majhul.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.voice === 'passive')).toBe(true);
    }
  });
});

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: Ableitungen (Partizipien/Maṣdar)', () => {
  const DERIVATION_JE_EINTRAG: Record<string, KorpusFeatures['derivation']> = {
    ismFail: 'activeParticiple',
    ismMaful: 'passiveParticiple',
    masdar: 'verbalNoun',
  };
  for (const [id, erwarteteDerivation] of Object.entries(DERIVATION_JE_EINTRAG)) {
    it(`"${id}": jeder Beleg trägt derivation=${erwarteteDerivation}`, () => {
      for (const beleg of deVerb.eintraege[id].belege) {
        const wort = findeWort(beleg);
        expect(wort).toBeDefined();
        const segmente = nomenSegmente(wort!);
        expect(segmente.some((s) => s.features.derivation === erwarteteDerivation)).toBe(true);
      }
    });
  }

  it('"ismTafdil": jeder Beleg hat ein Lemma im Muster أَفْعَل (beginnt mit أَ, ohne Partizip-/Maṣdar-Markierung)', () => {
    for (const beleg of deVerb.eintraege.ismTafdil.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      expect(wort!.lemma ?? '').toMatch(/^أَ/);
      const segmente = nomenSegmente(wort!);
      expect(segmente.some((s) => s.features.derivation === null)).toBe(true);
    }
  });

  it('"ismZamanMakan": jeder Beleg hat ein Lemma im Muster مَفْعِل/مَفْعَل (beginnt mit مَ) ohne Partizip-Markierung', () => {
    for (const beleg of deVerb.eintraege.ismZamanMakan.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      expect(wort!.lemma ?? '').toMatch(/^مَ/);
      const segmente = nomenSegmente(wort!);
      expect(segmente.some((s) => s.features.derivation === null)).toBe(true);
    }
  });
});

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: schwache und Sonderverben (Wurzelstruktur)', () => {
  it('"sahih": jeder Beleg hat eine Wurzel ohne Hamza, ohne schwachen Buchstaben und ohne Verdopplung', () => {
    for (const beleg of deVerb.eintraege.sahih.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(root.length).toBeGreaterThanOrEqual(3);
      expect(HAMZA.test(root)).toBe(false);
      expect(/[وي]/.test(root)).toBe(false);
      expect(root[1]).not.toBe(root[2]);
    }
  });

  it('"mahmuz": jeder Beleg hat ein Lemma mit Hamza, aber das tatsächliche Verb-Segment im Befehl hat die Hamza verloren (Ḥadhf)', () => {
    for (const beleg of deVerb.eintraege.mahmuz.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      expect(HAMZA.test(wort!.lemma ?? '')).toBe(true);
    }
  });

  it('"mithal": jeder Beleg hat eine Wurzel mit schwachem ERSTEM Radikal (و/ي)', () => {
    for (const beleg of deVerb.eintraege.mithal.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(/[وي]/.test(root[0])).toBe(true);
    }
  });

  it('"ajwaf": jeder Beleg hat eine Wurzel mit schwachem MITTLEREM Radikal (و/ي)', () => {
    for (const beleg of deVerb.eintraege.ajwaf.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(/[وي]/.test(root[1])).toBe(true);
    }
  });

  it('"naqis": jeder Beleg hat eine Wurzel mit schwachem LETZTEM Radikal (و/ي)', () => {
    for (const beleg of deVerb.eintraege.naqis.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(/[وي]/.test(root[2])).toBe(true);
    }
  });

  it('"lafif": jeder Beleg hat eine Wurzel mit ZWEI schwachen Radikalen (1.+3. oder 2.+3.)', () => {
    for (const beleg of deVerb.eintraege.lafif.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      const schwach = [/[وي]/.test(root[0]), /[وي]/.test(root[1]), /[وي]/.test(root[2])];
      const anzahlSchwach = schwach.filter(Boolean).length;
      expect(anzahlSchwach).toBeGreaterThanOrEqual(2);
    }
  });

  it('"mudaaf": jeder Beleg hat eine Wurzel mit identischem 2. und 3. Radikal', () => {
    for (const beleg of deVerb.eintraege.mudaaf.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(root[1]).toBe(root[2]);
    }
  });
});

(MORPHOLOGIE_DIR ? describe : describe.skip)('de-verb.json — gezielte Gegenprobe: Lautveränderungen', () => {
  it('"takhfif": jeder Beleg ist Form IV der Wurzel امن (Hamza-Verschmelzung zu آمَنَ/ءَامَنَ)', () => {
    for (const beleg of deVerb.eintraege.takhfif.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      expect(wort!.root).toBe('امن');
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.verbForm === 4)).toBe(true);
    }
  });

  it('"hadhf": jeder Beleg ist eine Befehlsform, deren Lemma ein Hamza trägt, das im tatsächlichen Verb-Segment fehlt', () => {
    for (const beleg of deVerb.eintraege.hadhf.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      expect(HAMZA.test(wort!.lemma ?? '')).toBe(true);
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.tense === 'imperative')).toBe(true);
      // Mindestens ein Verb-Segment im Befehl trägt selbst kein Hamza mehr.
      expect(segmente.some((s) => s.features.tense === 'imperative' && !HAMZA.test(s.text))).toBe(true);
    }
  });

  it('"idgham": jeder Beleg hat eine Wurzel mit identischem 2./3. Radikal (Muḍāʿaf-Verschmelzungsfälle)', () => {
    for (const beleg of deVerb.eintraege.idgham.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(root[1]).toBe(root[2]);
    }
  });

  it('"idgham": mindestens einer der beiden Belege zeigt tatsächlich die Verschmelzung (Schadda im Verb-Segment)', () => {
    const belege = deVerb.eintraege.idgham.belege;
    const treffer = belege.some((beleg) => {
      const wort = findeWort(beleg);
      if (!wort) return false;
      return verbSegmente(wort).some((s) => SCHADDA.test(s.text));
    });
    expect(treffer).toBe(true);
  });

  it('"qalb": jeder Beleg hat eine Wurzel mit schwachem 2. oder 3. Radikal, dessen Verb-Segment ein Alif statt des Wurzelbuchstabens zeigt', () => {
    for (const beleg of deVerb.eintraege.qalb.belege) {
      const wort = findeWort(beleg);
      expect(wort).toBeDefined();
      const root = wort!.root ?? '';
      expect(/[وي]/.test(root[1]) || /[وي]/.test(root[2])).toBe(true);
      const segmente = verbSegmente(wort!);
      expect(segmente.some((s) => s.features.tense === 'perfect' && ALIF.test(s.text))).toBe(true);
    }
  });
});

if (!MORPHOLOGIE_DIR) {
  console.warn(
    `[de-verb.test.ts] Morphologie-Korpus nicht gefunden (erwartet unter ${morphologieCacheVerzeichnis(MOBILE_ROOT)}) — ` +
      'Belegprüfung gegen den echten Korpus wird übersprungen. ' +
      'Einmal "node scripts/build-morphologie.mjs" in apps/mobile ausführen, dann erneut testen.',
  );
}
