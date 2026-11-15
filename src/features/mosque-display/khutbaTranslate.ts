import { Platform } from 'react-native';

export type KhutbaTranslateLang = 'ar' | 'de' | 'en' | 'tr';

export type TranslateModelInfo = {
  source: KhutbaTranslateLang;
  target: KhutbaTranslateLang;
  bytes?: number;
};

export function khutbaTranslateSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/** Geschätzte Modellgröße pro Sprachpaar (ML Kit on-device, offline nach Download). */
export function estimateModelBytes(_source: KhutbaTranslateLang, _target: KhutbaTranslateLang): number {
  return 28 * 1024 * 1024;
}

export async function ensureTranslateModels(
  source: KhutbaTranslateLang,
  target: KhutbaTranslateLang,
): Promise<void> {
  if (!khutbaTranslateSupported()) return;
  if (source === target) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TranslateText = require('@react-native-ml-kit/translate-text').default as {
    translate: (opts: {
      text: string;
      sourceLanguage: number;
      targetLanguage: number;
      downloadModelIfNeeded: boolean;
    }) => Promise<string>;
  };
  const { TranslateLanguage } = require('@react-native-ml-kit/translate-text') as {
    TranslateLanguage: Record<string, number>;
  };
  const langMap: Record<KhutbaTranslateLang, number> = {
    ar: TranslateLanguage.ARABIC,
    de: TranslateLanguage.GERMAN,
    en: TranslateLanguage.ENGLISH,
    tr: TranslateLanguage.TURKISH,
  };
  await TranslateText.translate({
    text: '.',
    sourceLanguage: langMap[source],
    targetLanguage: langMap[target],
    downloadModelIfNeeded: true,
  });
}

export async function translateKhutbaLine(
  text: string,
  source: KhutbaTranslateLang,
  target: KhutbaTranslateLang,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || source === target) return trimmed;
  if (!khutbaTranslateSupported()) return trimmed;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TranslateText = require('@react-native-ml-kit/translate-text').default as {
    translate: (opts: {
      text: string;
      sourceLanguage: number;
      targetLanguage: number;
      downloadModelIfNeeded: boolean;
    }) => Promise<string>;
  };
  const { TranslateLanguage } = require('@react-native-ml-kit/translate-text') as {
    TranslateLanguage: Record<string, number>;
  };
  const langMap: Record<KhutbaTranslateLang, number> = {
    ar: TranslateLanguage.ARABIC,
    de: TranslateLanguage.GERMAN,
    en: TranslateLanguage.ENGLISH,
    tr: TranslateLanguage.TURKISH,
  };
  return TranslateText.translate({
    text: trimmed,
    sourceLanguage: langMap[source],
    targetLanguage: langMap[target],
    downloadModelIfNeeded: true,
  });
}