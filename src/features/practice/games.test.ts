import { buildMatchingRun, matchingMistakeQuestion, MATCHING_PAIRS_PER_ROUND, MATCHING_ROUNDS } from './matching';
import {
  buildListeningRun,
  fatihaWordAudioUrl,
  isListeningCorrect,
  listeningMistakeQuestion,
  normalizeAnswer,
} from './listening';
import { buildPuzzleRun, PUZZLE_PHRASES, PUZZLE_ROUNDS } from './puzzle';

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const LOCALES = ['de', 'en', 'tr', 'ar', 'es', 'fr'] as const;

describe('buildPuzzleRun', () => {
  it('liefert 5 Runden mit vollständig gemischten Wort-Indizes', () => {
    const rounds = buildPuzzleRun();
    expect(rounds).toHaveLength(PUZZLE_ROUNDS);
    for (const round of rounds) {
      // shuffled ist eine Permutation aller Wort-Indizes
      expect([...round.shuffled].sort((a, b) => a - b)).toEqual(
        round.phrase.words.map((_, i) => i),
      );
      // und nie schon die Lösung (sonst wäre die Runde trivial)
      expect(round.shuffled.some((v, i) => v !== i)).toBe(true);
    }
  });

  it('alle Sätze haben Bedeutungen in allen 6 Sprachen und ≥2 Wörter', () => {
    // ≥2 statt ≥3: manche vollständigen Kurzsuren-Verse (z. B. An-Nas 114:2
    // "مَلِكِ ٱلنَّاسِ") bestehen im Uthmani-Text nur aus 2 Wörtern — kürzer
    // geht die exakte Vers-für-Vers-Zerlegung nicht, ohne Wörter zu erfinden.
    for (const phrase of PUZZLE_PHRASES) {
      expect(phrase.words.length).toBeGreaterThanOrEqual(2);
      for (const locale of LOCALES) {
        expect(phrase.meaning[locale]).toBeTruthy();
      }
    }
  });

  it('IDs sind eindeutig', () => {
    const ids = PUZZLE_PHRASES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildMatchingRun', () => {
  it('liefert 3 Runden à 5 eindeutige Paare', () => {
    const rounds = buildMatchingRun();
    expect(rounds).toHaveLength(MATCHING_ROUNDS);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round.pairs).toHaveLength(MATCHING_PAIRS_PER_ROUND);
      for (const pair of round.pairs) {
        // Kein Wort/keine Umschrift doppelt über den ganzen Lauf (wäre mehrdeutig)
        expect(seen.has(pair.arabic)).toBe(false);
        expect(seen.has(pair.translit)).toBe(false);
        seen.add(pair.arabic);
        seen.add(pair.translit);
      }
      // rightOrder ist eine Permutation der Paar-Indizes
      expect([...round.rightOrder].sort((a, b) => a - b)).toEqual(
        round.pairs.map((_, i) => i),
      );
    }
  });
});

describe('Hören-tippen (listening)', () => {
  it('normalisiert Längungszeichen und Sonderzeichen', () => {
    expect(normalizeAnswer('kitāb')).toBe('kitab');
    expect(normalizeAnswer("ʿIlm")).toBe('ilm');
    expect(normalizeAnswer('as-salam')).toBe('assalam');
  });

  it('akzeptiert Antworten unabhängig von Diakritika', () => {
    expect(isListeningCorrect('kitab', 'kitāb')).toBe(true);
    expect(isListeningCorrect('KITAB', 'kitāb')).toBe(true);
    expect(isListeningCorrect('kitib', 'kitāb')).toBe(false);
    expect(isListeningCorrect('', 'kitāb')).toBe(false);
  });

  it('liefert 10 Aufgaben mit Arabisch + Umschrift', () => {
    const run = buildListeningRun();
    expect(run).toHaveLength(10);
    for (const item of run) {
      expect(item.arabic.length).toBeGreaterThan(0);
      expect(item.translit.length).toBeGreaterThan(0);
    }
  });

  it('baut die quran.com-Wort-Audio-URL 3-stellig gepolstert für Sure 1', () => {
    expect(fatihaWordAudioUrl(1, 1)).toBe('https://audio.qurancdn.com/wbw/001_001_001.mp3');
    expect(fatihaWordAudioUrl(7, 9)).toBe('https://audio.qurancdn.com/wbw/001_007_009.mp3');
  });

  it('erste 5 Silben-Runden bleiben ohne echtes Audio (TTS), da Silben nie eigenständige Koranwörter sind', () => {
    const run = buildListeningRun();
    for (const item of run.slice(0, 5)) {
      expect(item.audioUrl).toBeUndefined();
    }
  });

  it('die 5 Wort-Runden bekommen echtes Fatiha-Rezitations-Audio, solange der Pool reicht', () => {
    const run = buildListeningRun();
    for (const item of run.slice(5)) {
      expect(item.audioUrl).toMatch(/^https:\/\/audio\.qurancdn\.com\/wbw\/001_\d{3}_\d{3}\.mp3$/);
    }
  });

  it('ist mit injiziertem Zufall deterministisch (gleicher Seed -> gleicher Lauf)', () => {
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const a = buildListeningRun(rand);
    seed = 1;
    const b = buildListeningRun(rand);
    expect(a).toEqual(b);
  });
});

// Quiz→Review-Brücke: falsch beantwortete matching-/Hör-Aufgaben werden als
// Multiple-Choice-Frage für die Fehler-Wiederholung (quiz/mistakes.tsx) gebaut.
describe('Fehler-Wiederholung aus Matching und Hören', () => {
  it('matchingMistakeQuestion: richtige Umschrift steht in den Optionen, Rest aus der Runde', () => {
    const round = buildMatchingRun(seededRand(4))[0];
    const missed = round.pairs[2];
    const q = matchingMistakeQuestion(missed, round.pairs, seededRand(9));
    expect(q.display).toBe(missed.arabic);
    expect(q.options[q.correctIndex]).toBe(missed.translit);
    expect(new Set(q.options).size).toBe(q.options.length);
  });

  it('listeningMistakeQuestion: richtige Umschrift steht in den Optionen, Rest aus dem Lauf', () => {
    const run = buildListeningRun(seededRand(6));
    const missed = run[3];
    const q = listeningMistakeQuestion(missed, run, seededRand(2));
    expect(q.display).toBe(missed.arabic);
    expect(q.options[q.correctIndex]).toBe(missed.translit);
    expect(new Set(q.options).size).toBe(q.options.length);
  });
});
