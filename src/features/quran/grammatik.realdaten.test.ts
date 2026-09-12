// Tests gegen ECHTE Ausschnitte der Morphologie-Pipeline (nicht gegen
// handgeschriebene Fixtures wie grammatik.test.ts). Die Quelle ist
// .daten-cache/out/morphologie/{1,2}.json — gitignored und in CI nicht
// vorhanden — deshalb liegen kleine, unveränderte Kopien (Sure 1 vollständig,
// Sure 2 Vers 1–5) unter ./__fixtures__. Diese Tests verifizieren, dass die
// in grammatik.ts korrigierte Logik (POS-Abdeckung, Artikel-Erkennung über
// DET-Tag, Verneinung nur über NEG-Tag) an echten Korpusdaten hält, nicht nur
// an den bewusst konstruierten Grenzfällen in grammatik.test.ts.
import { farbGruppe, fragmentRolle, istVerneinung, wortart } from './grammatik';
import type { MorphologieDatei, MorphWord } from './morphologieTypen';

import sure1Fixture from './__fixtures__/morphologie-1.json';
import sure2Vers1bis5Fixture from './__fixtures__/morphologie-2-verse-1-5.json';

const sure1 = sure1Fixture as unknown as MorphologieDatei;
const sure2Vers1bis5 = sure2Vers1bis5Fixture as unknown as MorphologieDatei;

function alleWoerter(datei: MorphologieDatei): MorphWord[] {
  return Object.values(datei.verses).flat();
}

function wort(datei: MorphologieDatei, vers: number, position: number): MorphWord {
  const treffer = datei.verses[String(vers)]?.find((w) => w.position === position);
  if (!treffer) throw new Error(`Fixture enthält kein Wort ${vers}:${position}`);
  return treffer;
}

describe('Realdaten: Sure 1 (vollständig) + Sure 2 Vers 1–5', () => {
  it('lädt die Fixtures mit dem erwarteten Schema', () => {
    expect(sure1.schema).toBe(2);
    expect(sure1.surah).toBe(1);
    expect(Object.keys(sure1.verses)).toHaveLength(7);
    expect(sure2Vers1bis5.surah).toBe(2);
    expect(Object.keys(sure2Vers1bis5.verses)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('jedes Segment in beiden Ausschnitten bekommt eine Wortart (kein POS-Tag liefert null)', () => {
    const woerter = [...alleWoerter(sure1), ...alleWoerter(sure2Vers1bis5)];
    let segmentAnzahl = 0;
    for (const w of woerter) {
      for (const segment of w.segments) {
        segmentAnzahl += 1;
        expect(wortart(segment.pos)).not.toBeNull();
      }
    }
    // Sure 1 hat 29 Wörter/48 Segmente, Sure 2 Vers 1–5 kommt noch dazu —
    // reine Belegprüfung, dass hier überhaupt etwas getestet wurde.
    expect(segmentAnzahl).toBeGreaterThan(40);
  });

  // 1:2:2 لِلَّهِ — genau das Beispiel aus der Aufgabenstellung: zerfällt in
  // Präposition (لِ, pos "P") + Eigenname (لَّهِ, pos "PN", Genitiv, bestimmt).
  it('لِلَّهِ (1:2:2) zerfällt in Präposition + Eigenname', () => {
    const w = wort(sure1, 2, 2);
    // .normalize('NFC'): die Reihenfolge kombinierender Diakritika (Shadda vor
    // vs. nach dem Harakat-Zeichen) ist im Quellkorpus uneinheitlich —
    // kanonisch äquivalent, aber ohne Normalisierung als String ungleich.
    expect(w.text.normalize('NFC')).toBe('لِلَّهِ'.normalize('NFC'));
    expect(w.segments).toHaveLength(2);

    const [praeposition, eigenname] = w.segments;
    expect(praeposition.kind).toBe('prefix');
    expect(praeposition.pos).toBe('P');
    expect(fragmentRolle(praeposition)).toBe('praeposition');

    expect(eigenname.kind).toBe('stem');
    expect(eigenname.pos).toBe('PN');
    expect(wortart(eigenname.pos)).toBe('ism');
    expect(eigenname.features.case).toBe('gen');
    expect(eigenname.features.state).toBe('definite');
  });

  // 1:2:3 رَبِّ trägt syntax.relation === "App" (Badal zu Wort 2, لِلَّهِ).
  it('1:2:3 (رَبِّ) trägt die Relation "App" (Badal)', () => {
    const w = wort(sure1, 2, 3);
    expect(w.text.normalize('NFC')).toBe('رَبِّ'.normalize('NFC'));
    expect(w.syntax?.relation).toBe('App');
    expect(w.syntax?.head).toBe(2);
  });

  // 1:5:4 نَسْتَعِينُ trägt syntax.relation === "conj" (koordiniert mit Wort 2).
  it('1:5:4 (نَسْتَعِينُ) trägt die Relation "conj"', () => {
    const w = wort(sure1, 5, 4);
    expect(w.text.normalize('NFC')).toBe('نَسْتَعِينُ'.normalize('NFC'));
    expect(w.syntax?.relation).toBe('conj');
    expect(w.syntax?.head).toBe(2);
  });

  // ---------------------------------------------------------------------
  // Bestimmtheits-Herleitung v2 (schema: 2) — Mudaf und Possessivsuffix,
  // siehe build-morphologie.mjs (bestimmtheitErgaenzen) und
  // PRUEFBERICHT-HERLEITUNG.md Abschnitt B.
  // ---------------------------------------------------------------------

  // 1:1:1 بِسْمِ ist Mudaf: 1:1:2 (ٱللَّهِ) trägt syntax.relation "Poss" mit
  // head 1 — das macht بِسْمِ grammatisch bestimmt, obwohl das Wort selbst
  // weder Al+-Präfix noch PN-Tag trägt.
  it('1:1:1 (بِسْمِ) ist als Mudaf hergeleitet bestimmt', () => {
    const w = wort(sure1, 1, 1);
    expect(w.text.normalize('NFC')).toBe('بِسْمِ'.normalize('NFC'));
    const kopf = wort(sure1, 1, 2);
    expect(kopf.syntax?.relation).toBe('Poss');
    expect(kopf.syntax?.head).toBe(1);
    const stamm = w.segments.find((s) => s.kind === 'stem');
    expect(stamm?.features.state).toBe('definite');
    expect(stamm?.derived).toContain('state');
  });

  // 1:2:3 رَبِّ ist ebenfalls Mudaf (Kopf der Poss-Relation von 1:2:4,
  // ٱلْعَٰلَمِينَ) — exakt das Beispiel aus der Aufgabenstellung.
  it('1:2:3 (رَبِّ) ist als Mudaf hergeleitet bestimmt', () => {
    const w = wort(sure1, 2, 3);
    const kopf = wort(sure1, 2, 4);
    expect(kopf.syntax?.relation).toBe('Poss');
    expect(kopf.syntax?.head).toBe(3);
    const stamm = w.segments.find((s) => s.kind === 'stem');
    expect(stamm?.features.state).toBe('definite');
    expect(stamm?.derived).toContain('state');
  });

  // 2:4:9 قَبْلِكَ — N-Stamm قَبْلِ mit angehängtem Possessivsuffix (كَ,
  // pos "PRON") wird als bestimmt hergeleitet.
  it('2:4:9 (قَبْلِكَ) ist über das Possessivsuffix hergeleitet bestimmt', () => {
    const w = wort(sure2Vers1bis5, 4, 9);
    expect(w.text.normalize('NFC')).toBe('قَبْلِكَ'.normalize('NFC'));
    expect(w.segments.some((s) => s.kind === 'suffix' && s.pos === 'PRON')).toBe(true);
    const stamm = w.segments.find((s) => s.kind === 'stem');
    expect(stamm?.pos).toBe('N');
    expect(stamm?.features.state).toBe('definite');
    expect(stamm?.derived).toContain('state');
  });

  // 2:2:6 هُدًى trägt explizites INDEF im Korpus — bleibt unbestimmt, auch
  // wenn eine der beiden neuen Regeln zuträfe (Vorrang der Korpus-Aussage,
  // siehe bestimmtheitErgaenzen in build-morphologie.mjs).
  it('2:2:6 (هُدًى) bleibt explizit indefinite — Korpus-Aussage wird nie überschrieben', () => {
    const w = wort(sure2Vers1bis5, 2, 6);
    expect(w.text.normalize('NFC')).toBe('هُدًى'.normalize('NFC'));
    const stamm = w.segments.find((s) => s.kind === 'stem');
    expect(stamm?.features.state).toBe('indefinite');
    // 'state' ist hier ein Korpus-BELEG (explizites INDEF), keine Herleitung.
    expect(stamm?.derived).not.toContain('state');
  });

  // Sure 2 Vers 1 ist "الٓمٓ" — die getrennt geschriebenen Buchstaben (huruf
  // muqatta'a) am Sure-Anfang, pos "INL", ohne Wurzel/Lemma und ohne echte
  // Dependenzrelation (relation "NonRel").
  it('2:1:1 (الٓمٓ) ist als INL getaggt und hat keine Wurzel', () => {
    const w = wort(sure2Vers1bis5, 1, 1);
    expect(w.segments).toHaveLength(1);
    expect(w.segments[0].pos).toBe('INL');
    expect(wortart('INL')).toBe('harf');
    expect(w.root).toBeNull();
  });

  it('der bestimmte Artikel wird über das POS-Tag DET erkannt, nicht über den Text', () => {
    let detGefunden = 0;
    for (const w of [...alleWoerter(sure1), ...alleWoerter(sure2Vers1bis5)]) {
      for (const segment of w.segments) {
        if (segment.pos === 'DET') {
          detGefunden += 1;
          expect(fragmentRolle(segment)).toBe('artikel');
          expect(farbGruppe(segment)).toBe('affix-artikel');
        }
      }
    }
    expect(detGefunden).toBeGreaterThan(0);
  });

  it('istVerneinung erkennt jede NEG-getaggte Verneinung in beiden Ausschnitten', () => {
    let verneinungenGefunden = 0;
    for (const w of [...alleWoerter(sure1), ...alleWoerter(sure2Vers1bis5)]) {
      const negSegmentVorhanden = w.segments.some((s) => s.pos === 'NEG');
      const treffer = istVerneinung(w);
      if (negSegmentVorhanden) {
        verneinungenGefunden += 1;
        expect(treffer).not.toBeNull();
        expect(treffer?.segment.pos).toBe('NEG');
      } else {
        expect(treffer).toBeNull();
      }
    }
    // Sure 1 + Sure 2 Vers 1–5 enthalten mindestens die Verneinung in Vers 7
    // ("nicht [der Weg] derer, die ...", غَيْرِ/لَا-Konstruktion in 1:7).
    expect(verneinungenGefunden).toBeGreaterThan(0);
  });
});
