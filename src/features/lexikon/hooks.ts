// React-Query-Hooks für das Lexikon-Feature. Lädt ausschließlich über die
// bereits vorhandene Lade-/Cache-Schicht des Quran-Features
// (`@/features/quran/morphologie` — Datei-Cache + R2-Fallback, siehe dort),
// hier nur als eigene Hooks gekapselt: `morphologieHooks.ts` im Quran-Feature
// deckt nur die Sure-weise Wortanalyse ab (parallele Baustelle, siehe
// AGENTS.md dieses Auftrags — kein Grund, dort zu ergänzen).
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { ladeLemmata, ladeMeta, ladeMorphologie, ladeWurzeln } from '@/features/quran/morphologie';
import type { LemmataDatei, MetaDatei, MorphologieDatei, MorphVorkommen, WurzelnDatei } from '@/features/quran/morphologieTypen';
import { wortart } from '@/features/quran/grammatik';

import { groupWordformsByWortart, type RootWordform } from './rootIndex';

// Wie STATIC_STALE_TIME in @/features/quran/morphologieHooks.ts — dieselben
// Konkordanz-/Morphologiedaten ändern sich praktisch nie.
const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

/** Wurzel-Konkordanz (roots.json, ~650 KB, 1.642 Einträge) — einmal geladen
 *  und über React Query gecacht, nicht bei jedem Tastendruck neu. */
export function useWurzeln(): UseQueryResult<WurzelnDatei> {
  return useQuery({
    queryKey: ['lexikon', 'roots'],
    queryFn: ladeWurzeln,
    staleTime: STATIC_STALE_TIME,
  });
}

/** Lemma-Konkordanz (lemmas.json, ~970 KB, 4.816 Einträge) — für die
 *  Konkordanz-Suche und die Wortform-Häufigkeiten der Wurzel-Detailansicht. */
export function useLemmata(): UseQueryResult<LemmataDatei> {
  return useQuery({
    queryKey: ['lexikon', 'lemmas'],
    queryFn: ladeLemmata,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useMorphologieMeta(): UseQueryResult<MetaDatei> {
  return useQuery({
    queryKey: ['lexikon', 'meta'],
    queryFn: ladeMeta,
    staleTime: STATIC_STALE_TIME,
  });
}

/**
 * Wortformen einer Wurzel, gruppiert nach Wortart — für die Wurzel-
 * Detailansicht. `root.lemmas` (aus roots.json) nennt die abgeleiteten
 * Lemmata; deren Häufigkeit kommt aus `lemmas.json` (die Summe aller
 * Lemma-Häufigkeiten einer Wurzel ergibt exakt `root.count`, geprüft gegen
 * die echten Daten). Die WORTART eines Lemmas steht in keiner der beiden
 * Konkordanz-Dateien — dafür wird je Lemma EIN Beleg-Vorkommen genommen und
 * dessen Sure-Morphologie geladen (Cache-Schlüssel identisch zu
 * `useSurahMorphologie` im Quran-Feature: `['quran', 'morphologie', surah]`
 * — Ergebnis wird also mit dem Reader/der Wortanalyse geteilt statt doppelt
 * geladen). Pro Wurzel sind das im Mittel < 3, höchstens 22 Suren-Abrufe
 * (gemessen gegen roots.json), nicht 114 — die Sure-weise Ladeschicht bleibt
 * damit gewahrt. Gemessen am Gerät (Release-Build, kalter Cache, Emulator
 * salati_lexikon): Wurzel اله (2.851 Belege, 3 Lemmata → 3 Suren-Abrufe)
 * 1,8 s; Wurzel قوم (22 Lemmata, das Maximum) 1,4 s. Der ursprünglich
 * gemeldete 35-Sekunden-Befund ließ sich damit NICHT auf "lädt alle 114
 * Suren" zurückführen — diese Schicht war bereits korrekt begrenzt. Der
 * reale Mangel war das fehlende Fortschritts-/Fehler-Feedback während der
 * (kurzen, aber sichtbaren) Wartezeit — siehe `loadedCount`/`totalCount`/
 * `retry` unten sowie die Wurzel-Detailansicht.
 */
export function useRootWordforms(
  lemmaEntries: { lemma: string; count: number; firstOccurrence: MorphVorkommen }[],
): {
  forms: RootWordform[];
  isLoading: boolean;
  isError: boolean;
  /** Anzahl der bereits abgeschlossenen (erfolgreichen ODER fehlgeschlagenen)
   *  Suren-Abrufe — für eine Fortschrittsanzeige statt eines reinen
   *  statischen Ladetexts. */
  loadedCount: number;
  /** Anzahl der insgesamt nötigen Suren-Abrufe (Anzahl distinkter Suren unter
   *  den Erst-Belegstellen der Lemmata dieser Wurzel, höchstens 22). */
  totalCount: number;
  /** Alle fehlgeschlagenen Suren-Abrufe erneut anstoßen. */
  retry: () => void;
} {
  const distinctSurahs = useMemo(
    () => [...new Set(lemmaEntries.map((l) => l.firstOccurrence[0]))],
    [lemmaEntries],
  );

  const queries = useQueries({
    queries: distinctSurahs.map((surah) => ({
      queryKey: ['quran', 'morphologie', surah],
      queryFn: () => ladeMorphologie(surah),
      staleTime: STATIC_STALE_TIME,
      enabled: lemmaEntries.length > 0,
    })),
  });

  const bySurah = useMemo(() => {
    const map = new Map<number, MorphologieDatei>();
    distinctSurahs.forEach((surah, i) => {
      const data = queries[i]?.data;
      if (data) map.set(surah, data);
    });
    return map;
  }, [distinctSurahs, queries]);

  const forms = useMemo<RootWordform[]>(() => {
    return lemmaEntries.map(({ lemma, count, firstOccurrence }) => {
      const [surah, ayah, position] = firstOccurrence;
      const datei = bySurah.get(surah);
      const word = datei?.verses[String(ayah)]?.find((w) => w.position === position);
      const stem = word?.segments.find((s) => s.kind === 'stem') ?? word?.segments[0];
      const wa = stem ? wortart(stem.pos) : null;
      return { lemma, count, wortart: wa };
    });
  }, [lemmaEntries, bySurah]);

  const retry = useCallback(() => {
    queries.forEach((q) => {
      if (q.isError) void q.refetch();
    });
  }, [queries]);

  return {
    forms,
    isLoading: lemmaEntries.length > 0 && queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    loadedCount: queries.filter((q) => q.isSuccess || q.isError).length,
    totalCount: distinctSurahs.length,
    retry,
  };
}

export { groupWordformsByWortart };

export interface VersePreview {
  words: string[];
  /** 1-basierte Position des hervorzuhebenden Wortes, `null` außerhalb des
   *  Verses (sollte bei validen Fundstellen nicht vorkommen). */
  highlightPosition: number | null;
}

/**
 * Vers-Vorschau für einen Konkordanz-/Belegtreffer: die Wortfolge des Verses
 * (aus der Morphologie-Datei der jeweiligen Sure — dieselbe Quelle wie der
 * Reader, kein zusätzlicher API-Aufruf) plus die Position des Treffer-Wortes
 * zum Hervorheben.
 */
export function useVersePreview(surah: number, ayah: number, position: number): UseQueryResult<VersePreview> {
  return useQuery({
    queryKey: ['quran', 'morphologie', surah],
    queryFn: () => ladeMorphologie(surah),
    staleTime: STATIC_STALE_TIME,
    select: (datei): VersePreview => {
      const verse = datei.verses[String(ayah)] ?? [];
      return {
        words: verse.map((w) => w.text),
        highlightPosition: verse.some((w) => w.position === position) ? position : null,
      };
    },
  });
}
