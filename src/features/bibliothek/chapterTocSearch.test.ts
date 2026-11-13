import type { ReaderChapterTocEntry } from '@/features/bibliothek/allinone/types';

import { filterChaptersByQuery } from './chapterTocSearch';

describe('filterChaptersByQuery', () => {
  const chapters: ReaderChapterTocEntry[] = [
    { slug: 'a', title: 'Einstieg', startPage: 1, endPage: 10, pageCount: 10 },
    { slug: 'b', title: 'Grammatik', startPage: 11, endPage: 40, pageCount: 30 },
  ];

  it('liefert alle bei leerer Suche', () => {
    expect(filterChaptersByQuery(chapters, '')).toHaveLength(2);
  });

  it('filtert nach Titel', () => {
    expect(filterChaptersByQuery(chapters, 'gram')).toEqual([chapters[1]]);
  });
});
