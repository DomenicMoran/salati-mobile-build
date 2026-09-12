// Morphologie mehrerer Suren gleichzeitig — für die Mushaf-Seitenansicht:
// eine Druckseite (und im Doppelseiten-Modus: zwei Seiten nebeneinander)
// kann mehrere Suren gleichzeitig zeigen. Gleiches Muster wie
// useMushafGroupReadings (features/quran/hooks.ts): der Aufrufer übergibt
// ein Array VARIABLER Länge, useQueries kapselt die variable Zahl an
// Abfragen (React erlaubt keine bedingte/variable Anzahl von useQuery-
// Aufrufen).
//
// Eigene Datei statt Erweiterung von morphologieHooks.ts: dort baut ein
// paralleler Agent (Wortanalyse-Sheet) — keine Änderungen an einer fremden,
// gerade in Arbeit befindlichen Datei, um Merge-Konflikte zu vermeiden.
// Gleicher queryKey wie useSurahMorphologie dort (['quran','morphologie',N]),
// die beiden Hooks teilen sich daher denselben React-Query-Cache-Eintrag.
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ladeMorphologie } from '../morphologie';
import type { MorphologieDatei, MorphWord } from '../morphologieTypen';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

export type MorphologieBySurah = Map<number, MorphologieDatei | undefined>;

export function useGroupMorphologie(surahNumbers: number[], enabled: boolean): MorphologieBySurah {
  const queries = useQueries({
    queries: surahNumbers.map((surahNumber) => ({
      queryKey: ['quran', 'morphologie', surahNumber],
      queryFn: () => ladeMorphologie(surahNumber),
      staleTime: STATIC_STALE_TIME,
      enabled,
    })),
  });
  return useMemo(() => {
    const map: MorphologieBySurah = new Map();
    surahNumbers.forEach((sn, i) => map.set(sn, queries[i]?.data));
    return map;
  }, [surahNumbers, queries]);
}

/** Wörter eines Verses aus der Multi-Suren-Karte, oder `undefined`, solange
 * die Morphologie dieser Sure (noch) nicht geladen ist. */
export function morphVerseWords(bySurah: MorphologieBySurah, surah: number, ayah: number): MorphWord[] | undefined {
  return bySurah.get(surah)?.verses[String(ayah)];
}
