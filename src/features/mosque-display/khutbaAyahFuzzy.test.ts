import { bestAyahMatch, fuzzyAyahScore, khutbaAyahDeepLink } from './khutbaAyahFuzzy';

describe('khutbaAyahFuzzy', () => {
  it('scores overlapping ayah tokens', () => {
    expect(fuzzyAyahScore('ar rahman', 'ar-rahman ir-rahman')).toBeGreaterThan(0.4);
  });

  it('finds best corpus hit', () => {
    const hit = bestAyahMatch('qul huwa allahu ahad', [
      { surah: 1, ayah: 1, text: 'bismillah' },
      { surah: 112, ayah: 1, text: 'qul huwa allahu ahad' },
    ]);
    expect(hit?.surah).toBe(112);
  });

  it('builds deep link', () => {
    expect(khutbaAyahDeepLink({ surah: 2, ayah: 255 })).toBe('/quran/2#255');
  });
});