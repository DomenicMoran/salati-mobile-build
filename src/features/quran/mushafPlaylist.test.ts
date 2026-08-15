import { buildMushafPlaylist, findMushafPlaylistIndex } from './mushafPlaylist';

describe('buildMushafPlaylist', () => {
  it('flattens groups into a single ordered list with matching audio URLs', () => {
    const groups = [
      { surah: 1, verses: [{ ayah: 1 }, { ayah: 2 }] },
      { surah: 2, verses: [{ ayah: 1 }] },
    ];
    const audioBySurah = new Map([
      [1, new Map([[1, 'a1.mp3'], [2, 'a2.mp3']])],
      [2, new Map([[1, 'b1.mp3']])],
    ]);
    expect(buildMushafPlaylist(groups, audioBySurah)).toEqual([
      { surah: 1, ayah: 1, audio: 'a1.mp3' },
      { surah: 1, ayah: 2, audio: 'a2.mp3' },
      { surah: 2, ayah: 1, audio: 'b1.mp3' },
    ]);
  });

  it('leaves audio undefined when no reading is loaded yet for a surah', () => {
    const groups = [{ surah: 1, verses: [{ ayah: 1 }] }];
    expect(buildMushafPlaylist(groups, new Map())).toEqual([{ surah: 1, ayah: 1, audio: undefined }]);
  });

  it('leaves audio undefined when the edition has a gap for that specific verse', () => {
    const groups = [{ surah: 1, verses: [{ ayah: 1 }, { ayah: 2 }] }];
    const audioBySurah = new Map([[1, new Map([[1, 'a1.mp3']])]]);
    expect(buildMushafPlaylist(groups, audioBySurah)).toEqual([
      { surah: 1, ayah: 1, audio: 'a1.mp3' },
      { surah: 1, ayah: 2, audio: undefined },
    ]);
  });

  it('returns an empty list for an empty page', () => {
    expect(buildMushafPlaylist([], new Map())).toEqual([]);
  });
});

describe('findMushafPlaylistIndex', () => {
  const playlist = buildMushafPlaylist(
    [
      { surah: 1, verses: [{ ayah: 1 }, { ayah: 2 }] },
      { surah: 2, verses: [{ ayah: 1 }] },
    ],
    new Map(),
  );

  it('finds the index of a verse by surah + ayah', () => {
    expect(findMushafPlaylistIndex(playlist, 2, 1)).toBe(2);
  });

  it('returns -1 when the verse is not on this page', () => {
    expect(findMushafPlaylistIndex(playlist, 5, 1)).toBe(-1);
  });
});
