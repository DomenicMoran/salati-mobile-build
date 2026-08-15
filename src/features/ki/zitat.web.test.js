// Web-Zitat-Modus: Erzwingung + PARITÄT zur nativen Fassung.
//
// Liegt bewusst NICHT in public/: alles dort landet 1:1 im Web-Export und
// würde als toter Ballast an jede Besucherin ausgeliefert.
//
// zitat.js ist eine Portierung von src/features/ki/zitat.ts. Divergenz zwischen
// beiden Dateien ist genau der Fehler, der bei retrieval.ts/suche.js schon
// einmal passiert ist (unterschiedliche BM25-Konstanten → Web lieferte andere
// Passagen als die App, siehe Befund 4 in docs/audit-2026-07-27/
// KI-SPRACHMESSUNG.md). Dieser Test vergleicht beide Implementierungen direkt.
import { abschnitte, normalisiereZitat, pruefeAntwort, waehleZitate, zitatAntwort } from '../../../public/rag/zitat.js';
import * as nativ from './zitat';

const ALKOHOL = {
  id: 'w-alkohol',
  src: 'Salati-Wissen: Alkohol im Islam',
  t: 'Berauschende Getränke sind im Islam verboten. Der Koran nennt sie zusammen mit dem Glücksspiel einen Greuel vom Werk des Satans. Es gilt nicht nur für das Trinken selbst, sondern auch für Herstellung, Handel und Ausschank.',
};
const DHUHR = {
  id: 'w-gebet-dhuhr',
  src: 'Salati-Wissen: Dhuhr — das Mittagsgebet',
  t: 'Dhuhr ist das Mittagsgebet. Dhuhr hat vier Rakat Pflichtgebet.',
};
const ZAKAT = {
  id: 'w-zakat',
  src: 'Salati-Wissen: Zakat — die Pflichtabgabe',
  t: 'Wer ein Mondjahr lang Vermögen oberhalb des Nisab-Werts besitzt, gibt davon 2,5 Prozent ab.',
};
const TREFFER = [ALKOHOL, DHUHR, ZAKAT];

describe('Erzwingung im Web', () => {
  test('behält den wörtlichen Satz', () => {
    expect(pruefeAntwort('Berauschende Getränke sind im Islam verboten.', [ALKOHOL]).belegt).toHaveLength(1);
  });

  test('GEGENPROBE: umgedrehte Verneinung, geänderte Zahl und erfundene Prozentzahl fliegen raus', () => {
    expect(pruefeAntwort('Ja, Wein ist im Islam erlaubt.', [ALKOHOL]).belegt).toEqual([]);
    expect(pruefeAntwort('Dhuhr hat zwei Rakat Pflichtgebet.', [DHUHR]).belegt).toEqual([]);
    expect(pruefeAntwort('Man gibt davon 25 Prozent ab.', [ZAKAT]).belegt).toEqual([]);
  });

  test('erfundene Antwort fällt auf die Quelle zurück statt leer zu bleiben', () => {
    const a = zitatAntwort('Ist Alkohol erlaubt?', TREFFER, 'Ja, geringe Mengen sind erlaubt.');
    expect(a.weg).toBe('rueckfall');
    expect(a.text).toContain('Berauschende Getränke sind im Islam verboten.');
  });

  test('jeder Block steht wörtlich in seiner eigenen Quelle', () => {
    for (const b of waehleZitate('Ist Alkohol im Islam erlaubt?', TREFFER)) {
      const quelle = TREFFER.find((d) => d.id === b.id);
      expect(quelle.src).toBe(b.src);
      expect(normalisiereZitat(quelle.t)).toContain(normalisiereZitat(b.text));
    }
  });
});

describe('Parität Web ↔ nativ', () => {
  const FRAGEN = [
    'Ist Alkohol im Islam erlaubt?',
    'Wie viele Rakat hat das Mittagsgebet Dhuhr?',
    'Wie viel Zakat muss man zahlen?',
    'كم ركعة في صلاة الظهر؟',
    'Was bricht das Fasten im Ramadan?',
    'اور عورتوں کے لیے؟',
  ];
  // Zweiter Satz mit Keywords und überlappenden Themen: nur er löst die
  // Titel-Gewichtung, die Ergänzungs-Reihenfolge und den Frühausstieg aus.
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
  const NACHBARN = [FASTEN, RAMADAN_MONAT, FASTEN_BRICHT];

  test('abschnitte() zerlegt identisch', () => {
    for (const d of TREFFER) {
      expect(abschnitte(d.t)).toEqual(nativ.abschnitte(d.t));
    }
  });

  test('normalisiereZitat() liefert identische Vergleichsform', () => {
    for (const d of [...TREFFER.map((x) => x.t), '2,5 Prozent', 'ظہر چار رکعت ہے۔']) {
      expect(normalisiereZitat(d)).toBe(nativ.normalisiereZitat(d));
    }
  });

  test('waehleZitate() wählt dieselben Blöcke', () => {
    for (const f of FRAGEN) {
      expect(waehleZitate(f, TREFFER)).toEqual(nativ.waehleZitate(f, TREFFER));
      expect(waehleZitate(f, NACHBARN)).toEqual(nativ.waehleZitate(f, NACHBARN));
    }
  });

  test('trifft auch unter benachbarten Passagen dieselbe Auswahl', () => {
    const frage = 'Was bricht das Fasten im Ramadan?';
    expect(waehleZitate(frage, NACHBARN).map((b) => b.id)).toContain('w-fasten-bricht');
    expect(waehleZitate(frage, NACHBARN)).toEqual(nativ.waehleZitate(frage, NACHBARN));
  });

  test('zitatAntwort() liefert denselben Text — mit und ohne Modellantwort', () => {
    for (const f of FRAGEN) {
      expect(zitatAntwort(f, TREFFER)).toEqual(nativ.zitatAntwort(f, TREFFER));
      expect(zitatAntwort(f, TREFFER, 'Ja, das ist erlaubt.')).toEqual(nativ.zitatAntwort(f, TREFFER, 'Ja, das ist erlaubt.'));
    }
  });
});
