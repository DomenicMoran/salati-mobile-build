import { chapterAtPage, chapterTocFromBuildManifest } from './chapterToc';
import type { AllInOneBuildManifest } from './types';

const B2_MANIFEST: AllInOneBuildManifest = {
  built: '2026-11-10',
  output: 'out.pdf',
  outputId: 'salati-islam-lernwerk',
  totalPages: 894,
  chapters: [
    {
      index: 1,
      slug: 'einstieg',
      title: 'Einstieg & Absicht',
      startPage: null,
      pageCount: 0,
      endPage: null,
      pending: true,
    },
    {
      index: 2,
      slug: 'arabisch-lesen-tadschwied',
      title: 'Arabisch lesen & Tadschwied',
      startPage: 1,
      pageCount: 95,
      endPage: 95,
      pending: false,
    },
  ],
  segments: [
    { file: 'lesen-lernen.pdf', id: 'lesen-lernen', startPage: 1, pageCount: 44, endPage: 44 },
    { file: 'tadschwied.pdf', id: 'tadschwied', startPage: 45, pageCount: 51, endPage: 95 },
  ],
};

describe('chapterTocFromBuildManifest', () => {
  it('skips pending chapters with no start page', () => {
    const toc = chapterTocFromBuildManifest(B2_MANIFEST);
    expect(toc.map((c) => c.slug)).toEqual(['arabisch-lesen-tadschwied']);
    expect(toc[0]?.startPage).toBe(1);
  });

  it('falls back to segments when chapters missing', () => {
    const toc = chapterTocFromBuildManifest({
      built: '2026-11-10',
      output: 'out.pdf',
      outputId: 'salati-islam-lernwerk',
      totalPages: 44,
      segments: B2_MANIFEST.segments.slice(0, 1),
    });
    expect(toc).toHaveLength(1);
    expect(toc[0]?.slug).toBe('lesen-lernen');
  });
});

describe('chapterAtPage', () => {
  it('resolves page inside chapter range', () => {
    const toc = chapterTocFromBuildManifest(B2_MANIFEST);
    expect(chapterAtPage(toc, 50)?.slug).toBe('arabisch-lesen-tadschwied');
    expect(chapterAtPage(toc, 0)).toBeNull();
  });
});
