import fallbackIndex from './index.fallback.json';

/** Build-time route inventory, independent of network availability and UI locale. */
export function audiobookChapterStaticParams(): { track: string; chapter: string }[] {
  const unique = new Map<string, { track: string; chapter: string }>();
  for (const entry of fallbackIndex.entries) {
    const value = { track: entry.track, chapter: String(entry.chapter_no) };
    unique.set(`${value.track}/${value.chapter}`, value);
  }
  return [...unique.values()];
}
