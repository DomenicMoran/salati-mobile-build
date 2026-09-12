// Ladeschicht für die Wortlisten-Übersetzungsbündel unter
// data/wortlisten-i18n/<lang>.json (siehe wortlistenI18nTypes.ts) — analog zu
// erklaerungenLoader.ts: literale dynamic import()-Map je Sprache (Metro/
// Webpack brauchen für Code-Splitting einen statischen Pfad-String je
// Aufrufstelle, siehe dortiger Kommentar), damit jede Sprache ihr eigenes
// Chunk bekommt statt 13 selten gebrauchte Sprachdateien in jedes Bundle zu
// ziehen. `de` hat bewusst KEINEN Eintrag: Die deutschen Bedeutungen liegen
// bereits vollständig in data/wortlisten.json selbst (WortlistenEintrag.de
// usw.) — eine de.json hier wäre eine reine Dopplung.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { WortlistenUebersetzung } from './wortlistenI18nTypes';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

const WORTLISTEN_I18N_LOADERS: Record<string, () => Promise<unknown>> = {
  en: () => import('./data/wortlisten-i18n/en.json'),
  tr: () => import('./data/wortlisten-i18n/tr.json'),
  ar: () => import('./data/wortlisten-i18n/ar.json'),
  es: () => import('./data/wortlisten-i18n/es.json'),
  fr: () => import('./data/wortlisten-i18n/fr.json'),
  id: () => import('./data/wortlisten-i18n/id.json'),
  bn: () => import('./data/wortlisten-i18n/bn.json'),
  fa: () => import('./data/wortlisten-i18n/fa.json'),
  ms: () => import('./data/wortlisten-i18n/ms.json'),
  ur: () => import('./data/wortlisten-i18n/ur.json'),
  ru: () => import('./data/wortlisten-i18n/ru.json'),
  sw: () => import('./data/wortlisten-i18n/sw.json'),
  ps: () => import('./data/wortlisten-i18n/ps.json'),
};

/** Ob für `lang` ein übersetztes Wortlisten-Bündel existiert — steuert, ob
 *  WortlistenKatalogView den `germanOnlyMeaningNote`-Hinweis noch anzeigen
 *  muss (siehe dort). */
export function hatWortlistenUebersetzung(lang: string): boolean {
  return lang in WORTLISTEN_I18N_LOADERS;
}

const cache: Partial<Record<string, Promise<WortlistenUebersetzung>>> = {};

function ladeWortlistenUebersetzung(lang: string): Promise<WortlistenUebersetzung | null> {
  const loader = WORTLISTEN_I18N_LOADERS[lang];
  if (!loader) return Promise.resolve(null);
  if (!cache[lang]) {
    cache[lang] = loader().then((mod) => mod as unknown as WortlistenUebersetzung);
  }
  return cache[lang]!;
}

/** Übersetztes Wortlisten-Bündel für `lang`, oder `null` für `de` bzw. eine
 *  (noch) nicht übersetzte Sprache — in beiden Fällen rendern die Karten
 *  dann die deutschen Felder aus data/wortlisten.json direkt. */
export function useWortlistenUebersetzung(lang: string): UseQueryResult<WortlistenUebersetzung | null> {
  return useQuery({
    queryKey: ['lexikon', 'wortlistenUebersetzung', lang],
    queryFn: () => ladeWortlistenUebersetzung(lang),
    staleTime: STATIC_STALE_TIME,
  });
}
