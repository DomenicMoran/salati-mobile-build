import { buildCards } from './cards';
import { LESSONS, lessonById } from './curriculum';
import { LETTERS, finalForm, initialForm, letterById, medialForm, syllableTranslit } from './letters';
import { buildQuiz, pickSimilarDistractors, readWordQuestion, shuffle, similarityScore } from './quiz';

// Deterministischer LCG statt Math.random — macht Quiz-Generierung testbar.
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Alphabet-Daten', () => {
  it('enthält genau 28 Buchstaben in 7 Gruppen', () => {
    expect(LETTERS).toHaveLength(28);
    for (let g = 0; g < 7; g++) {
      expect(LETTERS.filter((l) => l.group === g)).toHaveLength(4);
    }
  });

  it('IDs sind eindeutig', () => {
    expect(new Set(LETTERS.map((l) => l.id)).size).toBe(28);
  });

  it('genau die 6 Nicht-Verbinder haben connects=false', () => {
    const nonConnectors = LETTERS.filter((l) => !l.connects).map((l) => l.id);
    expect(nonConnectors.sort()).toEqual(['alif', 'dal', 'dhal', 'ra', 'waw', 'zay'].sort());
  });

  it('Positionsformen nutzen ZWJ für Verbinder', () => {
    const ba = letterById('ba');
    expect(initialForm(ba)).toBe('ب‍');
    expect(medialForm(ba)).toBe('‍ب‍');
    expect(finalForm(ba)).toBe('‍ب');
    const alif = letterById('alif');
    expect(initialForm(alif)).toBe('ا');
  });

  it('Silben-Transliteration kombiniert Konsonant + Vokal', () => {
    expect(syllableTranslit(letterById('ba'), 'fatha')).toBe('ba');
    expect(syllableTranslit(letterById('mim'), 'kasra')).toBe('mi');
    expect(syllableTranslit(letterById('nun'), 'damma')).toBe('nu');
  });
});

describe('shuffle', () => {
  it('behält alle Elemente', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr, seededRand(1));
    expect([...result].sort()).toEqual(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]); // Original unverändert
  });
});

describe('buildQuiz', () => {
  it('erzeugt für jede Lektion mindestens 3 Fragen mit gültiger Struktur', () => {
    for (const lesson of LESSONS) {
      const questions = buildQuiz(lesson, seededRand(42));
      expect(questions.length).toBeGreaterThanOrEqual(3);
      for (const q of questions) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length); // keine doppelten Optionen
        expect(q.promptKey.startsWith('learn.quiz.')).toBe(true);
      }
    }
  });

  it('Buchstaben-Lektion fragt Name, Glyph und Laut ab', () => {
    const lesson = lessonById('letters-1')!;
    const questions = buildQuiz(lesson, seededRand(7));
    expect(questions).toHaveLength(12);
    expect(questions.filter((q) => q.promptKey === 'learn.quiz.nameOfLetter')).toHaveLength(4);
    expect(questions.filter((q) => q.promptKey === 'learn.quiz.glyphOfLetter')).toHaveLength(4);
    const sound = questions.filter((q) => q.promptKey === 'learn.quiz.soundOfLetter');
    expect(sound).toHaveLength(4);
    // Laut-Fragen: kein sichtbares Zeichen (nur Audio-Symbol), arabische Optionen
    for (const q of sound) {
      expect(q.display).toBe('🔊');
      expect(q.tts).toBeTruthy();
      expect(q.optionsArabic).toBe(true);
    }
  });

  it('korrekte Antwort steht in den Optionen', () => {
    const lesson = lessonById('words-1')!;
    for (const q of buildQuiz(lesson, seededRand(3))) {
      expect(q.options[q.correctIndex]).toBeTruthy();
    }
  });
});

// readWordQuestion: baut aus einem Arabisch/Umschrift-Paar (Matching-Paar,
// Hör-Aufgabe, …) eine Multiple-Choice-Frage für die Fehler-Wiederholung
// (features/practice/mistakes), die nur QuizQuestion kennt.
describe('readWordQuestion', () => {
  const pool = ['kitab', 'qalam', 'bayt', 'shams', 'qamar'];

  it('zeigt das arabische Wort und die richtige Umschrift ist unter den Optionen', () => {
    const q = readWordQuestion({ arabic: 'كتاب', translit: 'kitab' }, pool, seededRand(1));
    expect(q.display).toBe('كتاب');
    expect(q.displayArabic).toBe(true);
    expect(q.optionsArabic).toBe(false);
    expect(q.promptKey).toBe('learn.quiz.readWord');
    expect(q.options[q.correctIndex]).toBe('kitab');
  });

  it('keine doppelten Optionen, Distraktoren stammen aus dem Pool', () => {
    const q = readWordQuestion({ arabic: 'قلم', translit: 'qalam' }, pool, seededRand(2));
    expect(new Set(q.options).size).toBe(q.options.length);
    for (const o of q.options) expect(pool).toContain(o);
  });

  it('funktioniert auch mit einem sehr kleinen Pool (kein Crash bei zu wenig Distraktoren)', () => {
    const q = readWordQuestion({ arabic: 'بيت', translit: 'bayt' }, ['bayt'], seededRand(3));
    expect(q.options).toEqual(['bayt']);
    expect(q.correctIndex).toBe(0);
  });
});

describe('ähnlichkeitsbasierte Distraktoren', () => {
  it('similarityScore: gemeinsamer Anfang/Ende schlägt völlig fremde Wörter', () => {
    expect(similarityScore('rahma', 'rahim')).toBeGreaterThan(similarityScore('rahma', 'xyz'));
    expect(similarityScore('kitab', 'kitabun')).toBeGreaterThan(similarityScore('kitab', 'nur'));
  });

  it('pickSimilarDistractors bevorzugt ähnlich aussehende Antworten', () => {
    // rand konstant 0 -> reine Ähnlichkeitsreihenfolge, deterministisch
    const pool = ['badr', 'umar', 'zayd', 'bakrun', 'nuh'];
    const picked = pickSimilarDistractors(pool, 'bakr', 3, () => 0);
    expect(picked).toContain('badr'); // gleicher Anfang b-a + Ende r ist am ähnlichsten
    expect(picked).not.toContain('bakr'); // korrekte Antwort nie als Distraktor
    expect(picked).toHaveLength(3);
  });

  it('Glyph-Fragen nutzen verwechselbare Geschwister als Distraktoren', () => {
    // ba/ta/tha teilen das Grundskelett (SIMILAR_SETS) — bei einer Lektion,
    // die alle drei enthält, müssen die Geschwister in den Optionen stehen.
    const lesson = { id: 'test', kind: 'letters', letterIds: ['ba', 'ta', 'tha', 'jim', 'dal', 'ra'] } as never;
    const questions = buildQuiz(lesson, seededRand(7));
    const glyphQ = questions.find(
      (q) => q.promptKey === 'learn.quiz.glyphOfLetter' && q.display === letterById('ba').name,
    );
    expect(glyphQ).toBeDefined();
    expect(glyphQ!.options).toContain(letterById('ta').arabic);
    expect(glyphQ!.options).toContain(letterById('tha').arabic);
  });
});

describe('bevorzugte Übungsart (exerciseStyle)', () => {
  const lesson = { id: 'test', kind: 'letters', letterIds: ['ba', 'ta', 'jim'] } as never;

  it('audio: ersetzt Lese-Fragen durch zusätzliche Hör-Fragen', () => {
    const qs = buildQuiz(lesson, seededRand(5), 'de', 'audio');
    expect(qs.some((q) => q.promptKey === 'learn.quiz.glyphOfLetter')).toBe(false);
    expect(qs.filter((q) => q.promptKey === 'learn.quiz.soundOfLetter')).toHaveLength(6);
  });

  it('reading: lässt Hör-Fragen weg', () => {
    const qs = buildQuiz(lesson, seededRand(5), 'de', 'reading');
    expect(qs.some((q) => q.promptKey === 'learn.quiz.soundOfLetter')).toBe(false);
    expect(qs.some((q) => q.promptKey === 'learn.quiz.glyphOfLetter')).toBe(true);
  });

  it('mixed (Default): enthält beide Fragetypen', () => {
    const qs = buildQuiz(lesson, seededRand(5));
    expect(qs.some((q) => q.promptKey === 'learn.quiz.soundOfLetter')).toBe(true);
    expect(qs.some((q) => q.promptKey === 'learn.quiz.glyphOfLetter')).toBe(true);
  });

  // Regression: Schriftbild-Fragen (nameOfLetter/glyphOfLetter) dürfen kein
  // Auto-Audio tragen, sonst verrät der LessonPlayer-Autoplay-Effekt die
  // Antwort per Gehör, bevor die Glyphe überhaupt gelesen werden muss
  // (User-Fund). Nur die explizite Hör-Variante (soundOfLetter, bzw.
  // nameOfLetter im reinen audio-Modus) darf tts tragen.
  it('reading/mixed: nameOfLetter und glyphOfLetter haben kein tts (kein Auto-Audio-Verrat)', () => {
    for (const style of ['reading', 'mixed'] as const) {
      const qs = buildQuiz(lesson, seededRand(5), 'de', style);
      const nameQs = qs.filter((q) => q.promptKey === 'learn.quiz.nameOfLetter');
      const glyphQs = qs.filter((q) => q.promptKey === 'learn.quiz.glyphOfLetter');
      expect(nameQs.length).toBeGreaterThan(0);
      for (const q of nameQs) expect(q.tts).toBeUndefined();
      for (const q of glyphQs) expect(q.tts).toBeUndefined();
    }
  });

  it('audio: nameOfLetter darf tts tragen (explizite Hör-Variante)', () => {
    const qs = buildQuiz(lesson, seededRand(5), 'de', 'audio');
    const nameQs = qs.filter((q) => q.promptKey === 'learn.quiz.nameOfLetter');
    expect(nameQs.length).toBeGreaterThan(0);
    for (const q of nameQs) expect(q.tts).toBeTruthy();
  });
});

describe('buildCards', () => {
  it('jede Lektion hat Lehr-Karten mit arabischem Inhalt', () => {
    for (const lesson of LESSONS) {
      const cards = buildCards(lesson);
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.arabic.length).toBeGreaterThan(0);
        expect(card.label.length).toBeGreaterThan(0);
      }
    }
  });
});
