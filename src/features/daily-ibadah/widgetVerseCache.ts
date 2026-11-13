import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveVerseOfDayContent } from '@/features/verseOfDay/content';
import { pickVerseOfDayRef } from '@/features/verseOfDay/pool';
import type { HadithLang } from '@/features/hadith/api';

const KEY = 'salatibox:votd-widget-cache-v1';

export type WidgetVerseCache = {
  dateKey: string;
  arabic: string;
  translation: string;
  source: string;
};

export async function loadWidgetVerseCache(): Promise<WidgetVerseCache | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WidgetVerseCache) : null;
  } catch {
    return null;
  }
}

export async function refreshWidgetVerseCache(locale: string, hadithLang: HadithLang): Promise<WidgetVerseCache | null> {
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10);
  const cached = await loadWidgetVerseCache();
  if (cached?.dateKey === dateKey) return cached;
  try {
    const ref = pickVerseOfDayRef(today);
    const content = await resolveVerseOfDayContent(ref, locale, hadithLang);
    const next: WidgetVerseCache = {
      dateKey,
      arabic: content.arabic,
      translation: content.translation,
      source: content.source,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return cached;
  }
}
