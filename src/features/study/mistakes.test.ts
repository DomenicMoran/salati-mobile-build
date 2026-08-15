import { parseMistakeState } from './mistakes';

describe('parseMistakeState', () => {
  it('leer/kaputt ergibt leeres Objekt', () => {
    expect(parseMistakeState(null)).toEqual({});
    expect(parseMistakeState('kaputt{')).toEqual({});
  });

  it('gültige Daten werden übernommen', () => {
    expect(parseMistakeState('{"learn:a":{"count":2,"last":5}}')).toEqual({
      'learn:a': { count: 2, last: 5 },
    });
  });

  it('Array statt Objekt ergibt leeres Objekt (typeof [] === "object" reicht nicht)', () => {
    expect(parseMistakeState('[]')).toEqual({});
    expect(parseMistakeState('null')).toEqual({});
  });
});
