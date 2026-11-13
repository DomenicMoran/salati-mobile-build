// Kurs-Aufbau "Koran lesen lernen" — vom Alphabet bis zum Lesen erster Suren,
// analog zu klassischen Alif-Ba-Lehrwerken: Buchstaben → Verbindungsformen →
// Vokalzeichen → Sonderzeichen → Wörter → Suren → Koran-Wortschatz.

import fatihaDeepData from './data/fatiha-deep.json';
import salahWordsData from './data/salah-words.json';
import vocabData from './data/vocab.json';
import type { Locale } from '@/lib/locale-detect';

export type LessonKind =
  | 'letters'
  | 'similar'
  | 'forms'
  | 'haraka'
  | 'concept'
  | 'words'
  | 'reading'
  | 'vocab'
  | 'wordbyword'
  | 'story';

/**
 * Lektions-/Kursinhalte (Vokabel-Bedeutungen, Story-Texte). Stand
 * 2026-07-27 sind alle 12 Studien-Kurse in allen 14 App-Sprachen zu 100 %
 * befüllt (zuletzt die 28 Lektionstitel von `dialects`). `Partial` bleibt,
 * weil die Fallback-Kette in `localizedText` für künftige neue Sprachen
 * bzw. neu hinzugefügte Inhalte weiter greifen muss.
 */
export type Localized = Partial<Record<Locale, string>>;

/** Fallback-Kette für `Localized`-Text: gewünschte Sprache → Englisch → Deutsch. */
export function localizedText(text: Localized, locale: Locale): string {
  return text[locale] ?? text.en ?? text.de ?? '';
}

/**
 * true = `localizedText` würde für diese Sprache NICHT den echten Text
 * dieser Sprache liefern, sondern in die Englisch/Deutsch-Fallback-Kette
 * fallen (leerer String zählt als fehlend). Die im Content-Audit 2026-07-21
 * gemeldeten Kurs-Lücken (akhlaq/aqida/nawawi40/nikah/dialects in
 * id/bn/fa/ms/ur/sw/ru/ps) sind inzwischen geschlossen — der Hinweis
 * (`learn.contentFallbackNotice` in LessonPlayer/cards/quiz) bleibt als
 * Sicherung für künftig ergänzte, noch unübersetzte Inhalte bestehen.
 */
export function isLocalizedFallback(text: Localized, locale: Locale): boolean {
  return !text[locale]?.trim();
}

/** Übersetzte Bedeutung eines Vokabel-Worts (Alias für Bestandscode). */
export type VocabMeaning = Localized;

/** Abschnitt einer Story-Lektion (Seerah, Propheten, Aqida, Tajwid …). */
export interface StorySection {
  title: Localized;
  text: Localized;
  /** Optionaler arabischer Bezugstext (z. B. zitierter Vers/Beispiel) */
  arabic?: string;
  /** Globale Ayah-Nummer (1–6236) für echte Rezitations-Audio des Beispiels */
  globalAyah?: number;
}

/** Kuratierte Quizfrage einer Story-Lektion — correct ist immer options[0]. */
export interface StoryQuizItem {
  q: Localized;
  options: Localized[];
}

export interface VocabWordItem {
  arabic: string;
  translit: string;
  meaning: VocabMeaning;
}

/** Ein einzelnes Wort innerhalb einer Wort-für-Wort-Zeile (Fatiha-Tiefenanalyse, Salah-Wörter). */
export interface WordToken {
  arabic: string;
  translit: string;
  meaning: VocabMeaning;
}

/** Eine Vers-/Satzzeile mit Wort-für-Wort-Aufschlüsselung. */
export interface WordByWordLine {
  arabic: string;
  translit: string;
  tokens: WordToken[];
  /** Globale Ayah-Nummer für echte Rezitations-Audio (nur Koran-Verse) */
  globalAyah?: number;
}

export interface ConceptCard {
  arabic: string;
  label: string;
  /** i18n-Key mit Erklärungstext (learn.concepts.*) */
  textKey?: string;
}

export interface WordItem {
  arabic: string;
  translit: string;
}

export interface ReadingLine {
  arabic: string;
  translit: string;
  /** Globale Ayah-Nummer (1–6236) für die Rezitations-Audio-URL */
  globalAyah: number;
}

export interface Lesson {
  id: string;
  kind: LessonKind;
  /** i18n-Key des Lektionstitels (learn.lessonTitles.*) — ODER title direkt */
  titleKey?: string;
  /** Direkt lokalisierter Titel (Studien-Kurse, deren Titel in den Kursdaten leben) */
  title?: Localized;
  /** Quellenangabe der Lektion (Pflicht bei Studien-Kursen, z. B. "Quran 12:4; Sahih al-Bukhari 3364") */
  source?: string;
  letterIds?: string[];
  haraka?: 'fatha' | 'kasra' | 'damma';
  conceptCards?: ConceptCard[];
  /** Fragen für Konzept-Lektionen: Wort/Silbe → Transliteration */
  conceptQuiz?: WordItem[];
  words?: WordItem[];
  reading?: ReadingLine[];
  vocabWords?: VocabWordItem[];
  wordByWordLines?: WordByWordLine[];
  story?: StorySection[];
  storyQuiz?: StoryQuizItem[];
}

/** Lektionstitel auflösen: direkte Lokalisierung vor i18n-Key. */
export function lessonTitle(lesson: Lesson, locale: Locale, t: (key: string) => string): string {
  if (lesson.title) return localizedText(lesson.title, locale);
  return lesson.titleKey ? t(lesson.titleKey) : lesson.id;
}

const G = (n: number, ids: string[]): Lesson => ({
  id: `letters-${n}`,
  kind: 'letters',
  titleKey: `learn.lessonTitles.letters-${n}`,
  letterIds: ids,
});

export const SIMILAR_SETS: string[][] = [
  ['ba', 'ta', 'tha'],
  ['jim', 'hha', 'kha'],
  ['dal', 'dhal'],
  ['ra', 'zay'],
  ['sin', 'shin'],
  ['sad', 'dad'],
  ['tta', 'zza'],
  ['ain', 'ghain'],
  ['fa', 'qaf'],
];

const FATIHA_LINES: ReadingLine[] = [
  { arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', translit: 'bismi llāhi r-raḥmāni r-raḥīm', globalAyah: 1 },
  { arabic: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', translit: 'al-ḥamdu lillāhi rabbi l-ʿālamīn', globalAyah: 2 },
  { arabic: 'الرَّحْمَٰنِ الرَّحِيمِ', translit: 'ar-raḥmāni r-raḥīm', globalAyah: 3 },
  { arabic: 'مَالِكِ يَوْمِ الدِّينِ', translit: 'māliki yawmi d-dīn', globalAyah: 4 },
  { arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', translit: 'iyyāka naʿbudu wa-iyyāka nastaʿīn', globalAyah: 5 },
  { arabic: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', translit: 'ihdinā ṣ-ṣirāṭa l-mustaqīm', globalAyah: 6 },
  {
    arabic: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    translit: 'ṣirāṭa lladhīna anʿamta ʿalayhim ghayri l-maghḍūbi ʿalayhim wa-lā ḍ-ḍāllīn',
    globalAyah: 7,
  },
];

function buildFatihaDeepLines(): WordByWordLine[] {
  const deep = fatihaDeepData.lines as { globalAyah: number; tokens: WordToken[] }[];
  return FATIHA_LINES.map((line) => ({
    arabic: line.arabic,
    translit: line.translit,
    globalAyah: line.globalAyah,
    tokens: deep.find((d) => d.globalAyah === line.globalAyah)?.tokens ?? [],
  }));
}

export const LESSONS: Lesson[] = [
  G(1, ['alif', 'ba', 'ta', 'tha']),
  G(2, ['jim', 'hha', 'kha', 'dal']),
  G(3, ['dhal', 'ra', 'zay', 'sin']),
  G(4, ['shin', 'sad', 'dad', 'tta']),
  G(5, ['zza', 'ain', 'ghain', 'fa']),
  G(6, ['qaf', 'kaf', 'lam', 'mim']),
  G(7, ['nun', 'ha', 'waw', 'ya']),
  {
    id: 'similar',
    kind: 'similar',
    titleKey: 'learn.lessonTitles.similar',
    letterIds: SIMILAR_SETS.flat(),
  },
  {
    id: 'forms-1',
    kind: 'forms',
    titleKey: 'learn.lessonTitles.forms-1',
    letterIds: ['ba', 'ta', 'tha', 'jim', 'hha', 'kha', 'sin', 'shin'],
  },
  {
    id: 'forms-2',
    kind: 'forms',
    titleKey: 'learn.lessonTitles.forms-2',
    letterIds: ['sad', 'dad', 'tta', 'zza', 'ain', 'ghain', 'fa', 'qaf'],
  },
  {
    id: 'forms-3',
    kind: 'forms',
    titleKey: 'learn.lessonTitles.forms-3',
    letterIds: ['kaf', 'lam', 'mim', 'nun', 'ha', 'ya', 'alif', 'dal', 'dhal', 'ra', 'zay', 'waw'],
  },
  { id: 'fatha', kind: 'haraka', titleKey: 'learn.lessonTitles.fatha', haraka: 'fatha' },
  { id: 'kasra', kind: 'haraka', titleKey: 'learn.lessonTitles.kasra', haraka: 'kasra' },
  { id: 'damma', kind: 'haraka', titleKey: 'learn.lessonTitles.damma', haraka: 'damma' },
  {
    id: 'tanwin',
    kind: 'concept',
    titleKey: 'learn.lessonTitles.tanwin',
    conceptCards: [
      { arabic: 'بً', label: 'ban', textKey: 'learn.concepts.tanwinFatha' },
      { arabic: 'بٍ', label: 'bin', textKey: 'learn.concepts.tanwinKasra' },
      { arabic: 'بٌ', label: 'bun', textKey: 'learn.concepts.tanwinDamma' },
    ],
    conceptQuiz: [
      { arabic: 'كِتَابًا', translit: 'kitāban' },
      { arabic: 'نُورٌ', translit: 'nūrun' },
      { arabic: 'خَيْرٍ', translit: 'khayrin' },
      { arabic: 'عَلِيمٌ', translit: 'ʿalīmun' },
    ],
  },
  {
    id: 'sukun',
    kind: 'concept',
    titleKey: 'learn.lessonTitles.sukun',
    conceptCards: [{ arabic: 'بْ', label: 'b (vokal-los)', textKey: 'learn.concepts.sukun' }],
    conceptQuiz: [
      { arabic: 'قَدْ', translit: 'qad' },
      { arabic: 'مِنْ', translit: 'min' },
      { arabic: 'كُمْ', translit: 'kum' },
      { arabic: 'بَلْ', translit: 'bal' },
    ],
  },
  {
    id: 'shadda',
    kind: 'concept',
    titleKey: 'learn.lessonTitles.shadda',
    conceptCards: [{ arabic: 'بَّ', label: 'bb', textKey: 'learn.concepts.shadda' }],
    conceptQuiz: [
      { arabic: 'رَبَّ', translit: 'rabba' },
      { arabic: 'إِنَّ', translit: 'inna' },
      { arabic: 'ثُمَّ', translit: 'thumma' },
      { arabic: 'حَقَّ', translit: 'ḥaqqa' },
    ],
  },
  {
    id: 'madd',
    kind: 'concept',
    titleKey: 'learn.lessonTitles.madd',
    conceptCards: [
      { arabic: 'بَا', label: 'bā', textKey: 'learn.concepts.maddAlif' },
      { arabic: 'بُو', label: 'bū', textKey: 'learn.concepts.maddWaw' },
      { arabic: 'بِي', label: 'bī', textKey: 'learn.concepts.maddYa' },
    ],
    conceptQuiz: [
      { arabic: 'قَالَ', translit: 'qāla' },
      { arabic: 'نُور', translit: 'nūr' },
      { arabic: 'دِين', translit: 'dīn' },
      { arabic: 'كِتَاب', translit: 'kitāb' },
    ],
  },
  {
    id: 'hamza-extras',
    kind: 'concept',
    titleKey: 'learn.lessonTitles.hamza-extras',
    conceptCards: [
      { arabic: 'ء', label: 'Hamza', textKey: 'learn.concepts.hamza' },
      { arabic: 'أ / إ', label: 'Hamza + Alif', textKey: 'learn.concepts.hamzaAlif' },
      { arabic: 'ة', label: 'Tā’ marbūṭa', textKey: 'learn.concepts.taMarbuta' },
      { arabic: 'ى', label: 'Alif maqṣūra', textKey: 'learn.concepts.alifMaqsura' },
      { arabic: 'لا', label: 'Lām-Alif', textKey: 'learn.concepts.lamAlif' },
    ],
    conceptQuiz: [
      { arabic: 'أَمَرَ', translit: 'amara' },
      { arabic: 'إِلَى', translit: 'ilā' },
      { arabic: 'رَحْمَة', translit: 'raḥma' },
      { arabic: 'لَا', translit: 'lā' },
    ],
  },
  {
    id: 'sun-moon',
    kind: 'concept',
    titleKey: 'learn.lessonTitles.sun-moon',
    conceptCards: [
      { arabic: 'الشَّمْس', label: 'ash-shams', textKey: 'learn.concepts.sunLetters' },
      { arabic: 'القَمَر', label: 'al-qamar', textKey: 'learn.concepts.moonLetters' },
    ],
    conceptQuiz: [
      { arabic: 'النُّور', translit: 'an-nūr' },
      { arabic: 'الكِتَاب', translit: 'al-kitāb' },
      { arabic: 'الرَّحْمَن', translit: 'ar-raḥmān' },
      { arabic: 'البَيْت', translit: 'al-bayt' },
    ],
  },
  {
    id: 'words-1',
    kind: 'words',
    titleKey: 'learn.lessonTitles.words-1',
    words: [
      { arabic: 'مِنْ', translit: 'min' },
      { arabic: 'مَنْ', translit: 'man' },
      { arabic: 'قُلْ', translit: 'qul' },
      { arabic: 'هُوَ', translit: 'huwa' },
      { arabic: 'لَنَا', translit: 'lanā' },
      { arabic: 'مَعَ', translit: 'maʿa' },
      { arabic: 'لَكَ', translit: 'laka' },
      { arabic: 'بِكَ', translit: 'bika' },
    ],
  },
  {
    id: 'words-2',
    kind: 'words',
    titleKey: 'learn.lessonTitles.words-2',
    words: [
      { arabic: 'كِتَاب', translit: 'kitāb' },
      { arabic: 'سَلَام', translit: 'salām' },
      { arabic: 'رَحْمَة', translit: 'raḥma' },
      { arabic: 'قَلْب', translit: 'qalb' },
      { arabic: 'جَنَّة', translit: 'janna' },
      { arabic: 'رَبّ', translit: 'rabb' },
      { arabic: 'دِين', translit: 'dīn' },
      { arabic: 'نُور', translit: 'nūr' },
    ],
  },
  {
    id: 'reading-fatiha',
    kind: 'reading',
    titleKey: 'learn.lessonTitles.reading-fatiha',
    reading: FATIHA_LINES,
  },
  {
    id: 'reading-fatiha-deep',
    kind: 'wordbyword',
    titleKey: 'learn.lessonTitles.reading-fatiha-deep',
    wordByWordLines: buildFatihaDeepLines(),
  },
  {
    id: 'reading-ikhlas',
    kind: 'reading',
    titleKey: 'learn.lessonTitles.reading-ikhlas',
    reading: [
      { arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ', translit: 'qul huwa llāhu aḥad', globalAyah: 6222 },
      { arabic: 'اللَّهُ الصَّمَدُ', translit: 'allāhu ṣ-ṣamad', globalAyah: 6223 },
      { arabic: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', translit: 'lam yalid wa-lam yūlad', globalAyah: 6224 },
      { arabic: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', translit: 'wa-lam yakun lahu kufuwan aḥad', globalAyah: 6225 },
    ],
  },
  // Die beiden Schutzsuren (Mu'awwidhatan) vervollständigen die vier im
  // Alltag meistrezitierten Kurzsuren als Leseübung (Fatiha, Ikhlas, Falaq, Nas).
  {
    id: 'reading-falaq',
    kind: 'reading',
    titleKey: 'learn.lessonTitles.reading-falaq',
    reading: [
      { arabic: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', translit: 'qul aʿūdhu bi-rabbi l-falaq', globalAyah: 6226 },
      { arabic: 'مِن شَرِّ مَا خَلَقَ', translit: 'min sharri mā khalaq', globalAyah: 6227 },
      { arabic: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', translit: 'wa-min sharri ghāsiqin idhā waqab', globalAyah: 6228 },
      { arabic: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', translit: 'wa-min sharri n-naffāthāti fī l-ʿuqad', globalAyah: 6229 },
      { arabic: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', translit: 'wa-min sharri ḥāsidin idhā ḥasad', globalAyah: 6230 },
    ],
  },
  {
    id: 'reading-nas',
    kind: 'reading',
    titleKey: 'learn.lessonTitles.reading-nas',
    reading: [
      { arabic: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', translit: 'qul aʿūdhu bi-rabbi n-nās', globalAyah: 6231 },
      { arabic: 'مَلِكِ النَّاسِ', translit: 'maliki n-nās', globalAyah: 6232 },
      { arabic: 'إِلَٰهِ النَّاسِ', translit: 'ilāhi n-nās', globalAyah: 6233 },
      { arabic: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', translit: 'min sharri l-waswāsi l-khannās', globalAyah: 6234 },
      { arabic: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', translit: 'alladhī yuwaswisu fī ṣudūri n-nās', globalAyah: 6235 },
      { arabic: 'مِنَ الْجِنَّةِ وَالنَّاسِ', translit: 'mina l-jinnati wa-n-nās', globalAyah: 6236 },
    ],
  },
  ...(salahWordsData.lessons as { id: string; titleKey: string; lines: WordByWordLine[] }[]).map(
    (l): Lesson => ({
      id: l.id,
      kind: 'wordbyword',
      titleKey: l.titleKey,
      wordByWordLines: l.lines,
    }),
  ),
  ...(vocabData.lessons as { id: string; words: VocabWordItem[] }[]).map(
    (l): Lesson => ({
      id: l.id,
      kind: 'vocab',
      titleKey: `learn.lessonTitles.${l.id}`,
      vocabWords: l.words,
    }),
  ),
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
