import { distanceKm } from './geo';

describe('distanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(distanceKm(52.52, 13.405, 52.52, 13.405)).toBe(0);
  });

  it('computes a known distance (Berlin to Hamburg, ~255km)', () => {
    const d = distanceKm(52.52, 13.405, 53.5511, 9.9937);
    expect(d).toBeGreaterThan(240);
    expect(d).toBeLessThan(270);
  });

  it('is symmetric', () => {
    const a = distanceKm(48.8566, 2.3522, 51.5074, -0.1278);
    const b = distanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(a).toBeCloseTo(b, 6);
  });
});
