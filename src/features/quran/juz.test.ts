import { JUZ_STARTS } from './juz';

/** Verszahlen der von JUZ_STARTS referenzierten Suren (Kufische Zählung). */
const AYAH_COUNT: Record<number, number> = {
  1: 7,
  2: 286,
  3: 200,
  4: 176,
  5: 120,
  6: 165,
  7: 206,
  8: 75,
  9: 129,
  11: 123,
  12: 111,
  15: 99,
  17: 111,
  18: 110,
  21: 112,
  23: 118,
  25: 77,
  27: 93,
  29: 69,
  33: 73,
  36: 83,
  39: 75,
  41: 54,
  46: 35,
  51: 60,
  58: 22,
  67: 30,
  78: 40,
};

// Die Juz-Startpunkte sind der Einsprung der Juz-Liste (quran/index.tsx) UND
// die Basis der Khatmah-Tagesportionen (khatmah.tsx). Ein falscher Startvers
// würde einen Leseplan systematisch verschieben — deshalb hier die
// vollständige Liste explizit gegen die Einteilung geprüft, die auch die
// App-Datenquelle (quran.com /api/v4/juzs) verwendet.

const CANONICAL: [number, number, number][] = [
  [1, 1, 1],
  [2, 2, 142],
  [3, 2, 253],
  [4, 3, 93],
  [5, 4, 24],
  [6, 4, 148],
  [7, 5, 82],
  [8, 6, 111],
  [9, 7, 88],
  [10, 8, 41],
  [11, 9, 93],
  [12, 11, 6],
  [13, 12, 53],
  [14, 15, 1],
  [15, 17, 1],
  [16, 18, 75],
  [17, 21, 1],
  [18, 23, 1],
  [19, 25, 21],
  [20, 27, 56],
  [21, 29, 46],
  [22, 33, 31],
  [23, 36, 28],
  [24, 39, 32],
  [25, 41, 47],
  [26, 46, 1],
  [27, 51, 31],
  [28, 58, 1],
  [29, 67, 1],
  [30, 78, 1],
];

describe('JUZ_STARTS', () => {
  it('hat genau 30 Einträge, lückenlos von 1 bis 30 nummeriert', () => {
    expect(JUZ_STARTS).toHaveLength(30);
    expect(JUZ_STARTS.map((j) => j.juz)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it.each(CANONICAL)('Juz %i beginnt bei Sure %i, Vers %i', (juz, surah, ayah) => {
    const entry = JUZ_STARTS[juz - 1];
    expect({ surah: entry.surah, ayah: entry.ayah }).toEqual({ surah, ayah });
  });

  it('läuft im Mushaf streng vorwärts (kein Rücksprung)', () => {
    for (let i = 1; i < JUZ_STARTS.length; i++) {
      const prev = JUZ_STARTS[i - 1];
      const cur = JUZ_STARTS[i];
      const forward = cur.surah > prev.surah || (cur.surah === prev.surah && cur.ayah > prev.ayah);
      expect({ juz: cur.juz, forward }).toEqual({ juz: cur.juz, forward: true });
    }
  });

  it('verweist nur auf existierende Sure/Vers-Kombinationen', () => {
    for (const j of JUZ_STARTS) {
      expect(j.surah).toBeGreaterThanOrEqual(1);
      expect(j.surah).toBeLessThanOrEqual(114);
      expect(j.ayah).toBeGreaterThanOrEqual(1);
      expect(j.ayah).toBeLessThanOrEqual(AYAH_COUNT[j.surah]);
    }
  });
});
