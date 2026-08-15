// Hören-erkennen: eine Silbe/ein Wort wird vorgesprochen, der Nutzer wählt
// das richtige ARABISCHE Wort aus 3-4 Optionen (statt die Umschrift zu
// tippen — reines Abhören+Abtippen der lateinischen Transliteration testete
// kaum Schrifterkennung, siehe listeningOptions/buildListeningOptions unten).
// normalizeAnswer/isListeningCorrect bleiben als Utility + für bestehende
// Tests (games.test.ts) erhalten, werden von der Multiple-Choice-UI aber
// nicht mehr gebraucht (dort reicht ein direkter String-Vergleich der Option).
//
// Audioquelle je Runden-Hälfte bewusst unterschiedlich:
// - Silben (ba/bi/bu …) sind ein reines Lautlehre-Konstrukt und kommen im
//   Koran nie als eigenständiges Wort vor — dafür existiert grundsätzlich
//   keine echte Rezitations-Audiodatei. Bleibt TTS (speakArabic in listen.tsx).
// - Wörter: für die Fatiha-Wort-für-Wort-Lektion (reading-fatiha-deep) ist
//   jedes Token einem echten Koranwort mit bekannter Sure:Ayah:Wortposition
//   zugeordnet (siehe fatihaWordItems) — dafür wird echtes quran.com-
//   Rezitations-Audio verwendet. Der übrige, generische Kurs-Wortschatz
//   (LESSONS[].words/conceptQuiz) hat KEINE gespeicherte Sure:Ayah:Wortposition
//   — ein Text-Vergleich gegen den Koran-Korpus wäre eine Rätselei (gleiche
//   Vokabel kommt mit unterschiedlichen Kasus-/Pausalendungen mehrfach vor)
//   und könnte falsch ausgesprochenes Audio liefern, schlimmer als TTS für
//   eine Lese-Lern-App. Bleibt bewusst TTS.
//
// requiresAudio: dieser gesamte Übungstyp ist strukturell audio-first — es
// gibt vor dem Abspielen keinen sichtbaren Text, der die Antwort zeigt (Play-
// Button statt Wort/Silbe). Anders als bei learn/quiz.ts/practice/modes.ts
// (dort ist Audio meist nur eine optionale Vorlese-HILFE zu einer bereits
// sichtbaren Frage) gibt es hier keine Text-only-Teilmenge, die man einzeln
// ausblenden könnte — daher wird bei exerciseStyle 'reading' die GESAMTE
// Übung ausgeblendet, statt einzelne Fragen zu filtern (Hub-Kachel in
// app/quiz/index.tsx, Deep-Link-Guard in app/quiz/listen.tsx).

import { letterById, syllable, syllableTranslit } from '../learn/letters';
import { LESSONS } from '../learn/curriculum';
import { pickSimilarDistractors, readWordQuestion, shuffle, type QuizQuestion, type Rand } from '../learn/quiz';
import { WORD_AUDIO_BASE } from '../quran/api';

export const LISTENING_ROUNDS = 10;

export interface ListeningItem {
  /** Arabischer Text für die Sprachausgabe. */
  arabic: string;
  /** Erwartete Umschrift (Anzeige in der Auflösung). */
  translit: string;
  /** Echte quran.com-Rezitations-Audio-URL, falls vorhanden — sonst Geräte-TTS (siehe Header-Kommentar). */
  audioUrl?: string;
}

/** Kleinschreibung, Längungs-/Sonderzeichen weg: "kitāb" → "kitab", "ʿilm" → "ilm". */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    // kombinierende Diakritika (ā→a, š→s …)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʿʾ'’`\-\s.]/g, '');
}

export function isListeningCorrect(input: string, expected: string): boolean {
  const a = normalizeAnswer(input);
  return a.length > 0 && a === normalizeAnswer(expected);
}

export interface ListeningOptions {
  /** Arabische Auswahlmöglichkeiten (3-4, inkl. korrekter Antwort), gemischt. */
  options: string[];
  correctIndex: number;
}

/**
 * Baut 3-4 arabische Auswahlmöglichkeiten für die Hör-Aufgabe: die korrekte
 * Antwort plus visuell ähnliche Distraktoren (pickSimilarDistractors, gleiches
 * Verfahren wie in den Lektions-Quizzen). Distraktoren kommen aus dem
 * gesamten Runden-Pool (Silben+Wörter) statt aus einer eigenen Kategorie —
 * bei 10 Items pro Runde reicht das für genug Auswahl, ohne eine zweite
 * Ähnlichkeits-Datenbank pflegen zu müssen.
 */
export function buildListeningOptions(
  item: ListeningItem,
  pool: ListeningItem[],
  rand: Rand = Math.random,
): ListeningOptions {
  const arabicPool = pool.map((p) => p.arabic);
  const distractors = pickSimilarDistractors(
    arabicPool,
    item.arabic,
    Math.min(3, new Set(arabicPool).size - 1),
    rand,
  );
  const options = shuffle([item.arabic, ...distractors], rand);
  return { options, correctIndex: options.indexOf(item.arabic) };
}

const SYLLABLE_LETTERS = ['ba', 'ta', 'jim', 'dal', 'ra', 'sin', 'fa', 'qaf', 'lam', 'mim', 'nun', 'kaf'];
const VOWELS = ['fatha', 'kasra', 'damma'] as const;

function syllableItems(rand: Rand): ListeningItem[] {
  const items: ListeningItem[] = [];
  for (const id of SYLLABLE_LETTERS) {
    const letter = letterById(id);
    for (const haraka of VOWELS) {
      items.push({ arabic: syllable(letter, haraka), translit: syllableTranslit(letter, haraka) });
    }
  }
  return shuffle(items, rand);
}

/**
 * quran.com-Wort-Audio-URL für ein Fatiha-Wort (Sure 1). Das Dateimuster
 * "wbw/{sure}_{ayah}_{wort}.mp3" (jeweils 3-stellig gepolstert) wurde am
 * 2026-07-18 live gegen die quran.com-v4-API verifiziert (verses/by_chapter/1
 * ?words=true) — exakte Übereinstimmung für alle 7 Ayat.
 */
export function fatihaWordAudioUrl(ayah: number, wordPosition: number): string {
  const pad = (n: number) => String(n).padStart(3, '0');
  return `${WORD_AUDIO_BASE}wbw/001_${pad(ayah)}_${pad(wordPosition)}.mp3`;
}

/**
 * Echte Wort-Audios aus der Fatiha-Wort-für-Wort-Lektion (reading-fatiha-deep,
 * kind: 'wordbyword'). globalAyah entspricht dort DIREKT der Ayah-Nummer, weil
 * Al-Fatiha Sure 1 ist (keine Sure:Ayah-Umrechnungstabelle im Projekt nötig/
 * vorhanden) — die Token-Reihenfolge je Zeile wurde live gegen die quran.com-
 * Wort-API abgeglichen (identische Wortzahl + Reihenfolge je Ayah), die
 * Wortposition ist daher schlicht der 1-basierte Token-Index innerhalb der Zeile.
 */
function fatihaWordItems(): ListeningItem[] {
  const lesson = LESSONS.find((l) => l.id === 'reading-fatiha-deep');
  const items: ListeningItem[] = [];
  const seen = new Set<string>();
  for (const line of lesson?.wordByWordLines ?? []) {
    if (!line.globalAyah) continue;
    line.tokens.forEach((token, i) => {
      if (seen.has(token.translit)) return;
      seen.add(token.translit);
      items.push({
        arabic: token.arabic,
        translit: token.translit,
        audioUrl: fatihaWordAudioUrl(line.globalAyah as number, i + 1),
      });
    });
  }
  return items;
}

/** Generischer Kurs-Wortschatz ohne bekannte Sure:Ayah:Wortposition — TTS (s. Header-Kommentar). */
function genericWordItems(): ListeningItem[] {
  const items: ListeningItem[] = [];
  const seen = new Set<string>();
  for (const lesson of LESSONS) {
    for (const w of [...(lesson.words ?? []), ...(lesson.conceptQuiz ?? [])]) {
      if (seen.has(w.translit)) continue;
      seen.add(w.translit);
      items.push({ arabic: w.arabic, translit: w.translit });
    }
  }
  return items;
}

/**
 * Wörter mit echtem Rezitations-Audio zuerst (Fatiha-Wort-für-Wort-Daten
 * reichen mit ~25 eindeutigen Wörtern für alle 5 Runden), generischer
 * TTS-Wortschatz nur als Fallback, falls die Fatiha-Daten mal knapp würden.
 */
function wordItems(rand: Rand): ListeningItem[] {
  return [...shuffle(fatihaWordItems(), rand), ...shuffle(genericWordItems(), rand)];
}

/** Falsch getippte Hör-Aufgabe als Multiple-Choice-Frage für die Fehler-Wiederholung. */
export function listeningMistakeQuestion(
  item: ListeningItem,
  pool: ListeningItem[],
  rand: Rand = Math.random,
): QuizQuestion {
  return readWordQuestion(item, pool.map((p) => p.translit), rand);
}

/** 10 Runden: erst leichtere Silben, dann Wörter (je 5). */
export function buildListeningRun(rand: Rand = Math.random): ListeningItem[] {
  const half = LISTENING_ROUNDS / 2;
  return [...syllableItems(rand).slice(0, half), ...wordItems(rand).slice(0, half)];
}
