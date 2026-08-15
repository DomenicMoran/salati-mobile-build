import { getGermanWordGlosses, hasGermanWordByWord } from './wbw-de';

// Die Glossen sind POSITIONSGEBUNDEN an die quran.com-Wortsegmentierung: eine
// Lücke oder ein zusätzlicher Eintrag verschiebt jede folgende Wortbedeutung
// um eins. Der Reader gleicht deshalb die Array-Länge ab — die Tabelle selbst
// muss aber lückenlos und plausibel sein.

/** Verszahlen der abgedeckten Suren. */
const AYAH_COUNT: Record<number, number> = { 1: 7, 112: 4, 113: 5, 114: 6 };

describe('hasGermanWordByWord', () => {
  it('deckt genau die vier Kernsuren ab', () => {
    for (const surah of [1, 112, 113, 114]) expect(hasGermanWordByWord(surah)).toBe(true);
  });

  it('meldet für nicht gepflegte Suren false (Reader fällt auf Englisch zurück)', () => {
    for (const surah of [2, 18, 36, 55, 111]) expect(hasGermanWordByWord(surah)).toBe(false);
  });

  it('meldet für ungültige Surennummern false statt zu werfen', () => {
    expect(hasGermanWordByWord(0)).toBe(false);
    expect(hasGermanWordByWord(115)).toBe(false);
    expect(hasGermanWordByWord(Number.NaN)).toBe(false);
  });
});

describe('getGermanWordGlosses — Vollständigkeit je Sure', () => {
  it.each(Object.entries(AYAH_COUNT))('Sure %s hat für jeden ihrer Verse Glossen', (surahStr, count) => {
    const surah = Number(surahStr);
    for (let ayah = 1; ayah <= count; ayah++) {
      const glosses = getGermanWordGlosses(surah, ayah);
      expect({ surah, ayah, present: Array.isArray(glosses) }).toEqual({ surah, ayah, present: true });
      expect(glosses!.length).toBeGreaterThan(0);
      for (const g of glosses!) expect(g.trim()).not.toBe('');
    }
  });

  it('hat keine Glossen für Verse jenseits des Surenendes', () => {
    expect(getGermanWordGlosses(1, 8)).toBeUndefined();
    expect(getGermanWordGlosses(112, 5)).toBeUndefined();
    expect(getGermanWordGlosses(113, 6)).toBeUndefined();
    expect(getGermanWordGlosses(114, 7)).toBeUndefined();
  });

  it('liefert undefined statt zu werfen für Vers 0 / nicht gepflegte Suren', () => {
    expect(getGermanWordGlosses(1, 0)).toBeUndefined();
    expect(getGermanWordGlosses(2, 1)).toBeUndefined();
    expect(getGermanWordGlosses(0, 1)).toBeUndefined();
  });
});

describe('getGermanWordGlosses — Wortzahlen (quran.com-Segmentierung)', () => {
  // Am 2026-07-22 gegen verses/by_chapter (words=true) verifiziert; eine
  // Änderung hier bedeutet, dass die Ausrichtung neu geprüft werden muss.
  const expectedLengths: [number, number, number][] = [
    [1, 1, 4],
    [1, 2, 4],
    [1, 3, 2],
    [1, 4, 3],
    [1, 5, 4],
    [1, 6, 3],
    [1, 7, 9],
    [112, 1, 4],
    [112, 4, 5],
    [113, 1, 4],
    [113, 5, 5],
    [114, 1, 4],
    [114, 6, 3],
  ];

  it.each(expectedLengths)('Sure %i Vers %i hat %i Wortglossen', (surah, ayah, length) => {
    expect(getGermanWordGlosses(surah, ayah)).toHaveLength(length);
  });

  it('enthält die etablierte deutsche Koran-Terminologie in Al-Fatiha 1:1', () => {
    expect(getGermanWordGlosses(1, 1)).toEqual([
      'Im Namen',
      'Allahs',
      'des Allerbarmers',
      'des Barmherzigen',
    ]);
  });
});
