import type { Locale } from '@/lib/locale-detect';
import guidesData from './guides.json';

// Praxis-Guides, statisch gebündelt (offline). Texte liegen je Eintrag als
// Sprach-Objekt vor; fehlt eine Sprache (z. B. neue UI-Sprachen wie es/fr),
// fällt die Auflösung auf Englisch, dann Deutsch zurück.

export type LocalizedText = Partial<Record<Locale, string>>;

export interface GuideStep {
  arabic?: string;
  translit?: string;
  title: LocalizedText;
  text: LocalizedText;
}

export interface Guide {
  id: string;
  icon: string;
  title: LocalizedText;
  intro: LocalizedText;
  /** Klassische Primärbelege (Koran/Sahih/Sunan) — wie `source` in study/data. */
  source: string;
  steps: GuideStep[];
}

export const GUIDES: Guide[] = guidesData.guides as Guide[];
export const GUIDES_DATASET_NOTE: string = guidesData.note;

export function resolveText(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en ?? text.de ?? Object.values(text)[0] ?? '';
}

/**
 * true = `resolveText` liefert für diese Sprache NICHT den echten Text
 * dieser Sprache, sondern fällt auf Englisch/Deutsch/eine beliebige andere
 * zurück. Content-Audit 2026-07-21: `steps.text` ist für 8 der 14 Sprachen
 * (id/bn/fa/ms/ur/sw/ru/ps) bei allen Guides unübersetzt — bisher fiel das
 * UI dafür still auf Englisch zurück (siehe [guide].tsx, gleiches Muster
 * wie `isLocalizedFallback` in features/learn/curriculum.ts).
 */
export function isTextFallback(text: LocalizedText, locale: Locale): boolean {
  return !text[locale]?.trim();
}

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
