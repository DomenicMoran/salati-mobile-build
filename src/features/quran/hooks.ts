import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  fetchAudioEditions,
  fetchMushafPage,
  fetchSurahList,
  fetchSurahReading,
  fetchSurahSecondTranslation,
  fetchSurahSegments,
  fetchSurahTafsir,
  fetchSurahTajweed,
  fetchSurahTransliteration,
  fetchSurahWordByWord,
  fetchSurahStartPage,
  fetchTafsirEditions,
  fetchTranslationEditions,
  MUSHAF_TOTAL_PAGES,
  searchQuran,
  type MushafStyle,
} from './api';

// Lange Cache-TTL — Editionen/Suren-Metadaten ändern sich praktisch nie.
const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

export function useSurahList() {
  return useQuery({
    queryKey: ['quran', 'surah-list'],
    queryFn: fetchSurahList,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useAudioEditions() {
  return useQuery({
    queryKey: ['quran', 'editions', 'audio'],
    queryFn: fetchAudioEditions,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useTranslationEditions() {
  return useQuery({
    queryKey: ['quran', 'editions', 'translation'],
    queryFn: fetchTranslationEditions,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useSurahReading(surahNumber: number, translationEdition: string, audioEdition: string) {
  return useQuery({
    // v2: Basmala-Abtrennung in Vers 1 (splitBasmala) — persistierte Alt-
    // Caches kannten das neue Datenformat nicht (kritischer Nutzer-Fund).
    queryKey: ['quran', 'surah', 2, surahNumber, translationEdition, audioEdition],
    queryFn: () => fetchSurahReading(surahNumber, translationEdition, audioEdition),
    staleTime: STATIC_STALE_TIME,
  });
}

export function useTafsirEditions() {
  return useQuery({
    queryKey: ['quran', 'editions', 'tafsir'],
    queryFn: fetchTafsirEditions,
    staleTime: STATIC_STALE_TIME,
  });
}

/** Tafsir nur laden, wenn der Nutzer ihn eingeschaltet hat (enabled). */
export function useSurahTafsir(surahNumber: number, edition: string, enabled: boolean) {
  return useQuery({
    queryKey: ['quran', 'tafsir', surahNumber, edition],
    queryFn: () => fetchSurahTafsir(surahNumber, edition),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}

/** Lateinische Umschrift nur laden, wenn eingeschaltet (enabled). */
export function useSurahTransliteration(surahNumber: number, enabled: boolean) {
  return useQuery({
    queryKey: ['quran', 'transliteration', surahNumber],
    queryFn: () => fetchSurahTransliteration(surahNumber),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}

/** Zweite, optional zusätzlich eingeblendete Übersetzung (Interpretations-
 * Vergleich) — nur laden, wenn der Nutzer sie eingeschaltet hat. */
export function useSurahSecondTranslation(surahNumber: number, edition: string, enabled: boolean) {
  return useQuery({
    queryKey: ['quran', 'translation2', surahNumber, edition],
    queryFn: () => fetchSurahSecondTranslation(surahNumber, edition),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}

/** Wort-für-Wort-Aufschlüsselung nur laden, wenn eingeschaltet (enabled). */
export function useSurahWordByWord(surahNumber: number, enabled: boolean) {
  return useQuery({
    queryKey: ['quran', 'word-by-word', surahNumber],
    queryFn: () => fetchSurahWordByWord(surahNumber),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}

/** Wort-Zeitstempel nur laden, wenn der Rezitator welche hat (id != null). */
export function useSurahSegments(surahNumber: number, recitationId: number | null) {
  return useQuery({
    queryKey: ['quran', 'segments', surahNumber, recitationId],
    queryFn: () => fetchSurahSegments(surahNumber, recitationId as number),
    staleTime: STATIC_STALE_TIME,
    enabled: recitationId !== null,
  });
}

/** Tajweed-Farbsegmente nur laden, wenn eingeschaltet (enabled). */
export function useSurahTajweed(surahNumber: number, enabled: boolean) {
  return useQuery({
    queryKey: ['quran', 'tajweed', surahNumber],
    queryFn: () => fetchSurahTajweed(surahNumber),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}

/** Eine Mushaf-Druckseite im gewählten Schriftstil (optional mit Wort-Daten). */
export function useMushafPage(page: number, style: MushafStyle, withWords = false) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['quran', 'mushaf', 2, page, style, withWords],
    queryFn: () => fetchMushafPage(page, style, withWords),
    staleTime: STATIC_STALE_TIME,
    enabled: page >= 1,
  });

  // Nachbarseiten vorladen, sobald die aktuelle Seite steht — Blättern ohne Spinner.
  const loaded = query.isSuccess;
  useEffect(() => {
    if (!loaded) return;
    for (const neighbor of [page + 1, page - 1]) {
      if (neighbor < 1 || neighbor > MUSHAF_TOTAL_PAGES) continue;
      queryClient.prefetchQuery({
        queryKey: ['quran', 'mushaf', 2, neighbor, style, withWords],
        queryFn: () => fetchMushafPage(neighbor, style, withWords),
        staleTime: STATIC_STALE_TIME,
      });
    }
  }, [loaded, page, style, withWords, queryClient]);

  return query;
}

/** Startseite einer Sure im Mushaf (nur laden, wenn eine Sure übergeben wurde). */
export function useSurahStartPage(surahNumber: number | null) {
  return useQuery({
    queryKey: ['quran', 'surah-start-page', surahNumber],
    queryFn: () => fetchSurahStartPage(surahNumber as number),
    staleTime: STATIC_STALE_TIME,
    enabled: surahNumber !== null,
  });
}

/** Übersetzung + Rezitations-Audio je Vers für alle Suren auf einer Mushaf-
 * Seite — teilt sich den Cache mit dem normalen Sure-Reader (identischer
 * queryKey), damit "Übersetzung"/"Rezitation" im Mushaf nichts doppelt lädt,
 * was der Reader (oder die Nachbarseiten-Vorladung) nicht schon geholt hat. */
export function useMushafGroupReadings(
  surahNumbers: number[],
  translationEdition: string,
  audioEdition: string,
  enabled: boolean,
) {
  return useQueries({
    queries: surahNumbers.map((surahNumber) => ({
      queryKey: ['quran', 'surah', 2, surahNumber, translationEdition, audioEdition],
      queryFn: () => fetchSurahReading(surahNumber, translationEdition, audioEdition),
      staleTime: STATIC_STALE_TIME,
      enabled,
    })),
  });
}

/** Volltextsuche über den ganzen Koran; nur aktiv wenn ein Suchbegriff steht. */
export function useQuranSearch(query: string, appLanguage: string, page: number) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['quran', 'search', trimmed, appLanguage, page],
    queryFn: () => searchQuran(trimmed, appLanguage, page),
    enabled: trimmed.length > 1,
  });
}
