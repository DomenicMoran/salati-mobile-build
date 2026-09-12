// Ladeschicht für data/wortlisten.json — Vokabel-/Partikellisten, eine
// Beispielsatzliste und zwei Flussdiagramme, die (siehe wortlistenTypes.ts
// und data/LUECKEN.md) keine Flexionsparadigmen sind und deshalb NICHT über
// paradigmenLoader.ts/paradigmenKategorien.ts erfasst werden — eine eigene,
// kleine Ladeschicht statt eines Sonderfalls im bestehenden Loader (der
// PARADIGM_SOURCES-Mechanismus geht von genau EINEM Schema aus,
// {schema, tables: ParadigmTabelle[]}; wortlisten.json hat drei
// verschiedene Listen-Arrays mit eigenem Schema, siehe WortlistenDatei).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Ablaufschema, Beispielsatzliste, Vergleichstabelle, WortlistenDatei, Wortliste } from './wortlistenTypes';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

interface WortlistenBestand {
  wortlisten: Wortliste[];
  beispielsatzlisten: Beispielsatzliste[];
  ablaufschemata: Ablaufschema[];
  vergleichstabellen: Vergleichstabelle[];
}

let cache: Promise<WortlistenBestand> | null = null;

function ladeWortlisten(): Promise<WortlistenBestand> {
  if (!cache) {
    cache = import('./data/wortlisten.json').then((mod) => {
      const datei = mod as unknown as WortlistenDatei;
      return {
        wortlisten: datei.wortlisten ?? [],
        beispielsatzlisten: datei.beispielsatzlisten ?? [],
        ablaufschemata: datei.ablaufschemata ?? [],
        vergleichstabellen: datei.vergleichstabellen ?? [],
      };
    });
  }
  return cache;
}

/** ALLE Wortlisten (Vokabel-/Partikellisten) + Beispielsatzlisten +
 *  Ablaufschemata + Vergleichstabellen aus data/wortlisten.json — für
 *  WortlistenKatalogView im Reiter "Grammatik & Ṣarf" (Unterreiter
 *  "Wortlisten"). */
export function useWortlistenBestand(): UseQueryResult<WortlistenBestand> {
  return useQuery({
    queryKey: ['lexikon', 'wortlistenBestand'],
    queryFn: ladeWortlisten,
    staleTime: STATIC_STALE_TIME,
  });
}
