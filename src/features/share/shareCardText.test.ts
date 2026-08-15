import { buildShareCaption, truncateForShareCard } from './shareCardText';

describe('truncateForShareCard', () => {
  it('returns short text unchanged', () => {
    expect(truncateForShareCard('Bismillah', 50)).toBe('Bismillah');
  });

  it('trims surrounding whitespace even when under the limit', () => {
    expect(truncateForShareCard('  Bismillah  ', 50)).toBe('Bismillah');
  });

  it('truncates long text at the last word boundary and appends an ellipsis', () => {
    const text = 'The quick brown fox jumps over the lazy dog and keeps running further';
    const result = truncateForShareCard(text, 30);
    expect(result).toBe('The quick brown fox jumps…');
    // The word before the ellipsis must be a whole word from the source text,
    // never a fragment cut off mid-way.
    expect(text).toContain(result.slice(0, -1));
    expect(result.length).toBeLessThanOrEqual(31);
  });

  it('hard-cuts a single very long word with no spaces', () => {
    const text = 'a'.repeat(100);
    const result = truncateForShareCard(text, 20);
    expect(result).toBe(`${'a'.repeat(20)}…`);
  });

  it('does not cut when text length exactly equals the limit', () => {
    const text = 'exactly twenty chars';
    expect(text.length).toBe(20);
    expect(truncateForShareCard(text, 20)).toBe(text);
  });
});

describe('buildShareCaption', () => {
  it('joins source, deep link and footer with blank lines', () => {
    expect(buildShareCaption('Al-Baqara 2:255', 'salatibox://quran/2?ayah=255', 'Geteilt aus der Salati-App')).toBe(
      'Al-Baqara 2:255\n\nsalatibox://quran/2?ayah=255\n\nGeteilt aus der Salati-App',
    );
  });
});
