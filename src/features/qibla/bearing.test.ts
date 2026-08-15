import { distanceToMeccaKm, qiblaBearing } from './bearing';

describe('qiblaBearing', () => {
  it('returns a value in [0, 360)', () => {
    const b = qiblaBearing(52.52, 13.405); // Berlin
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('points roughly south-east from Berlin toward Mecca', () => {
    const b = qiblaBearing(52.52, 13.405);
    // Bekannter Referenzwert für Berlin -> Mekka liegt um ~136°
    expect(b).toBeGreaterThan(120);
    expect(b).toBeLessThan(150);
  });

  it('trifft bekannte Referenzwerte auf 1 Grad genau', () => {
    // Referenzen: gängige Qibla-Rechner (Great-Circle-Anfangskurs)
    expect(qiblaBearing(52.52, 13.405)).toBeCloseTo(136.7, 0); // Berlin
    expect(qiblaBearing(41.0082, 28.9784)).toBeCloseTo(151.6, 0); // Istanbul
    expect(qiblaBearing(40.7128, -74.006)).toBeCloseTo(58.5, 0); // New York
    expect(qiblaBearing(-6.2088, 106.8456)).toBeCloseTo(295.2, 0); // Jakarta
  });

  it('is deterministic for the same input', () => {
    expect(qiblaBearing(48.1351, 11.582)).toBe(qiblaBearing(48.1351, 11.582));
  });
});

describe('distanceToMeccaKm', () => {
  it('is 0 at the Kaaba itself', () => {
    expect(distanceToMeccaKm(21.4225, 39.8262)).toBeCloseTo(0, 3);
  });

  it('trifft bekannte Referenz-Distanzen (Haversine) auf unter 1 km genau', () => {
    expect(distanceToMeccaKm(52.52, 13.405)).toBeCloseTo(4130.2, 0); // Berlin
    expect(distanceToMeccaKm(41.0082, 28.9784)).toBeCloseTo(2405.1, 0); // Istanbul
    expect(distanceToMeccaKm(40.7128, -74.006)).toBeCloseTo(10306.3, 0); // New York
    expect(distanceToMeccaKm(-6.2088, 106.8456)).toBeCloseTo(7920.1, 0); // Jakarta
  });

  it('returns a positive value for any location away from the Kaaba', () => {
    expect(distanceToMeccaKm(52.52, 13.405)).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', () => {
    expect(distanceToMeccaKm(48.1351, 11.582)).toBe(distanceToMeccaKm(48.1351, 11.582));
  });
});
