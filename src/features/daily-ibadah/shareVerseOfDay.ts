import { pickVerseOfDayRef } from '@/features/verseOfDay/pool';
import { resolveVerseOfDayContent } from '@/features/verseOfDay/content';
import { canShareContentImage, shareContentImage } from '@/features/quran/shareImage';
import type { HadithLang } from '@/features/hadith/api';

/** Vers/Hadith des Tages als Bild teilen (nativ: ShareCard; Web: Canvas). */
export async function shareVerseOfDayAsImage(locale: string, hadithLang: HadithLang): Promise<void> {
  const ref = pickVerseOfDayRef(new Date());
  const content = await resolveVerseOfDayContent(ref, locale, hadithLang);
  if (canShareContentImage) {
    await shareContentImage({
      arabic: content.arabic,
      translation: content.translation,
      source: content.source,
      deepLink: content.deepLink,
    });
    return;
  }
  const { default: Sharing } = await import('expo-sharing');
  const { default: FileSystem } = await import('expo-file-system/legacy');
  const text = `${content.arabic}\n\n${content.translation}\n— ${content.source}`;
  const path = `${FileSystem.cacheDirectory}verse-of-day.txt`;
  await FileSystem.writeAsStringAsync(path, text);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/plain' });
  }
}
