// React-Query-Hooks für die Wort-für-Wort-Bedeutungen (siehe ./wbw.ts).
// Eigene Datei statt Erweiterung von ./hooks.ts — gleiches Muster wie
// ./morphologieHooks.ts neben ./morphologie.ts.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ladeWbw, ladeWbwMeta, type WbwDatei, type WbwMetaDatei, type WbwSprache } from './wbw';

// Wie STATIC_STALE_TIME in ./hooks.ts — die Wort-Bedeutungen einer Sure ändern
// sich praktisch nie (Auslieferung ist „immutable" gecacht, siehe ./wbw.ts).
const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

/**
 * Wort-Bedeutungen einer Sure in der App-Sprache. `sprache === null` heißt
 * „für diese Sprache gibt es keinen Datensatz" — dann läuft die Abfrage gar
 * nicht erst an und der Reader bleibt beim englischen Gloss von quran.com.
 *
 * EIN FEHLSCHLAG DARF SICH NICHT FESTSETZEN (Befund der Geräteabnahme: ein
 * Timeout beim ersten Urdu-Durchgang ließ Sure 2 die ganze Sitzung lang
 * englisch): `staleTime` oben gilt nur für ERFOLGE — eine Abfrage ohne Daten
 * ist immer veraltet, `retryOnMount` (hier ausdrücklich statt still per
 * Vorgabe) lädt sie beim erneuten Betreten des Bildschirms neu, und
 * lib/queryClient.ts (`sollInDieAblage`) hält den Fehlzustand aus der
 * Persistenz heraus. Sichtbar wird der Fehlschlag über `isError` in der
 * Beschriftung des Umschalters (wbwUmschalterZustand in ./wbw.ts) und über
 * `refetch` als „Erneut versuchen" direkt dort.
 */
export function useSurahWbw(
  surahNumber: number,
  sprache: WbwSprache | null,
  enabled: boolean,
): UseQueryResult<WbwDatei> {
  return useQuery({
    queryKey: ['quran', 'wbw', sprache, surahNumber],
    queryFn: () => ladeWbw(sprache as WbwSprache, surahNumber),
    staleTime: STATIC_STALE_TIME,
    retryOnMount: true,
    enabled: enabled && sprache !== null,
  });
}

/**
 * Abdeckungs-Statistik aller Sprachen — Grundlage der ehrlichen Beschriftung
 * des Umschalters (wbwUmschalterZustand in ./wbw.ts). Nur nötig, wenn die
 * App-Sprache überhaupt einen Datensatz hat.
 */
export function useWbwMeta(enabled: boolean): UseQueryResult<WbwMetaDatei> {
  return useQuery({
    queryKey: ['quran', 'wbw', 'meta'],
    queryFn: () => ladeWbwMeta(),
    staleTime: STATIC_STALE_TIME,
    enabled,
  });
}
