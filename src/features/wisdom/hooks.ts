import type { Locale } from '@/lib/locale-detect';
import wisdomData from './wisdom.json';

// Weisheiten-Sammlung: belegte Quellen (Koran/Hadith/Gelehrte), statisch.
// Sprach-Fallback wie bei den Guides: locale → en → de.

export type LocalizedText = Partial<Record<Locale, string>>;

export interface WisdomEntry {
  id: string;
  arabic?: string;
  text: LocalizedText;
  source: string;
}

export const WISDOM_ENTRIES: WisdomEntry[] = wisdomData.entries as WisdomEntry[];
export const WISDOM_DATASET_NOTE: string = wisdomData.note;

export function resolveWisdomText(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en ?? text.de ?? Object.values(text)[0] ?? '';
}

/** Deterministische Tages-Weisheit: gleicher Tag ⇒ gleicher Eintrag. */
export function wisdomOfTheDay(now: Date = new Date()): WisdomEntry {
  const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
  return WISDOM_ENTRIES[daysSinceEpoch % WISDOM_ENTRIES.length];
}
