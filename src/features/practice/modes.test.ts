import type { Locale } from '@/lib/locale-detect';
import { PRACTICE_MODES, QUESTIONS_PER_RUN, buildPracticeQuiz } from './modes';
import { recordRun, parsePracticeStats, type PracticeStats } from './stats';

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const LOCALES: Locale[] = ['de', 'en', 'tr', 'ar', 'es', 'fr'];

describe('buildPracticeQuiz', () => {
  it('liefert für jeden Modus und jede Sprache gültige Fragen', () => {
    for (const mode of PRACTICE_MODES) {
      for (const locale of LOCALES) {
        const questions = buildPracticeQuiz(mode.id, locale, seededRand(11));
        expect(questions.length).toBeGreaterThanOrEqual(3);
        expect(questions.length).toBeLessThanOrEqual(QUESTIONS_PER_RUN);
        for (const q of questions) {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(q.options.length);
          expect(new Set(q.options).size).toBe(q.options.length);
          // Frage muss darstellbar sein: entweder lokalisierter Text oder i18n-Key
          expect(q.promptText || q.promptKey).toBeTruthy();
        }
      }
    }
  });

  it('Trivia-Fragen sind lokalisiert (promptText gesetzt)', () => {
    for (const locale of LOCALES) {
      for (const q of buildPracticeQuiz('knowledge', locale, seededRand(5))) {
        expect(q.promptText).toBeTruthy();
        expect(q.options.every((o) => o.length > 0)).toBe(true);
      }
    }
  });

  it('Verbindungs-Quiz: Ja/Nein-Antworten stimmen mit connects überein', () => {
    const questions = buildPracticeQuiz('connections', 'de', seededRand(9));
    const yesNo = questions.filter((q) => q.promptKey === 'practice.quiz.connectsLeft');
    expect(yesNo.length).toBeGreaterThan(0);
    for (const q of yesNo) {
      expect(['Ja', 'Nein']).toContain(q.options[q.correctIndex]);
    }
  });
});

// exerciseStyle 'reading' ("kann/will gerade nicht hören") darf keine Frage
// automatisch Ton abspielen lassen - hier ist tts nirgends requiresAudio
// (die Antwort steht immer sichtbar in display), sondern nur eine optionale
// Vorlese-HILFE, die deshalb in 'reading' unterdrückt wird (Audit 2026-07-20).
describe('buildPracticeQuiz: bevorzugte Übungsart (exerciseStyle)', () => {
  const MODES_WITH_TTS_HINT = ['letters', 'forms', 'connections', 'harakat', 'words', 'rules'] as const;

  it("reading: keine Frage trägt ein tts-Feld (kein Auto-Audio in Stille-Umgebung)", () => {
    for (const mode of MODES_WITH_TTS_HINT) {
      const questions = buildPracticeQuiz(mode, 'de', seededRand(3), 'reading');
      for (const q of questions) {
        expect(q.tts).toBeUndefined();
      }
    }
  });

  it('mixed (Default) und audio: mindestens eine Frage trägt eine tts-Vorlese-Hilfe', () => {
    for (const style of ['mixed', 'audio'] as const) {
      for (const mode of MODES_WITH_TTS_HINT) {
        const questions = buildPracticeQuiz(mode, 'de', seededRand(3), style);
        expect(questions.some((q) => q.tts)).toBe(true);
      }
    }
  });

  it("nameOfLetter behält auch bei style 'reading' keine Antwort-Optionen-Änderung (Frageninhalt bleibt gleich)", () => {
    const reading = buildPracticeQuiz('letters', 'de', seededRand(11), 'reading');
    const mixed = buildPracticeQuiz('letters', 'de', seededRand(11), 'mixed');
    expect(reading).toHaveLength(mixed.length);
    expect(reading.map((q) => q.promptKey)).toEqual(mixed.map((q) => q.promptKey));
  });

  it('mix-Modus unterdrückt tts ebenfalls bei reading', () => {
    const questions = buildPracticeQuiz('mix', 'de', seededRand(4), 'reading');
    for (const q of questions) {
      expect(q.tts).toBeUndefined();
    }
  });
});

describe('practice stats', () => {
  it('recordRun zählt plays und behält beste Quote', () => {
    let stats: PracticeStats = {};
    stats = recordRun(stats, 'letters', 8, 10, 1);
    stats = recordRun(stats, 'letters', 4, 10, 2);
    expect(stats.letters).toEqual({ bestScore: 8, bestTotal: 10, plays: 2, lastPlayedAt: 2 });
    stats = recordRun(stats, 'letters', 10, 10, 3);
    expect(stats.letters?.bestScore).toBe(10);
    expect(stats.letters?.plays).toBe(3);
  });

  it('parsePracticeStats ist defensiv', () => {
    expect(parsePracticeStats(null)).toEqual({});
    expect(parsePracticeStats('kaputt')).toEqual({});
  });
});
