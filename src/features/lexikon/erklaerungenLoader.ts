// Lädt die Lehrtext-Dateien des Reiters "Grammatik & Sarf" sowie die
// referenzierten Paradigmen-Tabellen NACH — per literalem dynamic `import()`,
// analog zum Kurs-Muster in `@/features/study/courses.ts` (eigener Metro-/
// Web-Chunk je Datei statt eines immer geladenen Bundles; drei Dateien mit
// zusammen weit über 200 KB dürfen nicht jede Route mitschleppen).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { ErklaerungenBereich, ErklaerungenDatei } from './erklaerungenTypes';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

// Metro/Webpack brauchen für dynamic import() einen statischen Pfad-String
// je Aufrufstelle — deshalb die explizite Map statt eines Template-Strings
// (gleiches Vorgehen wie LOADERS in @/lib/translate.ts).
const ERKLAERUNGEN_LOADERS: Record<ErklaerungenBereich, () => Promise<unknown>> = {
  nomen: () => import('./data/erklaerungen/de-nomen.json'),
  verb: () => import('./data/erklaerungen/de-verb.json'),
  'partikel-syntax': () => import('./data/erklaerungen/de-partikel-syntax.json'),
};

export async function ladeErklaerungen(bereich: ErklaerungenBereich): Promise<ErklaerungenDatei> {
  const mod = await ERKLAERUNGEN_LOADERS[bereich]();
  return mod as unknown as ErklaerungenDatei;
}

export function useErklaerungen(bereich: ErklaerungenBereich): UseQueryResult<ErklaerungenDatei> {
  return useQuery({
    queryKey: ['lexikon', 'erklaerungen', bereich],
    queryFn: () => ladeErklaerungen(bereich),
    staleTime: STATIC_STALE_TIME,
  });
}

const ALLE_BEREICHE: ErklaerungenBereich[] = ['nomen', 'verb', 'partikel-syntax'];

/** Alle drei Bereiche zusammen — für die Liste im Reiter "Grammatik & Sarf",
 *  die über alle Begriffe hinweg gruppiert anzeigt. */
export function useAlleErklaerungen(): {
  data: Partial<Record<ErklaerungenBereich, ErklaerungenDatei>>;
  isLoading: boolean;
  isError: boolean;
} {
  // Ein Hook pro Bereich statt einer Schleife: React-Hooks-Regeln verlangen
  // eine feste, bekannte Anzahl von Hook-Aufrufen — ALLE_BEREICHE hat immer
  // exakt drei Einträge.
  const nomen = useErklaerungen('nomen');
  const verb = useErklaerungen('verb');
  const partikel = useErklaerungen('partikel-syntax');
  const queries = { nomen, verb, 'partikel-syntax': partikel } as const;

  const data: Partial<Record<ErklaerungenBereich, ErklaerungenDatei>> = {};
  for (const bereich of ALLE_BEREICHE) {
    const d = queries[bereich].data;
    if (d) data[bereich] = d;
  }

  return {
    data,
    isLoading: ALLE_BEREICHE.some((b) => queries[b].isLoading),
    isError: ALLE_BEREICHE.some((b) => queries[b].isError),
  };
}

// Die Paradigmen-Tabellen selbst lädt @/features/lexikon/paradigmenLoader.ts
// (useParadigmTabelle) — ausgelagert, weil sie inzwischen aus VIER Dateien
// zusammengeführt werden (data/paradigmen*.json, siehe dortiger
// Kopf-Kommentar) und sowohl die Begriff-Detailansicht als auch der
// Tabellenkatalog/die Verbtyp-Route dieselbe Ladefunktion brauchen.
