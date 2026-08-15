import { CHANGELOG, changelogNewestFirst, getChangelogText, LATEST_CHANGELOG_VERSION } from './changelog';

// Vergleicht zwei Semver-Strings ('1.2.10' > '1.2.9'), nicht lexikografisch.
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

describe('changelog data', () => {
  it('enthält mindestens eine Version', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it('jede Versionsnummer folgt Semver (x.y.z, nur Ziffern)', () => {
    for (const v of CHANGELOG) {
      expect(v.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('Versionsnummern sind strikt aufsteigend (Datenreihenfolge: älteste zuerst)', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const prev = CHANGELOG[i - 1];
      const curr = CHANGELOG[i];
      expect(compareSemver(curr.version, prev.version)).toBeGreaterThan(0);
    }
  });

  it('keine doppelten Versionsnummern', () => {
    const versions = CHANGELOG.map((v) => v.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('jede Version hat ein gültiges ISO-Datum (YYYY-MM-DD)', () => {
    for (const v of CHANGELOG) {
      expect(v.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(v.date).getTime())).toBe(false);
    }
  });

  it('Daten sind chronologisch nicht rückläufig', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(CHANGELOG[i].date >= CHANGELOG[i - 1].date).toBe(true);
    }
  });

  it('jede Version hat mindestens einen Eintrag', () => {
    for (const v of CHANGELOG) {
      expect(v.entries.length).toBeGreaterThan(0);
    }
  });

  it('jeder Eintrag hat einen gültigen Typ und nicht-leeren de/en-Text', () => {
    const validTypes = new Set(['feature', 'improvement', 'fix']);
    for (const v of CHANGELOG) {
      for (const entry of v.entries) {
        expect(validTypes.has(entry.type)).toBe(true);
        expect(entry.de.trim().length).toBeGreaterThan(0);
        expect(entry.en.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('LATEST_CHANGELOG_VERSION ist die letzte Version der (aufsteigenden) Liste', () => {
    expect(LATEST_CHANGELOG_VERSION).toBe(CHANGELOG[CHANGELOG.length - 1].version);
  });

  it('changelogNewestFirst() kehrt die Reihenfolge um, ohne CHANGELOG zu mutieren', () => {
    const before = CHANGELOG.map((v) => v.version);
    const reversed = changelogNewestFirst();
    expect(reversed.map((v) => v.version)).toEqual([...before].reverse());
    expect(CHANGELOG.map((v) => v.version)).toEqual(before);
  });

  it('getChangelogText: "de" liefert den deutschen Text, jede andere Sprache faellt auf Englisch zurueck', () => {
    const entry = CHANGELOG[0].entries[0];
    expect(getChangelogText(entry, 'de')).toBe(entry.de);
    expect(getChangelogText(entry, 'en')).toBe(entry.en);
    expect(getChangelogText(entry, 'fr')).toBe(entry.en);
    expect(getChangelogText(entry, 'ar')).toBe(entry.en);
  });
});
