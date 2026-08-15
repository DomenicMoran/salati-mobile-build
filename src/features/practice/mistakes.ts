// Fehler-Wiederholung: falsch beantwortete Quiz-Fragen werden lokal
// gesammelt und als eigener Übungsmodus erneut gestellt; wer sie dort
// richtig beantwortet, wirft sie wieder raus (einfaches Leitner-Prinzip).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuizQuestion } from '../learn/quiz';

export const MISTAKES_STORAGE_KEY = 'salatibox:practice-mistakes';
export const MISTAKES_MAX = 50;

/** Stabiler Schlüssel einer Frage (Fragetext + Anzeige + richtige Antwort). */
export function mistakeKey(q: QuizQuestion): string {
  return `${q.promptKey}|${q.promptText ?? ''}|${q.display}|${q.options[q.correctIndex] ?? ''}`;
}

export function parseMistakes(raw: string | null): QuizQuestion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuizQuestion[]) : [];
  } catch {
    return [];
  }
}

/** Frage vorn anfügen; Duplikate (gleicher Key) ersetzen; Kappung auf MISTAKES_MAX. */
export function addMistake(list: QuizQuestion[], q: QuizQuestion): QuizQuestion[] {
  const key = mistakeKey(q);
  const rest = list.filter((m) => mistakeKey(m) !== key);
  return [q, ...rest].slice(0, MISTAKES_MAX);
}

export function removeMistake(list: QuizQuestion[], q: QuizQuestion): QuizQuestion[] {
  const key = mistakeKey(q);
  return list.filter((m) => mistakeKey(m) !== key);
}

export async function loadMistakes(): Promise<QuizQuestion[]> {
  return parseMistakes(await AsyncStorage.getItem(MISTAKES_STORAGE_KEY));
}

export async function saveMistakes(list: QuizQuestion[]): Promise<void> {
  await AsyncStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(list)).catch(() => {});
}

/** Für den Quiz-Screen: falsche Antwort merken (fire-and-forget). */
export async function recordMistake(q: QuizQuestion): Promise<void> {
  const list = await loadMistakes();
  await saveMistakes(addMistake(list, q));
}

/** Für den Fehler-Modus: richtig beantwortete Frage austragen. */
export async function clearMistake(q: QuizQuestion): Promise<void> {
  const list = await loadMistakes();
  await saveMistakes(removeMistake(list, q));
}
