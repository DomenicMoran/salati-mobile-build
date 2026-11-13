import { fetchJson } from '@/lib/fetchJson';

import { TAFSIR_RASSOUL_BASE } from './constants';
import type { TafsirBlock, TafsirSurahPayload } from './types';
import { isValidTafsirSurah } from './toc';

export async function fetchRassoulTafsirSurah(surah: number): Promise<TafsirBlock[]> {
  if (!isValidTafsirSurah(surah)) throw new Error('tafsir_surah_invalid');
  const daten = await fetchJson<TafsirSurahPayload>(`${TAFSIR_RASSOUL_BASE}/${surah}.json`, {
    cache: 'no-cache',
    errorPrefix: 'tafsir_bibliothek',
  });
  return Array.isArray(daten.blocks) ? daten.blocks : [];
}
