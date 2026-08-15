import { parseQadaCount } from './qada';

describe('parseQadaCount', () => {
  it('0 bei null (kein gespeicherter Wert)', () => {
    expect(parseQadaCount(null)).toBe(0);
  });

  it('parst eine gültige Zahl', () => {
    expect(parseQadaCount('3')).toBe(3);
  });

  it('rundet auf ganze Tage ab', () => {
    expect(parseQadaCount('3.7')).toBe(3);
  });

  it('0 bei negativer oder kaputter Eingabe', () => {
    expect(parseQadaCount('-2')).toBe(0);
    expect(parseQadaCount('nope')).toBe(0);
    expect(parseQadaCount('')).toBe(0);
  });
});
