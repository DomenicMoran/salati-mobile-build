import type { Locale } from '@/lib/locale-detect';
import duasData from './data/duas.json';

export interface Dua {
  id: string;
  category: string;
  arabic: string;
  transliteration: string;
  translations: Partial<Record<Locale, string>>;
  source: string;
}

export interface DuaCategory {
  id: string;
  labels: Partial<Record<Locale, string>>;
}

// Vollständig statisch gebündelt — keine Netzwerk-Abhängigkeit, funktioniert
// per Definition offline.
export const DUA_CATEGORIES: DuaCategory[] = duasData.categories;
export const ALL_DUAS: Dua[] = duasData.duas;
export const DUAS_DATASET_NOTE = duasData.note;

export function duasForCategory(categoryId: string): Dua[] {
  return ALL_DUAS.filter((d) => d.category === categoryId);
}

export function categoryLabel(categoryId: string, locale: Locale): string {
  const category = DUA_CATEGORIES.find((c) => c.id === categoryId);
  return category?.labels[locale] ?? category?.labels.en ?? category?.labels.de ?? categoryId;
}

/**
 * Übersetzung in der App-Sprache; für Arabisch entfällt die Übersetzung
 * (der Dua-Text selbst ist arabisch), Rückgabe null blendet die Zeile aus.
 * Noch nicht übersetzte Sprachen (es/fr) fallen auf Englisch zurück.
 */
export function duaTranslation(dua: Dua, locale: Locale): string | null {
  if (locale === 'ar') return null;
  return dua.translations[locale] ?? dua.translations.en ?? dua.translations.de ?? null;
}
