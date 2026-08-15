import { THEME_COLLECTIONS, themeCollectionById } from './collections';

describe('themes/collections', () => {
  it('eindeutige IDs, jede Sammlung hat mindestens 3 gültige Vers-Referenzen', () => {
    expect(new Set(THEME_COLLECTIONS.map((c) => c.id)).size).toBe(THEME_COLLECTIONS.length);
    for (const c of THEME_COLLECTIONS) {
      expect(c.verses.length).toBeGreaterThanOrEqual(3);
      expect(c.icon.length).toBeGreaterThan(0);
      expect(c.titleKey.startsWith('themes.collections.')).toBe(true);
      expect(c.introKey.startsWith('themes.collections.')).toBe(true);
      for (const v of c.verses) {
        expect(v.surah).toBeGreaterThanOrEqual(1);
        expect(v.surah).toBeLessThanOrEqual(114);
        expect(v.ayah).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('keine Sammlung enthält doppelte Vers-Referenzen', () => {
    for (const c of THEME_COLLECTIONS) {
      const keys = c.verses.map((v) => `${v.surah}:${v.ayah}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('themeCollectionById findet vorhandene IDs, gibt undefined für unbekannte zurück', () => {
    expect(themeCollectionById('patience')?.id).toBe('patience');
    expect(themeCollectionById('does-not-exist')).toBeUndefined();
  });
});
