// Quiz-Engine des Lern-Moduls: erzeugt aus einer Lektion deterministisch
// (bei injiziertem Zufall) eine Fragenliste. Reine Funktionen — testbar ohne
// React/AsyncStorage.

import { recitationUrl } from './audio';
import {
  isLocalizedFallback,
  localizedText,
  SIMILAR_SETS,
  type Lesson,
  type VocabWordItem,
  type WordItem,
} from './curriculum';
import {
  LETTERS,
  finalForm,
  initialForm,
  letterById,
  medialForm,
  syllable,
  syllableTranslit,
  type ArabicLetter,
} from './letters';
import type { Locale } from '@/lib/locale-detect';
import type { ExerciseStyle } from '@/features/settings/types';

export type Rand = () => number;

export interface QuizQuestion {
  /** i18n-Key der Fragestellung (learn.quiz.*) — leer, wenn promptText gesetzt ist */
  promptKey: string;
  /** Bereits lokalisierte Frage (kuratierte Quiz-Banken) — hat Vorrang vor promptKey */
  promptText?: string;
  /** Groß dargestelltes Element (Buchstabe/Silbe/Wort/Name) */
  display: string;
  displayArabic: boolean;
  options: string[];
  optionsArabic: boolean;
  correctIndex: number;
  /** Arabischer Text für Geräte-TTS (Anhören der Frage) */
  tts?: string;
  /** MP3 mit echter Rezitation (Lese-Lektionen) */
  audioUrl?: string;
  /**
   * true = Audio ist zwingend nötig, um die Frage zu beantworten (die
   * Antwort steht NICHT sichtbar in `display`, z. B. nur "🔊") — im
   * Unterschied zu tts/audioUrl als reiner Vorlese-HILFE bei einer bereits
   * sichtbaren Frage (Standardfall: display trägt die Antwort, tts liest
   * sie nur zusätzlich vor). Fragen mit requiresAudio werden bei
   * exerciseStyle 'reading' nie erzeugt (siehe letterQuestions/wordQuestions/
   * vocabQuestions unten) — das Feld macht diese Unterscheidung fürs
   * UI/Downstream-Code explizit, statt sie implizit aus `display` abzuleiten.
   */
  requiresAudio?: boolean;
  /**
   * true = promptText (kuratierte Quiz-Bank) ist NICHT in der aktuellen
   * App-Sprache vorhanden, sondern über die Englisch/Deutsch-Fallback-Kette
   * (`isLocalizedFallback`) entstanden — LessonPlayer zeigt dann
   * `learn.contentFallbackNotice` statt den Fallback still zu zeigen.
   */
  contentFallback?: boolean;
}

export function shuffle<T>(arr: T[], rand: Rand): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** n Distraktoren aus dem Pool, ohne das korrekte Element, ohne Duplikate. */
function pickDistractors<T>(pool: T[], exclude: T, n: number, rand: Rand): T[] {
  return shuffle(
    [...new Set(pool)].filter((p) => p !== exclude),
    rand,
  ).slice(0, n);
}

/**
 * Wie ähnlich zwei Antwort-Strings wirken: gemeinsamer Anfang zählt am
 * stärksten (der Blick springt zuerst auf den Wortanfang), gemeinsames Ende
 * danach, große Längenunterschiede machen Optionen sofort ausschließbar.
 */
export function similarityScore(a: string, b: string): number {
  const x = a.toLocaleLowerCase();
  const y = b.toLocaleLowerCase();
  const max = Math.min(x.length, y.length);
  let prefix = 0;
  while (prefix < max && x[prefix] === y[prefix]) prefix++;
  let suffix = 0;
  while (suffix < max - prefix && x[x.length - 1 - suffix] === y[y.length - 1 - suffix]) suffix++;
  return prefix * 3 + suffix * 2 - Math.abs(x.length - y.length);
}

/**
 * n Distraktoren, die dem richtigen Ergebnis möglichst ÄHNLICH sehen —
 * rein zufällige Distraktoren sind per Ausschlussverfahren zu leicht
 * erratbar (bekannter Wortanfang/-ende verrät die Antwort, User-Feedback).
 * Leichtes Zufallsrauschen verhindert, dass immer exakt dieselben
 * Distraktoren erscheinen.
 */
export function pickSimilarDistractors(pool: string[], correct: string, n: number, rand: Rand): string[] {
  return [...new Set(pool)]
    .filter((p) => p !== correct)
    .map((p) => ({ p, score: similarityScore(p, correct) + rand() * 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.p);
}

/** Die optisch verwechselbaren Geschwister eines Buchstabens (gleiches Grundskelett). */
export function similarSiblings(letter: ArabicLetter): ArabicLetter[] {
  const set = SIMILAR_SETS.find((ids) => ids.includes(letter.id));
  return set ? set.filter((id) => id !== letter.id).map(letterById) : [];
}

function withOptions(
  correct: string,
  distractors: string[],
  rand: Rand,
): { options: string[]; correctIndex: number } {
  const options = shuffle([correct, ...distractors], rand);
  return { options, correctIndex: options.indexOf(correct) };
}

/**
 * Baut aus einem beliebigen Arabisch/Umschrift-Paar (Matching-Paar,
 * Hör-Aufgabe, …) eine "Lies das Wort"-Multiple-Choice-Frage — für die
 * Fehler-Wiederholung (features/practice/mistakes), die nur QuizQuestion
 * kennt, egal aus welchem Übungsmodus der Fehler kam.
 */
export function readWordQuestion(
  word: { arabic: string; translit: string },
  translitPool: string[],
  rand: Rand = Math.random,
): QuizQuestion {
  return {
    promptKey: 'learn.quiz.readWord',
    display: word.arabic,
    displayArabic: true,
    optionsArabic: false,
    tts: word.arabic,
    ...withOptions(
      word.translit,
      pickSimilarDistractors(translitPool, word.translit, Math.min(3, translitPool.length - 1), rand),
      rand,
    ),
  };
}

function letterQuestions(
  letters: ArabicLetter[],
  rand: Rand,
  style: ExerciseStyle = 'mixed',
): QuizQuestion[] {
  const namePool = LETTERS.map((l) => l.name);
  const glyphPool = LETTERS.map((l) => l.arabic);
  const questions: QuizQuestion[] = [];
  for (const letter of letters) {
    const groupNames = letters.filter((l) => l.id !== letter.id).map((l) => l.name);
    const nameDistractors =
      groupNames.length >= 3
        ? shuffle(groupNames, rand).slice(0, 3)
        : [...groupNames, ...pickDistractors(namePool, letter.name, 3 - groupNames.length, rand)];
    questions.push({
      promptKey: 'learn.quiz.nameOfLetter',
      display: letter.arabic,
      displayArabic: true,
      optionsArabic: false,
      // Reine Schriftbild-Frage (Glyphe lesen -> Namen wählen): Auto-Audio
      // spricht sonst den arabischen Namen und verrät die Antwort direkt
      // per Gehör, ohne die Glyphe erkennen zu müssen (User-Fund). Nur im
      // expliziten Hör-Modus ("audio") darf das Zeichen automatisch
      // vorgelesen werden — dort ist Hören Teil der Übung.
      tts: style === 'audio' ? letter.arabicName : undefined,
      ...withOptions(letter.name, nameDistractors, rand),
    });
    // Verwechselbare Geschwister (gleiches Grundskelett) zuerst als
    // Distraktoren — zufällige Glyphen wären zu leicht unterscheidbar.
    const glyphDistractors = () => {
      const siblings = similarSiblings(letter).map((l) => l.arabic);
      return [
        ...shuffle(siblings, rand),
        ...pickDistractors(
          glyphPool.filter((g) => !siblings.includes(g)),
          letter.arabic,
          3 - siblings.length,
          rand,
        ),
      ].slice(0, 3);
    };
    // Bevorzugte Übungsart (Setting): "audio" ersetzt die Lese-Frage durch
    // eine zweite Hör-Frage, "reading" lässt die Hör-Frage weg — "mixed"
    // (Default) stellt beide.
    if (style !== 'audio') {
      questions.push({
        promptKey: 'learn.quiz.glyphOfLetter',
        display: letter.name,
        displayArabic: false,
        optionsArabic: true,
        // Ebenfalls eine reine Lese-Frage (Namen lesen -> passende Glyphe
        // wählen) — kommt nur in "reading"/"mixed" vor (nie in "audio"),
        // deshalb hier grundsätzlich kein Auto-Audio (kein tts-Feld).
        ...withOptions(letter.arabic, glyphDistractors(), rand),
      });
    }
    // Laut-Erkennung: Buchstabenname anhören -> richtiges Zeichen wählen
    if (style !== 'reading') {
      questions.push({
        promptKey: 'learn.quiz.soundOfLetter',
        display: '🔊',
        displayArabic: false,
        optionsArabic: true,
        tts: letter.arabicName,
        requiresAudio: true,
        ...withOptions(letter.arabic, glyphDistractors(), rand),
      });
    }
    if (style === 'audio') {
      // Zweite Hör-Frage mit anderen Distraktoren statt der Lese-Frage.
      questions.push({
        promptKey: 'learn.quiz.soundOfLetter',
        display: '🔊',
        displayArabic: false,
        optionsArabic: true,
        tts: letter.arabicName,
        requiresAudio: true,
        ...withOptions(letter.arabic, glyphDistractors(), rand),
      });
    }
  }
  return shuffle(questions, rand);
}

function similarQuestions(rand: Rand): QuizQuestion[] {
  const questions = SIMILAR_SETS.map((set) => {
    const letters = set.map(letterById);
    const target = letters[Math.floor(rand() * letters.length)];
    const others = letters.filter((l) => l.id !== target.id).map((l) => l.name);
    return {
      promptKey: 'learn.quiz.nameOfLetter',
      display: target.arabic,
      displayArabic: true,
      optionsArabic: false,
      tts: target.arabicName,
      ...withOptions(target.name, others, rand),
    };
  });
  return shuffle(questions, rand);
}

const FORM_KINDS = [
  { key: 'learn.quiz.formInitial', fn: initialForm },
  { key: 'learn.quiz.formMedial', fn: medialForm },
  { key: 'learn.quiz.formFinal', fn: finalForm },
] as const;

function formQuestions(letters: ArabicLetter[], rand: Rand): QuizQuestion[] {
  const questions = letters.map((letter, i) => {
    const kind = FORM_KINDS[i % FORM_KINDS.length];
    const correct = kind.fn(letter);
    // Verwechselbare Geschwister zuerst, dann Rest aus der Lektion —
    // die Positionsform eines völlig anders aussehenden Buchstabens
    // wäre per Ausschluss sofort erkennbar.
    const siblings = similarSiblings(letter).filter((l) => kind.fn(l) !== correct);
    const distractorLetters = [
      ...shuffle(siblings, rand),
      ...pickDistractors(
        letters.filter((l) => kind.fn(l) !== correct && !siblings.includes(l)),
        letter,
        3 - siblings.length,
        rand,
      ),
    ].slice(0, 3);
    return {
      promptKey: kind.key,
      display: letter.arabic,
      displayArabic: true,
      optionsArabic: true,
      ...withOptions(correct, distractorLetters.map(kind.fn), rand),
    };
  });
  return shuffle(questions, rand);
}

function harakaQuestions(haraka: 'fatha' | 'kasra' | 'damma', rand: Rand): QuizQuestion[] {
  // Lesbare Silben mit gut unterscheidbaren Konsonanten
  const ids = ['ba', 'ta', 'jim', 'dal', 'ra', 'sin', 'fa', 'lam', 'mim', 'nun'];
  const letters = shuffle(ids.map(letterById), rand).slice(0, 8);
  const questions = letters.map((letter) => {
    const correct = syllableTranslit(letter, haraka);
    // Distraktoren: gleiche Silbe mit anderen Vokalen + andere Konsonanten
    const otherVowels = (['fatha', 'kasra', 'damma'] as const)
      .filter((h) => h !== haraka)
      .map((h) => syllableTranslit(letter, h));
    const otherConsonant = syllableTranslit(
      pickDistractors(letters, letter, 1, rand)[0] ?? letterById('kaf'),
      haraka,
    );
    return {
      promptKey: 'learn.quiz.readSyllable',
      display: syllable(letter, haraka),
      displayArabic: true,
      optionsArabic: false,
      tts: syllable(letter, haraka),
      ...withOptions(correct, [...otherVowels, otherConsonant].slice(0, 3), rand),
    };
  });
  return shuffle(questions, rand);
}

/**
 * Bevorzugte Übungsart (Setting) für Wort-/Vers-Fragen: "reading" zeigt das
 * Schriftbild (das Wort selbst dient als Lese-Aufgabe), "audio" versteckt es
 * hinter 🔊 (reine Hör-Aufgabe, Ton läuft trotzdem automatisch - siehe
 * LessonPlayer) - "mixed" (Default) stellt beide Varianten, analog zum
 * bestehenden Muster in letterQuestions (glyphOfLetter vs. soundOfLetter).
 * Es gibt keinen eigenen i18n-Prompt für die Hör-Variante (promptKey bleibt
 * gleich) - Locale-Dateien liegen außerhalb des Änderungsbereichs dieses Fixes.
 */
function wordQuestions(
  words: (WordItem & { globalAyah?: number })[],
  promptKey: string,
  rand: Rand,
  style: ExerciseStyle = 'mixed',
): QuizQuestion[] {
  const translitPool = words.map((w) => w.translit);
  const questions: QuizQuestion[] = [];
  for (const word of words) {
    const build = (hidden: boolean): QuizQuestion => ({
      promptKey,
      display: hidden ? '🔊' : word.arabic,
      displayArabic: !hidden,
      optionsArabic: false,
      requiresAudio: hidden,
      // Lese-Lektionen bekommen echte Rezitation, alles andere Geräte-TTS.
      ...(word.globalAyah ? { audioUrl: recitationUrl(word.globalAyah) } : { tts: word.arabic }),
      ...withOptions(
        word.translit,
        pickSimilarDistractors(translitPool, word.translit, Math.min(3, translitPool.length - 1), rand),
        rand,
      ),
    });
    if (style !== 'audio') questions.push(build(false));
    if (style !== 'reading') questions.push(build(true));
    if (style === 'audio') questions.push(build(true));
  }
  return shuffle(questions, rand);
}

function vocabQuestions(
  words: VocabWordItem[],
  locale: Locale,
  rand: Rand,
  style: ExerciseStyle = 'mixed',
): QuizQuestion[] {
  const meaningPool = words.map((w) => localizedText(w.meaning, locale));
  const questions: QuizQuestion[] = [];
  for (const word of words) {
    const meaning = localizedText(word.meaning, locale);
    const build = (hidden: boolean): QuizQuestion => ({
      promptKey: 'learn.quiz.meaningOfWord',
      display: hidden ? '🔊' : word.arabic,
      displayArabic: !hidden,
      optionsArabic: false,
      requiresAudio: hidden,
      tts: word.arabic,
      contentFallback: isLocalizedFallback(word.meaning, locale),
      ...withOptions(meaning, pickSimilarDistractors(meaningPool, meaning, Math.min(3, meaningPool.length - 1), rand), rand),
    });
    if (style !== 'audio') questions.push(build(false));
    if (style !== 'reading') questions.push(build(true));
    if (style === 'audio') questions.push(build(true));
  }
  return shuffle(questions, rand);
}

export function buildQuiz(
  lesson: Lesson,
  rand: Rand = Math.random,
  locale: Locale = 'de',
  style: ExerciseStyle = 'mixed',
): QuizQuestion[] {
  switch (lesson.kind) {
    case 'letters':
      return letterQuestions((lesson.letterIds ?? []).map(letterById), rand, style);
    case 'similar':
      return similarQuestions(rand);
    case 'forms':
      return formQuestions((lesson.letterIds ?? []).map(letterById), rand);
    case 'haraka':
      return harakaQuestions(lesson.haraka ?? 'fatha', rand);
    case 'concept':
      return wordQuestions(lesson.conceptQuiz ?? [], 'learn.quiz.readWord', rand, style);
    case 'words':
      return wordQuestions(lesson.words ?? [], 'learn.quiz.readWord', rand, style);
    case 'reading':
      return wordQuestions(lesson.reading ?? [], 'learn.quiz.readAyah', rand, style);
    case 'vocab':
      return vocabQuestions(lesson.vocabWords ?? [], locale, rand, style);
    case 'wordbyword':
      return vocabQuestions(
        (lesson.wordByWordLines ?? []).flatMap((line) => line.tokens),
        locale,
        rand,
        style,
      );
    case 'story':
      // exerciseStyle bleibt hier ohne Effekt: StoryQuizItem (curriculum.ts)
      // trägt weder arabic noch audioUrl/tts - es gibt keine bestehende
      // Hör-Variante dieser Fragen, die "audio" bevorzugen könnte (Fix
      // Punkt 4 der Studien-Kurs-Audits: madinah/vocab-lastige Kurse sind
      // hier priorisiert, story-Kurse bleiben bewusst unverändert).
      return shuffle(
        (lesson.storyQuiz ?? []).map((item) => ({
          promptKey: '',
          promptText: localizedText(item.q, locale),
          display: '',
          displayArabic: false,
          optionsArabic: locale === 'ar',
          contentFallback:
            isLocalizedFallback(item.q, locale) || item.options.some((o) => isLocalizedFallback(o, locale)),
          ...withOptions(
            localizedText(item.options[0], locale),
            item.options.slice(1).map((o) => localizedText(o, locale)),
            rand,
          ),
        })),
        rand,
      );
  }
}
