// Pure Logik für den "Aufsagen"-Flow: Deep-Link-Params aus dem Koran-Reader
// (/hifz/[surah]?ayah=N&recite=1) und Auto-Abhaken nach gutem Rezitations-
// Check. Reine Funktionen — testbar ohne UI/Speech-API.

import { gradeFromSimilarity } from './similarity';

export interface ReciteParams {
  /** Ziel-Vers (numberInSurah) aus dem Deep-Link — null wenn fehlend/ungültig */
  targetAyah: number | null;
  /** Wurde der Aufsage-Check explizit angefordert (recite=1)? */
  reciteRequested: boolean;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parst die Reader-Deep-Link-Params. Ungültige Ayah-Werte (leer, 0, negativ,
 * nicht-numerisch) werden verworfen statt die Navigation zu brechen.
 */
export function parseReciteParams(params: {
  ayah?: string | string[];
  recite?: string | string[];
}): ReciteParams {
  const ayahRaw = firstParam(params.ayah);
  const n = Number(ayahRaw);
  const targetAyah = ayahRaw !== undefined && ayahRaw !== '' && Number.isInteger(n) && n >= 1 ? n : null;
  const reciteRaw = firstParam(params.recite);
  return { targetAyah, reciteRequested: reciteRaw === '1' || reciteRaw === 'true' };
}

/** Listen-Index des Ziel-Verses — null, wenn er in der Sure nicht existiert. */
export function indexForAyah(ayahNumbers: number[], targetAyah: number | null): number | null {
  if (targetAyah === null) return null;
  const idx = ayahNumbers.indexOf(targetAyah);
  return idx >= 0 ? idx : null;
}

/**
 * Auto-Abhak-Schwelle: ab Note "good" (Score >= 0.6) gilt der Vers als
 * aufgesagt und wird automatisch als "Kann ich" markiert — "retry" nicht.
 */
export function shouldAutoMarkKnown(score: number): boolean {
  return gradeFromSimilarity(score) !== 'retry';
}
