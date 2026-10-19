/** Hub-Reihenfolge gemaess Produkt-Prompt (Hörbücher, nicht Video-Kurs 3 Tajwid). */
export const AUDIOBOOK_HUB_TRACKS = [
  { id: 'arabisch-kurs-1', labelKey: 'audiobooks.tracks.kurs1' },
  { id: 'arabisch-kurs-2', labelKey: 'audiobooks.tracks.kurs2' },
  { id: 'grammatik-hoerbuch', labelKey: 'audiobooks.tracks.kurs3' },
  { id: 'pflichtwissen', labelKey: 'audiobooks.tracks.pflichtwissen' },
] as const;

export type AudiobookTrackId = (typeof AUDIOBOOK_HUB_TRACKS)[number]['id'];

export const BOOK_TRACK_IDS: readonly AudiobookTrackId[] = ['grammatik-hoerbuch', 'pflichtwissen'];

export function isAudiobookTrackId(value: string): value is AudiobookTrackId {
  return AUDIOBOOK_HUB_TRACKS.some((t) => t.id === value);
}
