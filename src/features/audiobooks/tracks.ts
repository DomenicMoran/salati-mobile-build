import type { AudiobookChapter } from './data';
import { trackHasChapters } from './data';

/** Hub-Reihenfolge — nur Spuren mit tatsaechlichen Kapiteln im Index (VP-A-005). */
export const AUDIOBOOK_HUB_TRACKS = [
  { id: 'grammatik-hoerbuch', labelKey: 'audiobooks.tracks.kurs3' },
  { id: 'pflichtwissen', labelKey: 'audiobooks.tracks.pflichtwissen' },
] as const;

/** Geplant: nicht im Hub listen, bis der R2-Index Kapitel fuehrt. */
export const AUDIOBOOK_TRACKS_PLANNED = [
  { id: 'arabisch-kurs-1', labelKey: 'audiobooks.tracks.kurs1' },
  { id: 'arabisch-kurs-2', labelKey: 'audiobooks.tracks.kurs2' },
] as const;

export type AudiobookTrackId = (typeof AUDIOBOOK_HUB_TRACKS)[number]['id'];

export const BOOK_TRACK_IDS: readonly AudiobookTrackId[] = ['grammatik-hoerbuch', 'pflichtwissen'];

const KNOWN_TRACK_SLUGS = new Set<string>([
  ...AUDIOBOOK_HUB_TRACKS.map((t) => t.id),
  ...AUDIOBOOK_TRACKS_PLANNED.map((t) => t.id),
]);

export function isAudiobookTrackId(value: string): value is AudiobookTrackId {
  return AUDIOBOOK_HUB_TRACKS.some((t) => t.id === value);
}

export function isKnownAudiobookTrackSlug(value: string): boolean {
  return KNOWN_TRACK_SLUGS.has(value);
}

/** Hub-Zeilen: deklarierte Spuren, die in der Locale Kapitel haben. */
export function hubTracksForLocale(
  entries: readonly AudiobookChapter[],
  uiLocale: string,
): (typeof AUDIOBOOK_HUB_TRACKS)[number][] {
  return AUDIOBOOK_HUB_TRACKS.filter((track) => trackHasChapters(entries, track.id, uiLocale));
}
