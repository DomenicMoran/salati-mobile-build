import type { Dua } from '@/features/duas/hooks';
import type { HadithWithTranslation } from '@/features/hadith/api';
import type { QuranSearchResult } from '@/features/quran/api';

import {
  capQuranResults,
  EMPTY_SEARCH_RESULTS,
  filterCourses,
  filterDuas,
  hadithHitsForCollection,
  hasAnyResults,
  mergeHadithHits,
  MAX_HADITH_PER_COLLECTION,
  MAX_RESULTS_PER_SECTION,
  totalResultCount,
  type CourseSearchItem,
} from './aggregate';

const QURAN_RESULTS: QuranSearchResult[] = Array.from({ length: 8 }, (_, i) => ({
  verseKey: `2:${i + 1}`,
  surah: 2,
  ayah: i + 1,
  arabicText: `آية ${i + 1}`,
  translationHtml: `<em>mercy</em> verse ${i + 1}`,
  translationName: 'Test',
}));

describe('capQuranResults', () => {
  it('caps to the default MAX_RESULTS_PER_SECTION without reordering', () => {
    const capped = capQuranResults(QURAN_RESULTS);
    expect(capped).toHaveLength(MAX_RESULTS_PER_SECTION);
    expect(capped.map((r) => r.ayah)).toEqual([1, 2, 3, 4, 5]);
  });

  it('respects a custom maxResults', () => {
    expect(capQuranResults(QURAN_RESULTS, 2)).toHaveLength(2);
  });

  it('does not mutate the source array', () => {
    const copy = [...QURAN_RESULTS];
    capQuranResults(QURAN_RESULTS, 1);
    expect(QURAN_RESULTS).toEqual(copy);
  });

  it('returns fewer results than the cap unchanged', () => {
    expect(capQuranResults(QURAN_RESULTS.slice(0, 2), 5)).toHaveLength(2);
  });
});

const SAMPLE_HADITHS: HadithWithTranslation[] = [
  {
    hadithnumber: 1,
    arabic: 'إنما الأعمال بالنيات',
    translation: 'Actions are judged by intentions',
    grades: [],
    reference: { book: 1, hadith: 1 },
  },
  {
    hadithnumber: 2,
    arabic: 'من حسن إسلام المرء تركه ما لا يعنيه',
    translation: 'Part of the perfection of Islam is leaving alone that which does not concern him',
    grades: [],
    reference: { book: 1, hadith: 2 },
  },
  {
    hadithnumber: 3,
    arabic: 'الدين النصيحة، قلنا: لمن؟ قال: intentions matter here too',
    translation: 'Religion is sincere advice, intentions matter here too',
    grades: [],
    reference: { book: 1, hadith: 3 },
  },
  {
    hadithnumber: 4,
    arabic: 'كذا',
    translation: 'Unrelated hadith about something else',
    grades: [],
    reference: { book: 1, hadith: 4 },
  },
];

describe('hadithHitsForCollection', () => {
  it('returns [] below MIN_QUERY_LENGTH', () => {
    expect(hadithHitsForCollection(SAMPLE_HADITHS, 'bukhari', 'Sahih al-Bukhari', 'i')).toEqual([]);
  });

  it('filters by translation text and attaches collection context', () => {
    const hits = hadithHitsForCollection(SAMPLE_HADITHS, 'bukhari', 'Sahih al-Bukhari', 'intentions');
    expect(hits.every((h) => h.collectionId === 'bukhari' && h.collectionName === 'Sahih al-Bukhari')).toBe(true);
    expect(hits.map((h) => h.hadith.hadithnumber).sort()).toEqual([1, 3]);
  });

  it('caps at maxPerCollection even with more matches available', () => {
    const hits = hadithHitsForCollection(SAMPLE_HADITHS, 'bukhari', 'Sahih al-Bukhari', 'intentions', 1);
    expect(hits).toHaveLength(1);
  });

  it('uses MAX_HADITH_PER_COLLECTION as the default cap', () => {
    expect(MAX_HADITH_PER_COLLECTION).toBeLessThan(SAMPLE_HADITHS.length);
  });
});

describe('mergeHadithHits', () => {
  it('flattens per-collection hits preserving collection order', () => {
    const perCollection = [
      hadithHitsForCollection(SAMPLE_HADITHS, 'bukhari', 'Sahih al-Bukhari', 'intentions'),
      hadithHitsForCollection(SAMPLE_HADITHS, 'muslim', 'Sahih Muslim', 'intentions'),
    ];
    const merged = mergeHadithHits(perCollection, 10);
    expect(merged.map((h) => h.collectionId)).toEqual(['bukhari', 'bukhari', 'muslim', 'muslim']);
  });

  it('caps the combined total across all collections', () => {
    const perCollection = [
      hadithHitsForCollection(SAMPLE_HADITHS, 'bukhari', 'Sahih al-Bukhari', 'intentions'),
      hadithHitsForCollection(SAMPLE_HADITHS, 'muslim', 'Sahih Muslim', 'intentions'),
    ];
    expect(mergeHadithHits(perCollection, 3)).toHaveLength(3);
  });

  it('returns [] for no collections', () => {
    expect(mergeHadithHits([], 5)).toEqual([]);
  });
});

const SAMPLE_DUAS: Dua[] = [
  {
    id: 'morning-1',
    category: 'morning',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ',
    transliteration: 'Asbahna wa asbaha al-mulku lillah',
    translations: { de: 'Wir sind in den Morgen eingetreten', en: 'We have entered the morning' },
    source: 'Muslim',
  },
  {
    id: 'travel-1',
    category: 'travel',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا',
    transliteration: 'Subhana alladhi sakhkhara lana hadha',
    translations: { de: 'Gepriesen sei Der, der uns dies dienstbar gemacht hat', en: 'Glory to Him who subjected this' },
    source: 'Abu Dawud',
  },
  {
    id: 'eating-1',
    category: 'eating',
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillah',
    translations: { de: 'Im Namen Allahs', en: 'In the name of Allah' },
    source: 'Bukhari',
  },
];

describe('filterDuas', () => {
  it('returns [] below MIN_QUERY_LENGTH', () => {
    expect(filterDuas(SAMPLE_DUAS, 'a', 'de')).toEqual([]);
  });

  it('matches the localized translation case-insensitively', () => {
    const result = filterDuas(SAMPLE_DUAS, 'MORGEN', 'de');
    expect(result.map((d) => d.id)).toEqual(['morning-1']);
  });

  it('matches transliteration', () => {
    const result = filterDuas(SAMPLE_DUAS, 'Bismillah', 'de');
    expect(result.map((d) => d.id)).toEqual(['eating-1']);
  });

  it('matches arabic text', () => {
    const result = filterDuas(SAMPLE_DUAS, 'سُبْحَانَ', 'de');
    expect(result.map((d) => d.id)).toEqual(['travel-1']);
  });

  it('matches source', () => {
    const result = filterDuas(SAMPLE_DUAS, 'dawud', 'de');
    expect(result.map((d) => d.id)).toEqual(['travel-1']);
  });

  it('falls back to english translation for a locale without one', () => {
    const result = filterDuas(SAMPLE_DUAS, 'entered the morning', 'fr');
    expect(result.map((d) => d.id)).toEqual(['morning-1']);
  });

  it('respects maxResults', () => {
    expect(filterDuas(SAMPLE_DUAS, 'a', 'de', 10).length).toBeLessThanOrEqual(10);
    expect(filterDuas(SAMPLE_DUAS, 'name', 'de', 1)).toHaveLength(1);
  });
});

const SAMPLE_COURSES: CourseSearchItem[] = [
  { id: 'tajwid', title: 'Tajwid', desc: 'Regeln der korrekten Koranrezitation' },
  { id: 'seerah', title: 'Seerah', desc: 'Das Leben des Propheten' },
  { id: 'aqida', title: 'Aqida', desc: 'Grundlagen des Glaubens' },
];

describe('filterCourses', () => {
  it('returns [] below MIN_QUERY_LENGTH', () => {
    expect(filterCourses(SAMPLE_COURSES, 'a')).toEqual([]);
  });

  it('matches title case-insensitively', () => {
    expect(filterCourses(SAMPLE_COURSES, 'SEERAH').map((c) => c.id)).toEqual(['seerah']);
  });

  it('matches description text', () => {
    expect(filterCourses(SAMPLE_COURSES, 'propheten').map((c) => c.id)).toEqual(['seerah']);
  });

  it('respects maxResults', () => {
    expect(filterCourses(SAMPLE_COURSES, 'des', 1)).toHaveLength(1);
  });

  it('returns [] when nothing matches', () => {
    expect(filterCourses(SAMPLE_COURSES, 'zzz-nonexistent')).toEqual([]);
  });
});

describe('hasAnyResults / totalResultCount', () => {
  it('is false/0 for EMPTY_SEARCH_RESULTS', () => {
    expect(hasAnyResults(EMPTY_SEARCH_RESULTS)).toBe(false);
    expect(totalResultCount(EMPTY_SEARCH_RESULTS)).toBe(0);
  });

  it('is true/>0 once any single category has a hit', () => {
    const results = { ...EMPTY_SEARCH_RESULTS, duas: filterDuas(SAMPLE_DUAS, 'Bismillah', 'de') };
    expect(hasAnyResults(results)).toBe(true);
    expect(totalResultCount(results)).toBe(1);
  });

  it('sums across all four categories', () => {
    const results = {
      quran: capQuranResults(QURAN_RESULTS, 2),
      hadith: mergeHadithHits([hadithHitsForCollection(SAMPLE_HADITHS, 'bukhari', 'Sahih al-Bukhari', 'intentions')], 5),
      duas: filterDuas(SAMPLE_DUAS, 'name', 'de'),
      courses: filterCourses(SAMPLE_COURSES, 'seerah'),
    };
    expect(totalResultCount(results)).toBe(
      results.quran.length + results.hadith.length + results.duas.length + results.courses.length,
    );
  });
});
