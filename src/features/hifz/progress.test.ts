import { knownCount, parseHifzProgress, setAyahStatus } from './progress';

describe('parseHifzProgress', () => {
  it('leer/kaputt ergibt leeres Objekt', () => {
    expect(parseHifzProgress(null)).toEqual({});
    expect(parseHifzProgress('kaputt{')).toEqual({});
  });

  it('gültige Daten werden übernommen', () => {
    expect(parseHifzProgress('{"1":{"1":"known"}}')).toEqual({ 1: { 1: 'known' } });
  });

  it('Array statt Objekt ergibt leeres Objekt (typeof [] === "object" reicht nicht)', () => {
    expect(parseHifzProgress('[]')).toEqual({});
    expect(parseHifzProgress('null')).toEqual({});
  });
});

describe('setAyahStatus / knownCount', () => {
  it('setzt Status und zählt bekannte Verse', () => {
    let progress = setAyahStatus({}, 1, 1, 'known');
    progress = setAyahStatus(progress, 1, 2, 'learning');
    expect(knownCount(progress, 1)).toBe(1);
  });
});
