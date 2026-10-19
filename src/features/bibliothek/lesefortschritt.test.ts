import {
  LESEFORTSCHRITT_STORAGE_KEY,
  parseLesefortschritt,
  serializeLesefortschritt,
} from './lesefortschritt';

describe('LESEFORTSCHRITT_STORAGE_KEY', () => {
  it('bleibt stabil fuer geteilten Speicher mit TV', () => {
    expect(LESEFORTSCHRITT_STORAGE_KEY).toBe('salati.bibliothek.rassoul.v1');
  });
});

describe('parseLesefortschritt', () => {
  it('lehnt ungueltiges JSON ab', () => {
    expect(parseLesefortschritt('kein json')).toBeNull();
  });

  it('lehnt Sure 0 ab', () => {
    expect(parseLesefortschritt(JSON.stringify({ surah: 0, block: 0 }))).toBeNull();
  });

  it('lehnt Sure 115 ab', () => {
    expect(parseLesefortschritt(JSON.stringify({ surah: 115, block: 0 }))).toBeNull();
  });

  it('lehnt negative Block-Indizes ab', () => {
    expect(parseLesefortschritt(JSON.stringify({ surah: 1, block: -1 }))).toBeNull();
  });
});

describe('serializeLesefortschritt / parseLesefortschritt', () => {
  it('roundtrip fuer gueltigen Fortschritt', () => {
    const wert = { surah: 2, block: 7 };
    expect(parseLesefortschritt(serializeLesefortschritt(wert))).toEqual(wert);
  });
});
