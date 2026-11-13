import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  chapterStartOffset,
  chapterTocFromBuild,
  parseAllInOneBuildManifest,
  segmentForPage,
} from './buildToc';

const REPO_BUILD_JSON = path.resolve(
  __dirname,
  '../../../../../../output/audit-20261110-p2/builds/salati-islam-lernwerk-draft.build.json',
);

const FIXTURE_MINIMAL = {
  built: '2026-11-10',
  output: 'out.pdf',
  totalPages: 10,
  outputId: 'salati-islam-lernwerk',
  segments: [
    { file: 'a.pdf', id: 'a', startPage: 1, pageCount: 4, endPage: 4 },
    { file: 'b.pdf', id: 'b', startPage: 5, pageCount: 6, endPage: 10 },
  ],
} as const;

describe('parseAllInOneBuildManifest', () => {
  it('akzeptiert gültiges build.json', () => {
    const m = parseAllInOneBuildManifest(FIXTURE_MINIMAL);
    expect(m).not.toBeNull();
    expect(m?.segments).toHaveLength(2);
  });

  it('lehnt kaputte Segments ab', () => {
    expect(parseAllInOneBuildManifest({ ...FIXTURE_MINIMAL, segments: [{}] })).toBeNull();
  });
});

describe('chapterTocFromBuild', () => {
  it('mappt Segment-Offsets', () => {
    const m = parseAllInOneBuildManifest(FIXTURE_MINIMAL)!;
    expect(chapterTocFromBuild(m)).toEqual([
      { id: 'a', startPage: 1, endPage: 4, pageCount: 4 },
      { id: 'b', startPage: 5, endPage: 10, pageCount: 6 },
    ]);
  });
});

describe('chapterStartOffset / segmentForPage', () => {
  const m = parseAllInOneBuildManifest(FIXTURE_MINIMAL)!;

  it('liefert Kapitelstart', () => {
    expect(chapterStartOffset(m, 'b')).toBe(5);
    expect(chapterStartOffset(m, 'missing')).toBeNull();
  });

  it('löst Seite → Segment', () => {
    expect(segmentForPage(m, 1)?.id).toBe('a');
    expect(segmentForPage(m, 7)?.id).toBe('b');
    expect(segmentForPage(m, 0)).toBeNull();
    expect(segmentForPage(m, 11)).toBeNull();
  });
});

describe('repo build manifest (draft)', () => {
  it('lädt salati-islam-lernwerk-draft.build.json', () => {
    const raw = JSON.parse(readFileSync(REPO_BUILD_JSON, 'utf8')) as unknown;
    const m = parseAllInOneBuildManifest(raw);
    expect(m).not.toBeNull();
    expect(m?.totalPages).toBe(901);
    expect(m?.segments.length).toBeGreaterThan(15);
    expect(m?.segments[0]?.id).toBe('einstieg');
    expect(chapterStartOffset(m!, 'aqida')).toBe(550);
    expect(segmentForPage(m!, 901)?.id).toBe('pruefung-sprache');
  });
});
