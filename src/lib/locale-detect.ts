import * as Localization from 'expo-localization';

// Die 8 Phase-1-Sprachen (#60: id/bn/fa/ms/ur/sw/ru/ps) werden EINZELN,
// Commit für Commit ergänzt (siehe locales/*.json) — nicht alle auf einmal,
// damit jeder Commit für sich fertig übersetzt + getestet ist.
export type Locale = 'de' | 'en' | 'tr' | 'ar' | 'es' | 'fr' | 'id' | 'bn' | 'fa' | 'ms' | 'ur' | 'ru' | 'sw' | 'ps';

export const SUPPORTED_LOCALES: Locale[] = [
  'de',
  'en',
  'tr',
  'ar',
  'es',
  'fr',
  'id',
  'bn',
  'fa',
  'ms',
  'ur',
  'ru',
  'sw',
  'ps',
];

// ar/ur/fa/ps sind rechtsläufige Schriftsysteme. Generisch statt einzelner
// `=== 'ar'`-Checks, damit RTL-Textausrichtung (Reader/Tafsir/Übersetzung)
// für alle vier gilt — sowohl für die App-Sprache (Locale) als auch für
// Quran-Edition-Sprachcodes (gleiches ISO-639-1-Format, z. B.
// `edition.language` von api.alquran.cloud/quran.com).
const RTL_LANGUAGE_CODES = new Set(['ar', 'ur', 'fa', 'ps']);

export function isRtlLanguageCode(code: string | null | undefined): boolean {
  return !!code && RTL_LANGUAGE_CODES.has(code);
}

export function isRtlLocale(locale: Locale): boolean {
  return isRtlLanguageCode(locale);
}

export function detectDeviceLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode;
  if (tag && (SUPPORTED_LOCALES as string[]).includes(tag)) return tag as Locale;
  return 'en';
}
