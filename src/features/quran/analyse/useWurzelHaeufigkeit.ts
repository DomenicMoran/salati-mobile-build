// Häufigkeit einer Wurzel im gesamten Koran, für die "Wurzel und Grundform"-
// Sektion des Wortanalyse-Sheets. Eigene, winzige Hook-Datei statt Erweiterung
// von morphologieHooks.ts: WortAnalyseSheet.tsx ist neuer Code eines parallelen
// Agenten (siehe Kommentar dort), morphologieHooks.ts bleibt unangetastet, um
// keine Merge-Konflikte zu erzeugen.
import { useQuery } from '@tanstack/react-query';

import { ladeWurzeln } from '../morphologie';

// Wie STATIC_STALE_TIME in morphologieHooks.ts — roots.json ändert sich
// praktisch nie.
const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

export interface WurzelHaeufigkeitResult {
  /** Vorkommen der Wurzel im gesamten Koran. `undefined`, solange die
   * Wurzeldaten nicht geladen sind, das Laden fehlschlug, oder keine Wurzel
   * angefragt wurde — NIE 0 vortäuschen, wenn schlicht nichts geladen ist. */
  anzahl: number | undefined;
}

/**
 * Lädt (bei Bedarf) die globale Wurzel-Konkordanz (roots.json) und liefert die
 * Trefferzahl der angefragten Wurzel. `enabled` sollte an die Sichtbarkeit des
 * Sheets gekoppelt werden, damit roots.json nicht bei jedem Wort-Tap erneut
 * angefragt wird, aber auch nicht geladen wird, solange niemand hinschaut.
 */
export function useWurzelHaeufigkeit(wurzel: string | null, enabled: boolean): WurzelHaeufigkeitResult {
  const query = useQuery({
    queryKey: ['quran', 'wurzeln'],
    queryFn: ladeWurzeln,
    staleTime: STATIC_STALE_TIME,
    enabled: enabled && wurzel !== null,
  });
  return { anzahl: wurzel !== null ? query.data?.[wurzel]?.count : undefined };
}
