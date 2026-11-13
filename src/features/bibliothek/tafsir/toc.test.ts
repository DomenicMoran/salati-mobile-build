import { adjacentTafsirSurah, buildTafsirToc, isValidTafsirSurah } from './toc';

describe('buildTafsirToc', () => {
  it('liefert 114 Eintraege', () => {
    const toc = buildTafsirToc();
    expect(toc).toHaveLength(114);
    expect(toc[0]).toEqual({ surah: 1 });
    expect(toc[113]).toEqual({ surah: 114 });
  });
});

describe('isValidTafsirSurah', () => {
  it('akzeptiert 1..114', () => {
    expect(isValidTafsirSurah(1)).toBe(true);
    expect(isValidTafsirSurah(114)).toBe(true);
  });

  it('lehnt Randfaelle ab', () => {
    expect(isValidTafsirSurah(0)).toBe(false);
    expect(isValidTafsirSurah(115)).toBe(false);
  });
});

describe('adjacentTafsirSurah', () => {
  it('liefert prev/next', () => {
    expect(adjacentTafsirSurah(1)).toEqual({ prev: null, next: 2 });
    expect(adjacentTafsirSurah(114)).toEqual({ prev: 113, next: null });
    expect(adjacentTafsirSurah(2)).toEqual({ prev: 1, next: 3 });
  });
});
