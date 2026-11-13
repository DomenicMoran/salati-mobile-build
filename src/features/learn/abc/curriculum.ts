import type { Lesson } from '@/features/learn/curriculum';

/** Eigenständiger Koran-ABC-Grundkurs — nicht in `LESSONS` mischen. */
export const ABC_LESSONS: readonly Lesson[] = [
  {
    id: 'abc-welcome',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.welcome',
    conceptCards: [
      { arabic: 'الْقُرْآن', label: 'Qurʾān', textKey: 'learn.abc.cards.welcomeGoal' },
      { arabic: 'ا', label: 'rechts', textKey: 'learn.abc.cards.welcomeRtl' },
    ],
    conceptQuiz: [
      { arabic: 'بِ', translit: 'bi' },
      { arabic: 'مَ', translit: 'ma' },
    ],
  },
  {
    id: 'abc-letter-mark',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.letterMark',
    conceptCards: [
      { arabic: 'بَ', label: 'Buchstabe + Zeichen', textKey: 'learn.abc.cards.letterMark' },
      { arabic: 'ب', label: 'ohne Zeichen', textKey: 'learn.abc.cards.letterBare' },
    ],
    conceptQuiz: [
      { arabic: 'تَ', translit: 'ta' },
      { arabic: 'ثُ', translit: 'thu' },
    ],
  },
  {
    id: 'abc-tarqiq-tafkhim',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.tone',
    conceptCards: [
      { arabic: 'س', label: 'hell / dünn', textKey: 'learn.abc.cards.tarqiq' },
      { arabic: 'ص', label: 'dunkel / voll', textKey: 'learn.abc.cards.tafkhim' },
    ],
    conceptQuiz: [
      { arabic: 'ط', translit: 'ṭā (dunkel)' },
      { arabic: 'ت', translit: 'tā (hell)' },
    ],
  },
  {
    id: 'abc-vowels',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.vowels',
    conceptCards: [
      { arabic: 'بَ', label: 'Fatha · a', textKey: 'learn.abc.cards.fatha' },
      { arabic: 'بِ', label: 'Kasra · i', textKey: 'learn.abc.cards.kasra' },
      { arabic: 'بُ', label: 'Damma · u', textKey: 'learn.abc.cards.damma' },
    ],
    conceptQuiz: [
      { arabic: 'بَ', translit: 'ba' },
      { arabic: 'بِ', translit: 'bi' },
      { arabic: 'بُ', translit: 'bu' },
    ],
  },
  {
    id: 'abc-sukun',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.sukun',
    conceptCards: [
      { arabic: 'بْ', label: 'Sukūn', textKey: 'learn.abc.cards.sukun' },
      { arabic: 'قَدْ', label: 'geschlossen', textKey: 'learn.abc.cards.sukunHear' },
    ],
    conceptQuiz: [
      { arabic: 'مْ', translit: 'm (ohne Vokal)' },
      { arabic: 'لْ', translit: 'l (ohne Vokal)' },
    ],
  },
  {
    id: 'abc-shadda',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.shadda',
    conceptCards: [{ arabic: 'رَبَّ', label: 'Schadda', textKey: 'learn.abc.cards.shadda' }],
    conceptQuiz: [
      { arabic: 'مُ', translit: 'mu' },
      { arabic: 'مُّ', translit: 'mmu' },
    ],
  },
  {
    id: 'abc-madd',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.madd',
    conceptCards: [
      { arabic: 'قَالَ', label: 'langes ā', textKey: 'learn.abc.cards.maddAlif' },
      { arabic: 'ٰ', label: 'Dehnungszeichen', textKey: 'learn.abc.cards.maddSign' },
    ],
    conceptQuiz: [
      { arabic: 'نُور', translit: 'nūr' },
      { arabic: 'نَ', translit: 'na (kurz)' },
    ],
  },
  {
    id: 'abc-tanwin',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.tanwin',
    conceptCards: [
      { arabic: 'كِتَابًا', label: 'Tanwīn -an', textKey: 'learn.abc.cards.tanwinFatha' },
      { arabic: 'نُورٌ', label: 'Tanwīn -un', textKey: 'learn.abc.cards.tanwinDamma' },
    ],
    conceptQuiz: [
      { arabic: 'خَيْرٍ', translit: 'khayrin' },
      { arabic: 'بَ', translit: 'ba' },
    ],
  },
  {
    id: 'abc-article',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.article',
    conceptCards: [{ arabic: 'الْ', label: 'Artikel al-', textKey: 'learn.abc.cards.article' }],
    conceptQuiz: [
      { arabic: 'النُّور', translit: 'an-nūr' },
      { arabic: 'الْقَمَر', translit: 'al-qamar' },
    ],
  },
  {
    id: 'abc-allah',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.allah',
    conceptCards: [{ arabic: 'اللَّهُ', label: 'Allah', textKey: 'learn.abc.cards.allah' }],
    conceptQuiz: [
      { arabic: 'اللَّهُ', translit: 'Allāhu' },
      { arabic: 'بِسْمِ', translit: 'bismi' },
    ],
  },
  {
    id: 'abc-waqf',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.waqf',
    conceptCards: [{ arabic: 'مُحَمَّدٌ ۛ', label: 'Halt', textKey: 'learn.abc.cards.waqf' }],
    conceptQuiz: [
      { arabic: 'عَلَيْهِمْ', translit: 'ʿalayhim' },
      { arabic: 'عَلَيْهِ', translit: 'ʿalayhi' },
    ],
  },
  {
    id: 'abc-bridge',
    kind: 'concept',
    titleKey: 'learn.abc.lessonTitles.bridge',
    conceptCards: [{ arabic: 'ا ب ت ث', label: 'Alphabet', textKey: 'learn.abc.cards.bridge' }],
    conceptQuiz: [
      { arabic: 'بَ', translit: 'ba' },
      { arabic: 'بِ', translit: 'bi' },
    ],
  },
];

export const ABC_PROGRESS_STORAGE_KEY = 'salatibox:learn-abc-progress';

export function abcLessonById(id: string): Lesson | undefined {
  return ABC_LESSONS.find((l) => l.id === id);
}

export const ABC_FIRST_CORE_LESSON = 'letters-1';
