import { filterHadiths, flattenHadeethencPages, groupHadithsByBook, hadithOfTheDay } from './hooks';
import type { HadithWithTranslation } from './api';

const SAMPLE: HadithWithTranslation[] = [
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
];

describe('filterHadiths', () => {
  it('returns all hadiths for an empty query', () => {
    expect(filterHadiths(SAMPLE, '')).toHaveLength(2);
  });

  it('filters by translation text case-insensitively', () => {
    const result = filterHadiths(SAMPLE, 'INTENTIONS');
    expect(result).toHaveLength(1);
    expect(result[0].hadithnumber).toBe(1);
  });

  it('filters by arabic text', () => {
    const result = filterHadiths(SAMPLE, 'الأعمال');
    expect(result).toHaveLength(1);
    expect(result[0].hadithnumber).toBe(1);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterHadiths(SAMPLE, 'nonexistent-xyz')).toHaveLength(0);
  });
});

describe('groupHadithsByBook', () => {
  const sections = { '0': '', '1': 'Revelation', '2': 'Belief' };
  const withThreeBooks: HadithWithTranslation[] = [
    ...SAMPLE,
    {
      hadithnumber: 3,
      arabic: 'كذا',
      translation: 'Faith example',
      grades: [],
      reference: { book: 2, hadith: 1 },
    },
    {
      hadithnumber: 4,
      arabic: 'كذا٢',
      translation: 'Unnamed section entry',
      grades: [],
      reference: { book: 0, hadith: 1 },
    },
  ];

  it('groups by reference.book and counts entries', () => {
    const result = groupHadithsByBook(withThreeBooks, sections);
    const book1 = result.find((b) => b.book === 1);
    const book2 = result.find((b) => b.book === 2);
    expect(book1?.count).toBe(2);
    expect(book1?.title).toBe('Revelation');
    expect(book2?.count).toBe(1);
    expect(book2?.title).toBe('Belief');
  });

  it('skips books with an empty section title', () => {
    const result = groupHadithsByBook(withThreeBooks, sections);
    expect(result.find((b) => b.book === 0)).toBeUndefined();
  });

  it('sorts results by book number ascending', () => {
    const result = groupHadithsByBook(withThreeBooks, sections);
    const numbers = result.map((b) => b.book);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });
});

describe('hadithOfTheDay', () => {
  it('returns undefined for an empty collection', () => {
    expect(hadithOfTheDay([], new Date('2026-07-16'))).toBeUndefined();
  });

  it('returns the same entry for the same day (deterministic)', () => {
    const date = new Date('2026-07-16T08:00:00Z');
    const a = hadithOfTheDay(SAMPLE, date);
    const b = hadithOfTheDay(SAMPLE, new Date('2026-07-16T20:00:00Z'));
    expect(a).toBe(b);
  });

  it('picks a different entry on a different day (with more than one candidate)', () => {
    const many: HadithWithTranslation[] = Array.from({ length: 42 }, (_, i) => ({
      hadithnumber: i + 1,
      arabic: 'x',
      translation: `hadith ${i + 1}`,
      grades: [],
      reference: { book: 1, hadith: i + 1 },
    }));
    const day1 = hadithOfTheDay(many, new Date('2026-07-16'));
    const day2 = hadithOfTheDay(many, new Date('2026-07-17'));
    expect(day1?.hadithnumber).not.toBe(day2?.hadithnumber);
  });

  it('always returns an entry within bounds of the collection', () => {
    const result = hadithOfTheDay(SAMPLE, new Date('2030-01-01'));
    expect(SAMPLE).toContain(result);
  });
});

describe('flattenHadeethencPages', () => {
  const page = (ids: string[], p: number, lastPage: number) => ({
    items: ids.map((id) => ({ id, title: `Titel ${id}` })),
    page: p,
    lastPage,
    total: 5,
  });

  it('führt nachgeladene Seiten in Ladereihenfolge zusammen', () => {
    const flat = flattenHadeethencPages([page(['1', '2'], 1, 3), page(['3', '4'], 2, 3)]);
    expect(flat.map((h) => h.id)).toEqual(['1', '2', '3', '4']);
  });

  it('liefert eine leere Liste, solange nichts geladen ist', () => {
    expect(flattenHadeethencPages(undefined)).toEqual([]);
    expect(flattenHadeethencPages([])).toEqual([]);
  });
});
