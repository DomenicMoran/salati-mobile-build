// React-Query-Hooks für die Wort-Morphologie-/Syntaxdaten. Eigene Datei statt
// Erweiterung von ./hooks.ts: die Wortanalyse ist ein eigenständiges Feature
// (paralleler Agent baut noch die UI/Anbindung in WortAnalyseSheet.tsx/[surah].tsx),
// und ./hooks.ts wird bewusst nicht angefasst, um keine Merge-Konflikte mit
// dieser parallelen Arbeit zu erzeugen.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ladeMorphologie } from './morphologie';
import type { MorphologieDatei, MorphWord } from './morphologieTypen';

// Wie STATIC_STALE_TIME in ./hooks.ts — Morphologiedaten einer Sure ändern
// sich praktisch nie.
const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

/**
 * Rohe Morphologiedatei einer Sure — nur laden, wenn der Nutzer die
 * Wortanalyse aktiv eingeschaltet hat (`enabled`). Geteilter Cache-Eintrag
 * für useVerseMorphologie/useWortMorphologie derselben Sure (identischer
 * queryKey), damit ein Sure-weiter Vers-für-Vers-Aufruf nicht mehrfach lädt.
 */
export function useSurahMorphologie(surahNumber: number, enabled: boolean): UseQueryResult<MorphologieDatei> {
  return useQuery({
    queryKey: ['quran', 'morphologie', surahNumber],
    queryFn: () => ladeMorphologie(surahNumber),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}

export interface VerseMorphologieResult extends Omit<UseQueryResult<MorphologieDatei>, 'data'> {
  /** Wörter des angefragten Verses, oder `undefined` solange nicht geladen/kein Treffer. */
  verse: MorphWord[] | undefined;
}

/** Morphologie eines einzelnen Verses. */
export function useVerseMorphologie(surahNumber: number, ayahNumber: number, enabled: boolean): VerseMorphologieResult {
  const query = useSurahMorphologie(surahNumber, enabled);
  const { data, ...rest } = query;
  return {
    ...rest,
    verse: data?.verses[String(ayahNumber)],
  };
}

export interface WortMorphologieResult extends Omit<VerseMorphologieResult, 'verse'> {
  /** Das angefragte Wort, oder `undefined` solange nicht geladen/keine passende Position. */
  word: MorphWord | undefined;
}

/** Morphologie eines einzelnen Wortes (Vers + 1-basierte Position). */
export function useWortMorphologie(
  surahNumber: number,
  ayahNumber: number,
  position: number,
  enabled: boolean,
): WortMorphologieResult {
  const { verse, ...rest } = useVerseMorphologie(surahNumber, ayahNumber, enabled);
  return {
    ...rest,
    word: verse?.find((w) => w.position === position),
  };
}
