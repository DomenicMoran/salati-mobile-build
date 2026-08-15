// Matching: arabische Wörter aus dem Kurs ihrer Umschrift zuordnen.
// Paare kommen aus demselben Wort-Pool wie der Wörter-Quiz-Modus.

import { LESSONS } from '../learn/curriculum';
import { readWordQuestion, shuffle, type QuizQuestion, type Rand } from '../learn/quiz';

export interface MatchingPair {
  arabic: string;
  translit: string;
}

export const MATCHING_PAIRS_PER_ROUND = 5;
export const MATCHING_ROUNDS = 3;

function matchingPool(): MatchingPair[] {
  const seen = new Set<string>();
  const pool: MatchingPair[] = [];
  for (const lesson of LESSONS) {
    for (const word of [...(lesson.words ?? []), ...(lesson.conceptQuiz ?? [])]) {
      // Duplikate (gleiche Umschrift ODER gleiches Wort) wären im Board mehrdeutig
      if (seen.has(word.arabic) || seen.has(word.translit)) continue;
      seen.add(word.arabic);
      seen.add(word.translit);
      pool.push({ arabic: word.arabic, translit: word.translit });
    }
  }
  return pool;
}

export interface MatchingRound {
  pairs: MatchingPair[];
  /** Anzeige-Reihenfolge der rechten Spalte (Indizes in pairs). */
  rightOrder: number[];
}

/** Falsch zugeordnetes Paar (im ersten Versuch verfehlt) als Quiz-Frage für die Fehler-Wiederholung. */
export function matchingMistakeQuestion(
  pair: MatchingPair,
  roundPairs: MatchingPair[],
  rand: Rand = Math.random,
): QuizQuestion {
  return readWordQuestion(pair, roundPairs.map((p) => p.translit), rand);
}

export function buildMatchingRun(rand: Rand = Math.random): MatchingRound[] {
  const pool = shuffle(matchingPool(), rand);
  const rounds: MatchingRound[] = [];
  for (let r = 0; r < MATCHING_ROUNDS; r++) {
    const pairs = pool.slice(r * MATCHING_PAIRS_PER_ROUND, (r + 1) * MATCHING_PAIRS_PER_ROUND);
    if (pairs.length < MATCHING_PAIRS_PER_ROUND) break;
    rounds.push({
      pairs,
      rightOrder: shuffle(Array.from({ length: pairs.length }, (_, i) => i), rand),
    });
  }
  return rounds;
}
