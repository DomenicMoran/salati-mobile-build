import { searchConcordance } from './concordance';
import type { LemmataDatei, WurzelnDatei } from '@/features/quran/morphologieTypen';

const ROOTS: WurzelnDatei = {
  اله: { count: 2851, lemmas: ['إِلَٰه', 'ٱللَّه', 'ٱللَّهُمَّ'], occurrences: [[1, 1, 2]] },
  سمو: {
    count: 381,
    lemmas: ['تَسْمِيَة', 'سَمَآء', 'سَمِيّ', 'سَمَّىٰ', 'مُّسَمًّى', 'ٱسْم'],
    occurrences: [[1, 1, 1]],
  },
};

const LEMMAS: LemmataDatei = {
  'ٱللَّه': { count: 2699, occurrences: [[1, 1, 2]] },
  'ٱسْم': { count: 39, occurrences: [[1, 1, 1]] },
};

describe('searchConcordance', () => {
  it('liefert keine Treffer bei leerer Anfrage', () => {
    expect(searchConcordance('', ROOTS, LEMMAS)).toEqual([]);
    expect(searchConcordance('   ', ROOTS, LEMMAS)).toEqual([]);
  });

  it('findet eine Wurzel ohne Diakritika-Eingabe', () => {
    const results = searchConcordance('اله', ROOTS, LEMMAS);
    const root = results.find((r) => r.kind === 'root' && r.text === 'اله');
    expect(root).toBeTruthy();
    expect(root?.count).toBe(2851);
  });

  it('findet ein Lemma trotz Alif-Wasla/Harakat-Unterschied zur Eingabe', () => {
    // Eingabe ohne Wasla und ohne jedes Vokalzeichen
    const results = searchConcordance('الله', ROOTS, LEMMAS);
    const lemma = results.find((r) => r.kind === 'lemma' && r.text === 'ٱللَّه');
    expect(lemma).toBeTruthy();
    expect(lemma?.count).toBe(2699);
  });

  it('sortiert normalisiert exakte Treffer vor Teiltreffern', () => {
    // "سمو" ist sowohl exakte Wurzel als auch (normalisiert) im laengeren
    // "اله"-Eintrag nicht enthalten -- prueft nur, dass der exakte
    // Wurzeltreffer vor etwaigen zufaelligen Teiltreffern gleicher Kategorie steht.
    const results = searchConcordance('سمو', ROOTS, LEMMAS);
    expect(results[0]).toMatchObject({ kind: 'root', text: 'سمو' });
  });

  it('liefert keine Treffer, wenn nichts passt', () => {
    expect(searchConcordance('موسى', ROOTS, LEMMAS)).toEqual([]);
  });
});
