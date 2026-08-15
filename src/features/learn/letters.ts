import { arabicClusters, normalizeArabicText } from '@/lib/arabicText';

// Das arabische Alphabet als Datengrundlage des Lern-Moduls. Namen und
// Transliterationen sind DMG-nah und sprachneutral gehalten — sie werden in
// allen App-Sprachen identisch angezeigt (wie in gängigen Alif-Ba-Lehrwerken).

export interface ArabicLetter {
  id: string;
  /** Isolierte Form, z.B. "ب" */
  arabic: string;
  /** Buchstabenname, z.B. "Bā’" */
  name: string;
  /** Arabischer Buchstabenname für TTS, z.B. "باء" */
  arabicName: string;
  /** Lautwert/Transliteration, z.B. "b" */
  translit: string;
  /** false bei den 6 Buchstaben, die nicht nach links verbinden (ا د ذ ر ز و) */
  connects: boolean;
  /** Lehr-Gruppe 0..6 (je 4 Buchstaben) */
  group: number;
}

export const LETTERS: ArabicLetter[] = [
  { id: 'alif', arabic: 'ا', name: 'Alif', arabicName: 'ألف', translit: 'ā', connects: false, group: 0 },
  { id: 'ba', arabic: 'ب', name: 'Bā’', arabicName: 'باء', translit: 'b', connects: true, group: 0 },
  { id: 'ta', arabic: 'ت', name: 'Tā’', arabicName: 'تاء', translit: 't', connects: true, group: 0 },
  { id: 'tha', arabic: 'ث', name: 'Thā’', arabicName: 'ثاء', translit: 'th', connects: true, group: 0 },
  { id: 'jim', arabic: 'ج', name: 'Jīm', arabicName: 'جيم', translit: 'j', connects: true, group: 1 },
  { id: 'hha', arabic: 'ح', name: 'Ḥā’', arabicName: 'حاء', translit: 'ḥ', connects: true, group: 1 },
  { id: 'kha', arabic: 'خ', name: 'Khā’', arabicName: 'خاء', translit: 'kh', connects: true, group: 1 },
  { id: 'dal', arabic: 'د', name: 'Dāl', arabicName: 'دال', translit: 'd', connects: false, group: 1 },
  { id: 'dhal', arabic: 'ذ', name: 'Dhāl', arabicName: 'ذال', translit: 'dh', connects: false, group: 2 },
  { id: 'ra', arabic: 'ر', name: 'Rā’', arabicName: 'راء', translit: 'r', connects: false, group: 2 },
  { id: 'zay', arabic: 'ز', name: 'Zāy', arabicName: 'زاي', translit: 'z', connects: false, group: 2 },
  { id: 'sin', arabic: 'س', name: 'Sīn', arabicName: 'سين', translit: 's', connects: true, group: 2 },
  { id: 'shin', arabic: 'ش', name: 'Shīn', arabicName: 'شين', translit: 'sh', connects: true, group: 3 },
  { id: 'sad', arabic: 'ص', name: 'Ṣād', arabicName: 'صاد', translit: 'ṣ', connects: true, group: 3 },
  { id: 'dad', arabic: 'ض', name: 'Ḍād', arabicName: 'ضاد', translit: 'ḍ', connects: true, group: 3 },
  { id: 'tta', arabic: 'ط', name: 'Ṭā’', arabicName: 'طاء', translit: 'ṭ', connects: true, group: 3 },
  { id: 'zza', arabic: 'ظ', name: 'Ẓā’', arabicName: 'ظاء', translit: 'ẓ', connects: true, group: 4 },
  { id: 'ain', arabic: 'ع', name: 'ʿAyn', arabicName: 'عين', translit: 'ʿ', connects: true, group: 4 },
  { id: 'ghain', arabic: 'غ', name: 'Ghayn', arabicName: 'غين', translit: 'gh', connects: true, group: 4 },
  { id: 'fa', arabic: 'ف', name: 'Fā’', arabicName: 'فاء', translit: 'f', connects: true, group: 4 },
  { id: 'qaf', arabic: 'ق', name: 'Qāf', arabicName: 'قاف', translit: 'q', connects: true, group: 5 },
  { id: 'kaf', arabic: 'ك', name: 'Kāf', arabicName: 'كاف', translit: 'k', connects: true, group: 5 },
  { id: 'lam', arabic: 'ل', name: 'Lām', arabicName: 'لام', translit: 'l', connects: true, group: 5 },
  { id: 'mim', arabic: 'م', name: 'Mīm', arabicName: 'ميم', translit: 'm', connects: true, group: 5 },
  { id: 'nun', arabic: 'ن', name: 'Nūn', arabicName: 'نون', translit: 'n', connects: true, group: 6 },
  { id: 'ha', arabic: 'ه', name: 'Hā’', arabicName: 'هاء', translit: 'h', connects: true, group: 6 },
  { id: 'waw', arabic: 'و', name: 'Wāw', arabicName: 'واو', translit: 'w', connects: false, group: 6 },
  { id: 'ya', arabic: 'ي', name: 'Yā’', arabicName: 'ياء', translit: 'y', connects: true, group: 6 },
];

export function letterById(id: string): ArabicLetter {
  const letter = LETTERS.find((l) => l.id === id);
  if (!letter) throw new Error(`unknown_letter_${id}`);
  return letter;
}

// Positionsformen über Zero-Width-Joiner: der Text-Renderer formt den
// Buchstaben dann wie mitten im Wort — keine Grafiken nötig.
const ZWJ = '\u200D';

export function isolatedForm(l: ArabicLetter): string {
  return l.arabic;
}

export function initialForm(l: ArabicLetter): string {
  return l.connects ? l.arabic + ZWJ : l.arabic;
}

export function medialForm(l: ArabicLetter): string {
  return l.connects ? ZWJ + l.arabic + ZWJ : ZWJ + l.arabic;
}

export function finalForm(l: ArabicLetter): string {
  return ZWJ + l.arabic;
}

// Vokal- und Hilfszeichen
export const HARAKAT = {
  fatha: 'َ',
  kasra: 'ِ',
  damma: 'ُ',
  sukun: 'ْ',
  shadda: 'ّ',
  fathatan: 'ً',
  dammatan: 'ٌ',
  kasratan: 'ٍ',
} as const;

/** Silbe aus Konsonant + Vokalzeichen, z.B. syllable(ba, 'fatha') → "بَ" */
export function syllable(l: ArabicLetter, haraka: keyof typeof HARAKAT): string {
  return l.arabic + HARAKAT[haraka];
}

/** Transliteration einer Silbe mit Kurzvokal. */
export function syllableTranslit(l: ArabicLetter, haraka: 'fatha' | 'kasra' | 'damma'): string {
  const vowel = haraka === 'fatha' ? 'a' : haraka === 'kasra' ? 'i' : 'u';
  return l.translit + vowel;
}

const BASE_LETTER_BY_CHAR = new Map(LETTERS.map((l) => [l.arabic, l]));
/** Zero-Width-Non-Joiner: bricht die kursive Verbindung zum nächsten Buchstaben. */
const ZWNJ = '‌';

/**
 * Arabische Grundbuchstaben inkl. der Formen, die nicht zu den 28 Alphabet-
 * Buchstaben zählen (Hamza-Träger أ إ ؤ ئ, Tā-Marbūta ة, Alif-Maqsūra ى,
 * Alif-Waṣla ٱ). Vorher entschied `BASE_LETTER_BY_CHAR` allein — diese Formen
 * blieben dadurch mit dem Nachbarn verbunden, obwohl die Ansicht genau das
 * Gegenteil zeigen soll.
 */
const ARABIC_BASE_LETTER_RE = /^[ء-غف-يٮٯٱ-ۓە]/;

/**
 * Zerlegt ein Wort in seine isolierten Buchstabenformen (statt der natürlich
 * verbundenen Schreibweise) — zum Einprägen, welcher Buchstabe in einem Wort
 * steckt. Harakat/Vokalzeichen bleiben am jeweiligen Buchstaben erhalten, nur
 * die kursive Verbindung zwischen den Grundbuchstaben wird per ZWNJ getrennt.
 *
 * Arbeitet über Grapheme-Cluster (lib/arabicText.ts): so kann kein Vokalzeichen
 * vom Basisbuchstaben abgetrennt werden und damit auch kein Lauf entstehen, dem
 * die Text-Engine einen gestrichelten Kreis voranstellt.
 */
export function wordToIsolatedForms(word: string): string {
  // collapseWhitespace: false — hier kommen einzelne Wörter an, führende/
  // folgende Leerzeichen gibt es nicht, und ein Trimmen würde den
  // NBSP-Basisträger gleich wieder entfernen.
  const clusters = arabicClusters(normalizeArabicText(word, { collapseWhitespace: false }));
  let out = '';
  clusters.forEach((cluster, i) => {
    if (i > 0 && ARABIC_BASE_LETTER_RE.test(cluster)) out += ZWNJ;
    out += cluster;
  });
  return out;
}

/** Sonnenbuchstaben: assimilieren das Lām des Artikels "al-". */
export const SUN_LETTER_IDS = new Set([
  'ta', 'tha', 'dal', 'dhal', 'ra', 'zay', 'sin', 'shin', 'sad', 'dad', 'tta', 'zza', 'lam', 'nun',
]);

// Zeichen, die im Uthmani-Korantext vorkommen, aber keine der 28 LETTERS
// sind (Hamza-Trägerformen, Tā-Marbūta, Alif-Maqsūra, Alif-Wasla). Eigene,
// kleine Namensliste statt sie den 28 Grundbuchstaben unterzuschieben — das
// wären falsche Angaben (z.B. "أ" ist kein eigenständiges Alif).
const EXTRA_LETTER_NAMES: Record<string, string> = {
  'أ': 'Hamza (auf Alif)',
  'إ': 'Hamza (auf Alif, unten)',
  'ؤ': 'Hamza (auf Wāw)',
  'ئ': 'Hamza (auf Yā’)',
  'ء': 'Hamza',
  'ة': 'Tā’ marbūṭa',
  'ى': 'Alif maqṣūra',
  'ٱ': 'Alif waṣla',
};

export interface WordLetter {
  /** Isolierte Glyphe, z.B. "ب" */
  char: string;
  /** Buchstabenname, oder null bei einem (seltenen) unbekannten Zeichen —
   * dann wird im UI nur die Glyphe ohne erfundenen Namen gezeigt. */
  name: string | null;
}

/**
 * Zerlegt ein Wort in seine einzelnen Grundbuchstaben für die "Buchstaben"-
 * Ansicht im Wort-Info-Sheet (Task #66). Harakat/Vokalzeichen werden
 * übersprungen — sie sind keine eigenen Buchstaben. Deckt die 28 Alphabet-
 * Buchstaben plus die gängigen Hamza-/Sonderformen ab (s. EXTRA_LETTER_NAMES).
 */
export function wordToLetterList(word: string): WordLetter[] {
  const out: WordLetter[] = [];
  // Normalisieren (NFC), damit eine zerlegt gelieferte Schreibweise
  // (z. B. Alif + kombinierendes Hamza statt "أ") denselben Namen findet.
  for (const ch of Array.from(normalizeArabicText(word, { collapseWhitespace: false }))) {
    const base = BASE_LETTER_BY_CHAR.get(ch);
    if (base) {
      out.push({ char: ch, name: base.name });
    } else if (ch in EXTRA_LETTER_NAMES) {
      out.push({ char: ch, name: EXTRA_LETTER_NAMES[ch] });
    }
  }
  return out;
}
