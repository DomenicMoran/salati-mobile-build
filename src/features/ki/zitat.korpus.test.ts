// Zitat-Modus am AUSGELIEFERTEN Korpus — dieselbe Aufrufkette wie im KI-Screen
// (app/ki-native.tsx): suche(stand.index, frage, 3) → zitatAntwort(frage, …).
//
// Warum eine eigene Datei: zitat.test.ts prüft die Logik an kleinen Fixtures.
// Hier läuft sie gegen die 7.144 Dokumente, die tatsächlich im App-Bundle
// liegen (public/rag/korpus-de.json). Das ist die Prüfung, die anschlägt, wenn
// Korpus und Auswahl auseinanderlaufen — etwa nach einem Korpus-Neubau.
//
// Geprüft wird die Zusage, auf der der Wegfall des Beta-Hinweises beruht:
// jeder angezeigte Satz steht WÖRTLICH in der Quelle, die darunter genannt ist.
import { deutscherStand } from './korpus';
import { suche } from './retrieval';
import { abschnitte, normalisiereZitat, zitatAntwort } from './zitat';

jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///doc/' }));
jest.mock('@/lib/errorLog', () => ({ logError: jest.fn(async () => undefined) }));

/** Dieselben zwölf Fragen wie in der Messung (docs/audit-2026-07-27/KI-ZITATMODUS.md). */
const FRAGEN = [
  'Wie mache ich Wudu? Nenne alle Schritte.',
  'Wie viele Rakat hat das Mittagsgebet Dhuhr?',
  'Wer ist Allah?',
  'Ist Alkohol im Islam erlaubt?',
  'Was sagt der Koran über Geduld?',
  'Und bei Frauen?',
  'Was sind die fünf Säulen des Islam?',
  'Wann beginnt die Zeit des Ischa-Gebets?',
  'Was bricht das Fasten im Ramadan?',
  'Welches Bittgebet spricht man vor dem Essen?',
  'Was ist Tayammum und wann darf man es machen?',
  'Wie viel Zakat muss man zahlen?',
];

describe('Zitat-Modus am ausgelieferten Korpus', () => {
  const index = deutscherStand().index;

  it.each(FRAGEN)('„%s" wird ausschließlich wörtlich belegt beantwortet', (frage) => {
    const treffer = suche(index, frage, 3);
    expect(treffer.length).toBeGreaterThan(0);
    const antwort = zitatAntwort(frage, treffer);
    expect(antwort.bloecke.length).toBeGreaterThan(0);
    expect(antwort.text.length).toBeGreaterThan(0);
    for (const block of antwort.bloecke) {
      const quelle = treffer.find((d) => d.id === block.id);
      // Die Quellenangabe muss zum zitierten Dokument gehören …
      expect(quelle).toBeDefined();
      expect(block.src).toBe(quelle!.src);
      // … und der ganze Block wörtlich darin stehen.
      expect(normalisiereZitat(quelle!.t)).toContain(normalisiereZitat(block.text));
      // Kein Block darf leer oder ein blosses Satzzeichen sein.
      expect(abschnitte(block.text).length).toBeGreaterThan(0);
    }
  });

  it('lässt bei einer Schrittanleitung keinen Schritt aus', () => {
    const treffer = suche(index, FRAGEN[0]!, 3);
    const antwort = zitatAntwort(FRAGEN[0]!, treffer);
    const schritte = (t: string) => new Set(t.match(/(?:^|[\s(])(\d{1,2})[.)]\s/g) ?? []).size;
    for (const block of antwort.bloecke) {
      const quelle = treffer.find((d) => d.id === block.id)!;
      if (schritte(quelle.t) >= 3) expect(schritte(block.text)).toBe(schritte(quelle.t));
    }
  });

  it('beantwortet die Alkoholfrage mit dem Verbot aus der Quelle, nicht mit einer Erlaubnis', () => {
    // Der Fall, an dem das Sprachmodell in vier Sprachen scheiterte („Ja, Wein
    // ist erlaubt") — hier kann die Antwort nur das sagen, was in der Quelle steht.
    const frage = 'Ist Alkohol im Islam erlaubt?';
    const antwort = zitatAntwort(frage, suche(index, frage, 3));
    expect(antwort.text).toContain('verboten');
  });

  it('gibt die Rakat-Zahl aus der Quelle wieder', () => {
    const frage = 'Wie viele Rakat hat das Mittagsgebet Dhuhr?';
    const antwort = zitatAntwort(frage, suche(index, frage, 3));
    expect(antwort.text).toContain('vier Rakat');
    expect(antwort.text).not.toMatch(/Dhuhr hat zwei Rakat/);
  });

  it('nennt bei der Zakat-Frage den Prozentsatz der Quelle', () => {
    const frage = 'Wie viel Zakat muss man zahlen?';
    const antwort = zitatAntwort(frage, suche(index, frage, 3));
    expect(antwort.text).toContain('2,5 Prozent');
    expect(antwort.text).not.toContain('25 Prozent ab');
  });
});
