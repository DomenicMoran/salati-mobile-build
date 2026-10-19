// Hörbücher-Index: mehrspurige Kapitel (Grammatik-Hörbuch, Pflichtwissen, …).
// Remote auf R2 unter podcast/audiobooks/index.json; bei Netz-/404-Fehler
// gebündeltes index.fallback.json (Kopie aus podcast/audiobooks/index.json).
import { fetchJson } from '@/lib/fetchJson';
import { filterByContentLanguage, normalizeContentLanguage } from '@/features/media/content-language';

import fallbackIndex from './index.fallback.json';
import releasePolicy from './release-policy.json';

const blockedGrammarLocales = new Set(releasePolicy.blockedGrammarLocales);
const blockedPflichtwissenLocales = new Set(releasePolicy.blockedPflichtwissenLocales);

export function isAudiobookReleaseAllowed(entry: Pick<AudiobookChapter, 'track' | 'lang'>): boolean {
  if (entry.track === 'grammatik-hoerbuch' && blockedGrammarLocales.has(normalizeContentLanguage(entry.lang))) return false;
  return entry.track !== 'pflichtwissen' || !blockedPflichtwissenLocales.has(normalizeContentLanguage(entry.lang));
}

const PODCAST_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/podcast';
export const AUDIOBOOK_INDEX_URL = `${PODCAST_BASE}/audiobooks/index.json`;

export interface AudiobookChapter {
  track: string;
  chapter_no: number;
  title: string;
  lang: string;
  audio_url: string;
  duration_sec?: number | null;
  book_pdf_url?: string | null;
  video_url?: string | null;
  transcript?: string | null;
}

export interface AudiobookIndex {
  version: number;
  updated_at: string;
  entries: AudiobookChapter[];
}

/** Relative Pfade im Index (../audio/…) → öffentliche R2-URL. */
export function resolveAudiobookMediaUrl(relativeOrAbsolute: string): string {
  const raw = relativeOrAbsolute.trim();
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const withoutParent = raw.replace(/^\.\.\//, '');
  return `${PODCAST_BASE}/${withoutParent}`;
}

function normalizeChapter(entry: AudiobookChapter): AudiobookChapter {
  return {
    ...entry,
    audio_url: resolveAudiobookMediaUrl(entry.audio_url),
    book_pdf_url: entry.book_pdf_url ? resolveAudiobookMediaUrl(entry.book_pdf_url) : entry.book_pdf_url,
    video_url: entry.video_url ? resolveAudiobookMediaUrl(entry.video_url) : entry.video_url,
    transcript: entry.transcript ? resolveAudiobookMediaUrl(entry.transcript) : entry.transcript,
  };
}

function parseIndex(raw: Partial<AudiobookIndex>): AudiobookIndex {
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    updated_at: raw.updated_at ?? '',
    entries: entries.filter(isAudiobookReleaseAllowed).map((e) => normalizeChapter(e as AudiobookChapter)),
  };
}

export async function fetchAudiobookIndex(): Promise<AudiobookIndex> {
  try {
    const j = await fetchJson<Partial<AudiobookIndex>>(AUDIOBOOK_INDEX_URL, {
      cache: 'no-cache',
      errorPrefix: 'audiobook_index',
    });
    return parseIndex(j);
  } catch {
    return parseIndex(fallbackIndex as Partial<AudiobookIndex>);
  }
}

/** Nur Kapitel in der UI-Sprache — kein DE-Fallback für andere Locales. */
export function chaptersForLocale(entries: readonly AudiobookChapter[], uiLocale: string): AudiobookChapter[] {
  return filterByContentLanguage(entries.filter(isAudiobookReleaseAllowed), uiLocale);
}

export function chaptersForTrack(
  entries: readonly AudiobookChapter[],
  track: string,
  uiLocale: string,
): AudiobookChapter[] {
  const id = track.trim();
  return chaptersForLocale(entries, uiLocale)
    .filter((e) => e.track === id)
    .sort((a, b) => a.chapter_no - b.chapter_no);
}

/** Name der Sprache in der Sprache selbst, für die Sprachleiste. */
export const AUDIOBOOK_LANGUAGE_ENDONYM: Readonly<Record<string, string>> = {
  de: 'Deutsch',
  en: 'English',
  tr: 'Türkçe',
  ar: 'العربية',
  es: 'Español',
  fr: 'Français',
  id: 'Indonesia',
  bn: 'বাংলা',
  fa: 'فارسی',
  ms: 'Melayu',
  ur: 'اردو',
  ru: 'Русский',
  sw: 'Kiswahili',
  ps: 'پښتو',
};

/** Sprachen, in denen dieser Track freigegebene Kapitel hat. */
export function languagesForTrack(entries: readonly AudiobookChapter[], track: string): string[] {
  const id = track.trim();
  const langs = new Set<string>();
  for (const entry of entries) {
    if (entry.track !== id || !isAudiobookReleaseAllowed(entry)) continue;
    langs.add(normalizeContentLanguage(entry.lang));
  }
  return [...langs].sort();
}

export function trackHasChapters(
  entries: readonly AudiobookChapter[],
  track: string,
  uiLocale: string,
): boolean {
  return chaptersForTrack(entries, track, uiLocale).length > 0;
}

export interface AudiobookBookEntry {
  track: string;
  trackLabelKey: string;
  title: string;
  pdf_url: string;
}

/** Ein PDF pro Track (erstes Kapitel mit book_pdf_url in der Locale). */
export function booksForLocale(
  entries: readonly AudiobookChapter[],
  uiLocale: string,
  trackLabelKeys: Readonly<Record<string, string>>,
): AudiobookBookEntry[] {
  const localized = chaptersForLocale(entries, uiLocale);
  const seen = new Set<string>();
  const out: AudiobookBookEntry[] = [];
  for (const ch of localized) {
    if (!ch.book_pdf_url?.trim() || seen.has(ch.track)) continue;
    seen.add(ch.track);
    const labelKey = trackLabelKeys[ch.track];
    if (!labelKey) continue;
    out.push({
      track: ch.track,
      trackLabelKey: labelKey,
      title: ch.title,
      pdf_url: ch.book_pdf_url,
    });
  }
  return out;
}

/** mm:ss aus Sekunden; null/0 → „—“ in der UI. */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function chapterKey(ch: AudiobookChapter): string {
  return `${normalizeContentLanguage(ch.lang)}:${ch.track}:${ch.chapter_no}`;
}
