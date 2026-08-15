import { buildGapWords, knownAyahNumbers, selectHiddenIndices } from './gapTest';

// Deterministische rng-Sequenz statt Math.random — jeder Aufruf konsumiert
// den nächsten Wert, danach wird zyklisch wiederholt (reicht für Tests).
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('selectHiddenIndices', () => {
  it('leerer Vers ergibt keine Lücken', () => {
    expect(selectHiddenIndices(0)).toEqual([]);
  });

  it('blendet in 3er-Gruppen aus, wenn rng < 0.5 zurückgibt', () => {
    // groupSize=3 (rng<0.5), offset=floor(rng*3): 0 -> Index 0; nächste Gruppe
    // startet bei 3, offset 0 -> Index 3.
    const rng = seqRng([0.1, 0, 0.1, 0]);
    expect(selectHiddenIndices(6, rng)).toEqual([0, 3]);
  });

  it('blendet in 4er-Gruppen aus, wenn rng >= 0.5 zurückgibt', () => {
    // groupSize=4 (rng>=0.5), offset=floor(rng*4)=floor(0.9*4)=3 in jeder
    // Gruppe -> Index 3 (erste Gruppe 0-3) und Index 7 (zweite Gruppe 4-7).
    const rng = seqRng([0.9]);
    expect(selectHiddenIndices(8, rng)).toEqual([3, 7]);
  });

  it('genau ein Wort pro Gruppe wird ausgeblendet, nie mehr', () => {
    const rng = seqRng([0.2, 0.7, 0.4, 0.1, 0.6, 0.3]);
    const hidden = selectHiddenIndices(10, rng);
    // Jede Gruppe (3 oder 4 Wörter) liefert genau einen Treffer.
    expect(hidden.length).toBeGreaterThanOrEqual(Math.floor(10 / 4));
    expect(hidden.length).toBeLessThanOrEqual(Math.ceil(10 / 3));
    expect(new Set(hidden).size).toBe(hidden.length);
  });

  it('letzte, kleinere Restgruppe bleibt innerhalb der Wortanzahl', () => {
    // 5 Wörter, erste Gruppe 4 (rng>=0.5), Rest-Gruppe nur noch 1 Wort.
    const rng = seqRng([0.9, 0, 0.1, 0]);
    const hidden = selectHiddenIndices(5, rng);
    expect(hidden.every((i) => i >= 0 && i < 5)).toBe(true);
    expect(hidden).toContain(4); // einziges Wort der Restgruppe
  });
});

describe('buildGapWords', () => {
  it('markiert genau die von selectHiddenIndices gewählten Wörter als hidden', () => {
    const rng = seqRng([0.1, 0]); // eine 3er-Gruppe, offset 0 -> Index 0
    const words = buildGapWords('بِسْمِ اللَّهِ الرَّحْمَٰنِ', rng);
    expect(words).toEqual([
      { text: 'بِسْمِ', hidden: true },
      { text: 'اللَّهِ', hidden: false },
      { text: 'الرَّحْمَٰنِ', hidden: false },
    ]);
  });

  it('leerer Vers-Text ergibt leere Liste', () => {
    expect(buildGapWords('')).toEqual([]);
  });

  it('mehrfache Leerzeichen werden wie ein Trenner behandelt', () => {
    const words = buildGapWords('اللَّهُ   أَكْبَرُ', () => 0);
    expect(words.map((w) => w.text)).toEqual(['اللَّهُ', 'أَكْبَرُ']);
  });

  it('macht aus einem allein stehenden Waqf-Zeichen keine eigene Lücke', () => {
    // Uthmani-Text von 2:2 (live geprüft): "ۛ" steht dort zwischen Leerzeichen.
    // Als eigenes Wort wäre es eine unlösbare Lücke — und als eigener Text-Lauf
    // hätte es einen gestrichelten Kreis (s. lib/arabicText.ts).
    const words = buildGapWords('لَا رَيْبَ ۛ فِيهِ ۛ هُدًى', () => 0);
    expect(words.map((w) => w.text)).toEqual(['لَا', 'رَيْبَ ۛ', 'فِيهِ ۛ', 'هُدًى']);
  });
});

describe('knownAyahNumbers', () => {
  it('liefert nur "known"-Verse einer Sure, aufsteigend sortiert', () => {
    const progress = {
      2: { 5: 'known' as const, 3: 'learning' as const, 1: 'known' as const },
      3: { 1: 'known' as const },
    };
    expect(knownAyahNumbers(progress, 2)).toEqual([1, 5]);
  });

  it('unbekannte Sure ergibt leere Liste', () => {
    expect(knownAyahNumbers({}, 7)).toEqual([]);
  });
});
