// Quiz-Hub "Üben & Quiz": frei wählbare Übungs-Modi. Buchstaben/Formen/
// Verbindungen/Harakat/Wörter/Regeln werden aus den Lern-Daten generiert,
// Islam-Wissen und Koran-Quiz kommen aus der kuratierten trivia.json
// (de/en/tr/ar). correct steht in der Bank immer auf Index 0 und wird zur
// Laufzeit gemischt.

import type { Locale } from '@/lib/locale-detect';

import {
  HARAKAT,
  LETTERS,
  SUN_LETTER_IDS,
  finalForm,
  initialForm,
  letterById,
  medialForm,
  syllable,
  syllableTranslit,
} from '../learn/letters';
import { LESSONS } from '../learn/curriculum';
import { shuffle, similarSiblings, type QuizQuestion, type Rand } from '../learn/quiz';
import type { ArabicLetter } from '../learn/letters';
import type { ExerciseStyle } from '@/features/settings/types';
import triviaData from './trivia.json';

export type PracticeModeId =
  | 'letters'
  | 'forms'
  | 'connections'
  | 'harakat'
  | 'words'
  | 'rules'
  | 'knowledge'
  | 'quran'
  | 'seerah'
  | 'sahaba'
  | 'akhlaq'
  | 'nikah'
  | 'dialects'
  | 'mix';

export interface PracticeMode {
  id: PracticeModeId;
  icon: string;
}

export const PRACTICE_MODES: PracticeMode[] = [
  { id: 'letters', icon: 'ب' },
  { id: 'forms', icon: 'ـبـ' },
  { id: 'connections', icon: '🔗' },
  { id: 'harakat', icon: 'بَ' },
  { id: 'words', icon: '📖' },
  { id: 'rules', icon: '📐' },
  { id: 'knowledge', icon: '🕌' },
  { id: 'quran', icon: '📗' },
  { id: 'seerah', icon: '🌙' },
  { id: 'sahaba', icon: '👥' },
  { id: 'akhlaq', icon: '💎' },
  { id: 'nikah', icon: '🏠' },
  { id: 'dialects', icon: '🗺️' },
  { id: 'mix', icon: '🎲' },
];

export const QUESTIONS_PER_RUN = 10;

const YES_NO: Record<Locale, [string, string]> = {
  de: ['Ja', 'Nein'],
  en: ['Yes', 'No'],
  tr: ['Evet', 'Hayır'],
  ar: ['نعم', 'لا'],
  es: ['Sí', 'No'],
  fr: ['Oui', 'Non'],
  id: ['Ya', 'Tidak'],
  bn: ['হ্যাঁ', 'না'],
  fa: ['بله', 'خیر'],
  ms: ['Ya', 'Tidak'],
  ur: ['ہاں', 'نہیں'],
  ru: ['Да', 'Нет'],
  sw: ['Ndiyo', 'Hapana'],
  ps: ['هو', 'نه'],
};

function pick<T>(arr: T[], n: number, rand: Rand): T[] {
  return shuffle(arr, rand).slice(0, n);
}

/**
 * 3 Buchstaben-Distraktoren, verwechselbare Geschwister (SIMILAR_SETS)
 * zuerst — rein zufällige Distraktoren sind per Ausschluss zu leicht
 * erratbar (User-Feedback, analog zu learn/quiz.ts).
 */
function letterDistractors(
  letter: ArabicLetter,
  candidates: ArabicLetter[],
  toOption: (l: ArabicLetter) => string,
  correct: string,
  rand: Rand,
): string[] {
  const siblings = similarSiblings(letter).filter(
    (l) => candidates.some((c) => c.id === l.id) && toOption(l) !== correct,
  );
  const rest = candidates.filter(
    (l) => l.id !== letter.id && toOption(l) !== correct && !siblings.some((s) => s.id === l.id),
  );
  return [...shuffle(siblings, rand), ...shuffle(rest, rand)].slice(0, 3).map(toOption);
}

function withOptions(
  correct: string,
  distractors: string[],
  rand: Rand,
): { options: string[]; correctIndex: number } {
  const options = shuffle([correct, ...distractors], rand);
  return { options, correctIndex: options.indexOf(correct) };
}

function letterQuestions(rand: Rand, style: ExerciseStyle = 'mixed'): QuizQuestion[] {
  return pick(LETTERS, QUESTIONS_PER_RUN, rand).map((letter, i) => {
    const askName = i % 2 === 0;
    if (askName) {
      const distractors = letterDistractors(letter, LETTERS, (l) => l.name, letter.name, rand);
      return {
        promptKey: 'learn.quiz.nameOfLetter',
        display: letter.arabic,
        displayArabic: true,
        optionsArabic: false,
        // KEIN tts hier, UNABHÄNGIG von style: [mode].tsx spielt tts
        // automatisch beim Laden der Frage ab - würde bei "Wie heißt dieser
        // Buchstabe?" den gesuchten Namen direkt vorlesen und die Antwort
        // per Gehör verraten, ohne dass die Glyphe erkannt werden muss
        // (gleicher Fund/Fix wie learn/quiz.ts letterQuestions). Anders als
        // dort gibt es hier keine zweite, rein akustische Frage-Variante, die
        // bei exerciseStyle 'audio' an ihre Stelle treten könnte - die Frage
        // bleibt in allen drei Stilen unverändert.
        ...withOptions(letter.name, distractors, rand),
      };
    }
    const distractors = letterDistractors(letter, LETTERS, (l) => l.arabic, letter.arabic, rand);
    return {
      promptKey: 'learn.quiz.glyphOfLetter',
      display: letter.name,
      displayArabic: false,
      optionsArabic: true,
      // tts ist hier nur eine freiwillige Vorlese-HILFE (die Antwort steht
      // sichtbar in den Options-Glyphen, kein requiresAudio) - bei
      // exerciseStyle 'reading' ("kann/will gerade nicht hören") bleibt sie
      // stumm, sonst spielt [mode].tsx sie beim Laden automatisch ab.
      tts: style === 'reading' ? undefined : letter.arabicName,
      ...withOptions(letter.arabic, distractors, rand),
    };
  });
}

const FORM_KINDS = [
  { key: 'learn.quiz.formInitial', fn: initialForm },
  { key: 'learn.quiz.formMedial', fn: medialForm },
  { key: 'learn.quiz.formFinal', fn: finalForm },
] as const;

function formQuestions(rand: Rand, style: ExerciseStyle = 'mixed'): QuizQuestion[] {
  const connectors = LETTERS.filter((l) => l.connects);
  return pick(connectors, QUESTIONS_PER_RUN, rand).map((letter, i) => {
    const kind = FORM_KINDS[i % FORM_KINDS.length];
    const correct = kind.fn(letter);
    const distractors = letterDistractors(letter, connectors, kind.fn, correct, rand);
    return {
      promptKey: kind.key,
      display: letter.arabic,
      displayArabic: true,
      optionsArabic: true,
      // Nur Vorlese-Hilfe (Glyphe steht bereits sichtbar da) - bei 'reading' stumm.
      tts: style === 'reading' ? undefined : letter.arabicName,
      ...withOptions(correct, distractors, rand),
    };
  });
}

function connectionQuestions(locale: Locale, rand: Rand, style: ExerciseStyle = 'mixed'): QuizQuestion[] {
  const [yes, no] = YES_NO[locale];
  const questions: QuizQuestion[] = [];

  // "Verbindet sich dieser Buchstabe nach links?"
  for (const letter of pick(LETTERS, 6, rand)) {
    const options = [yes, no];
    questions.push({
      promptKey: 'practice.quiz.connectsLeft',
      display: letter.arabic,
      displayArabic: true,
      optionsArabic: false,
      // Nur Vorlese-Hilfe (Glyphe steht bereits sichtbar da) - bei 'reading' stumm.
      tts: style === 'reading' ? undefined : letter.arabicName,
      options,
      correctIndex: letter.connects ? 0 : 1,
    });
  }

  // "Welcher Buchstabe verbindet sich NICHT nach links?"
  const nonConnectors = LETTERS.filter((l) => !l.connects);
  const connectors = LETTERS.filter((l) => l.connects);
  for (const target of pick(nonConnectors, 4, rand)) {
    const distractors = pick(connectors, 3, rand).map((l) => l.arabic);
    questions.push({
      promptKey: 'practice.quiz.whichNonConnector',
      display: '',
      displayArabic: false,
      optionsArabic: true,
      ...withOptions(target.arabic, distractors, rand),
    });
  }

  return shuffle(questions, rand).slice(0, QUESTIONS_PER_RUN);
}

const VOWELS = ['fatha', 'kasra', 'damma'] as const;

function harakatQuestions(rand: Rand, style: ExerciseStyle = 'mixed'): QuizQuestion[] {
  const readable = ['ba', 'ta', 'jim', 'dal', 'ra', 'sin', 'fa', 'qaf', 'lam', 'mim', 'nun', 'kaf'].map(
    letterById,
  );
  return pick(readable, QUESTIONS_PER_RUN, rand).map((letter, i) => {
    const haraka = VOWELS[i % VOWELS.length];
    const correct = syllableTranslit(letter, haraka);
    const otherVowels = VOWELS.filter((h) => h !== haraka).map((h) => syllableTranslit(letter, h));
    const otherLetter = pick(readable.filter((l) => l.id !== letter.id), 1, rand)[0];
    return {
      promptKey: 'learn.quiz.readSyllable',
      display: syllable(letter, haraka),
      displayArabic: true,
      optionsArabic: false,
      // Nur Vorlese-Hilfe (Silbe steht bereits sichtbar da) - bei 'reading' stumm.
      tts: style === 'reading' ? undefined : syllable(letter, haraka),
      ...withOptions(correct, [...otherVowels, syllableTranslit(otherLetter, haraka)], rand),
    };
  });
}

interface WordPoolItem {
  arabic: string;
  translit: string;
}

/** Alle lesbaren Wörter aus dem Kurs (Wort-Lektionen + Konzept-Beispiele). */
function wordPool(): WordPoolItem[] {
  const pool: WordPoolItem[] = [];
  for (const lesson of LESSONS) {
    if (lesson.words) pool.push(...lesson.words);
    if (lesson.conceptQuiz) pool.push(...lesson.conceptQuiz);
  }
  return pool;
}

function wordQuestions(rand: Rand, style: ExerciseStyle = 'mixed'): QuizQuestion[] {
  const pool = wordPool();
  const translits = [...new Set(pool.map((w) => w.translit))];
  return pick(pool, QUESTIONS_PER_RUN, rand).map((word) => ({
    promptKey: 'learn.quiz.readWord',
    display: word.arabic,
    displayArabic: true,
    optionsArabic: false,
    // Nur Vorlese-Hilfe (Wort steht bereits sichtbar da) - bei 'reading' stumm.
    tts: style === 'reading' ? undefined : word.arabic,
    ...withOptions(word.translit, pick(translits.filter((t) => t !== word.translit), 3, rand), rand),
  }));
}

function ruleQuestions(locale: Locale, rand: Rand, style: ExerciseStyle = 'mixed'): QuizQuestion[] {
  const [yes, no] = YES_NO[locale];
  const questions: QuizQuestion[] = [];
  // Alle tts-Felder unten sind nur Vorlese-HILFE (Antwort steht bereits
  // sichtbar in display) - bei exerciseStyle 'reading' bewusst stumm.
  const hintTts = (text: string) => (style === 'reading' ? undefined : text);

  // Sonnen-/Mondbuchstaben
  for (const letter of pick(LETTERS.filter((l) => l.id !== 'alif'), 5, rand)) {
    questions.push({
      promptKey: 'practice.quiz.isSunLetter',
      display: letter.arabic,
      displayArabic: true,
      optionsArabic: false,
      tts: hintTts(letter.arabicName),
      options: [yes, no],
      correctIndex: SUN_LETTER_IDS.has(letter.id) ? 0 : 1,
    });
  }

  // Madd: Langvokal lesen
  const maddCombos = [
    { arabic: `ب${HARAKAT.fatha}ا`, correct: 'bā', wrong: ['ba', 'bī', 'bū'] },
    { arabic: `ب${HARAKAT.damma}و`, correct: 'bū', wrong: ['bu', 'bā', 'bī'] },
    { arabic: `ب${HARAKAT.kasra}ي`, correct: 'bī', wrong: ['bi', 'bū', 'bā'] },
    { arabic: `س${HARAKAT.fatha}ا`, correct: 'sā', wrong: ['sa', 'sī', 'sū'] },
    { arabic: `ن${HARAKAT.damma}و`, correct: 'nū', wrong: ['nu', 'nā', 'nī'] },
  ];
  for (const combo of pick(maddCombos, 3, rand)) {
    questions.push({
      promptKey: 'learn.quiz.readSyllable',
      display: combo.arabic,
      displayArabic: true,
      optionsArabic: false,
      tts: hintTts(combo.arabic),
      ...withOptions(combo.correct, combo.wrong, rand),
    });
  }

  // Artikel-Assimilation (aus der Sonnen-/Mond-Lektion)
  const sunMoon = LESSONS.find((l) => l.id === 'sun-moon');
  const articleWords = [...(sunMoon?.conceptQuiz ?? []), ...(sunMoon?.conceptCards ?? []).map((c) => ({ arabic: c.arabic, translit: c.label }))];
  const translits = articleWords.map((w) => w.translit);
  for (const word of pick(articleWords, 2, rand)) {
    questions.push({
      promptKey: 'learn.quiz.readWord',
      display: word.arabic,
      displayArabic: true,
      optionsArabic: false,
      tts: hintTts(word.arabic),
      ...withOptions(word.translit, pick(translits.filter((t) => t !== word.translit), 3, rand), rand),
    });
  }

  return shuffle(questions, rand).slice(0, QUESTIONS_PER_RUN);
}

interface TriviaQuestion {
  id: string;
  category: 'knowledge' | 'quran' | 'seerah' | 'sahaba' | 'akhlaq' | 'nikah' | 'dialects';
  q: Partial<Record<Locale, string>>;
  options: Partial<Record<Locale, string>>[];
}

const TRIVIA: TriviaQuestion[] = triviaData.questions as unknown as TriviaQuestion[];

/** Noch nicht übersetzte Sprachen (es/fr) fallen auf Englisch zurück. */
function triviaText(text: Partial<Record<Locale, string>>, locale: Locale): string {
  return text[locale] ?? text.en ?? text.de ?? '';
}

function triviaQuestions(
  category: 'knowledge' | 'quran' | 'seerah' | 'sahaba' | 'akhlaq' | 'nikah' | 'dialects',
  locale: Locale,
  rand: Rand,
): QuizQuestion[] {
  return pick(TRIVIA.filter((t) => t.category === category), QUESTIONS_PER_RUN, rand).map((t) => {
    const correct = triviaText(t.options[0], locale);
    const distractors = t.options.slice(1).map((o) => triviaText(o, locale));
    return {
      promptKey: '',
      promptText: triviaText(t.q, locale),
      display: '',
      displayArabic: false,
      optionsArabic: locale === 'ar',
      ...withOptions(correct, distractors, rand),
    };
  });
}

export function buildPracticeQuiz(
  mode: PracticeModeId,
  locale: Locale,
  rand: Rand = Math.random,
  // Bevorzugte Übungsart (Setting): keine Frage hier ist requiresAudio (die
  // Antwort steht immer sichtbar da, siehe letterQuestions/formQuestions/…) -
  // style steuert daher nur, ob die optionalen tts-Vorlese-Hilfen automatisch
  // abspielen (unterdrückt bei 'reading'), nicht WELCHE Fragen entstehen.
  style: ExerciseStyle = 'mixed',
): QuizQuestion[] {
  switch (mode) {
    case 'letters':
      return letterQuestions(rand, style);
    case 'forms':
      return formQuestions(rand, style);
    case 'connections':
      return connectionQuestions(locale, rand, style);
    case 'harakat':
      return harakatQuestions(rand, style);
    case 'words':
      return wordQuestions(rand, style);
    case 'rules':
      return ruleQuestions(locale, rand, style);
    case 'knowledge':
      return triviaQuestions('knowledge', locale, rand);
    case 'quran':
      return triviaQuestions('quran', locale, rand);
    case 'seerah':
      return triviaQuestions('seerah', locale, rand);
    case 'sahaba':
      return triviaQuestions('sahaba', locale, rand);
    case 'akhlaq':
      return triviaQuestions('akhlaq', locale, rand);
    case 'nikah':
      return triviaQuestions('nikah', locale, rand);
    case 'dialects':
      return triviaQuestions('dialects', locale, rand);
    case 'mix': {
      const all = [
        ...letterQuestions(rand, style),
        ...formQuestions(rand, style),
        ...harakatQuestions(rand, style),
        ...wordQuestions(rand, style),
        ...triviaQuestions('knowledge', locale, rand),
        ...triviaQuestions('quran', locale, rand),
        ...triviaQuestions('seerah', locale, rand),
        ...triviaQuestions('sahaba', locale, rand),
        ...triviaQuestions('akhlaq', locale, rand),
        ...triviaQuestions('nikah', locale, rand),
        ...triviaQuestions('dialects', locale, rand),
      ];
      return pick(all, QUESTIONS_PER_RUN, rand);
    }
  }
}
