import { buildRootList, groupWordformsByWortart, sortRoots, toRootOccurrences } from './rootIndex';
import type { WurzelnDatei } from '@/features/quran/morphologieTypen';

const ROOTS: WurzelnDatei = {
  اله: { count: 2851, lemmas: ['إِلَٰه', 'ٱللَّه', 'ٱللَّهُمَّ'], occurrences: [] },
  سمو: { count: 381, lemmas: ['تَسْمِيَة', 'سَمَآء'], occurrences: [] },
  رحم: { count: 339, lemmas: ['رَّحْمَٰن', 'رَّحِيم', 'رَحِمَ'], occurrences: [] },
};

describe('buildRootList', () => {
  it('baut fuer jede Wurzel Anzahl und Lemma-Anzahl', () => {
    const list = buildRootList(ROOTS);
    expect(list).toHaveLength(3);
    expect(list.find((r) => r.root === 'اله')).toEqual({ root: 'اله', count: 2851, lemmaCount: 3 });
  });
});

describe('sortRoots', () => {
  const list = buildRootList(ROOTS);

  it('sortiert nach Haeufigkeit absteigend', () => {
    const sorted = sortRoots(list, 'frequency');
    expect(sorted.map((r) => r.root)).toEqual(['اله', 'سمو', 'رحم']);
  });

  it('sortiert alphabetisch nach Codepoint', () => {
    const sorted = sortRoots(list, 'alphabetical');
    // Codepoint-Reihenfolge der arabischen Buchstaben: ا (U+0627) < ر
    // (U+0631) < س (U+0633)
    expect(sorted.map((r) => r.root)).toEqual(['اله', 'رحم', 'سمو']);
  });

  it('veraendert die Eingabeliste nicht (reine Funktion)', () => {
    const original = [...list];
    sortRoots(list, 'alphabetical');
    expect(list).toEqual(original);
  });
});

describe('groupWordformsByWortart', () => {
  it('gruppiert nach ism/fiil/harf/unbekannt in fester Reihenfolge und sortiert je Gruppe nach Haeufigkeit', () => {
    const groups = groupWordformsByWortart([
      { lemma: 'a', count: 5, wortart: 'fiil' },
      { lemma: 'b', count: 50, wortart: 'ism' },
      { lemma: 'c', count: 10, wortart: 'ism' },
      { lemma: 'd', count: 1, wortart: null },
    ]);
    expect(groups.map((g) => g.wortart)).toEqual(['ism', 'fiil', null]);
    expect(groups[0].forms.map((f) => f.lemma)).toEqual(['b', 'c']);
  });

  it('laesst leere Gruppen weg', () => {
    const groups = groupWordformsByWortart([{ lemma: 'a', count: 1, wortart: 'harf' }]);
    expect(groups).toEqual([{ wortart: 'harf', forms: [{ lemma: 'a', count: 1, wortart: 'harf' }] }]);
  });
});

describe('toRootOccurrences', () => {
  it('wandelt Tripel in benannte Objekte um', () => {
    expect(toRootOccurrences([[2, 255, 16]])).toEqual([{ surah: 2, ayah: 255, position: 16 }]);
  });
});
