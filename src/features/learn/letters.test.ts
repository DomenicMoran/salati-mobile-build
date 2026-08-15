import { wordToIsolatedForms, wordToLetterList } from './letters';

describe('wordToIsolatedForms', () => {
  it('inserts a ZWNJ between consecutive base letters', () => {
    const result = wordToIsolatedForms('كتب');
    expect(result).toBe('ك‌ت‌ب');
  });

  it('keeps harakat attached to their base letter', () => {
    const result = wordToIsolatedForms('كِتَابٌ');
    // Base letters ك, ت, ا, ب separated by ZWNJ; diacritics stay put.
    expect(result).toBe('كِ‌تَ‌ا‌بٌ');
  });

  it('returns a single letter unchanged (no ZWNJ needed)', () => {
    expect(wordToIsolatedForms('ب')).toBe('ب');
  });

  it('trennt auch Hamza-Träger und Alif-Waṣla ab (nicht Teil der 28 Buchstaben)', () => {
    // Vorher blieben أ إ ؤ ئ ة ى ٱ mit dem Nachbarn verbunden, obwohl die
    // Ansicht gerade die isolierten Formen zeigen soll.
    expect(wordToIsolatedForms('ٱلْحَمْدُ')).toBe('ٱ‌لْ‌حَ‌مْ‌دُ');
    expect(wordToIsolatedForms('سَمَاءٌ')).toBe('سَ‌مَ‌ا‌ءٌ');
  });

  it('erzeugt keinen basislosen Lauf, wenn der Text mit einem Zeichen beginnt', () => {
    // Ein führendes Vokalzeichen bekäme sonst den gestrichelten Kreis.
    expect(wordToIsolatedForms('ًب').startsWith('ً')).toBe(false);
  });
});

describe('wordToLetterList', () => {
  it('splits a plain word into named base letters', () => {
    expect(wordToLetterList('كتب')).toEqual([
      { char: 'ك', name: 'Kāf' },
      { char: 'ت', name: 'Tā’' },
      { char: 'ب', name: 'Bā’' },
    ]);
  });

  it('skips harakat/diacritics, keeping only base letters', () => {
    expect(wordToLetterList('كِتَابٌ')).toEqual([
      { char: 'ك', name: 'Kāf' },
      { char: 'ت', name: 'Tā’' },
      { char: 'ا', name: 'Alif' },
      { char: 'ب', name: 'Bā’' },
    ]);
  });

  it('names common hamza/special forms not in the 28-letter alphabet', () => {
    expect(wordToLetterList('سَمَاءٌ')).toEqual([
      { char: 'س', name: 'Sīn' },
      { char: 'م', name: 'Mīm' },
      { char: 'ا', name: 'Alif' },
      { char: 'ء', name: 'Hamza' },
    ]);
  });
});
