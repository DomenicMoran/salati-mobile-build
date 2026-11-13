import fallbackIndex from './index.fallback.json';
import { trackHasChapters } from './data';
import type { AudiobookChapter } from './data';
import { AUDIOBOOK_HUB_TRACKS, AUDIOBOOK_TRACKS_PLANNED, hubTracksForLocale } from './tracks';

const entries = fallbackIndex.entries as AudiobookChapter[];

describe('hubTracksForLocale', () => {
  it('lists only hub tracks that have chapters in the fallback index', () => {
    for (const locale of ['de', 'en', 'ar']) {
      const hub = hubTracksForLocale(entries, locale);
      for (const row of hub) {
        expect(AUDIOBOOK_HUB_TRACKS.some((t) => t.id === row.id)).toBe(true);
        expect(trackHasChapters(entries, row.id, locale)).toBe(true);
      }
      const hubIds = new Set<string>(hub.map((t) => t.id));
      for (const planned of AUDIOBOOK_TRACKS_PLANNED) {
        expect(hubIds.has(planned.id)).toBe(false);
      }
    }
  });

  it('never advertises planned tracks without index content', () => {
    expect(AUDIOBOOK_HUB_TRACKS.map((t) => t.id)).not.toContain('arabisch-kurs-1');
    expect(AUDIOBOOK_HUB_TRACKS.map((t) => t.id)).not.toContain('arabisch-kurs-2');
  });
});
