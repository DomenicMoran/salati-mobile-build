import { encodeBase64 } from '../sync/base64';
import {
  InvalidDuelCodeError,
  buildDuelChallenge,
  buildDuelQuestions,
  decodeDuelChallenge,
  encodeDuelChallenge,
  seededRand,
} from './asyncDuel';
import { QUESTIONS_PER_RUN } from './modes';

describe('seededRand', () => {
  it('liefert bei gleichem Seed exakt dieselbe Zahlenfolge', () => {
    const a = seededRand(42);
    const b = seededRand(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('liefert bei unterschiedlichem Seed eine andere Folge', () => {
    const a = seededRand(1);
    const b = seededRand(2);
    expect(a()).not.toBe(b());
  });

  it('bleibt im Bereich [0, 1)', () => {
    const rand = seededRand(7);
    for (let i = 0; i < 50; i++) {
      const n = rand();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('buildDuelQuestions', () => {
  it('liefert bei gleichem Seed + gleicher Sprache dasselbe Fragen-Set (Determinismus fürs faire Duell)', () => {
    const a = buildDuelQuestions(1234, 'de');
    const b = buildDuelQuestions(1234, 'de');
    expect(a).toEqual(b);
    expect(a).toHaveLength(QUESTIONS_PER_RUN);
  });

  it('liefert bei unterschiedlichem Seed ein anderes Fragen-Set', () => {
    const a = buildDuelQuestions(1, 'de');
    const b = buildDuelQuestions(2, 'de');
    expect(a).not.toEqual(b);
  });
});

describe('encodeDuelChallenge / decodeDuelChallenge', () => {
  it('round-trippt einen Duell-Code', () => {
    const challenge = buildDuelChallenge(999, 7, 10);
    const code = encodeDuelChallenge(challenge);
    expect(decodeDuelChallenge(code)).toEqual(challenge);
  });

  it('wirft InvalidDuelCodeError für Kauderwelsch', () => {
    expect(() => decodeDuelChallenge('offensichtlich kein code!!')).toThrow(InvalidDuelCodeError);
  });

  it('wirft InvalidDuelCodeError für validen Base64-Text, der kein Duell-Payload ist', () => {
    const unrelated = encodeDuelChallenge(buildDuelChallenge(1, 0, 10));
    const tampered = unrelated.slice(0, -4);
    expect(() => decodeDuelChallenge(tampered)).toThrow(InvalidDuelCodeError);
  });

  it('wirft InvalidDuelCodeError bei falscher/fehlender Version', () => {
    const code = encodeBase64(JSON.stringify({ v: 2, seed: 1, score: 1, total: 10 }));
    expect(() => decodeDuelChallenge(code)).toThrow(InvalidDuelCodeError);
  });

  it('trimmt umgebende Leerzeichen aus einem eingefügten Code', () => {
    const challenge = buildDuelChallenge(5, 3, 10);
    const code = `  ${encodeDuelChallenge(challenge)}\n`;
    expect(decodeDuelChallenge(code)).toEqual(challenge);
  });
});
