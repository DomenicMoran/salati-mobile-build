import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { fetchHadithCollection, type HadithLang, type HadithWithTranslation } from './api';
import {
  fetchHadeethencCategories,
  fetchHadeethencHadith,
  fetchHadeethencPage,
  type HadeethencListItem,
  type HadeethencPage,
} from './hadeethenc';
import type { Locale } from '@/lib/locale-detect';

/**
 * Deterministischer "Hadith des Tages": gleicher Tag ⇒ gleicher Eintrag,
 * analog zu wisdomOfTheDay(). Erwartet eine bereits geladene Sammlung
 * (typischerweise An-Nawawi 40 — klein, kuratiert, keine Themen-Auswahl
 * nötig) statt einer eigenen statischen Datenquelle.
 */
export function hadithOfTheDay(
  hadiths: HadithWithTranslation[],
  now: Date = new Date(),
): HadithWithTranslation | undefined {
  if (hadiths.length === 0) return undefined;
  const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
  return hadiths[daysSinceEpoch % hadiths.length];
}

export interface HadithBookInfo {
  book: number;
  title: string;
  count: number;
}

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

export function useHadithCollection(collection: string, translationLang: HadithLang) {
  return useQuery({
    queryKey: ['hadith', 'collection', collection, translationLang],
    queryFn: () => fetchHadithCollection(collection, translationLang),
    staleTime: STATIC_STALE_TIME,
  });
}

/** Client-seitige Textsuche im bereits geladenen Buch — kein Server-Search nötig. */
export function filterHadiths(hadiths: HadithWithTranslation[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return hadiths;
  return hadiths.filter(
    (h) => h.translation.toLowerCase().includes(q) || h.arabic.includes(query.trim()),
  );
}

export function useHadithSearch(hadiths: HadithWithTranslation[] | undefined, query: string) {
  return useMemo(() => filterHadiths(hadiths ?? [], query), [hadiths, query]);
}

/**
 * Kapitel-/Themenliste aus den bereits geladenen Buch-Metadaten
 * (`metadata.sections`) — kein Zusatz-API-Call nötig. Leere Titel
 * (Buch "0" bei manchen Sammlungen) werden übersprungen.
 */
export function groupHadithsByBook(
  hadiths: HadithWithTranslation[],
  sections: Record<string, string>,
): HadithBookInfo[] {
  const counts = new Map<number, number>();
  for (const h of hadiths) {
    counts.set(h.reference.book, (counts.get(h.reference.book) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([book, count]) => ({ book, title: sections[String(book)] ?? '', count }))
    .filter((b) => b.title.trim() !== '')
    .sort((a, b) => a.book - b.book);
}

export function useHadithBooks(
  hadiths: HadithWithTranslation[] | undefined,
  sections: Record<string, string> | undefined,
): HadithBookInfo[] {
  return useMemo(
    () => (hadiths && sections ? groupHadithsByBook(hadiths, sections) : []),
    [hadiths, sections],
  );
}

// --- HadeethEnc (thematisch geordnete Enzyklopädie, alle 14 App-Sprachen) ---

/**
 * Themenbaum der Enzyklopädie. Sprachabhängig (die Titel kommen übersetzt von
 * der API), darum steckt die Sprache im Query-Key — sonst zeigt ein
 * Sprachwechsel bis zum Ablauf der staleTime weiter die alten Titel.
 */
export function useHadeethencCategories(locale: Locale) {
  return useQuery({
    queryKey: ['hadeethenc', 'categories', locale],
    queryFn: () => fetchHadeethencCategories(locale),
    staleTime: STATIC_STALE_TIME,
  });
}

/** Führt die geladenen Seiten zu einer flachen Liste zusammen (pure, testbar). */
export function flattenHadeethencPages(pages: HadeethencPage[] | undefined): HadeethencListItem[] {
  return (pages ?? []).flatMap((p) => p.items);
}

/**
 * Hadithe einer Kategorie, seitenweise nachgeladen. Eine Kategorie kann über
 * 200 Einträge haben — alles auf einmal zu holen wären mehrere hundert
 * Kilobyte, bevor die Liste überhaupt erscheint.
 */
export function useHadeethencHadiths(locale: Locale, categoryId: string) {
  return useInfiniteQuery({
    queryKey: ['hadeethenc', 'list', locale, categoryId],
    queryFn: ({ pageParam }) => fetchHadeethencPage(locale, categoryId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last: HadeethencPage) =>
      last.page < last.lastPage ? last.page + 1 : undefined,
    staleTime: STATIC_STALE_TIME,
    enabled: categoryId !== '',
  });
}

export function useHadeethencHadith(locale: Locale, id: string) {
  return useQuery({
    queryKey: ['hadeethenc', 'hadeeth', locale, id],
    queryFn: () => fetchHadeethencHadith(locale, id),
    staleTime: STATIC_STALE_TIME,
    enabled: id !== '',
  });
}
