// Zitat-Modus: Erzwingung und extraktive Auswahl.
//
// Der Kern dieser Datei ist die GEGENPROBE: Genau die Fehler, die das
// Gerätemodell in der Messung vom 2026-07-27/28 gemacht hat (umgedrehte
// Verneinung, geänderte Zahl, erfundene Versnummer, ausgelassener Schritt),
// müssen von `pruefeAntwort` abgewiesen werden. Ginge auch nur einer davon
// durch, wäre der Zitat-Modus wertlos.
import {
  abschnitte,
  besterAusschnitt,
  formatiereZitate,
  istAnleitung,
  normalisiereZitat,
  pruefeAntwort,
  waehleZitate,
  zitatAntwort,
} from './zitat';
import type { KorpusDoc } from './retrieval';

const ALKOHOL: KorpusDoc = {
  id: 'w-alkohol',
  src: 'Salati-Wissen: Alkohol im Islam',
  t: 'Berauschende Getränke sind im Islam verboten. Der Koran nennt sie zusammen mit dem Glücksspiel einen Greuel vom Werk des Satans. Es gilt nicht nur für das Trinken selbst, sondern auch für Herstellung, Handel und Ausschank.',
};
const DHUHR: KorpusDoc = {
  id: 'w-gebet-dhuhr',
  src: 'Salati-Wissen: Dhuhr — das Mittagsgebet',
  t: 'Dhuhr ist das Mittagsgebet. Dhuhr hat vier Rakat Pflichtgebet.',
};
const ZAKAT: KorpusDoc = {
  id: 'w-zakat',
  src: 'Salati-Wissen: Zakat — die Pflichtabgabe',
  t: 'Wer ein Mondjahr lang Vermögen oberhalb des Nisab-Werts besitzt, gibt davon 2,5 Prozent ab.',
};
const WUDU: KorpusDoc = {
  id: 'w-wudu-kurz',
  src: 'Salati-Wissen: Wudu — die Gebetswaschung',
  t: 'Ohne Wudu kein Gebet. Die Schritte der Reihe nach: 1. Absicht fassen und Bismillah sagen. 2. Beide Hände waschen, dreimal. 3. Mund ausspülen, dreimal. 4. Das Gesicht waschen, dreimal. 5. Die Arme bis zu den Ellenbogen waschen. 6. Über den Kopf streichen. 7. Die Füße bis zu den Knöcheln waschen. 8. Zum Abschluss die Schahada sprechen.',
};

describe('Abschnitte zerlegen', () => {
  test('trennt Sätze und behält die Lage im Quellentext', () => {
    const teile = abschnitte('Erster Satz. Zweiter Satz!');
    expect(teile.map((a) => a.text)).toEqual(['Erster Satz.', 'Zweiter Satz!']);
    const quelle = 'Erster Satz. Zweiter Satz!';
    expect(quelle.slice(teile[1]!.start, teile[1]!.ende)).toBe('Zweiter Satz!');
  });

  test('hängt reine Aufzählungsmarker an den folgenden Schritt', () => {
    const teile = abschnitte('1. Hände waschen. 2. Mund ausspülen.');
    expect(teile.map((a) => a.text)).toEqual(['1. Hände waschen.', '2. Mund ausspülen.']);
  });

  test('trennt an Zeilenumbrüchen auch ohne Satzzeichen', () => {
    expect(abschnitte('Zeile eins\nZeile zwei').map((a) => a.text)).toEqual(['Zeile eins', 'Zeile zwei']);
  });

  test('erkennt das arabische Fragezeichen, den Urdu-Punkt und das Danda', () => {
    expect(abschnitte('ما هو التيمم؟ هو بديل الوضوء.').length).toBe(2);
    expect(abschnitte('ظہر چار رکعت ہے۔ عصر چار رکعت ہے۔').length).toBe(2);
    expect(abschnitte('আল্লাহ এক। তিনি স্রষ্টা।').length).toBe(2);
  });
});

describe('Normalisierung glättet nur Form, nie Inhalt', () => {
  test('Leerraum, Groß-/Kleinschreibung und Satzzeichen sind egal', () => {
    expect(normalisiereZitat('Dhuhr  hat vier Rakat!')).toBe(normalisiereZitat('dhuhr hat vier rakat'));
  });

  test('Zahlen verschmelzen NICHT, wenn Satzzeichen wegfallen', () => {
    // Würden Satzzeichen gelöscht statt durch Leerraum ersetzt, wäre „2,5" gleich
    // „25" — und eine erfundene Prozentzahl käme als belegt durch.
    expect(normalisiereZitat('2,5 Prozent')).not.toBe(normalisiereZitat('25 Prozent'));
  });

  test('Verneinung und Zahlwort bleiben unterscheidbar', () => {
    expect(normalisiereZitat('ist verboten')).not.toBe(normalisiereZitat('ist erlaubt'));
    expect(normalisiereZitat('vier Rakat')).not.toBe(normalisiereZitat('zwei Rakat'));
  });

  test('prüft an Wortgrenzen — „vier" steckt nicht in „vierzig"', () => {
    expect(normalisiereZitat('Es sind vierzig Tage.').includes(normalisiereZitat('vier'))).toBe(false);
  });
});

describe('Erzwingung: belegte Sätze bleiben', () => {
  test('wörtlicher Satz aus der Quelle wird behalten', () => {
    const { belegt, unbelegt } = pruefeAntwort('Berauschende Getränke sind im Islam verboten.', [ALKOHOL]);
    expect(belegt).toEqual(['Berauschende Getränke sind im Islam verboten.']);
    expect(unbelegt).toEqual([]);
  });

  test('Anfang eines Quellensatzes reicht — gekürzt ist nicht erfunden', () => {
    expect(pruefeAntwort('Der Koran nennt sie zusammen mit dem Glücksspiel.', [ALKOHOL]).belegt).toHaveLength(1);
  });

  test('Wiederholungsschleifen werden auf ein Vorkommen eingedampft', () => {
    const satz = 'Dhuhr hat vier Rakat Pflichtgebet.';
    expect(pruefeAntwort(`${satz} ${satz} ${satz}`, [DHUHR]).belegt).toEqual([satz]);
  });
});

describe('GEGENPROBE: erfundene Antworten werden abgewiesen', () => {
  test('umgedrehte Verneinung („Ja, Wein ist erlaubt")', () => {
    const { belegt, unbelegt } = pruefeAntwort('Ja, Wein ist im Islam erlaubt.', [ALKOHOL]);
    expect(belegt).toEqual([]);
    expect(unbelegt).toHaveLength(1);
  });

  test('geänderte Zahl („Dhuhr hat zwei Rakat")', () => {
    expect(pruefeAntwort('Dhuhr hat zwei Rakat Pflichtgebet.', [DHUHR]).belegt).toEqual([]);
  });

  test('erfundene Prozentzahl trotz gleicher Ziffern in der Quelle', () => {
    expect(pruefeAntwort('Man gibt davon 25 Prozent ab.', [ZAKAT]).belegt).toEqual([]);
    expect(pruefeAntwort('Man gibt davon 2,5 Prozent plus 25 Prozent ab.', [ZAKAT]).belegt).toEqual([]);
  });

  test('erfundene Quellenangabe', () => {
    expect(pruefeAntwort('Alkohol ist im Islam verboten (Koran 2:153).', [ALKOHOL]).belegt).toEqual([]);
  });

  test('Ein-Wort-Stellungnahme zählt nicht als Beleg', () => {
    // „Nein." wäre hier sachlich richtig — aber es steht so nicht in der Quelle,
    // und dieselbe Mechanik ließe sonst „Ja." durch.
    expect(pruefeAntwort('Nein.', [ALKOHOL]).belegt).toEqual([]);
  });

  test('Satz aus einer anderen Quelle als der mitgelieferten fällt raus', () => {
    expect(pruefeAntwort('Dhuhr hat vier Rakat Pflichtgebet.', [ALKOHOL]).belegt).toEqual([]);
  });

  test('gemischte Antwort: nur der belegte Satz überlebt', () => {
    const { belegt, unbelegt } = pruefeAntwort(
      'Berauschende Getränke sind im Islam verboten.\nGeringe Mengen sind aber bis 0,5 Prozent erlaubt.',
      [ALKOHOL],
    );
    expect(belegt).toEqual(['Berauschende Getränke sind im Islam verboten.']);
    expect(unbelegt).toEqual(['Geringe Mengen sind aber bis 0,5 Prozent erlaubt.']);
  });

  test('Prompt-Etiketten des Modells sind nicht belegt', () => {
    expect(pruefeAntwort('Vorherige Antwort (gekürzt): Ohne Wudu kein Gebet.', [WUDU]).belegt).toEqual([]);
  });
});

describe('Programmatische Auswahl', () => {
  test('zitiert die Hauptquelle wörtlich und nennt ihre Quellenangabe', () => {
    const bloecke = waehleZitate('Ist Alkohol im Islam erlaubt?', [ALKOHOL]);
    expect(bloecke).toHaveLength(1);
    expect(bloecke[0]!.src).toBe(ALKOHOL.src);
    expect(ALKOHOL.t).toContain(bloecke[0]!.text);
  });

  test('kürzt eine nummerierte Anleitung nicht', () => {
    expect(istAnleitung(WUDU.t)).toBe(true);
    const text = besterAusschnitt(WUDU.t, 'Wie mache ich Wudu?', 100);
    expect(text).toBe(WUDU.t);
    expect(text).toContain('8. Zum Abschluss die Schahada sprechen.');
  });

  test('schneidet lange Fließtexte an Satzgrenzen, nie mitten im Wort', () => {
    const lang: KorpusDoc = {
      id: 'w-lang',
      src: 'Salati-Wissen: Lang',
      t: `${'Ein völlig anderes Thema ohne Bezug. '.repeat(20)}Die Zeit des Ischa-Gebets beginnt nach der Abendröte. ${'Noch ein anderes Thema. '.repeat(20)}`,
    };
    const text = besterAusschnitt(lang.t, 'Wann beginnt die Zeit des Ischa-Gebets?', 300);
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text).toContain('Die Zeit des Ischa-Gebets beginnt nach der Abendröte.');
    expect(lang.t).toContain(text);
  });

  test('ohne Treffer gibt es keine Blöcke', () => {
    expect(waehleZitate('Irgendeine Frage', [])).toEqual([]);
  });
});

describe('Zitat-Antwort als Ganzes', () => {
  const TREFFER = [ALKOHOL, DHUHR, ZAKAT];

  test('ohne Modell: jeder Block steht wörtlich in seiner eigenen Quelle', () => {
    const a = zitatAntwort('Ist Alkohol im Islam erlaubt?', TREFFER);
    expect(a.weg).toBe('programm');
    expect(a.bloecke.length).toBeGreaterThan(0);
    for (const b of a.bloecke) {
      const quelle = TREFFER.find((d) => d.id === b.id)!;
      expect(quelle.src).toBe(b.src);
      expect(normalisiereZitat(quelle.t)).toContain(normalisiereZitat(b.text));
    }
  });

  test('erfundene Modellantwort fällt auf die Quelle zurück, statt leer zu bleiben', () => {
    const a = zitatAntwort('Ist Alkohol im Islam erlaubt?', TREFFER, 'Ja, geringe Mengen Alkohol sind erlaubt.');
    expect(a.weg).toBe('rueckfall');
    expect(a.verworfen).toEqual(['Ja, geringe Mengen Alkohol sind erlaubt.']);
    expect(a.text).toContain('Berauschende Getränke sind im Islam verboten.');
  });

  test('belegte Modellauswahl wird übernommen und richtig zugeordnet', () => {
    const a = zitatAntwort('Ist Alkohol im Islam erlaubt?', TREFFER, 'Berauschende Getränke sind im Islam verboten.');
    expect(a.weg).toBe('modell');
    expect(a.bloecke).toHaveLength(1);
    expect(a.bloecke[0]!.src).toBe(ALKOHOL.src);
  });

  test('teilweise erfundene Modellantwort verliert genau den erfundenen Satz', () => {
    const a = zitatAntwort(
      'Wie viele Rakat hat Dhuhr?',
      TREFFER,
      'Dhuhr hat vier Rakat Pflichtgebet.\nAm Freitag sind es sechs Rakat.',
    );
    expect(a.weg).toBe('modell');
    expect(a.text).toContain('vier Rakat');
    expect(a.text).not.toContain('sechs');
    expect(a.verworfen).toEqual(['Am Freitag sind es sechs Rakat.']);
  });

  test('die Antwort ist nie leer, solange es Treffer gibt', () => {
    expect(zitatAntwort('Frage', TREFFER, '').text.length).toBeGreaterThan(0);
  });

  test('Formatierung stellt jedem Zitat seine Quellenangabe zur Seite', () => {
    expect(formatiereZitate([{ id: 'x', src: 'Quelle X', text: 'Text' }])).toBe('„Text“\n— Quelle X');
  });
});

/**
 * Regression zur Messung vom 2026-07-28 (docs/audit-2026-07-27/KI-ZITATMODUS.md):
 * Auf „Was bricht das Fasten im Ramadan?" liefert das Retrieval die allgemeine
 * Ramadan-Passage zuerst. Die Antwort MUSS trotzdem die Passage enthalten, die
 * die Frage beantwortet — sie stand in acht Sprachen erst auf Platz 2 oder 3.
 */
describe('Auswahl unter thematisch benachbarten Passagen', () => {
const FASTEN = {
  id: 'w-fasten-ramadan',
  src: 'Salati-Wissen: Das Fasten im Ramadan',
  k: 'ramadan fasten sawm',
  t: 'Im Monat Ramadan zu fasten, ist die vierte Säule des Islam. Gefastet wird von der Morgendämmerung bis zum Sonnenuntergang. Vor Beginn steht die Absicht, am Ende der Fastenbruch.',
};
const FASTEN_BRICHT = {
  id: 'w-fasten-bricht',
  src: 'Salati-Wissen: Was das Fasten bricht',
  k: 'bricht fasten ungueltig',
  t: 'Das Fasten bricht durch absichtliches Essen und Trinken, durch ehelichen Verkehr und durch absichtliches Erbrechen. Zähneputzen und Duschen brechen das Fasten nach verbreiteter Auffassung nicht. Wer aus Vergesslichkeit isst oder trinkt, setzt das Fasten einfach fort. Wichtig bleibt: Fasten ist mehr als Verzicht auf Essen — wer Lüge und Streit nicht lässt, dem fehlt der eigentliche Sinn.',
};
const RAMADAN_MONAT = {
  id: 'w-ramadan-monat',
  src: 'Salati-Wissen: Der Monat Ramadan',
  k: 'ramadan monat fasten',
  t: 'Ramadan ist der neunte Monat des islamischen Jahres und der Monat, in dem der Koran herabgesandt wurde. Das Fasten in ihm ist Pflicht.',
};

  test('zitiert die Passage mit der Antwort, auch wenn sie nicht auf Platz 1 steht', () => {
    const bloecke = waehleZitate('Was bricht das Fasten im Ramadan?', [FASTEN, RAMADAN_MONAT, FASTEN_BRICHT]);
    expect(bloecke.map((b) => b.id)).toContain('w-fasten-bricht');
    // Der unterscheidende Begriff steht im Titel genau EINER Passage — sie
    // gehört vor die, die nur „Ramadan" und „Fasten" teilt.
    expect(bloecke[1]!.id).toBe('w-fasten-bricht');
  });

  test('deckt die Quellenangabe die ganze Frage ab, bleibt es bei der einen Passage', () => {
    const bloecke = waehleZitate('Was bricht das Fasten?', [FASTEN_BRICHT, FASTEN, RAMADAN_MONAT]);
    expect(bloecke).toHaveLength(1);
    expect(bloecke[0]!.id).toBe('w-fasten-bricht');
  });
});
