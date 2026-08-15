// App-weite Suche: reine Aggregations-/Kategorisierungs-Logik, getrennt von
// der UI (search.tsx) und von der Datenbeschaffung (die weiterhin über die
// BESTEHENDEN Endpunkte/Loader der einzelnen Bereiche läuft — quran/api.ts,
// hadith/api.ts+hooks.ts, duas/hooks.ts, study/courses.ts). Diese Datei baut
// KEINEN eigenen Suchindex, sondern filtert/begrenzt nur die bereits von den
// Einzelbereichen gelieferten Treffer für die kompakte, kategorisierte
// Gesamtansicht.
import type { Dua } from '@/features/duas/hooks';
import { duaTranslation } from '@/features/duas/hooks';
import type { HadithWithTranslation } from '@/features/hadith/api';
import { filterHadiths } from '@/features/hadith/hooks';
import type { QuranSearchResult } from '@/features/quran/api';
import type { Locale } from '@/lib/locale-detect';

/** Unter dieser Zeichenzahl wird gar nicht erst gefiltert (leere Trefferliste) —
 * verhindert, dass z. B. ein einzelner Buchstabe die halbe Dua-Sammlung matcht. */
export const MIN_QUERY_LENGTH = 2;

/** Wie viele Treffer je Kategorie in der kompakten Gesamtübersicht stehen. */
export const MAX_RESULTS_PER_SECTION = 5;

/** Obergrenze je Hadith-Sammlung, damit eine einzelne große Sammlung
 * (z. B. Bukhari) nicht alle anderen aus der Gesamtliste verdrängt. */
export const MAX_HADITH_PER_COLLECTION = 3;

/** Koran-Treffer sind bereits serverseitig sortiert (Relevanz) — hier nur
 * auf die Anzeigemenge kappen, ohne die Reihenfolge zu verändern. */
export function capQuranResults(
  results: QuranSearchResult[],
  maxResults: number = MAX_RESULTS_PER_SECTION,
): QuranSearchResult[] {
  return results.slice(0, maxResults);
}

export interface HadithSearchHit {
  collectionId: string;
  collectionName: string;
  hadith: HadithWithTranslation;
}

/** Filtert die Hadithe EINER bereits geladenen Sammlung und verpackt Treffer
 * mit Sammlungs-Kontext, direkt auf maxPerCollection begrenzt. */
export function hadithHitsForCollection(
  hadiths: HadithWithTranslation[],
  collectionId: string,
  collectionName: string,
  query: string,
  maxPerCollection: number = MAX_HADITH_PER_COLLECTION,
): HadithSearchHit[] {
  if (query.trim().length < MIN_QUERY_LENGTH) return [];
  return filterHadiths(hadiths, query)
    .slice(0, maxPerCollection)
    .map((hadith) => ({ collectionId, collectionName, hadith }));
}

/** Fasst die pro Sammlung bereits gefundenen (und pro Sammlung gekappten)
 * Treffer zu EINER Gesamtliste zusammen, in Sammlungsreihenfolge, begrenzt
 * auf maxTotal Treffer für die Gesamtübersicht. */
export function mergeHadithHits(
  perCollection: HadithSearchHit[][],
  maxTotal: number = MAX_RESULTS_PER_SECTION,
): HadithSearchHit[] {
  return perCollection.flat().slice(0, maxTotal);
}

/** Client-seitige Textsuche über die (bereits offline gebündelten) Duas:
 * Arabisch, Umschrift, Quellenangabe und die für `locale` aufgelöste
 * Übersetzung (inkl. deren en/de-Fallback, siehe duaTranslation()). */
export function filterDuas(
  duas: Dua[],
  query: string,
  locale: Locale,
  maxResults: number = MAX_RESULTS_PER_SECTION,
): Dua[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];
  const q = trimmed.toLowerCase();
  return duas
    .filter((d) => {
      const translation = duaTranslation(d, locale);
      return (
        d.arabic.includes(trimmed) ||
        d.transliteration.toLowerCase().includes(q) ||
        d.source.toLowerCase().includes(q) ||
        (translation ? translation.toLowerCase().includes(q) : false)
      );
    })
    .slice(0, maxResults);
}

export interface CourseSearchItem {
  id: string;
  title: string;
  desc: string;
}

/** Client-seitige Textsuche über die Kurs-Metadaten (Titel + Beschreibung),
 * die der Aufrufer bereits synchron über i18n aufgelöst hat (COURSE_META
 * selbst enthält keine Texte — siehe study/courses.ts) — keine der schweren
 * Lektions-JSONs wird dafür geladen. */
export function filterCourses(
  courses: CourseSearchItem[],
  query: string,
  maxResults: number = MAX_RESULTS_PER_SECTION,
): CourseSearchItem[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];
  const q = trimmed.toLowerCase();
  return courses.filter((c) => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)).slice(0, maxResults);
}

export interface GlobalSearchResults {
  quran: QuranSearchResult[];
  hadith: HadithSearchHit[];
  duas: Dua[];
  courses: CourseSearchItem[];
}

export const EMPTY_SEARCH_RESULTS: GlobalSearchResults = { quran: [], hadith: [], duas: [], courses: [] };

export function hasAnyResults(results: GlobalSearchResults): boolean {
  return (
    results.quran.length > 0 ||
    results.hadith.length > 0 ||
    results.duas.length > 0 ||
    results.courses.length > 0
  );
}

export function totalResultCount(results: GlobalSearchResults): number {
  return results.quran.length + results.hadith.length + results.duas.length + results.courses.length;
}
