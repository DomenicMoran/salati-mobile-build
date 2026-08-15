import { parsePracticeStats } from './stats';

describe('parsePracticeStats', () => {
  it('leer/kaputt ergibt leeres Objekt', () => {
    expect(parsePracticeStats(null)).toEqual({});
    expect(parsePracticeStats('kaputt{')).toEqual({});
  });

  it('gültige Daten werden übernommen', () => {
    expect(
      parsePracticeStats('{"letters":{"bestScore":8,"bestTotal":10,"plays":3,"lastPlayedAt":1}}'),
    ).toEqual({ letters: { bestScore: 8, bestTotal: 10, plays: 3, lastPlayedAt: 1 } });
  });

  it('Array statt Objekt ergibt leeres Objekt (typeof [] === "object" reicht nicht)', () => {
    expect(parsePracticeStats('[]')).toEqual({});
    expect(parsePracticeStats('null')).toEqual({});
  });
});
