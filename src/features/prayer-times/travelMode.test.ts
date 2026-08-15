import { distanceKm, getTravelStatus, TRAVEL_DISTANCE_THRESHOLD_KM } from './travelMode';

const BERLIN = { lat: 52.52, lon: 13.405 };
const HAMBURG = { lat: 53.5511, lon: 9.9937 }; // ~255 km von Berlin
const POTSDAM = { lat: 52.3906, lon: 13.0645 }; // ~26 km von Berlin

describe('distanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(distanceKm(BERLIN, BERLIN)).toBe(0);
  });

  it('computes a realistic distance for two known cities', () => {
    const d = distanceKm(BERLIN, HAMBURG);
    expect(d).toBeGreaterThan(240);
    expect(d).toBeLessThan(270);
  });

  it('is symmetric', () => {
    expect(distanceKm(BERLIN, HAMBURG)).toBeCloseTo(distanceKm(HAMBURG, BERLIN), 6);
  });

  it('computes a short realistic distance for a nearby city', () => {
    const d = distanceKm(BERLIN, POTSDAM);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(35);
  });
});

describe('getTravelStatus', () => {
  it('is never traveling when no home is set', () => {
    expect(getTravelStatus(null, HAMBURG)).toEqual({ isTraveling: false, distanceKm: 0 });
  });

  it('is not traveling below the threshold (nearby city)', () => {
    const status = getTravelStatus(BERLIN, POTSDAM);
    expect(status.isTraveling).toBe(false);
    expect(status.distanceKm).toBeLessThan(TRAVEL_DISTANCE_THRESHOLD_KM);
  });

  it('is traveling above the threshold (far city)', () => {
    const status = getTravelStatus(BERLIN, HAMBURG);
    expect(status.isTraveling).toBe(true);
    expect(status.distanceKm).toBeGreaterThan(TRAVEL_DISTANCE_THRESHOLD_KM);
  });

  it('treats exactly the threshold distance as not traveling (strictly greater-than)', () => {
    // Ein Punkt exakt TRAVEL_DISTANCE_THRESHOLD_KM nördlich von BERLIN
    // (1 Grad Breite ≈ 111.32 km, daher die Umrechnung).
    const kmPerDegreeLat = 111.32;
    const exact = { lat: BERLIN.lat + TRAVEL_DISTANCE_THRESHOLD_KM / kmPerDegreeLat, lon: BERLIN.lon };
    const status = getTravelStatus(BERLIN, exact);
    expect(status.distanceKm).toBeCloseTo(TRAVEL_DISTANCE_THRESHOLD_KM, 0);
  });

  it('stays at the same location => not traveling', () => {
    expect(getTravelStatus(BERLIN, BERLIN).isTraveling).toBe(false);
  });
});
