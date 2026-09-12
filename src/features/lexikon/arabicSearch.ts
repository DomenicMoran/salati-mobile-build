// Diakritika-unempfindliche Normalisierung für die Lexikon-Suche (Wurzeln,
// Lemmata, Konkordanz, Fachbegriffe).
//
// ANDERE Aufgabe als `@/lib/arabicText.ts`: jene Datei bereitet Text FÜRS
// RENDERN auf (Harakat bleiben erhalten — sie sind Teil des Korantexts) und
// löst NUR Kodierungs-/Shaping-Probleme (gestrichelter Kreis, Präsentations-
// formen, NFC). Für den Suchvergleich hier müssen dagegen zwei Schreibweisen
// desselben Wortes GLEICH werden — ein Nutzer, der ohne Vokalzeichen tippt
// ("الله" statt "ٱللَّه"), muss trotzdem Treffer bekommen. Deshalb eine
// eigene, bewusst aggressivere Normalisierung statt Wiederverwendung von
// normalizeArabicText().
//
// Bekannter Stolperstein in diesem Projekt (siehe FORTSETZEN-KORAN-LEXIKON.md,
// Grammatik-Korrektur): arabische Literale im Code normalisieren unter
// Umständen anders als die Korpusdaten (Shadda/Fatha-Reihenfolge) — deshalb
// zuerst IMMER `.normalize('NFC')` auf BEIDEN Seiten, bevor irgendein Zeichen
// verglichen oder entfernt wird. Alle Bereiche unten sind deshalb als
// \u-Hex-Escapes notiert statt als literale Zeichen im Quelltext (gleiches
// Vorgehen wie ARABIC_MARK_RANGES in @/lib/arabicText.ts) — so kann weder ein
// Editor noch eine abweichende Datei-Kodierung ein Kombinationszeichen
// unbemerkt verändern.

/**
 * Arabische Diakritika (Harakat/Tanwin, Shadda, Sukun, Dagger-Alif) sowie
 * Koran-spezifische Zusatzzeichen (Waqf-/Rezitationszeichen) und Tatweel —
 * alles, was beim Tippen typischerweise weggelassen wird und den optischen,
 * nicht aber den lexikalischen Wortkern verändert. Bereich deckungsgleich mit
 * ARABIC_MARK_RANGES in `@/lib/arabicText.ts`, hier zusätzlich inklusive
 * Tatweel (U+0640, dort separat behandelt).
 */
const DIACRITICS_RANGES = 'ؐ-ؚـً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ࣓-ࣣ࣡-ࣿ';
const DIACRITICS_RE = new RegExp(`[${DIACRITICS_RANGES}]`, 'g');

/** Alif-Varianten (Hamza auf Alif U+0623, Hamza unter Alif U+0625,
 *  Madda U+0622, Wasla U+0671) → einfaches Alif U+0627. */
const ALEF_VARIANTS_RE = new RegExp('[أإآٱ]', 'g');
/** Alif maqsura (U+0649) → Ya (U+064A) — übliche Suchnormalisierung,
 *  z. B. "موسى" ↔ "موسي". */
const ALEF_MAKSURA_RE = new RegExp('ى', 'g');
/** Ta marbuta (U+0629) → Ha (U+0647) — häufige Schreibvariante,
 *  z. B. "رحمة" ↔ "رحمه". */
const TEH_MARBUTA_RE = new RegExp('ة', 'g');
/** Unsichtbare Steuerzeichen (ZWSP, Bidi-Marker/Embeddings/Isolates, BOM),
 *  die eine Tastatur gelegentlich mittippt und die sonst einen sonst
 *  identischen Vergleich scheitern lassen (gleicher Bereich wie
 *  INVISIBLE_CONTROLS_RE in `@/lib/arabicText.ts`). */
const INVISIBLE_RE = new RegExp('[​‎‏؜‪-‮⁦-⁩﻿]', 'g');

/**
 * Normalisiert arabischen (oder lateinischen) Text für den Suchvergleich:
 * NFC zuerst (Kompositions-Reihenfolge angleichen), dann unsichtbare
 * Steuerzeichen und Diakritika/Tatweel entfernen, Alif-Varianten/Alif-
 * maqsura/Ta-marbuta vereinheitlichen, Groß-/Kleinschreibung angleichen
 * (wirkungslos auf arabische Zeichen, hilft bei lateinischen Nebentreffern
 * wie Transliterationen), Leerraum zusammenfassen.
 *
 * Auf BEIDE Seiten eines Vergleichs anwenden — sonst greift die
 * Normalisierung nur einseitig und der Vergleich scheitert erneut.
 */
export function normalizeForSearch(text: string): string {
  if (!text) return '';
  let out = text.normalize('NFC');
  out = out.replace(INVISIBLE_RE, '');
  out = out.replace(DIACRITICS_RE, '');
  out = out.replace(ALEF_VARIANTS_RE, 'ا');
  out = out.replace(ALEF_MAKSURA_RE, 'ي');
  out = out.replace(TEH_MARBUTA_RE, 'ه');
  out = out.toLowerCase();
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/** true, wenn `haystack` (nach Normalisierung) `needle` enthält — leerer
 *  `needle` liefert bewusst `false` (kein "alles matcht" bei leerer Eingabe). */
export function searchMatches(haystack: string, needle: string): boolean {
  const n = normalizeForSearch(needle);
  if (!n) return false;
  return normalizeForSearch(haystack).includes(n);
}
