// Matching-Logik für den Halal/Haram-Barcode-Scanner: case-insensitive,
// sprachunabhängiges Keyword-Matching der Open-Food-Facts-Zutatenliste gegen
// den Klassifikations-Datensatz (classification.ts).
//
// Bewusst Token-basiert statt reinem Substring-Matching: reines Substring-
// Matching auf kurzen Wortwurzeln (z. B. "porc") würde false positives wie
// "porcini" (Pilz, rein pflanzlich) oder "lab" gegen "label" erzeugen. Der
// Tokenizer zerlegt den Text in Buchstaben/Zahlen-Läufe (Unicode-fähig, deckt
// auch Arabisch/Türkisch-Sonderzeichen ab); Keywords müssen als vollständige
// Token-Sequenz vorkommen, nicht nur als Teilstring irgendeines Tokens.

import { CLASSIFICATION_CATEGORIES, HALAL_CERTIFIED_KEYWORDS, type HalalStatus } from './classification';

export interface MatchedIngredient {
  categoryId: string;
  status: 'haram' | 'mashbooh';
  matchedKeyword: string;
}

export interface ClassificationResult {
  status: HalalStatus;
  matches: MatchedIngredient[];
  /** true, wenn ein expliziter "halal-zertifiziert"-Hinweis gefunden wurde. */
  halalCertified: boolean;
}

/** Zerlegt Text in kleingeschriebene Buchstaben/Zahlen-Token (Unicode-fähig). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Essig (auch Weinessig/vinaigre de vin/vinagre de vino/üzüm-şarap sirkesi)
 * gilt nach herrschender Mehrheitsmeinung als halal, weil der Alkohol
 * vollständig zu Essigsäure umgewandelt ist — die kurzen Getränke-Wörter
 * ("wine", "wein", "vin", "vino", "şarap" …) dürfen deshalb NICHT als
 * Alkohol-Treffer zählen, wenn in der Nähe ein Essig-Wort steht.
 */
const VINEGAR_CONTEXT_WORDS = new Set([
  'vinegar',
  'essig',
  'vinaigre',
  'vinagre',
  'sirke',
  'sirkesi',
  'aceto',
]);
const VINEGAR_EXEMPT_KEYWORDS = new Set([
  'wine',
  'wein',
  'vin',
  'vino',
  'şarap',
  'beer',
  'bier',
  'biere',
  'bière',
  'cerveza',
]);

/** Start-Indizes, an denen `keyword` als zusammenhängende Token-Sequenz vorkommt. */
function findMatchIndices(tokens: string[], keyword: string): number[] {
  const kwTokens = tokenize(keyword);
  if (kwTokens.length === 0) return [];
  const indices: number[] = [];
  if (kwTokens.length === 1) {
    tokens.forEach((t, i) => {
      if (t === kwTokens[0]) indices.push(i);
    });
    return indices;
  }
  for (let i = 0; i <= tokens.length - kwTokens.length; i++) {
    if (kwTokens.every((kt, j) => tokens[i + j] === kt)) indices.push(i);
  }
  return indices;
}

function hasNearbyVinegarWord(tokens: string[], index: number, windowSize = 2): boolean {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(tokens.length, index + windowSize + 1);
  for (let i = start; i < end; i++) {
    if (VINEGAR_CONTEXT_WORDS.has(tokens[i])) return true;
  }
  return false;
}

/** Prüft, ob `keyword` als zusammenhängende Token-Sequenz in `tokens` vorkommt. */
function containsKeyword(tokens: string[], keyword: string): boolean {
  const indices = findMatchIndices(tokens, keyword);
  if (indices.length === 0) return false;
  if (!VINEGAR_EXEMPT_KEYWORDS.has(keyword)) return true;
  // Getränke-Wort zählt nur, wenn mindestens ein Treffer NICHT neben einem Essig-Wort steht.
  return indices.some((i) => !hasNearbyVinegarWord(tokens, i));
}

/**
 * Klassifiziert einen Zutatentext gegen den Datensatz. Prioritätsreihenfolge:
 * 1. Haram-Kategorie gefunden -> haram (überstimmt alles andere)
 * 2. Kein Haram, aber "halal-zertifiziert"-Marker gefunden -> halal
 *    (die Zertifizierung beantwortet den Zweifel, den Mashbooh sonst offen lässt)
 * 3. Mashbooh-Kategorie gefunden -> mashbooh
 * 4. Zutatentext vorhanden, aber nichts davon gefunden -> halal (keine der
 *    bekannten bedenklichen Zutaten erkannt; siehe Disclaimer im UI, das ist
 *    keine Garantie für 100%ige pflanzliche/halal Zusammensetzung)
 * 5. Kein Zutatentext -> unknown ("nicht genug Daten")
 */
export function classifyIngredients(ingredientsText: string | null | undefined): ClassificationResult {
  if (!ingredientsText || ingredientsText.trim().length === 0) {
    return { status: 'unknown', matches: [], halalCertified: false };
  }

  const tokens = tokenize(ingredientsText);
  const matches: MatchedIngredient[] = [];

  for (const category of CLASSIFICATION_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (containsKeyword(tokens, keyword)) {
        matches.push({ categoryId: category.id, status: category.status, matchedKeyword: keyword });
        break; // ein Treffer pro Kategorie genügt
      }
    }
  }

  const halalCertified = HALAL_CERTIFIED_KEYWORDS.some((kw) => containsKeyword(tokens, kw));
  const haramMatches = matches.filter((m) => m.status === 'haram');
  const mashboohMatches = matches.filter((m) => m.status === 'mashbooh');

  if (haramMatches.length > 0) {
    return { status: 'haram', matches: haramMatches, halalCertified };
  }
  if (halalCertified) {
    return { status: 'halal', matches: mashboohMatches, halalCertified };
  }
  if (mashboohMatches.length > 0) {
    return { status: 'mashbooh', matches: mashboohMatches, halalCertified };
  }
  return { status: 'halal', matches: [], halalCertified: false };
}
