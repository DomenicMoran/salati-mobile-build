// Lernphase: erzeugt aus einer Lektion die Lehr-Karten, die vor dem Quiz
// durchgeblättert werden.

import { recitationUrl } from './audio';
import { isLocalizedFallback, localizedText, SIMILAR_SETS, type Lesson } from './curriculum';
import letterExamples from './data/letter-examples.json';
import {
  finalForm,
  initialForm,
  letterById,
  medialForm,
  syllable,
  syllableTranslit,
  wordToIsolatedForms,
} from './letters';
import type { Locale } from '@/lib/locale-detect';

const LETTER_EXAMPLE_BY_ID = new Map(letterExamples.map((e) => [e.letterId, e]));

export interface LessonCard {
  arabic: string;
  label: string;
  sublabel?: string;
  /** i18n-Key mit Erklärung (learn.concepts.*) */
  textKey?: string;
  /** Bereits lokalisierter Fließtext (Story-Lektionen) — hat Vorrang vor textKey */
  text?: string;
  /** Arabischer Text für Geräte-TTS (Buchstabenname/Silbe/Wort) */
  tts?: string;
  /** MP3 mit echter Rezitation (Lese-Lektionen) */
  audioUrl?: string;
  /** Wort in isolierten Buchstabenformen (statt verbunden) — Einprägen der Einzelbuchstaben */
  isolated?: string;
  /**
   * true = der angezeigte Text (label/text) ist NICHT in der aktuellen
   * App-Sprache vorhanden und stammt aus der Englisch/Deutsch-Fallback-Kette
   * (`isLocalizedFallback`) — LessonPlayer zeigt dann `learn.contentFallbackNotice`.
   */
  contentFallback?: boolean;
}

const HARAKA_TEXT_KEYS = {
  fatha: 'learn.concepts.fatha',
  kasra: 'learn.concepts.kasra',
  damma: 'learn.concepts.damma',
} as const;

export function buildCards(lesson: Lesson, locale: Locale = 'de'): LessonCard[] {
  switch (lesson.kind) {
    case 'letters':
      return (lesson.letterIds ?? []).map(letterById).map((l) => {
        const example = LETTER_EXAMPLE_BY_ID.get(l.id);
        return {
          arabic: l.arabic,
          label: l.name,
          sublabel: example
            ? `${l.translit} · ${example.arabic} (${localizedText(example.meaning, locale)})`
            : l.translit,
          tts: l.arabicName,
        };
      });
    case 'similar':
      return SIMILAR_SETS.map((set) => {
        const letters = set.map(letterById);
        return {
          arabic: letters.map((l) => l.arabic).join('  '),
          label: letters.map((l) => l.name).join(' · '),
          sublabel: letters.map((l) => l.translit).join(' · '),
          textKey: 'learn.concepts.similar',
          tts: letters.map((l) => l.arabicName).join('، '),
        };
      });
    case 'forms':
      return (lesson.letterIds ?? []).map(letterById).map((l) => ({
        // Reihenfolge (RTL gelesen): isoliert، Anfang، Mitte، Ende
        arabic: `${l.arabic}  ${initialForm(l)}  ${medialForm(l)}  ${finalForm(l)}`,
        label: l.name,
        sublabel: l.translit,
        textKey: l.connects ? 'learn.concepts.forms' : 'learn.concepts.nonConnector',
        tts: l.arabicName,
      }));
    case 'haraka': {
      const haraka = lesson.haraka ?? 'fatha';
      const intro: LessonCard = {
        arabic: syllable(letterById('ba'), haraka),
        label: syllableTranslit(letterById('ba'), haraka),
        textKey: HARAKA_TEXT_KEYS[haraka],
        tts: syllable(letterById('ba'), haraka),
      };
      const examples = ['ta', 'jim', 'sin', 'lam', 'nun'].map(letterById).map((l) => ({
        arabic: syllable(l, haraka),
        label: syllableTranslit(l, haraka),
        tts: syllable(l, haraka),
      }));
      return [intro, ...examples];
    }
    case 'concept':
      return [
        ...(lesson.conceptCards ?? []).map((c) => ({ ...c, tts: c.arabic })),
        ...(lesson.conceptQuiz ?? []).map((w) => ({ arabic: w.arabic, label: w.translit, tts: w.arabic })),
      ];
    case 'words':
      return (lesson.words ?? []).map((w) => ({
        arabic: w.arabic,
        label: w.translit,
        tts: w.arabic,
        isolated: wordToIsolatedForms(w.arabic),
      }));
    case 'vocab':
      return (lesson.vocabWords ?? []).map((w) => ({
        arabic: w.arabic,
        label: localizedText(w.meaning, locale),
        sublabel: w.translit,
        tts: w.arabic,
        isolated: wordToIsolatedForms(w.arabic),
        contentFallback: isLocalizedFallback(w.meaning, locale),
      }));
    case 'wordbyword':
      return (lesson.wordByWordLines ?? []).flatMap((line) => [
        ...line.tokens.map((tok) => ({
          arabic: tok.arabic,
          label: localizedText(tok.meaning, locale),
          sublabel: tok.translit,
          tts: tok.arabic,
          contentFallback: isLocalizedFallback(tok.meaning, locale),
        })),
        {
          arabic: line.arabic,
          label: line.translit,
          textKey: 'learn.concepts.wordByWordRecap',
          ...(line.globalAyah ? { audioUrl: recitationUrl(line.globalAyah) } : { tts: line.arabic }),
        },
      ]);
    case 'reading':
      return (lesson.reading ?? []).map((r) => ({
        arabic: r.arabic,
        label: r.translit,
        audioUrl: recitationUrl(r.globalAyah),
      }));
    case 'story':
      return (lesson.story ?? []).map((s) => ({
        arabic: s.arabic ?? '',
        label: localizedText(s.title, locale),
        text: localizedText(s.text, locale),
        contentFallback: isLocalizedFallback(s.title, locale) || isLocalizedFallback(s.text, locale),
        // Echte Rezitation, wenn ein Vers referenziert ist — sonst Geräte-TTS.
        ...(s.globalAyah
          ? { audioUrl: recitationUrl(s.globalAyah) }
          : s.arabic
            ? { tts: s.arabic }
            : {}),
      }));
  }
}
