// Asynchrones Duell per Sync-Code — bewusst KEIN Echtzeit-Multiplayer: das
// bräuchte einen Relay-Server, den es im server-losen Architekturprinzip der
// App nicht gibt (siehe Kommentar in features/sync/codeSync.ts). Stattdessen
// wie asynchrones Schach per Zug-Austausch: Spieler A spielt eine Runde und
// exportiert Fragen-Seed + Score als kompakten Code (derselbe Base64-
// Mechanismus wie beim Fortschritts-Sync, siehe features/sync/base64.ts —
// eigener kleiner Payload statt der großen SYNC_STORAGE_KEYS-Liste). Diesen
// Code schickt Spieler A selbst über einen beliebigen Kanal (Chat/Mail) an
// Spieler B. B importiert den Code und bekommt DASSELBE Fragen-Set vorgelegt
// (deterministisch aus dem Seed erzeugt, damit es fair ist — beide Geräte
// sehen exakt dieselben 10 Fragen, nur in ihrer jeweils eigenen App-Sprache),
// spielt seine Runde und sieht danach den Vergleich beider Scores.

import { decodeBase64, encodeBase64 } from '../sync/base64';
import { buildPracticeQuiz } from './modes';
import type { Locale } from '@/lib/locale-detect';
import type { QuizQuestion, Rand } from '../learn/quiz';

/**
 * Deterministischer Pseudozufallsgenerator (mulberry32) aus einem 32-Bit-Seed.
 * Math.random() ist nicht reproduzierbar — für ein faires Duell müssen aber
 * beide Geräte aus demselben Seed exakt dieselbe Fragenfolge erzeugen.
 */
export function seededRand(seed: number): Rand {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zufälliger 32-Bit-Seed für ein NEUES Duell — nur beim Erstellen zufällig, danach steckt er fest im Code. */
export function randomDuelSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** Dieselben 10 Fragen für beide Spieler, rein aus dem Seed abgeleitet (nur die Anzeigesprache bleibt je Gerät eigen). */
export function buildDuelQuestions(seed: number, locale: Locale): QuizQuestion[] {
  return buildPracticeQuiz('mix', locale, seededRand(seed));
}

export interface DuelChallenge {
  v: 1;
  seed: number;
  score: number;
  total: number;
  createdAt: string;
}

export class InvalidDuelCodeError extends Error {
  constructor() {
    super('invalid_duel_code');
  }
}

export function buildDuelChallenge(seed: number, score: number, total: number): DuelChallenge {
  return { v: 1, seed, score, total, createdAt: new Date().toISOString() };
}

export function encodeDuelChallenge(challenge: DuelChallenge): string {
  return encodeBase64(JSON.stringify(challenge));
}

/** Wirft InvalidDuelCodeError bei kaputtem/fremdem Code statt eines kryptischen JSON-Fehlers. */
export function decodeDuelChallenge(code: string): DuelChallenge {
  let json: string;
  try {
    json = decodeBase64(code.trim());
  } catch {
    throw new InvalidDuelCodeError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidDuelCodeError();
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== 1 ||
    typeof (parsed as { seed?: unknown }).seed !== 'number' ||
    typeof (parsed as { score?: unknown }).score !== 'number' ||
    typeof (parsed as { total?: unknown }).total !== 'number'
  ) {
    throw new InvalidDuelCodeError();
  }
  return parsed as DuelChallenge;
}
