// Liegt bewusst NICHT in public/: alles dort landet 1:1 im Web-Export und
// würde als toter Ballast an jede Besucherin ausgeliefert.
//
// Node-Tests für das Salati-KI-Retrieval (siehe suche.js-Kommentarkopf:
// "ausgelagert = Node-testbar"). Läuft über das jest-expo-Preset des
// Workspaces (babel transformiert das ES-Modul-Syntax automatisch).
import { baueIndex, suche, sucheHybrid, tokens, norm, istArabisch, stemme, kosinus, int8ZuFloat } from '../../../public/rag/suche.js';

const DOCS = [
  { id: 'q:2:153', src: 'Koran 2:153 (Al-Baqara)', t: 'O die ihr glaubt, sucht Hilfe in der Standhaftigkeit und im Gebet. Gewiss, Allah ist mit den Standhaften.' },
  { id: 'q:94:5', src: 'Koran 94:5 (Ash-Sharh)', t: 'So gewiss ist mit der Not Erleichterung.' },
  { id: 'd:morning', src: 'Dua: Asbahna wa asbahal-mulku lillah', t: 'Wir sind in den Morgen eingetreten und mit uns die Herrschaft Allahs.' },
  { id: 'h-nawawi-01', src: 'an-Nawawī Nr. 1', t: 'Die Taten sind allein nach den Absichten zu bemessen.' },
  { id: 'k-akhlaq-sabr', src: 'Salati-Kurs Akhlaq: Sabr — die Geduld', t: 'Sabr bedeutet, in Schwierigkeiten standhaft zu bleiben und auf Allahs Hilfe zu vertrauen.' },
];

describe('Retrieval-Grundlagen (bestehend)', () => {
  test('findet Geduld-Quellen bei deutscher Frage', () => {
    const idx = baueIndex(DOCS);
    const treffer = suche(idx, 'Was sagt der Koran über Geduld?', 3);
    expect(treffer.length).toBeGreaterThan(0);
    expect(treffer.map((d) => d.id)).toContain('q:2:153');
  });

  test('leere/stopwortlastige Frage liefert keine Treffer', () => {
    const idx = baueIndex(DOCS);
    expect(suche(idx, 'was ist das denn so')).toEqual([]);
  });
});

describe('Dokumenttyp-Gewichtung und Vielfalt (Fix 2026-07-27)', () => {
  // Gleiche Fälle wie src/features/ki/retrieval.test.ts — beide Implementierungen
  // müssen sich identisch verhalten.
  const GEMISCHT = [
    { id: 'q:5:6', src: 'Koran 5:6 (Al-Maaida)', t: 'Wascht euer Gesicht und eure Hände bis zu den Ellbogen.' },
    { id: 'q:4:43', src: 'Koran 4:43 (An-Nisaa)', t: 'Und wascht euch, wenn ihr im Zustand der Unreinheit seid.' },
    { id: 'g-wudu', src: 'Salati-Praxis: Wudu - die Gebetswaschung', t: 'Wudu Schritt für Schritt: Hände waschen, Mund ausspülen, Gesicht waschen, Arme bis zu den Ellbogen, über den Kopf streichen, Füße waschen.' },
    { id: 'g-wudu-1', src: 'Salati-Praxis: Wudu - die Gebetswaschung', t: 'Fortsetzung der Wudu-Schritte: rechts vor links, jeweils dreimal, zum Abschluss die Schahada.' },
    { id: 'g-wudu-2', src: 'Salati-Praxis: Wudu - die Gebetswaschung', t: 'Weitere Wudu-Hinweise: Pflichtteile sind Gesicht, Arme, Kopfstreichen und Füße waschen.' },
  ];

  test('erklärendes Dokument schlägt den blossen Beleg-Vers', () => {
    const idx = baueIndex(GEMISCHT);
    expect(suche(idx, 'Wie mache ich Wudu?', 3)[0]?.id).toBe('g-wudu');
  });

  test('höchstens zwei Passagen aus derselben Quelle', () => {
    // Zweite, ebenfalls starke Quelle zum selben Thema: die drei Stücke des
    // Praxis-Guides dürfen sie nicht verdrängen.
    const idx = baueIndex([
      ...GEMISCHT,
      { id: 'w-wudu-kurz', src: 'Salati-Wissen: Wudu — die Gebetswaschung', t: 'Ohne Wudu kein Gebet: Hände, Mund, Nase, Gesicht, Arme, Kopf und Füße waschen.' },
    ]);
    const treffer = suche(idx, 'Wudu waschen', 3);
    const ausGuide = treffer.filter((d) => d.src.startsWith('Salati-Praxis')).length;
    expect(ausGuide).toBeLessThanOrEqual(2);
    expect(treffer.map((d) => d.id)).toContain('w-wudu-kurz');
  });

  test('unsichtbares Keyword-Feld k macht Schreibvarianten auffindbar', () => {
    const idx = baueIndex([
      { id: 'w-gebet-ischa', src: 'Salati-Wissen: Ischa — das Nachtgebet', t: 'Das Nachtgebet hat vier Rakat.', k: 'isha ishaa nachtgebet' },
      { id: 'q:1:1', src: 'Koran 1:1 (Al-Faatiha)', t: 'Im Namen Allahs, des Allerbarmers, des Barmherzigen.' },
    ]);
    expect(suche(idx, 'Was ist isha', 2)[0]?.id).toBe('w-gebet-ischa');
  });

  test('Präfix-Treffer schlagen keinen exakten Treffer (Schadda/Schaden)', () => {
    const idx = baueIndex([
      { id: 'h-nawawi-32', src: 'an-Nawawī Nr. 32', t: 'Es gibt keinen Schaden und keine Vergeltung von Schaden. Schaden bleibt Schaden.' },
      { id: 'w-schadda', src: 'Salati-Wissen: Die Schadda', t: 'Die Schadda ist das Verdopplungszeichen über einem Buchstaben.' },
    ]);
    expect(suche(idx, 'Was ist eine Schadda', 2)[0]?.id).toBe('w-schadda');
  });
});

describe('Arabisch-Modus (istArabisch, norm)', () => {
  test('istArabisch erkennt überwiegend arabische Eingabe', () => {
    expect(istArabisch('ما هو الصبر؟')).toBe(true);
  });

  test('istArabisch verneint deutsche Eingabe', () => {
    expect(istArabisch('Was sagt der Koran über Geduld?')).toBe(false);
  });

  test('istArabisch verneint leere Eingabe', () => {
    expect(istArabisch('')).toBe(false);
    expect(istArabisch(undefined)).toBe(false);
  });

  test('norm() löscht arabische Schriftzeichen NICHT mehr (vorheriger Bug)', () => {
    expect(norm('صبر')).toContain('صبر');
  });

  test('tokens() auf reinem Arabisch ergibt nicht-leere Tokens (vorher: 0 Tokens -> [] Treffer)', () => {
    expect(tokens('ما هو الصبر؟').length).toBeGreaterThan(0);
  });

  test('arabisches Brücken-Synonym findet dieselben Geduld-Quellen wie die deutsche Frage', () => {
    const idx = baueIndex(DOCS);
    const treffer = suche(idx, 'صبر', 3);
    expect(treffer.map((d) => d.id)).toContain('k-akhlaq-sabr');
  });

  test('stemme() lässt arabische Wörter unverändert (keine lateinischen Suffixe matchen)', () => {
    expect(stemme('صبر')).toBe('صبر');
  });
});

describe('Stufe-2 Embedding-Kombination (sucheHybrid)', () => {
  test('ohne Embeddings fällt sucheHybrid auf reine Keyword-Suche zurück', () => {
    const idx = baueIndex(DOCS);
    const treffer = sucheHybrid(idx, 'Was sagt der Koran über Geduld?', null, 3);
    expect(treffer.map((d) => d.id)).toEqual(suche(idx, 'Was sagt der Koran über Geduld?', 3).map((d) => d.id));
  });

  test('mit passenden Embeddings kombiniert sucheHybrid Keyword- und Cosine-Score', () => {
    const idx = baueIndex(DOCS);
    const dim = 4;
    // Handgebaute, bereits unit-normalisierte "Embeddings": Dok 1 (Sabr-Kurs)
    // bekommt den zur Query identischen Vektor -> muss ganz oben landen,
    // auch wenn wir absichtlich einen Begriff wählen, der keyword-seitig
    // NICHT im Dokument vorkommt (rein semantischer Treffer).
    const vektoren = new Float32Array(DOCS.length * dim);
    vektoren.set([0, 1, 0, 0], 4 * dim); // DOCS[4] = Sabr-Kurs
    const embeddings = { vektoren, dim, queryVektor: new Float32Array([0, 1, 0, 0]) };
    const treffer = sucheHybrid(idx, 'völlig andere Wortwahl ohne Übereinstimmung', embeddings, 1);
    expect(treffer[0]?.id).toBe('k-akhlaq-sabr');
  });

  test('sucheHybrid degradiert bei Dimensions-Mismatch (Korpus geändert, Embeddings veraltet) auf Keyword-Suche', () => {
    const idx = baueIndex(DOCS);
    const embeddings = { vektoren: new Float32Array(4), dim: 4, queryVektor: new Float32Array(4) };
    const treffer = sucheHybrid(idx, 'Was sagt der Koran über Geduld?', embeddings, 3);
    expect(treffer.map((d) => d.id)).toEqual(suche(idx, 'Was sagt der Koran über Geduld?', 3).map((d) => d.id));
  });

  test('kosinus() = Skalarprodukt normalisierter Vektoren', () => {
    expect(kosinus(new Float32Array([1, 0]), new Float32Array([1, 0]))).toBeCloseTo(1);
    expect(kosinus(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
  });

  test('int8ZuFloat() dequantisiert -127..127 auf -1..1', () => {
    const out = int8ZuFloat(new Int8Array([127, -127, 0]));
    expect(out[0]).toBeCloseTo(1);
    expect(out[1]).toBeCloseTo(-1);
    expect(out[2]).toBeCloseTo(0);
  });
});
