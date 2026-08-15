// Lückentest: Auswendiglern-Check OHNE Mikrofon/Ton ("in der Bahn"-Situation,
// siehe hifz/[surah].tsx für den Mikrofon-Check-Pendant). Ein bereits als
// "Kann ich" markierter Vers wird mit zufällig ausgeblendeten Wörtern
// gezeigt; der Nutzer tippt zum Aufdecken und schätzt sich am Ende selbst
// ein. Reine Funktionen — testbar ohne UI.

import { splitArabicWords } from '@/lib/arabicText';
import type { HifzProgress } from './progress';

export interface GapWord {
  /** Original-Wortform (mit Harakat), für die Anzeige nach Aufdecken. */
  text: string;
  /** true = Wort startet verdeckt (Lücke), muss angetippt werden. */
  hidden: boolean;
}

/**
 * Wählt Wort-Indizes zum Ausblenden: läuft in Gruppen von 3-4 Wörtern durch
 * den Vers und blendet je Gruppe genau EIN zufälliges Wort aus — ergibt im
 * Schnitt "jedes 3.-4. Wort", aber ohne festes Raster (User-Wunsch:
 * zufällig, nicht stur jedes 3. Wort — sonst lernt man die Position statt
 * den Inhalt).
 */
export function selectHiddenIndices(wordCount: number, rng: () => number = Math.random): number[] {
  const hidden: number[] = [];
  let i = 0;
  while (i < wordCount) {
    const groupSize = rng() < 0.5 ? 3 : 4;
    const size = Math.min(groupSize, wordCount - i);
    const offset = Math.floor(rng() * size);
    hidden.push(i + offset);
    i += size;
  }
  return hidden;
}

/**
 * Baut die Wort-Liste für die Lücken-Anzeige aus dem arabischen Vers-Text.
 * `rng` ist injizierbar (Test-Determinismus) — Default `Math.random` für den
 * echten Einsatz.
 */
export function buildGapWords(arabicVerse: string, rng: () => number = Math.random): GapWord[] {
  // splitArabicWords statt split(/\s+/): allein stehende Waqf-Zeichen des
  // Uthmani-Textes wären sonst eigene "Wörter" — als Lücke sinnlos und in
  // einem eigenen Text-Lauf mit gestricheltem Kreis gerendert (lib/arabicText.ts).
  const words = splitArabicWords(arabicVerse);
  const hiddenSet = new Set(selectHiddenIndices(words.length, rng));
  return words.map((text, i) => ({ text, hidden: hiddenSet.has(i) }));
}

/**
 * Ayah-Nummern eines bereits als "Kann ich" markierten Verses in einer Sure,
 * aufsteigend sortiert — Grundlage für die Auswahl der Lückentest-Session
 * (nur was schon "gekonnt" ist, macht als Abruf-Check Sinn).
 */
export function knownAyahNumbers(progress: HifzProgress, surah: number): number[] {
  const surahProgress = progress[surah] ?? {};
  return Object.entries(surahProgress)
    .filter(([, status]) => status === 'known')
    .map(([ayah]) => Number(ayah))
    .sort((a, b) => a - b);
}
