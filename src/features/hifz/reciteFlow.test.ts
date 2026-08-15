import { indexForAyah, parseReciteParams, shouldAutoMarkKnown } from './reciteFlow';

describe('parseReciteParams', () => {
  it('parst gültige ayah- und recite-Params', () => {
    expect(parseReciteParams({ ayah: '5', recite: '1' })).toEqual({
      targetAyah: 5,
      reciteRequested: true,
    });
  });

  it('akzeptiert recite=true als angefordert', () => {
    expect(parseReciteParams({ ayah: '2', recite: 'true' }).reciteRequested).toBe(true);
  });

  it('liefert Defaults ohne Params', () => {
    expect(parseReciteParams({})).toEqual({ targetAyah: null, reciteRequested: false });
  });

  it('verwirft ungültige ayah-Werte', () => {
    expect(parseReciteParams({ ayah: '' }).targetAyah).toBeNull();
    expect(parseReciteParams({ ayah: '0' }).targetAyah).toBeNull();
    expect(parseReciteParams({ ayah: '-3' }).targetAyah).toBeNull();
    expect(parseReciteParams({ ayah: '2.5' }).targetAyah).toBeNull();
    expect(parseReciteParams({ ayah: 'abc' }).targetAyah).toBeNull();
  });

  it('nimmt bei Array-Params das erste Element', () => {
    expect(parseReciteParams({ ayah: ['7', '9'], recite: ['1'] })).toEqual({
      targetAyah: 7,
      reciteRequested: true,
    });
  });

  it('wertet andere recite-Werte als nicht angefordert', () => {
    expect(parseReciteParams({ recite: '0' }).reciteRequested).toBe(false);
    expect(parseReciteParams({ recite: 'yes' }).reciteRequested).toBe(false);
  });
});

describe('indexForAyah', () => {
  it('findet den Index des Ziel-Verses', () => {
    expect(indexForAyah([1, 2, 3, 4], 3)).toBe(2);
  });

  it('liefert null für fehlenden Vers oder fehlendes Ziel', () => {
    expect(indexForAyah([1, 2, 3], 9)).toBeNull();
    expect(indexForAyah([1, 2, 3], null)).toBeNull();
    expect(indexForAyah([], 1)).toBeNull();
  });
});

describe('shouldAutoMarkKnown', () => {
  it('hakt ab Note "good" (>= 0.45) automatisch ab', () => {
    expect(shouldAutoMarkKnown(1)).toBe(true);
    expect(shouldAutoMarkKnown(0.72)).toBe(true);
    expect(shouldAutoMarkKnown(0.45)).toBe(true);
  });

  it('hakt bei "retry" (< 0.45) nicht ab', () => {
    expect(shouldAutoMarkKnown(0.44)).toBe(false);
    expect(shouldAutoMarkKnown(0)).toBe(false);
  });
});
