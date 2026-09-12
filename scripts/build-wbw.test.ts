/**
 * Prüft die von scripts/build-wbw.mjs ERZEUGTEN Dateien unter
 * .daten-cache/out/wbw/v2/ — nicht den Bau-Code selbst.
 *
 * Ausführen: cd apps/mobile && npx jest scripts/build-wbw.test.ts
 *
 * Datenform v2: je Vers eine Folge von Wortgruppen [von, bis, Text]. Eine
 * Glosse kann mehrere arabische Wörter überspannen (Verschmelzung in der
 * Quelle, siehe Kopf von build-wbw.mjs). Geprüft wird deshalb nicht mehr die
 * Länge eines Arrays, sondern: lückenlos aufsteigend, von <= bis, keine
 * Überlappung, Vereinigung exakt 1..n, kein leerer Text.
 *
 * Zwei Blöcke, und das mit Absicht:
 *
 * 1. "Selbstkontrolle der Prüfung" läuft IMMER. Sie füttert `pruefeSureDatei`
 *    mit erfundenen Fällen — solche, die anschlagen MÜSSEN (Loch zwischen zwei
 *    Gruppen, Überlappung, absteigende Folge, von > bis, falsches Ende, leerer
 *    Text), und einen, der NICHT anschlagen darf. Ohne das wüsste man nicht,
 *    ob der Datenblock greift oder nur grün ist, weil die Prüfung nichts tut.
 * 2. Der Datenblock läuft nur, wenn die erzeugten Dateien da sind.
 *    .daten-cache/ ist per .gitignore ausgeschlossen (mehrere hundert MB
 *    Zwischenstände), also existiert der Ordner auf einem CI-Läufer nicht.
 *    Statt dort dauerhaft rot zu sein, wird er sichtbar übersprungen — die
 *    Selbstkontrolle oben bleibt davon unberührt.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const MOBILE = path.join(__dirname, '..');
const WBW_DIR = path.join(MOBILE, '.daten-cache', 'out', 'wbw', 'v2');
const KORPUS_DIR = path.join(MOBILE, '.daten-cache', 'out', 'morphologie', 'v3');
const SPRACHEN = ['fr', 'fa', 'id', 'bn', 'ur', 'tr'] as const;
const SUREN = 114;

/** [vonPosition, bisPosition, Text] — beide Grenzen einschließlich, 1-basiert. */
type Gruppe = [number, number, string];

/** Größte Gruppenlänge, die build-wbw.mjs noch ausliefert (dieselbe Zahl wie
 * MAX_GRUPPENLAENGE dort) — über den gesamten Bestand aller 6 Sprachen ist 3
 * Wörter die größte inhaltlich bestätigt korrekte Länge; jede Gruppe der
 * Länge ≥ 4 ist bislang ausschließlich als Fehler aufgetreten (ur 38:3, siehe
 * WBW-PRUEFUNG-2026-09-12.md). Hier dupliziert, weil diese Datei bewusst NICHT
 * aus build-wbw.mjs importiert (siehe Kopf-Kommentar) — die Datei prüft die
 * ERZEUGTEN Dateien, nicht den Bau-Code selbst.*/
const MAX_GRUPPENLAENGE = 3;

type WbwDatei = {
  schema: number;
  lang: string;
  surah: number;
  verses: Record<string, Gruppe[]>;
};

type MetaDatei = {
  schema: number;
  korpus: { verse: number; woerter: number };
  sprachen: Record<
    string,
    {
      verse: number;
      woerter: number;
      gruppen: number;
      anteilVerse: number;
      anteilWoerter: number;
      anteilInMehrwortgruppe: number;
    }
  >;
};

/** Wortzahl je Vers laut eigenem Korpus: sure -> vers -> n. */
type Wortzahlen = Map<number, Map<number, number>>;

/**
 * Die eigentliche Prüfung. Gibt eine Liste von Befunden zurück; leer = in
 * Ordnung. Bewusst als reine Funktion, damit die Selbstkontrolle sie mit
 * erfundenen Daten aufrufen kann.
 */
function pruefeSureDatei(
  daten: WbwDatei,
  sprache: string,
  sure: number,
  wortzahlen: Map<number, number>,
): string[] {
  const befunde: string[] = [];
  if (daten.schema !== 2) befunde.push(`${sprache}/${sure}: schema ${daten.schema} statt 2`);
  if (daten.lang !== sprache) befunde.push(`${sprache}/${sure}: lang "${daten.lang}" statt "${sprache}"`);
  if (daten.surah !== sure) befunde.push(`${sprache}/${sure}: surah ${daten.surah} statt ${sure}`);
  if (!daten.verses || typeof daten.verses !== 'object') {
    befunde.push(`${sprache}/${sure}: verses fehlt`);
    return befunde;
  }

  for (const [versSchluessel, gruppen] of Object.entries(daten.verses)) {
    const vers = Number(versSchluessel);
    const n = wortzahlen.get(vers);
    const ort = `${sprache}/${sure}:${versSchluessel}`;
    if (!Number.isInteger(vers) || n === undefined) {
      befunde.push(`${ort}: Vers gibt es im Korpus nicht`);
      continue;
    }
    if (!Array.isArray(gruppen) || gruppen.length === 0) {
      befunde.push(`${ort}: keine Gruppen`);
      continue;
    }

    let erwarteteVon = 1;
    let vorherigesBis = 0;
    gruppen.forEach((gruppe, i) => {
      if (!Array.isArray(gruppe) || gruppe.length !== 3) {
        befunde.push(`${ort} Gruppe ${i + 1}: kein [von, bis, Text]`);
        return;
      }
      const [von, bis, text] = gruppe;
      if (!Number.isInteger(von) || !Number.isInteger(bis)) {
        befunde.push(`${ort} Gruppe ${i + 1}: von/bis sind keine ganzen Zahlen`);
        return;
      }
      if (von > bis) befunde.push(`${ort} Gruppe ${i + 1}: von ${von} > bis ${bis}`);
      if (bis - von + 1 > MAX_GRUPPENLAENGE) {
        befunde.push(`${ort} Gruppe ${i + 1}: Länge ${bis - von + 1} > ${MAX_GRUPPENLAENGE} (siehe ur 38:3)`);
      }
      // Lückenlos und aufsteigend heißt: jede Gruppe beginnt genau dort, wo
      // die vorige aufgehört hat. Das schließt Loch UND Überlappung aus.
      if (von !== erwarteteVon) {
        befunde.push(
          `${ort} Gruppe ${i + 1}: beginnt bei ${von}, erwartet ${erwarteteVon}` +
            (von > erwarteteVon ? ' (Loch)' : ' (Überlappung)'),
        );
      }
      if (bis <= vorherigesBis) befunde.push(`${ort} Gruppe ${i + 1}: bis ${bis} steigt nicht an`);
      if (typeof text !== 'string') {
        befunde.push(`${ort} Gruppe ${i + 1}: Text ist kein String`);
      } else if (!text.trim()) {
        befunde.push(`${ort} Gruppe ${i + 1}: Text ist leer oder nur Leerraum`);
      }
      erwarteteVon = Math.max(erwarteteVon, bis + 1);
      vorherigesBis = Math.max(vorherigesBis, bis);
    });

    const letztesBis = gruppen[gruppen.length - 1]?.[1];
    if (letztesBis !== n) {
      befunde.push(`${ort}: letzte Gruppe endet bei ${letztesBis}, Korpus sagt ${n} Wörter`);
    }
  }
  return befunde;
}

function ladeKorpusWortzahlen(): Wortzahlen {
  const wortzahlen: Wortzahlen = new Map();
  for (let sure = 1; sure <= SUREN; sure++) {
    const daten = JSON.parse(readFileSync(path.join(KORPUS_DIR, `${sure}.json`), 'utf8')) as {
      verses: Record<string, unknown[]>;
    };
    const proSure = new Map<number, number>();
    for (const [vers, wortListe] of Object.entries(daten.verses)) proSure.set(Number(vers), wortListe.length);
    wortzahlen.set(sure, proSure);
  }
  return wortzahlen;
}

// ---------------------------------------------------------------------------
// 1. Selbstkontrolle der Prüfung — läuft immer, ohne erzeugte Daten.
// ---------------------------------------------------------------------------

describe('Selbstkontrolle: die Prüfung schlägt an, wo sie muss', () => {
  const wortzahlen = new Map<number, number>([
    [1, 4],
    [2, 4],
  ]);
  // Vers 1 mit einer Mehrwortgruppe [2,3], Vers 2 ohne — beides gültig.
  const guteDatei = (): WbwDatei => ({
    schema: 2,
    lang: 'tr',
    surah: 1,
    verses: {
      '1': [
        [1, 1, 'a'],
        [2, 3, 'bc'],
        [4, 4, 'd'],
      ],
      '2': [
        [1, 1, 'e'],
        [2, 2, 'f'],
        [3, 3, 'g'],
        [4, 4, 'h'],
      ],
    },
  });

  test('darf NICHT anschlagen: korrekte Datei mit und ohne Mehrwortgruppe', () => {
    expect(pruefeSureDatei(guteDatei(), 'tr', 1, wortzahlen)).toEqual([]);
  });

  test('MUSS anschlagen: Loch zwischen zwei Gruppen (Position 2 gehört zu nichts)', () => {
    const kaputt = guteDatei();
    kaputt.verses['1'] = [
      [1, 1, 'a'],
      [3, 3, 'c'],
      [4, 4, 'd'],
    ];
    const befunde = pruefeSureDatei(kaputt, 'tr', 1, wortzahlen);
    expect(befunde).toHaveLength(1);
    expect(befunde[0]).toContain('beginnt bei 3, erwartet 2 (Loch)');
  });

  test('MUSS anschlagen: Überlappung zweier Gruppen', () => {
    const kaputt = guteDatei();
    kaputt.verses['1'] = [
      [1, 2, 'ab'],
      [2, 3, 'bc'],
      [4, 4, 'd'],
    ];
    const befunde = pruefeSureDatei(kaputt, 'tr', 1, wortzahlen);
    expect(befunde).toHaveLength(1);
    expect(befunde[0]).toContain('beginnt bei 2, erwartet 3 (Überlappung)');
  });

  test('MUSS anschlagen: von > bis', () => {
    const kaputt = guteDatei();
    kaputt.verses['2'] = [
      [1, 1, 'e'],
      [3, 2, 'fg'],
      [3, 3, 'g'],
      [4, 4, 'h'],
    ];
    const befunde = pruefeSureDatei(kaputt, 'tr', 1, wortzahlen);
    expect(befunde.join(' ')).toContain('von 3 > bis 2');
  });

  test('MUSS anschlagen: Vereinigung deckt nicht bis zur Korpus-Wortzahl', () => {
    const kaputt = guteDatei();
    kaputt.verses['1'] = [
      [1, 1, 'a'],
      [2, 3, 'bc'],
    ];
    const befunde = pruefeSureDatei(kaputt, 'tr', 1, wortzahlen);
    expect(befunde).toHaveLength(1);
    expect(befunde[0]).toContain('endet bei 3, Korpus sagt 4 Wörter');
  });

  test('MUSS anschlagen: leerer Text und Text aus reinem Leerraum', () => {
    const kaputt = guteDatei();
    kaputt.verses['2'] = [
      [1, 1, ''],
      [2, 2, '   '],
      [3, 3, 'g'],
      [4, 4, 'h'],
    ];
    const befunde = pruefeSureDatei(kaputt, 'tr', 1, wortzahlen);
    expect(befunde).toHaveLength(2);
    expect(befunde.join(' ')).toContain('Text ist leer oder nur Leerraum');
  });

  test('MUSS anschlagen: Gruppe länger als 3 Wörter (Muster des Fehlers ur 38:3)', () => {
    const kaputt = guteDatei();
    kaputt.verses['1'] = [[1, 4, 'abcd']];
    const befunde = pruefeSureDatei(kaputt, 'tr', 1, wortzahlen);
    expect(befunde).toHaveLength(1);
    expect(befunde[0]).toContain('Länge 4 > 3');
  });

  test('MUSS anschlagen: Vers, den der Korpus nicht kennt', () => {
    const kaputt = guteDatei();
    kaputt.verses['99'] = [[1, 1, 'x']];
    expect(pruefeSureDatei(kaputt, 'tr', 1, wortzahlen)).toEqual([
      'tr/1:99: Vers gibt es im Korpus nicht',
    ]);
  });

  test('MUSS anschlagen: falsches schema/lang/surah im Kopf', () => {
    const kaputt = { ...guteDatei(), schema: 1, lang: 'de', surah: 7 };
    expect(pruefeSureDatei(kaputt, 'tr', 1, wortzahlen)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Die erzeugten Daten selbst.
// ---------------------------------------------------------------------------

const datenDa = existsSync(path.join(WBW_DIR, 'meta.json')) && existsSync(path.join(KORPUS_DIR, '1.json'));
const beschreibeDaten = datenDa ? describe : describe.skip;

beschreibeDaten('erzeugte WBW-Dateien unter .daten-cache/out/wbw/v2', () => {
  let wortzahlen: Wortzahlen;
  let meta: MetaDatei;

  beforeAll(() => {
    wortzahlen = ladeKorpusWortzahlen();
    meta = JSON.parse(readFileSync(path.join(WBW_DIR, 'meta.json'), 'utf8')) as MetaDatei;
  });

  test('alle sechs Sprachen mit je 114 Suren-Dateien vorhanden', () => {
    for (const sprache of SPRACHEN) {
      const dateien = readdirSync(path.join(WBW_DIR, sprache)).filter((n) => n.endsWith('.json'));
      expect({ sprache, anzahl: dateien.length }).toEqual({ sprache, anzahl: SUREN });
    }
  });

  test.each(SPRACHEN)(
    '%s: Gruppen lückenlos aufsteigend, ohne Überlappung, Vereinigung exakt 1..n, kein leerer Text',
    (sprache) => {
      const befunde: string[] = [];
      for (let sure = 1; sure <= SUREN; sure++) {
        const datei = path.join(WBW_DIR, sprache, `${sure}.json`);
        const daten = JSON.parse(readFileSync(datei, 'utf8')) as WbwDatei;
        befunde.push(...pruefeSureDatei(daten, sprache, sure, wortzahlen.get(sure)!));
      }
      expect(befunde.slice(0, 20)).toEqual([]);
    },
  );

  test('meta.json deckt sich mit den tatsächlich geschriebenen Dateien', () => {
    const gezaehlt: Record<string, { verse: number; woerter: number; gruppen: number }> = {};
    for (const sprache of SPRACHEN) {
      let verse = 0;
      let woerter = 0;
      let gruppenZahl = 0;
      for (let sure = 1; sure <= SUREN; sure++) {
        const daten = JSON.parse(readFileSync(path.join(WBW_DIR, sprache, `${sure}.json`), 'utf8')) as WbwDatei;
        for (const gruppen of Object.values(daten.verses)) {
          verse++;
          gruppenZahl += gruppen.length;
          woerter += gruppen[gruppen.length - 1][1];
        }
      }
      gezaehlt[sprache] = { verse, woerter, gruppen: gruppenZahl };
    }

    const ausMeta: Record<string, { verse: number; woerter: number; gruppen: number }> = {};
    for (const sprache of SPRACHEN) {
      const s = meta.sprachen[sprache];
      ausMeta[sprache] = { verse: s.verse, woerter: s.woerter, gruppen: s.gruppen };
    }
    expect(ausMeta).toEqual(gezaehlt);
  });

  test('meta.json: Anteile passen zu den Zahlen, Korpus-Summen stimmen', () => {
    expect(meta.schema).toBe(2);
    // 6236 Verse / 77.429 Wörter — dieselbe Referenz wie in
    // scripts/build-morphologie.test.mjs.
    expect(meta.korpus).toEqual({ verse: 6236, woerter: 77429 });
    for (const sprache of SPRACHEN) {
      const s = meta.sprachen[sprache];
      expect(s.anteilVerse).toBeCloseTo(s.verse / meta.korpus.verse, 4);
      expect(s.anteilWoerter).toBeCloseTo(s.woerter / meta.korpus.woerter, 4);
      expect(s.gruppen).toBeLessThanOrEqual(s.woerter);
      expect(s.verse).toBeGreaterThan(0);
      expect(s.verse).toBeLessThanOrEqual(meta.korpus.verse);
      expect(s.anteilInMehrwortgruppe).toBeGreaterThanOrEqual(0);
      expect(s.anteilInMehrwortgruppe).toBeLessThan(1);
    }
  });

  test('meta.json: Anteil in Mehrwortgruppen ist aus den Dateien nachgerechnet', () => {
    for (const sprache of SPRACHEN) {
      let woerter = 0;
      let inMehrwortgruppe = 0;
      for (let sure = 1; sure <= SUREN; sure++) {
        const daten = JSON.parse(readFileSync(path.join(WBW_DIR, sprache, `${sure}.json`), 'utf8')) as WbwDatei;
        for (const gruppen of Object.values(daten.verses)) {
          woerter += gruppen[gruppen.length - 1][1];
          for (const [von, bis] of gruppen) if (bis > von) inMehrwortgruppe += bis - von + 1;
        }
      }
      expect({ sprache, anteil: Number((inMehrwortgruppe / woerter).toFixed(4)) }).toEqual({
        sprache,
        anteil: meta.sprachen[sprache].anteilInMehrwortgruppe,
      });
    }
  });

  test('Stichprobe: tr 2:4 fasst مِن قَبْلِكَ zu einer Gruppe [8,9] zusammen', () => {
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'tr', '2.json'), 'utf8')) as WbwDatei;
    const gruppen = daten.verses['4'];
    const mehrwort = gruppen.filter(([von, bis]) => bis > von);
    expect(mehrwort).toEqual([[8, 9, 'senden önce']]);
    expect(gruppen[gruppen.length - 1][1]).toBe(12);
  });

  test('Stichprobe: tr 3:5 bindet die Schlusslücken über die Gegenrichtung an', () => {
    // Positionen 10 (P, bindet laut Wortart nach rechts) und 11 (N) stehen am
    // Versende; rechts von 10 liegt keine beglosste Zelle mehr, also greift
    // die Gegenrichtung und beide gehören zu "ve gökte" an Position 9.
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'tr', '3.json'), 'utf8')) as WbwDatei;
    const gruppen = daten.verses['5'];
    expect(gruppen[gruppen.length - 1]).toEqual([9, 11, 've gökte']);
  });

  test('Stichprobe: ur 38:61 bindet die Schlusslücken über die Gegenrichtung an', () => {
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'ur', '38.json'), 'utf8')) as WbwDatei;
    const gruppen = daten.verses['61'];
    expect(gruppen[gruppen.length - 1][0]).toBe(9);
    expect(gruppen[gruppen.length - 1][1]).toBe(11);
  });

  test('Stichprobe: fr 1:1 hat vier Einzelgruppen, keine davon die Versnummer', () => {
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'fr', '1.json'), 'utf8')) as WbwDatei;
    expect(daten.verses['1']).toHaveLength(4);
    expect(daten.verses['1'].every(([von, bis]) => von === bis)).toBe(true);
    expect(daten.verses['1'].some(([, , text]) => /^\(?\d+\)?$/.test(text))).toBe(false);
  });

  test('Stichprobe: id 1:1 endet nicht mit der Endmarkierung "(1)"', () => {
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'id', '1.json'), 'utf8')) as WbwDatei;
    const gruppen = daten.verses['1'];
    expect(gruppen[gruppen.length - 1][1]).toBe(4);
    expect(gruppen[gruppen.length - 1][2]).not.toBe('(1)');
  });

  // -------------------------------------------------------------------------
  // Regressionsfälle aus WBW-PRUEFUNG-2026-09-12.md: je ein echter Fall aus
  // dem Befund, der nach der Korrektur nicht mehr (falsch) ausgeliefert wird.
  // -------------------------------------------------------------------------

  test('Fund HOCH 1 behoben: ur 38:3 (Positionsverschiebung) fehlt jetzt ganz, statt eine falsche Länge-5-Gruppe zu zeigen', () => {
    // Vorher: Gruppe [6,10] mit Text "اس وقت کوئی نجات" — die Rohquelle
    // nummeriert ihre 6 echten Übersetzungseinheiten 1..6 statt an der
    // arabischen Startposition 1,3,5,7,8,9; zwei arabische Wörter (قَرْنٍ,
    // فَنَادَوا۟) verlieren dadurch ihre eigentliche Übersetzung. Die
    // Gruppe-zu-lang-Prüfung (MAX_GRUPPENLAENGE=3) verwirft den ganzen Vers,
    // die App fällt für 38:3 komplett auf Englisch zurück.
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'ur', '38.json'), 'utf8')) as WbwDatei;
    expect(daten.verses['3']).toBeUndefined();
  });

  test('Fund NIEDRIG 4 behoben: ur 2:140 (arabisches Wort unübersetzt kopiert) fehlt jetzt ganz', () => {
    // Vorher: Position 12 trug "نَصَٰرَىٰ" — zeichengleich mit dem arabischen
    // Koranwort an derselben Stelle (Korpus-`text` inkl. Vokalzeichen), statt
    // einer urdu-eigenen Wiedergabe. Die arabisch-unuebersetzt-Prüfung
    // verwirft den ganzen Vers.
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'ur', '2.json'), 'utf8')) as WbwDatei;
    expect(daten.verses['140']).toBeUndefined();
  });

  test('Fund MITTEL 2 behoben: fa 3:27 zeigt keinen "<null>"-Platzhalter mehr', () => {
    // Vorher: Position 1 trug wörtlich den String "<null>" statt persischem
    // Text (einer von 52 Fällen, siehe Befund). istPlatzhalter() behandelt
    // das wie eine Lücke — Position 1 geht in der Nachbargruppe auf, "<null>"
    // erscheint nirgends mehr im ausgelieferten Text.
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'fa', '3.json'), 'utf8')) as WbwDatei;
    const gruppen = daten.verses['27'];
    expect(gruppen).toBeDefined();
    expect(gruppen.some(([, , text]) => text === '<null>')).toBe(false);
  });

  test('Weiterer Platzhalter (Auftragspunkt 3) behoben: fr 2:27 verschmilzt "[]" statt es als eigene Glosse zu zeigen', () => {
    // fr markiert dieselbe Verschmelzung (مِنۢ بَعْدِ = "danach"), die ur/tr mit
    // einem leeren String kennzeichnen, mit dem literalen "[]" — 136 Fälle
    // im gesamten fr-Bestand, immer unmittelbar vor "après". Vorher bekam die
    // Position ihre eigene falsche Glosse "[]"; jetzt geht sie in der Gruppe
    // mit "après" auf.
    const daten = JSON.parse(readFileSync(path.join(WBW_DIR, 'fr', '2.json'), 'utf8')) as WbwDatei;
    const gruppen = daten.verses['27'];
    expect(gruppen.some(([, , text]) => text === '[]')).toBe(false);
    expect(gruppen).toContainEqual([5, 6, 'après']);
  });

  test('Regressionsschutz: keine ausgelieferte Gruppe ist länger als 3 Wörter', () => {
    // Direkte Kontrolle über den GESAMTEN Bestand aller 6 Sprachen (nicht nur
    // die Selbstkontrolle mit erfundenen Daten oben): die im Befund als
    // einziger Fall bestätigte Länge-5-Gruppe (ur 38:3) darf nirgends mehr
    // vorkommen, egal in welcher Sprache/Sure.
    const zuLang: string[] = [];
    for (const sprache of SPRACHEN) {
      for (let sure = 1; sure <= SUREN; sure++) {
        const daten = JSON.parse(readFileSync(path.join(WBW_DIR, sprache, `${sure}.json`), 'utf8')) as WbwDatei;
        for (const [vers, gruppen] of Object.entries(daten.verses)) {
          for (const [von, bis] of gruppen) {
            if (bis - von + 1 > 3) zuLang.push(`${sprache}/${sure}:${vers} [${von},${bis}]`);
          }
        }
      }
    }
    expect(zuLang).toEqual([]);
  });
});
