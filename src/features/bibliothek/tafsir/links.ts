import { quranAyahDeepLink, quranSurahDeepLink, tafsirBibliothekDeepLink } from '@/lib/deepLinks';

/** Passt zu Expo-Router: `app/bibliothek/tafsir/[surah].tsx`. */
export function tafsirBibliothekPath(surah: number, block = 0): string {
  const blockQuery = block > 0 ? `?block=${block}` : '';
  return `/bibliothek/tafsir/${surah}${blockQuery}`;
}

export { tafsirBibliothekDeepLink };

export function quranSurahDeepLinkForTafsir(surah: number, ayah?: number): string {
  if (typeof ayah === 'number' && ayah > 0) return quranAyahDeepLink(surah, ayah);
  return quranSurahDeepLink(surah);
}
