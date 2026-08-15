import type { IconName } from '@/components/ui/icon-symbol';
import type { LocalizedText } from '@/features/guides/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// "Gebet mitbeten" (Pray-Along) — feste Gebetstexte + Ablauf-Generierung.
//
// QUELLEN DER ARABISCHEN TEXTE UND UMSCHRIFT (nichts frei erfunden/paraphrasiert):
//  • Al-Fatiha (arabic + translit)  → aus der bereits geprüften App-Daten
//    src/features/learn/data/fatiha-deep.json (Token-weise, hier Vers für Vers
//    verbatim zusammengesetzt).
//  • Takbir, Sana (Istiftah), Ruku-/Sujud-Tasbih, Sami'Allah/Rabbana, Jalsa-
//    Bittgebet, Tashahhud (At-Tahiyyat), Salawat (Ibrahim-Formel), Zuflucht-
//    Bittgebet vor dem Salam  → aus src/features/learn/data/salah-words.json
//    (Zeilen-Umschrift verbatim übernommen und zu vollständigen Phrasen
//    zusammengefügt).
//  • Salam  → aus src/features/guides/guides.json (Guide "how-to-pray", Schritt 10).
//  • Ablauf/Rak'ah-Zählung + Madhhab-Hinweise folgen der verbreiteten
//    (hanafitischen) Zählung derselben Guides.
//
// Die Umschrift nutzt das akademische System der App-Lern-Module (ḥ, ẓ, ā, ʿ …)
// — konsistent zu fatiha-deep.json / salah-words.json, damit Nutzer, die dort
// üben, dieselbe Schreibweise wiederfinden.
//
// Übersetzungen liegen (wie in guides.json) für ALLE 14 App-Sprachen vor
// (Inhalts-Audit 2026-07-27: die 8 Phase-1-Sprachen id/bn/fa/ms/ur/sw/ru/ps
// fielen hier zuvor still auf Englisch zurück und wurden nachgezogen). Die
// Fallback-Kette in resolveText() bleibt als Sicherung für künftige Sprachen.
//
// Für die drei Koran-Texte (Al-Fatiha, Al-Ikhlas, Al-Kawthar) sind die
// Übersetzungen der 8 ergänzten Sprachen NICHT selbst formuliert, sondern
// verbatim aus genau den Editionen übernommen, die die App im Reader ohnehin
// als Standard ausliefert (features/quran/api.ts BEST_TRANSLATIONS):
// id.indonesian · bn.bengali · fa.fooladvand · ur.jalandhry · sw.barwani ·
// ru.kuliev · ps.abdulwali (alle Al Quran Cloud) sowie qcom.39 (Basmeih,
// Malaiisch, quran.com). Die Dhikr-Phrasen und Handlungsanweisungen folgen der
// Terminologie der bereits 14-sprachigen App-Daten (salah-words.json,
// guides.json), damit Nutzer dieselben Begriffe wiederfinden.
//
// WICHTIG: Vor dem Store-Launch religiös gegenprüfen (siehe USER-TODO, gleiches
// Verfahren wie bei guides.json / duas.json).
// ─────────────────────────────────────────────────────────────────────────────

export const PRAY_ALONG_SOURCE_NOTE =
  'Gebetstexte aus den geprüften App-Daten (Al-Fatiha: fatiha-deep.json; feste Dhikr: salah-words.json; Salam: guides.json). Ablauf nach verbreiteter (hanafitischer) Zählung; Unterschiede der Rechtsschulen sind als Hinweis markiert. Vor Store-Launch religiös gegenprüfen.';

export type PrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'witr';

export type Posture =
  | 'takbir'
  | 'qiyam'
  | 'ruku'
  | 'itidal'
  | 'sujud'
  | 'jalsa'
  | 'tashahhud'
  | 'salam';

export const POSTURE_ICON: Record<Posture, IconName> = {
  takbir: 'hand-left',
  qiyam: 'body',
  ruku: 'arrow-down',
  itidal: 'arrow-up',
  sujud: 'arrow-down-circle',
  jalsa: 'ellipsis-horizontal',
  tashahhud: 'finger-print',
  salam: 'checkmark-done',
};

export interface PrayStep {
  posture: Posture;
  /** Aktions-/Haltungs-Titel (z. B. „Ruku – Verbeugung"). */
  label: LocalizedText;
  /** Arabischer Wortlaut (verbatim aus geprüften App-Daten). */
  arabic?: string;
  /** Lateinische Umschrift zum Mitsprechen. */
  transliteration?: string;
  /** Kurze Übersetzung / bei textlosen Schritten die Handlungsanweisung. */
  translation: LocalizedText;
  /** Physische Ausführung + Sunnah-/Madhhab-Hinweise. */
  note?: LocalizedText;
  /** z. B. „×3" für Tasbih-Wiederholungen. */
  repeat?: string;
  /** Rak'ah-Nummer (für die Fortschrittsanzeige), fehlt bei Rahmen-Schritten. */
  rakah?: number;
  /** true für die kurzen Suren-Schritte (Al-Ikhlas/Al-Kawthar), z. B. für die
   *  Lern-Ansicht, die Kern-Texte gesondert präsentiert. Rein additiv. */
  isSurah?: boolean;
}

export interface PrayerDef {
  id: PrayerId;
  name: LocalizedText;
  /** Zeit-/Kontext-Untertitel. */
  timeName: LocalizedText;
  /** Anzahl Fard-Rak'ah (bei Witr: Wajib/Sunnah nach Madhhab). */
  rakahs: number;
  icon: IconName;
  witr?: boolean;
}

// ── Gebets-Auswahl (Schritt 1) ───────────────────────────────────────────────
export const PRAYERS: PrayerDef[] = [
  {
    id: 'fajr',
    rakahs: 2,
    icon: 'partly-sunny',
    name: {
      de: 'Fajr',
      en: 'Fajr',
      tr: 'Sabah',
      ar: 'الفجر',
      es: 'Fayr',
      fr: 'Fajr',
      id: 'Subuh',
      bn: 'ফজর',
      fa: 'فجر',
      ms: 'Subuh',
      ur: 'فجر',
      sw: 'Alfajiri',
      ru: 'Фаджр',
      ps: 'سهار',
    },
    timeName: {
      de: '2 Rak’ah Fard · Morgengebet',
      en: '2 rak’ah fard · dawn prayer',
      tr: '2 rekât farz · sabah namazı',
      ar: 'ركعتان فرض · صلاة الفجر',
      es: '2 rakat fard · oración del alba',
      fr: '2 rak’a fard · prière de l’aube',
      id: '2 rakaat fardu · salat fajar',
      bn: '২ রাকাত ফরজ · ভোরের নামাজ',
      fa: '۲ رکعت فرض · نماز بامداد',
      ms: '2 rakaat fardu · solat fajar',
      ur: '۲ رکعت فرض · صبح کی نماز',
      sw: 'Rakaa 2 faradhi · swala ya alfajiri',
      ru: '2 раката фард · утренняя молитва',
      ps: '۲ رکعته فرض · د سهار لمونځ',
    },
  },
  {
    id: 'dhuhr',
    rakahs: 4,
    icon: 'sunny',
    name: {
      de: 'Dhuhr',
      en: 'Dhuhr',
      tr: 'Öğle',
      ar: 'الظهر',
      es: 'Dhuhr',
      fr: 'Dhuhr',
      id: 'Zuhur',
      bn: 'যোহর',
      fa: 'ظهر',
      ms: 'Zuhur',
      ur: 'ظہر',
      sw: 'Adhuhuri',
      ru: 'Зухр',
      ps: 'ماسپښین',
    },
    timeName: {
      de: '4 Rak’ah Fard · Mittagsgebet',
      en: '4 rak’ah fard · noon prayer',
      tr: '4 rekât farz · öğle namazı',
      ar: 'أربع ركعات فرض · صلاة الظهر',
      es: '4 rakat fard · oración del mediodía',
      fr: '4 rak’a fard · prière de midi',
      id: '4 rakaat fardu · salat siang',
      bn: '৪ রাকাত ফরজ · দুপুরের নামাজ',
      fa: '۴ رکعت فرض · نماز ظهر',
      ms: '4 rakaat fardu · solat tengah hari',
      ur: '۴ رکعت فرض · دوپہر کی نماز',
      sw: 'Rakaa 4 faradhi · swala ya mchana',
      ru: '4 раката фард · полуденная молитва',
      ps: '۴ رکعته فرض · د ماسپښین لمونځ',
    },
  },
  {
    id: 'asr',
    rakahs: 4,
    icon: 'contrast',
    name: {
      de: 'Asr',
      en: 'Asr',
      tr: 'İkindi',
      ar: 'العصر',
      es: 'Asr',
      fr: 'Asr',
      id: 'Asar',
      bn: 'আসর',
      fa: 'عصر',
      ms: 'Asar',
      ur: 'عصر',
      sw: 'Alasiri',
      ru: 'Аср',
      ps: 'مازديګر',
    },
    timeName: {
      de: '4 Rak’ah Fard · Nachmittagsgebet',
      en: '4 rak’ah fard · afternoon prayer',
      tr: '4 rekât farz · ikindi namazı',
      ar: 'أربع ركعات فرض · صلاة العصر',
      es: '4 rakat fard · oración de la tarde',
      fr: '4 rak’a fard · prière de l’après-midi',
      id: '4 rakaat fardu · salat sore',
      bn: '৪ রাকাত ফরজ · বিকেলের নামাজ',
      fa: '۴ رکعت فرض · نماز عصر',
      ms: '4 rakaat fardu · solat petang',
      ur: '۴ رکعت فرض · سہ پہر کی نماز',
      sw: 'Rakaa 4 faradhi · swala ya alasiri',
      ru: '4 раката фард · послеполуденная молитва',
      ps: '۴ رکعته فرض · د مازديګر لمونځ',
    },
  },
  {
    id: 'maghrib',
    rakahs: 3,
    icon: 'moon-outline',
    name: {
      de: 'Maghrib',
      en: 'Maghrib',
      tr: 'Akşam',
      ar: 'المغرب',
      es: 'Magrib',
      fr: 'Maghrib',
      id: 'Magrib',
      bn: 'মাগরিব',
      fa: 'مغرب',
      ms: 'Maghrib',
      ur: 'مغرب',
      sw: 'Magharibi',
      ru: 'Магриб',
      ps: 'ماښام',
    },
    timeName: {
      de: '3 Rak’ah Fard · Abendgebet',
      en: '3 rak’ah fard · sunset prayer',
      tr: '3 rekât farz · akşam namazı',
      ar: 'ثلاث ركعات فرض · صلاة المغرب',
      es: '3 rakat fard · oración del ocaso',
      fr: '3 rak’a fard · prière du coucher du soleil',
      id: '3 rakaat fardu · salat senja',
      bn: '৩ রাকাত ফরজ · সন্ধ্যার নামাজ',
      fa: '۳ رکعت فرض · نماز مغرب',
      ms: '3 rakaat fardu · solat senja',
      ur: '۳ رکعت فرض · غروب کی نماز',
      sw: 'Rakaa 3 faradhi · swala ya magharibi',
      ru: '3 раката фард · молитва на закате',
      ps: '۳ رکعته فرض · د ماښام لمونځ',
    },
  },
  {
    id: 'isha',
    rakahs: 4,
    icon: 'moon',
    name: {
      de: 'Isha',
      en: 'Isha',
      tr: 'Yatsı',
      ar: 'العشاء',
      es: 'Isha',
      fr: 'Isha',
      id: 'Isya',
      bn: 'এশা',
      fa: 'عشا',
      ms: 'Isyak',
      ur: 'عشاء',
      sw: 'Isha',
      ru: 'Иша',
      ps: 'ماخستن',
    },
    timeName: {
      de: '4 Rak’ah Fard · Nachtgebet',
      en: '4 rak’ah fard · night prayer',
      tr: '4 rekât farz · yatsı namazı',
      ar: 'أربع ركعات فرض · صلاة العشاء',
      es: '4 rakat fard · oración de la noche',
      fr: '4 rak’a fard · prière de la nuit',
      id: '4 rakaat fardu · salat malam',
      bn: '৪ রাকাত ফরজ · রাতের নামাজ',
      fa: '۴ رکعت فرض · نماز شب',
      ms: '4 rakaat fardu · solat malam',
      ur: '۴ رکعت فرض · رات کی نماز',
      sw: 'Rakaa 4 faradhi · swala ya usiku',
      ru: '4 раката фард · ночная молитва',
      ps: '۴ رکعته فرض · د شپې لمونځ',
    },
  },
  {
    id: 'witr',
    rakahs: 3,
    icon: 'star-outline',
    witr: true,
    name: {
      de: 'Witr',
      en: 'Witr',
      tr: 'Vitir',
      ar: 'الوتر',
      es: 'Witr',
      fr: 'Witr',
      id: 'Witir',
      bn: 'বিতর',
      fa: 'وتر',
      ms: 'Witir',
      ur: 'وتر',
      sw: 'Witri',
      ru: 'Витр',
      ps: 'وتر',
    },
    timeName: {
      de: '3 Rak’ah · nach Isha (hanafitisch Wajib)',
      en: '3 rak’ah · after isha (Hanafi: wajib)',
      tr: '3 rekât · yatsıdan sonra (Hanefî: vacip)',
      ar: 'ثلاث ركعات · بعد العشاء (واجب عند الحنفية)',
      es: '3 rakat · después de Isha (hanafí: wayib)',
      fr: '3 rak’a · après Isha (hanafite : wajib)',
      id: '3 rakaat · setelah Isya (mazhab Hanafi: wajib)',
      bn: '৩ রাকাত · এশার পর (হানাফি মাযহাবে ওয়াজিব)',
      fa: '۳ رکعت · پس از عشا (نزد حنفی واجب)',
      ms: '3 rakaat · selepas Isyak (mazhab Hanafi: wajib)',
      ur: '۳ رکعت · عشاء کے بعد (حنفی مسلک میں واجب)',
      sw: 'Rakaa 3 · baada ya isha (Hanafi: wajibu)',
      ru: '3 раката · после иша (у ханафитов — ваджиб)',
      ps: '۳ رکعته · له ماخستن وروسته (په حنفي مذهب کې واجب)',
    },
  },
];

export function prayerById(id: string): PrayerDef | undefined {
  return PRAYERS.find((p) => p.id === id);
}

// ── Feste Bausteine (verbatim aus geprüften App-Daten, s. Kopf-Kommentar) ─────

const AL_FATIHA_ARABIC = [
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
  'الرَّحْمَٰنِ الرَّحِيمِ',
  'مَالِكِ يَوْمِ الدِّينِ',
  'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
  'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
  'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
].join('\n');

const AL_FATIHA_TRANSLIT = [
  'bismi llāhi r-raḥmāni r-raḥīm',
  'al-ḥamdu lillāhi rabbi l-ʿālamīn',
  'ar-raḥmāni r-raḥīm',
  'māliki yawmi d-dīn',
  'iyyāka naʿbudu wa-iyyāka nastaʿīn',
  'ihdinā ṣ-ṣirāṭa l-mustaqīm',
  'ṣirāṭa lladhīna anʿamta ʿalayhim ghayri l-maghḍūbi ʿalayhim wa-lā ḍ-ḍāllīn',
].join('\n');

const AL_FATIHA_TRANSLATION: LocalizedText = {
  de: 'Im Namen Allahs, des Allerbarmers, des Barmherzigen. Alles Lob gebührt Allah, dem Herrn der Welten, dem Allerbarmer, dem Barmherzigen, dem Herrscher am Tag des Gerichts. Dir allein dienen wir, und Dich allein bitten wir um Hilfe. Leite uns den geraden Weg, den Weg derer, die Du begnadet hast, nicht derer, die (Deinen) Zorn erregt haben, und nicht der Irregehenden.',
  en: 'In the name of Allah, the Most Gracious, the Most Merciful. All praise belongs to Allah, Lord of the worlds, the Most Gracious, the Most Merciful, Master of the Day of Judgment. You alone we worship, and You alone we ask for help. Guide us to the straight path — the path of those You have blessed, not of those who earned Your anger, nor of those who go astray.',
  tr: 'Rahman ve Rahim olan Allah’ın adıyla. Hamd, âlemlerin Rabbi Allah’a mahsustur; O Rahman’dır, Rahim’dir, din gününün sahibidir. Yalnız Sana kulluk eder ve yalnız Senden yardım dileriz. Bizi doğru yola ilet; nimet verdiklerinin yoluna, gazaba uğrayanların ve sapmışların yoluna değil.',
  ar: 'بسم الله الرحمن الرحيم. الحمد لله رب العالمين، الرحمن الرحيم، مالك يوم الدين. إياك نعبد وإياك نستعين. اهدنا الصراط المستقيم، صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين.',
  es: 'En el nombre de Alá, el Clementísimo, el Misericordiosísimo. Toda alabanza pertenece a Alá, Señor de los mundos, el Clementísimo, el Misericordiosísimo, Soberano del Día del Juicio. Solo a Ti adoramos y solo a Ti pedimos ayuda. Guíanos por el camino recto, el camino de aquellos a quienes agraciaste, no de los que incurrieron en ira ni de los extraviados.',
  fr: 'Au nom d’Allah, le Tout Miséricordieux, le Très Miséricordieux. Louange à Allah, Seigneur des mondes, le Tout Miséricordieux, le Très Miséricordieux, Souverain du Jour de la rétribution. C’est Toi seul que nous adorons et c’est Toi seul dont nous implorons le secours. Guide-nous sur le droit chemin, le chemin de ceux que Tu as comblés de bienfaits, non de ceux qui ont encouru Ta colère ni des égarés.',
  id: 'Dengan menyebut nama Allah Yang Maha Pemurah lagi Maha Penyayang. Segala puji bagi Allah, Tuhan semesta alam. Maha Pemurah lagi Maha Penyayang. Yang menguasai di Hari Pembalasan. Hanya Engkaulah yang kami sembah, dan hanya kepada Engkaulah kami meminta pertolongan. Tunjukilah kami jalan yang lurus, (yaitu) jalan orang-orang yang telah Engkau beri nikmat kepada mereka; bukan (jalan) mereka yang dimurkai dan bukan (pula jalan) mereka yang sesat.',
  bn: 'শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু। যাবতীয় প্রশংসা আল্লাহ তাআলার যিনি সকল সৃষ্টি জগতের পালনকর্তা। যিনি নিতান্ত মেহেরবান ও দয়ালু। যিনি বিচার দিনের মালিক। আমরা একমাত্র তোমারই ইবাদত করি এবং শুধুমাত্র তোমারই সাহায্য প্রার্থনা করি। আমাদেরকে সরল পথ দেখাও, সে সমস্ত লোকের পথ, যাদেরকে তুমি নেয়ামত দান করেছ। তাদের পথ নয়, যাদের প্রতি তোমার গজব নাযিল হয়েছে এবং যারা পথভ্রষ্ট হয়েছে।',
  fa: 'به نام خداوند رحمتگر مهربان. ستایش خدایى را كه پروردگار جهانیان، رحمتگر مهربان، [و] خداوند روز جزاست. [بار الها] تنها تو را مى‌پرستیم، و تنها از تو یارى مى‌جوییم. ما را به راه راست هدایت فرما، راه آنان كه گرامى‌شان داشته‌اى، نه [راه] مغضوبان، و نه [راه] گمراهان.',
  ms: 'Dengan nama Allah, Yang Maha Pemurah, lagi Maha Mengasihani. Segala puji tertentu bagi Allah, Tuhan yang memelihara dan mentadbirkan sekalian alam. Yang Maha Pemurah, lagi Maha Mengasihani. Yang Menguasai pemerintahan hari Pembalasan (hari Akhirat). Engkaulah sahaja (Ya Allah) yang kami sembah, dan kepada Engkaulah sahaja kami memohon pertolongan. Tunjukilah kami jalan yang lurus. Iaitu jalan orang-orang yang Engkau telah kurniakan nikmat kepada mereka, bukan (jalan) orang-orang yang Engkau telah murkai, dan bukan pula (jalan) orang-orang yang sesat.',
  ur: 'شروع اللہ کا نام لے کر جو بڑا مہربان نہایت رحم والا ہے۔ سب طرح کی تعریف خدا ہی کو (سزاوار) ہے جو تمام مخلوقات کا پروردگار ہے، بڑا مہربان نہایت رحم والا، انصاف کے دن کا حاکم۔ (اے پروردگار) ہم تیری ہی عبادت کرتے ہیں اور تجھ ہی سے مدد مانگتے ہیں۔ ہم کو سیدھے رستے چلا، ان لوگوں کے رستے جن پر تو اپنا فضل و کرم کرتا رہا، نہ ان کے جن پر غصے ہوتا رہا اور نہ گمراہوں کے۔',
  sw: 'Kwa jina la Mwenyezi Mungu Mwingi wa Rehema Mwenye Kurehemu. Sifa njema zote ni za Mwenyezi Mungu, Mola Mlezi wa viumbe vyote; Mwingi wa Rehema Mwenye Kurehemu; Mwenye Kumiliki Siku ya Malipo. Wewe tu tunakuabudu, na Wewe tu tunakuomba msaada. Tuongoe njia iliyo nyooka, njia ya ulio waneemesha, siyo ya walio kasirikiwa, wala walio potea.',
  ru: 'Во имя Аллаха, Милостивого, Милосердного! Хвала Аллаху, Господу миров, Милостивому, Милосердному, Властелину Дня воздаяния! Тебе одному мы поклоняемся и Тебя одного молим о помощи. Веди нас прямым путем, путем тех, кого Ты облагодетельствовал, не тех, на кого пал гнев, и не заблудших.',
  ps: 'د الله په نامه سره (شروع كوم) چې ډېر زیات مهربان، بې حده رحم كوونكى دى. ټول (د كمال) صفتونه خاص د الله لپاره دي چې د ټولو عالَمونو ښه پالونكى دى، ډېر زیات مهربان، بې حده رحم كوونكى دى، د بَدلې د ورځې مالك دى. مونږ خاص ستا عبادت كوو او خاص له تا نه مدد غواړو. ته مونږ ته سَمَه (نېغه) لاره وښَیَه، د هغو خلقو لاره چې تا پر هغوى باندې انعام كړى دى؛ نه د هغو چې پر هغوى باندې غضب شوى او نه د ګمراهانو.',
};

function takbirStep(): PrayStep {
  return {
    posture: 'takbir',
    label: {
      de: 'Takbir – Eröffnung',
      en: 'Takbir – opening',
      tr: 'İftitah Tekbiri',
      ar: 'تكبيرة الإحرام',
      es: 'Takbir de apertura',
      fr: 'Takbir d’ouverture',
      id: 'Takbiratul Ihram',
      bn: 'প্রারম্ভিক তাকবীর',
      fa: 'تکبیرة الاحرام',
      ms: 'Takbiratul Ihram',
      ur: 'تکبیرِ تحریمہ',
      sw: 'Takbira ya Ufunguzi',
      ru: 'Такбир — начало',
      ps: 'د پیل تکبیر',
    },
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'allāhu akbar',
    translation: {
      de: 'Allah ist am größten.',
      en: 'Allah is the greatest.',
      tr: 'Allah en büyüktür.',
      ar: 'الله أكبر.',
      es: 'Alá es el más grande.',
      fr: 'Allah est le plus grand.',
      id: 'Allah Mahabesar.',
      bn: 'আল্লাহ সবচেয়ে মহান।',
      fa: 'الله بزرگ‌تر است.',
      ms: 'Allah Maha Besar.',
      ur: 'اللہ سب سے بڑا ہے۔',
      sw: 'Allah ni Mkuu zaidi.',
      ru: 'Аллах превелик.',
      ps: 'الله ترټولو لوی دی.',
    },
    note: {
      de: 'Im Stehen die Hände auf Schulter-/Ohrhöhe heben und „Allahu Akbar" sagen. Damit beginnt das Gebet; danach die rechte Hand über die linke legen.',
      en: 'Standing, raise the hands to shoulder/ear level and say “Allahu Akbar”. The prayer now begins; then place the right hand over the left.',
      tr: 'Ayakta ellerini omuz/kulak hizasına kaldır ve „Allahu Ekber" de. Namaz başlar; sonra sağ elini sol elinin üzerine koy.',
      ar: 'قائماً ارفع يديك حذو منكبيك وقل „الله أكبر". تبدأ الصلاة، ثم ضع يمينك على شمالك.',
      es: 'De pie, levanta las manos a la altura de los hombros/orejas y di «Allahu Akbar». Comienza la oración; luego coloca la mano derecha sobre la izquierda.',
      fr: 'Debout, lève les mains à hauteur des épaules/oreilles et dis « Allahu Akbar ». La prière commence ; place ensuite la main droite sur la gauche.',
      id: 'Berdiri, angkat kedua tangan setinggi bahu atau telinga dan ucapkan “Allahu Akbar”. Dengan itu salat dimulai; kemudian letakkan tangan kanan di atas tangan kiri.',
      bn: 'দাঁড়িয়ে দুই হাত কাঁধ বা কান বরাবর তুলে “আল্লাহু আকবার” বলো। এতেই নামাজ শুরু হয়; এরপর ডান হাত বাঁ হাতের ওপর রাখো।',
      fa: 'ایستاده دست‌ها را تا سطح شانه یا گوش بالا ببر و «الله اکبر» بگو. با این تکبیر نماز آغاز می‌شود؛ سپس دست راست را روی دست چپ بگذار.',
      ms: 'Berdiri, angkat kedua-dua tangan searas bahu atau telinga dan ucapkan “Allahu Akbar”. Dengan itu solat pun bermula; kemudian letakkan tangan kanan di atas tangan kiri.',
      ur: 'کھڑے ہو کر ہاتھوں کو کندھوں یا کانوں کی بلندی تک اٹھاؤ اور «اللہ اکبر» کہو۔ اسی سے نماز شروع ہو جاتی ہے؛ پھر دایاں ہاتھ بائیں ہاتھ پر رکھو۔',
      sw: 'Ukiwa umesimama, nyanyua mikono hadi usawa wa mabega au masikio na useme “Allahu Akbar”. Hapo swala imeanza; kisha weka mkono wa kulia juu ya wa kushoto.',
      ru: 'Стоя подними руки до уровня плеч или ушей и скажи «Аллаху акбар». С этого начинается молитва; затем положи правую руку на левую.',
      ps: 'ولاړ لاسونه تر اوږو یا غوږونو پورې پورته کړه او «الله اکبر» ووایه. په همدې سره لمونځ پیلېږي؛ بیا ښی لاس په کیڼ لاس باندې کېږده.',
    },
  };
}

function sanaStep(): PrayStep {
  return {
    posture: 'qiyam',
    label: {
      de: 'Sana – Eröffnungsbittgebet (Sunnah)',
      en: 'Sana – opening supplication (sunnah)',
      tr: 'Sübhaneke (sünnet)',
      ar: 'دعاء الاستفتاح (سنة)',
      es: 'Sana – súplica de apertura (sunna)',
      fr: 'Sana – invocation d’ouverture (sunna)',
      id: 'Doa Iftitah (sunah)',
      bn: 'ছানা – সূচনার দোয়া (সুন্নত)',
      fa: 'دعای افتتاح (سنت)',
      ms: 'Doa Iftitah (sunat)',
      ur: 'ثنا – دعائے استفتاح (سنت)',
      sw: 'Dua ya Ufunguzi (sunna)',
      ru: 'Сана — вступительное дуа (сунна)',
      ps: 'د پیل دعا — ثنا (سنت)',
    },
    arabic:
      'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ وَلَا إِلَٰهَ غَيْرُكَ',
    transliteration:
      'subḥānaka llāhumma wa-biḥamdika wa-tabāraka smuka wa-taʿālā jadduka wa-lā ilāha ghayruka',
    translation: {
      de: 'Gepriesen bist Du, o Allah, und Dir gebührt Lob; gesegnet ist Dein Name und erhaben Deine Majestät, und es gibt keinen Gott außer Dir.',
      en: 'Glory be to You, O Allah, and praise; blessed is Your name and exalted is Your majesty, and there is no god but You.',
      tr: 'Sen her eksiklikten uzaksın Allah’ım, Sana hamd olsun; adın mübarektir, şanın yücedir ve Senden başka ilah yoktur.',
      ar: 'سبحانك اللهم وبحمدك، وتبارك اسمك، وتعالى جدك، ولا إله غيرك.',
      es: 'Gloria a Ti, oh Alá, y alabanza; bendito sea Tu nombre y exaltada Tu majestad, y no hay más dios que Tú.',
      fr: 'Gloire et louange à Toi, ô Allah ; béni soit Ton nom et exaltée Ta majesté, et il n’y a de divinité que Toi.',
      id: 'Mahasuci Engkau, ya Allah, dan dengan pujian-Mu; berkah bagi nama-Mu dan tinggi keagungan-Mu, dan tidak ada tuhan selain Engkau.',
      bn: 'হে আল্লাহ, তুমি পবিত্র এবং তোমার প্রশংসাসহ; বরকতময় তোমার নাম, সমুন্নত তোমার মহিমা, আর তুমি ছাড়া কোনো উপাস্য নেই।',
      fa: 'منزهی تو، خدایا، و به ستایش تو؛ نام تو بلندمرتبه است و عظمت تو بلند است، و معبودی جز تو نیست.',
      ms: 'Maha Suci Engkau, ya Allah, dan dengan pujian-Mu; berkat bagi nama-Mu dan tinggi keagungan-Mu, dan tiada tuhan selain Engkau.',
      ur: 'اے اللہ، تو پاک ہے اور تیری تعریف کے ساتھ؛ تیرا نام برکت والا ہے اور تیری شان بلند ہے، اور تیرے سوا کوئی معبود نہیں۔',
      sw: 'Wewe umetakasika, ewe Allah, na kwa sifa Zako; jina Lako limebarikiwa na utukufu Wako umetukuka, na hakuna mola isipokuwa Wewe.',
      ru: 'Пречист Ты, о Аллах, и хвала Тебе; благословенно имя Твоё и возвышенно величие Твоё, и нет божества, кроме Тебя.',
      ps: 'ته پاک يې، يا الله، او ستا په ستاینه؛ ستا نوم برکتناک دی او ستا لوی والی لوړ دی، او له تا پرته بل معبود نشته.',
    },
    note: {
      de: 'Leise im Stehen, direkt nach dem Takbir.',
      en: 'Said quietly while standing, right after the takbir.',
      tr: 'Ayakta, tekbirden hemen sonra sessizce.',
      ar: 'يُقال سراً في القيام بعد التكبير مباشرة.',
      es: 'Se dice en voz baja de pie, justo después del takbir.',
      fr: 'À dire à voix basse, debout, juste après le takbir.',
      id: 'Dibaca lirih sambil berdiri, tepat setelah takbir.',
      bn: 'দাঁড়ানো অবস্থায় তাকবীরের ঠিক পরে নিচু স্বরে পড়া হয়।',
      fa: 'ایستاده و آهسته، بلافاصله پس از تکبیر خوانده می‌شود.',
      ms: 'Dibaca perlahan sambil berdiri, sejurus selepas takbir.',
      ur: 'کھڑے ہو کر تکبیر کے فوراً بعد آہستہ پڑھی جاتی ہے۔',
      sw: 'Husomwa kwa sauti ya chini ukiwa umesimama, mara tu baada ya takbira.',
      ru: 'Читается тихо стоя, сразу после такбира.',
      ps: 'ولاړ او ورو، له تکبیر وروسته سمدستي لوستل کیږي.',
    },
  };
}

// Kurze Anfänger-Suren für die ersten beiden Rak'ah (nach Al-Fatiha). Arabisch
// verbatim aus api.alquran.cloud (quran-uthmani; Basmala-Präfix entfernt, weil
// sie leise separat gesagt wird), Übersetzungen aus den dortigen Editionen,
// Umschrift in der App-Konvention (vgl. sanaStep). Religiöse Gegenprüfung: s.
// PRAY_ALONG_SOURCE_NOTE / USER-TODO.
const AL_IKHLAS: Pick<PrayStep, 'arabic' | 'transliteration' | 'translation'> = {
  arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
  transliteration:
    'qul huwa llāhu aḥad · allāhu ṣ-ṣamad · lam yalid wa-lam yūlad · wa-lam yakun lahū kufuwan aḥad',
  translation: {
    de: 'Sprich: „Er ist Allah, ein Einziger. Allah, der Absolute. Er zeugt nicht und ist nicht gezeugt worden, und keiner ist Ihm ebenbürtig."',
    en: 'Say, "He is Allah, [who is] One, Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent."',
    tr: 'De ki: O Allah birdir. Allah her şeyden müstağnidir, her şey O’na muhtaçtır. O doğurmamış ve doğmamıştır. Hiçbir şey O’na denk değildir.',
    ar: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
    es: 'Di: "Él es Al-lah, Uno. Al-lah es el Absoluto. No engendró ni fue engendrado. Y no hay nada ni nadie semejante a Él."',
    fr: 'Dis : « Il est Allah, Unique. Allah, Le Seul à être imploré. Il n’a pas engendré et n’a pas été engendré, et nul n’est égal à Lui. »',
    id: 'Katakanlah: "Dialah Allah, Yang Maha Esa. Allah adalah Tuhan yang bergantung kepada-Nya segala sesuatu. Dia tiada beranak dan tidak pula diperanakkan, dan tidak ada seorang pun yang setara dengan Dia."',
    bn: 'বলুন, তিনি আল্লাহ, এক, আল্লাহ অমুখাপেক্ষী, তিনি কাউকে জন্ম দেননি এবং কেউ তাকে জন্ম দেয়নি এবং তার সমতুল্য কেউ নেই।',
    fa: 'بگو: «اوست خداى یگانه، خداى صمد [ثابت - متعالى]، [كسى را] نزاده، و زاده نشده است، و هیچ كس او را همتا نیست.»',
    ms: 'Katakanlah (wahai Muhammad): "(Tuhanku) ialah Allah Yang Maha Esa; Allah Yang menjadi tumpuan sekalian makhluk untuk memohon sebarang hajat; Ia tiada beranak, dan Ia pula tidak diperanakkan; dan tidak ada sesiapa pun yang serupa dengan-Nya."',
    ur: 'کہو کہ وہ (ذات پاک جس کا نام) اللہ (ہے) ایک ہے، معبودِ برحق جو بےنیاز ہے، نہ کسی کا باپ ہے اور نہ کسی کا بیٹا، اور کوئی اس کا ہمسر نہیں۔',
    sw: 'Sema: Yeye Mwenyezi Mungu ni wa pekee. Mwenyezi Mungu Mkusudiwa. Hakuzaa wala hakuzaliwa. Wala hana anayefanana naye hata mmoja.',
    ru: 'Скажи: «Он — Аллах Единый, Аллах Самодостаточный. Он не родил и не был рожден, и нет никого равного Ему».',
    ps: '(اى نبي!) ته (دوى ته) ووایه: شان دا دى چې الله یو دى، هم دا الله بې نیاز (بې حاجته) دى، نه يې (څوك) زېږولى دى او نه دى (له چا) زېږول شوى دى، او د ده هیڅوك سیال (او) برابر نشته.',
  },
};
const AL_KAWTHAR: Pick<PrayStep, 'arabic' | 'transliteration' | 'translation'> = {
  arabic: 'إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ فَصَلِّ لِرَبِّكَ وَٱنْحَرْ إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ',
  transliteration: 'innā aʿṭaynāka l-kawthar · fa-ṣalli li-rabbika wa-nḥar · inna shāniʾaka huwa l-abtar',
  translation: {
    de: 'Wir haben dir die Überfülle (al-Kauthar) gegeben. So bete zu deinem Herrn und opfere. Wahrlich, dein Hasser ist der Abgeschnittene.',
    en: 'Indeed, We have granted you al-Kawthar. So pray to your Lord and sacrifice. Indeed, your enemy is the one cut off.',
    tr: 'Doğrusu biz sana Kevser’i verdik. Öyleyse Rabbin için namaz kıl ve kurban kes. Doğrusu sana kin besleyen, soyu kesik olanın ta kendisidir.',
    ar: 'إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ فَصَلِّ لِرَبِّكَ وَٱنْحَرْ إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ',
    es: 'Te hemos concedido la abundancia (al-Kawthar). Reza a tu Señor y sacrifica. Porque quien te odia será el que quede sin descendencia.',
    fr: 'Nous t’avons certes accordé l’Abondance. Accomplis la Salât pour ton Seigneur et sacrifie. Celui qui te hait sera privé de postérité.',
    id: 'Sesungguhnya Kami telah memberikan kepadamu nikmat yang banyak. Maka dirikanlah salat karena Tuhanmu; dan berkorbanlah. Sesungguhnya orang-orang yang membenci kamu, dialah yang terputus.',
    bn: 'নিশ্চয় আমি আপনাকে কাওসার দান করেছি। অতএব আপনার পালনকর্তার উদ্দেশ্যে নামাজ পড়ুন এবং কোরবানি করুন। যে আপনার শত্রু, সেই তো নির্বংশ।',
    fa: 'ما تو را [چشمهٔ] كوثر دادیم، پس براى پروردگارت نماز گزار و قربانى كن. دشمنت خود بى‌تبار خواهد بود.',
    ms: 'Sesungguhnya Kami telah mengurniakan kepadamu (wahai Muhammad) kebaikan yang banyak (di dunia dan di akhirat). Oleh itu, kerjakanlah sembahyang kerana Tuhanmu semata-mata, dan sembelihlah korban (sebagai bersyukur). Sesungguhnya orang yang bencikan engkau, dialah yang terputus.',
    ur: '(اے محمدﷺ) ہم نے تم کو کوثر عطا فرمائی ہے، تو اپنے پروردگار کے لیے نماز پڑھا کرو اور قربانی دیا کرو۔ کچھ شک نہیں کہ تمہارا دشمن ہی بےاولاد رہے گا۔',
    sw: 'Hakika tumekupa kheri nyingi. Basi sali na uchinje kwa ajili ya Mola wako Mlezi. Hakika anayekuchukia ndiye aliye mpungufu.',
    ru: 'Мы даровали тебе аль-Каусар. Посему совершай намаз ради своего Господа и закалывай жертву. Воистину, твой ненавистник сам окажется безвестным.',
    ps: 'بېشكه مونږ تا ته كوثر دركړى دى، نو ته د خپل رب لپاره لمونځ كوه او قرباني كوه. بېشكه ستا دښمن هم هغه بې بنیاده (او لاولده) دى.',
  },
};

// Eigener Schritt für die kurze Sure nach Al-Fatiha (Rak'ah 1 → Al-Ikhlas,
// Rak'ah 2 → Al-Kawthar): die beiden, die Anfänger zuerst lernen.
function shortSurahStep(rakah: number): PrayStep {
  const isKawthar = rakah === 2;
  const sura = isKawthar ? AL_KAWTHAR : AL_IKHLAS;
  const name = isKawthar ? 'Al-Kawthar' : 'Al-Ikhlas';
  const nameAr = isKawthar ? 'الكوثر' : 'الإخلاص';
  return {
    posture: 'qiyam',
    rakah,
    isSurah: true,
    label: {
      de: `Kurze Sure – ${name}`,
      en: `Short surah – ${name}`,
      tr: `Kısa sure – ${name}`,
      ar: `سورة قصيرة – ${nameAr}`,
      es: `Sura corta – ${name}`,
      fr: `Courte sourate – ${name}`,
      id: `Surah pendek – ${name}`,
      bn: `ছোট সূরা – ${name}`,
      fa: `سورهٔ کوتاه – ${name}`,
      ms: `Surah pendek – ${name}`,
      ur: `مختصر سورت – ${name}`,
      sw: `Sura fupi – ${name}`,
      ru: `Короткая сура – ${name}`,
      ps: `لنډ سورت – ${name}`,
    },
    arabic: sura.arabic,
    transliteration: sura.transliteration,
    translation: sura.translation!,
    note: {
      de: 'Nach Al-Fatiha (nur 1. + 2. Rak’ah). Zuvor leise „Bismillāh ar-Raḥmān ar-Raḥīm". Al-Ikhlas und Al-Kawthar gehören zu den ersten Suren, die man auswendig lernt.',
      en: 'After Al-Fatiha (1st + 2nd rakah only). Quietly say "Bismillah ar-Rahman ar-Rahim" first. Al-Ikhlas and Al-Kawthar are among the first surahs one memorizes.',
      tr: 'Fâtiha’dan sonra (yalnız 1. + 2. rekât). Önce sessizce „Bismillâhi’r-Rahmâni’r-Rahîm". İhlâs ve Kevser ilk ezberlenen surelerdendir.',
      ar: 'بعد الفاتحة (في الركعتين الأوليين فقط). قل سراً „بسم الله الرحمن الرحيم" أولاً. الإخلاص والكوثر من أوائل ما يُحفظ.',
      es: 'Tras Al-Fatiha (solo 1.ª + 2.ª raka). Di antes en voz baja "Bismillah ar-Rahman ar-Rahim". Al-Ikhlas y Al-Kawthar están entre las primeras suras que se memorizan.',
      fr: 'Après Al-Fatiha (1re + 2e rak’a seulement). Dis d’abord à voix basse « Bismillah ar-Rahman ar-Rahim ». Al-Ikhlas et Al-Kawthar sont parmi les premières sourates mémorisées.',
      id: 'Setelah Al-Fatihah (hanya rakaat 1 dan 2). Sebelumnya ucapkan lirih “Bismillahir-Rahmanir-Rahim”. Al-Ikhlas dan Al-Kawthar termasuk surah pertama yang dihafal.',
      bn: 'আল-ফাতিহার পর (কেবল ১ম ও ২য় রাকাতে)। আগে নিচু স্বরে “বিসমিল্লাহির রাহমানির রাহীম” বলো। আল-ইখলাস ও আল-কাওসার সবার আগে মুখস্থ করা সূরাগুলোর অন্যতম।',
      fa: 'پس از فاتحه (تنها در رکعت اول و دوم). پیش از آن آهسته «بسم الله الرحمن الرحیم» بگو. اخلاص و کوثر از نخستین سوره‌هایی هستند که حفظ می‌شوند.',
      ms: 'Selepas Al-Fatihah (rakaat pertama dan kedua sahaja). Sebelumnya ucapkan perlahan “Bismillahir-Rahmanir-Rahim”. Al-Ikhlas dan Al-Kawthar antara surah pertama yang dihafal.',
      ur: 'الفاتحہ کے بعد (صرف پہلی اور دوسری رکعت میں)۔ پہلے آہستہ «بسم اللہ الرحمن الرحیم» کہو۔ الاخلاص اور الکوثر اُن سورتوں میں سے ہیں جو سب سے پہلے یاد کی جاتی ہیں۔',
      sw: 'Baada ya Al-Fatiha (rakaa ya kwanza na ya pili tu). Kabla yake sema kwa sauti ya chini “Bismillahir-Rahmanir-Rahim”. Al-Ikhlas na Al-Kawthar ni miongoni mwa sura za kwanza kuhifadhiwa.',
      ru: 'После «Аль-Фатихи» (только 1-й и 2-й ракат). Сначала тихо скажи «Бисмилляхи-р-Рахмани-р-Рахим». «Аль-Ихляс» и «Аль-Каусар» — среди первых сур, которые заучивают наизусть.',
      ps: 'له فاتحې وروسته (يوازې په لومړي او دویم رکعت کې). مخکې يې ورو «بسم الله الرحمن الرحیم» ووایه. الاخلاص او الکوثر له هغو لومړنیو سورتونو څخه دي چې زده کیږي.',
    },
  };
}

function recitationStep(rakah: number, withSurah: boolean): PrayStep {
  return {
    posture: 'qiyam',
    rakah,
    label: withSurah
      ? {
          de: 'Qiyam – Al-Fatiha + Sure',
          en: 'Qiyam – Al-Fatiha + surah',
          tr: 'Kıyam – Fâtiha + sure',
          ar: 'القيام – الفاتحة وسورة',
          es: 'Qiyam – Al-Fatiha + sura',
          fr: 'Qiyam – Al-Fatiha + sourate',
          id: 'Qiyam – Al-Fatihah + surah',
          bn: 'কিয়াম – আল-ফাতিহা + সূরা',
          fa: 'قیام – فاتحه + سوره',
          ms: 'Qiam – Al-Fatihah + surah',
          ur: 'قیام – الفاتحہ + سورت',
          sw: 'Kiyamu – Al-Fatiha + sura',
          ru: 'Кыям – «Аль-Фатиха» + сура',
          ps: 'قیام – الفاتحه + سورت',
        }
      : {
          de: 'Qiyam – Al-Fatiha',
          en: 'Qiyam – Al-Fatiha',
          tr: 'Kıyam – Fâtiha',
          ar: 'القيام – الفاتحة',
          es: 'Qiyam – Al-Fatiha',
          fr: 'Qiyam – Al-Fatiha',
          id: 'Qiyam – Al-Fatihah',
          bn: 'কিয়াম – আল-ফাতিহা',
          fa: 'قیام – فاتحه',
          ms: 'Qiam – Al-Fatihah',
          ur: 'قیام – الفاتحہ',
          sw: 'Kiyamu – Al-Fatiha',
          ru: 'Кыям – «Аль-Фатиха»',
          ps: 'قیام – الفاتحه',
        },
    arabic: AL_FATIHA_ARABIC,
    transliteration: AL_FATIHA_TRANSLIT,
    translation: AL_FATIHA_TRANSLATION,
    note: withSurah
      ? {
          de: 'Al-Fatiha ist in jeder Rak’ah Pflicht. In den ersten beiden Rak’ah folgt danach eine kurze Sure oder einige Verse (z. B. Al-Ikhlas) – im Lern-Modul zu üben.',
          en: 'Al-Fatiha is required in every rakah. In the first two rakahs, add a short surah or a few verses (e.g. Al-Ikhlas) — practice these in the learning course.',
          tr: 'Fâtiha her rekâtta farzdır. İlk iki rekâtta ardından kısa bir sure veya birkaç ayet eklenir (örn. İhlâs) – öğrenme bölümünde çalış.',
          ar: 'الفاتحة ركن في كل ركعة. وفي الركعتين الأوليين تُضاف سورة قصيرة أو آيات (مثل الإخلاص).',
          es: 'Al-Fatiha es obligatoria en cada raka. En las dos primeras se añade una sura corta o algunos versículos (p. ej. Al-Ikhlas).',
          fr: 'Al-Fatiha est obligatoire à chaque rak’a. Dans les deux premières, ajoute une courte sourate ou quelques versets (p. ex. Al-Ikhlas).',
          id: 'Al-Fatihah wajib pada setiap rakaat. Pada dua rakaat pertama, tambahkan satu surah pendek atau beberapa ayat (misalnya Al-Ikhlas) – latihlah di modul belajar.',
          bn: 'প্রতি রাকাতে আল-ফাতিহা ফরজ। প্রথম দুই রাকাতে এরপর একটি ছোট সূরা বা কয়েকটি আয়াত পড়ো (যেমন আল-ইখলাস) – শেখার অংশে অনুশীলন করো।',
          fa: 'فاتحه در هر رکعت واجب است. در دو رکعت نخست پس از آن سوره‌ای کوتاه یا چند آیه بخوان (مثلاً اخلاص) – در بخش آموزش تمرین کن.',
          ms: 'Al-Fatihah wajib pada setiap rakaat. Pada dua rakaat pertama, tambah satu surah pendek atau beberapa ayat (contohnya Al-Ikhlas) – latihlah dalam modul pembelajaran.',
          ur: 'ہر رکعت میں الفاتحہ لازم ہے۔ پہلی دو رکعتوں میں اس کے بعد کوئی مختصر سورت یا چند آیات پڑھو (مثلاً الاخلاص) – سیکھنے کے حصے میں مشق کرو۔',
          sw: 'Al-Fatiha ni lazima katika kila rakaa. Katika rakaa mbili za mwanzo ongeza sura fupi au aya kadhaa (kwa mfano Al-Ikhlas) – zizoeze katika sehemu ya kujifunza.',
          ru: '«Аль-Фатиха» обязательна в каждом ракате. В первых двух ракатах добавь короткую суру или несколько аятов (например «Аль-Ихляс») – отработай это в учебном модуле.',
          ps: 'الفاتحه په هر رکعت کې فرض ده. په لومړیو دوو رکعتونو کې بیا یو لنډ سورت یا څو آیتونه ولوله (لکه الاخلاص) – د زده‌کړې په برخه کې یې تمرین کړه.',
        }
      : {
          de: 'In der 3. und 4. Rak’ah wird nur Al-Fatiha rezitiert, ohne zusätzliche Sure.',
          en: 'In the 3rd and 4th rakah only Al-Fatiha is recited, without an additional surah.',
          tr: '3. ve 4. rekâtta sadece Fâtiha okunur, ek sure olmadan.',
          ar: 'في الركعة الثالثة والرابعة تُقرأ الفاتحة فقط دون سورة.',
          es: 'En la 3.ª y 4.ª raka solo se recita Al-Fatiha, sin sura adicional.',
          fr: 'Aux 3e et 4e rak’a, on ne récite qu’Al-Fatiha, sans sourate supplémentaire.',
          id: 'Pada rakaat ketiga dan keempat hanya dibaca Al-Fatihah, tanpa surah tambahan.',
          bn: 'তৃতীয় ও চতুর্থ রাকাতে কেবল আল-ফাতিহা পড়া হয়, অতিরিক্ত সূরা ছাড়া।',
          fa: 'در رکعت سوم و چهارم تنها فاتحه خوانده می‌شود، بدون سورهٔ دیگر.',
          ms: 'Pada rakaat ketiga dan keempat hanya dibaca Al-Fatihah, tanpa surah tambahan.',
          ur: 'تیسری اور چوتھی رکعت میں صرف الفاتحہ پڑھی جاتی ہے، کوئی اضافی سورت نہیں۔',
          sw: 'Katika rakaa ya tatu na ya nne husomwa Al-Fatiha peke yake, bila sura ya ziada.',
          ru: 'В третьем и четвёртом ракатах читается только «Аль-Фатиха», без дополнительной суры.',
          ps: 'په درېیم او څلورم رکعت کې يوازې الفاتحه لوستل کیږي، پرته له بل سورت نه.',
        },
  };
}

// Dua al-Qunut (hanafitischer Wortlaut, „Allāhumma innā nastaʿīnuka …"), wird
// im Witr in der 3. Rak'ah nach Al-Fatiha gesprochen. Arabisch + Umschrift
// verbatim aus der etablierten Fassung; religiöse Gegenprüfung s.
// PRAY_ALONG_SOURCE_NOTE / USER-TODO.
function qunutStep(rakah: number): PrayStep {
  return {
    posture: 'qiyam',
    rakah,
    label: {
      de: 'Dua al-Qunut (nur Witr)',
      en: 'Dua al-Qunut (witr only)',
      tr: 'Kunut Duası (yalnız vitir)',
      ar: 'دعاء القنوت (في الوتر)',
      es: 'Dua al-Qunut (solo witr)',
      fr: 'Dua al-Qunut (witr uniquement)',
      id: 'Doa Qunut (hanya pada Witir)',
      bn: 'দোয়া কুনুত (কেবল বিতরে)',
      fa: 'دعای قنوت (تنها در وتر)',
      ms: 'Doa Qunut (hanya pada Witir)',
      ur: 'دعائے قنوت (صرف وتر میں)',
      sw: 'Dua ya Qunut (katika Witri pekee)',
      ru: 'Дуа аль-кунут (только в витре)',
      ps: 'د قنوت دعا (يوازې په وتر کې)',
    },
    arabic:
      'اللَّهُمَّ إِنَّا نَسْتَعِينُكَ وَنَسْتَغْفِرُكَ وَنُؤْمِنُ بِكَ وَنَتَوَكَّلُ عَلَيْكَ وَنُثْنِي عَلَيْكَ الْخَيْرَ، وَنَشْكُرُكَ وَلَا نَكْفُرُكَ، وَنَخْلَعُ وَنَتْرُكُ مَنْ يَفْجُرُكَ. اللَّهُمَّ إِيَّاكَ نَعْبُدُ وَلَكَ نُصَلِّي وَنَسْجُدُ، وَإِلَيْكَ نَسْعَى وَنَحْفِدُ، نَرْجُو رَحْمَتَكَ وَنَخْشَى عَذَابَكَ، إِنَّ عَذَابَكَ بِالْكُفَّارِ مُلْحِقٌ',
    transliteration:
      'allāhumma innā nastaʿīnuka wa-nastaghfiruka wa-nuʾminu bika wa-natawakkalu ʿalayka wa-nuthnī ʿalayka l-khayr, wa-nashkuruka wa-lā nakfuruka, wa-nakhlaʿu wa-natruku man yafjuruk. allāhumma iyyāka naʿbudu wa-laka nuṣallī wa-nasjud, wa-ilayka nasʿā wa-naḥfid, narjū raḥmataka wa-nakhshā ʿadhābak, inna ʿadhābaka bi-l-kuffāri mulḥiq',
    translation: {
      de: 'O Allah, wir bitten Dich um Hilfe und um Vergebung, glauben an Dich und vertrauen auf Dich; wir loben Dich auf das Beste, danken Dir und sind nicht undankbar. Wir sagen uns los von jedem, der Dir ungehorsam ist, und lassen ihn. O Allah, Dir allein dienen wir, für Dich beten und werfen wir uns nieder, zu Dir eilen und streben wir; wir erhoffen Deine Barmherzigkeit und fürchten Deine Strafe. Wahrlich, Deine Strafe ereilt die Ungläubigen.',
      en: 'O Allah, we seek Your help and Your forgiveness, we believe in You and rely upon You; we praise You in the best way, thank You and are not ungrateful. We forsake and abandon whoever disobeys You. O Allah, You alone we worship, for You we pray and prostrate, to You we strive and hasten; we hope for Your mercy and fear Your punishment. Truly, Your punishment will reach the disbelievers.',
      tr: 'Allah’ım! Senden yardım ve bağışlanma dileriz; Sana inanır, Sana tevekkül ederiz. Seni en güzel şekilde över, Sana şükreder, nankörlük etmeyiz. Sana isyan edeni bırakır ve terk ederiz. Allah’ım! Yalnız Sana ibadet eder, yalnız Senin için namaz kılar ve secde ederiz; Sana koşar, Sana yöneliriz. Rahmetini umar, azabından korkarız. Şüphesiz Senin azabın kâfirlere ulaşır.',
      ar: 'اللهم إنا نستعينك ونستغفرك ونؤمن بك ونتوكل عليك ونثني عليك الخير، ونشكرك ولا نكفرك، ونخلع ونترك من يفجرك. اللهم إياك نعبد ولك نصلي ونسجد، وإليك نسعى ونحفد، نرجو رحمتك ونخشى عذابك، إن عذابك بالكفار ملحق.',
      es: 'Oh Alá, buscamos Tu ayuda y Tu perdón, creemos en Ti y confiamos en Ti; Te alabamos del mejor modo, Te agradecemos y no somos ingratos. Nos desligamos y abandonamos a quien Te desobedece. Oh Alá, solo a Ti adoramos, para Ti rezamos y nos postramos, hacia Ti nos esforzamos y acudimos; esperamos Tu misericordia y tememos Tu castigo. En verdad, Tu castigo alcanzará a los incrédulos.',
      fr: 'Ô Allah, nous implorons Ton aide et Ton pardon, nous croyons en Toi et plaçons notre confiance en Toi ; nous Te louons de la meilleure façon, Te remercions et ne renions pas Tes bienfaits. Nous délaissons et abandonnons quiconque Te désobéit. Ô Allah, c’est Toi seul que nous adorons, pour Toi que nous prions et nous prosternons, vers Toi que nous nous empressons ; nous espérons Ta miséricorde et craignons Ton châtiment. En vérité, Ton châtiment atteindra les mécréants.',
      id: 'Ya Allah, kami memohon pertolongan dan ampunan-Mu, kami beriman kepada-Mu dan bertawakal kepada-Mu; kami memuji-Mu dengan sebaik-baiknya, bersyukur kepada-Mu dan tidak mengingkari-Mu. Kami melepaskan dan meninggalkan siapa saja yang durhaka kepada-Mu. Ya Allah, hanya Engkau yang kami sembah, untuk-Mu kami salat dan bersujud, kepada-Mu kami berusaha dan bersegera; kami mengharap rahmat-Mu dan takut akan azab-Mu. Sesungguhnya azab-Mu pasti menimpa orang-orang kafir.',
      bn: 'হে আল্লাহ, আমরা তোমার কাছে সাহায্য ও ক্ষমা চাই, তোমার প্রতি ঈমান আনি এবং তোমার ওপর ভরসা করি; আমরা তোমার সর্বোত্তম প্রশংসা করি, তোমার শোকর আদায় করি এবং অকৃতজ্ঞ হই না। যে তোমার অবাধ্য হয়, আমরা তাকে ত্যাগ করি ও ছেড়ে দিই। হে আল্লাহ, আমরা কেবল তোমারই ইবাদত করি, তোমারই জন্য নামাজ পড়ি ও সিজদা করি, তোমার দিকেই ছুটে যাই ও অগ্রসর হই; আমরা তোমার রহমতের আশা রাখি এবং তোমার আযাবকে ভয় করি। নিশ্চয়ই তোমার আযাব কাফিরদের ওপর পতিত হবে।',
      fa: 'خدایا، از تو یاری و آمرزش می‌خواهیم، به تو ایمان داریم و بر تو توکل می‌کنیم؛ تو را به نیکوترین وجه می‌ستاییم، سپاست می‌گزاریم و ناسپاسی نمی‌کنیم. از هر کس که تو را نافرمانی کند دوری می‌جوییم و او را وامی‌گذاریم. خدایا، تنها تو را می‌پرستیم، برای تو نماز می‌گزاریم و سجده می‌کنیم، به سوی تو می‌شتابیم و می‌کوشیم؛ به رحمت تو امید داریم و از عذاب تو می‌ترسیم. همانا عذاب تو به کافران خواهد رسید.',
      ms: 'Ya Allah, kami memohon pertolongan dan keampunan-Mu, kami beriman kepada-Mu dan bertawakal kepada-Mu; kami memuji-Mu dengan sebaik-baiknya, bersyukur kepada-Mu dan tidak mengingkari-Mu. Kami melepaskan dan meninggalkan sesiapa yang derhaka kepada-Mu. Ya Allah, hanya Engkau yang kami sembah, untuk-Mu kami solat dan sujud, kepada-Mu kami berusaha dan bersegera; kami mengharapkan rahmat-Mu dan takut akan azab-Mu. Sesungguhnya azab-Mu pasti menimpa orang-orang kafir.',
      ur: 'اے اللہ، ہم تجھ سے مدد اور مغفرت طلب کرتے ہیں، تجھ پر ایمان لاتے ہیں اور تجھ پر بھروسا کرتے ہیں؛ ہم تیری بہترین تعریف کرتے ہیں، تیرا شکر ادا کرتے ہیں اور ناشکری نہیں کرتے۔ ہم اُس کو چھوڑ دیتے ہیں جو تیری نافرمانی کرے۔ اے اللہ، ہم تیری ہی عبادت کرتے ہیں، تیرے ہی لیے نماز پڑھتے اور سجدہ کرتے ہیں، تیری ہی طرف دوڑتے اور بڑھتے ہیں؛ ہم تیری رحمت کی امید رکھتے ہیں اور تیرے عذاب سے ڈرتے ہیں۔ بے شک تیرا عذاب کافروں کو پہنچنے والا ہے۔',
      sw: 'Ewe Allah, tunakuomba msaada na msamaha Wako, tunakuamini na tunakutegemea; tunakusifu kwa sifa bora, tunakushukuru na hatukukufuru. Tunajitenga na kumwacha kila anayekuasi. Ewe Allah, Wewe pekee ndiye tunayemwabudu, kwa ajili Yako tunaswali na kusujudu, Kwako tunakimbilia na kuharakisha; tunatumaini rehema Yako na tunahofia adhabu Yako. Hakika adhabu Yako itawafikia makafiri.',
      ru: 'О Аллах, мы просим у Тебя помощи и прощения, веруем в Тебя и полагаемся на Тебя; мы восхваляем Тебя наилучшим образом, благодарим Тебя и не проявляем неблагодарности. Мы отрекаемся и оставляем всякого, кто Тебе непокорен. О Аллах, Тебе одному мы поклоняемся, для Тебя молимся и совершаем земной поклон, к Тебе стремимся и спешим; мы надеемся на Твою милость и страшимся Твоего наказания. Поистине, Твоё наказание постигнет неверующих.',
      ps: 'يا الله، له تا نه مرسته او بښنه غواړو، پر تا ایمان لرو او پر تا توکل کوو؛ تا په ښه توګه ستایو، شکر دې اداکوو او ناشکري نه کوو. له هغه چا څخه ځان لرې کوو او هغه پرېږدو چې ستا نافرماني کوي. يا الله، يوازې ستا عبادت کوو، ستا لپاره لمونځ کوو او سجده کوو، ستا لوري ته منډې وهو او هڅه کوو؛ ستا رحمت ته هیله لرو او ستا له عذابه ډارېږو. بېشکه ستا عذاب به کافرانو ته ورسېږي.',
    },
    note: {
      de: 'Nur im Witr, in der 3. Rak’ah: nach Al-Fatiha (ohne weitere Sure) „Allahu Akbar" sagen, die Hände heben und dieses Bittgebet leise sprechen, danach in den Ruku gehen. Hanafitisch VOR dem Ruku; andere Rechtsschulen sprechen den Qunut nach dem Ruku bzw. v. a. in der zweiten Ramadan-Hälfte.',
      en: 'Witr only, in the 3rd rakah: after Al-Fatiha (no additional surah) say “Allahu Akbar”, raise the hands and recite this supplication quietly, then go into ruku. Hanafi: BEFORE ruku; other schools recite it after ruku, or mainly in the second half of Ramadan.',
      tr: 'Yalnız vitirde, 3. rekâtta: Fâtiha’dan sonra (ek sure olmadan) „Allahu Ekber" de, elleri kaldır ve bu duayı sessizce oku, sonra rükûya git. Hanefî: rükûdan ÖNCE; diğer mezhepler rükûdan sonra ya da özellikle Ramazan’ın ikinci yarısında okur.',
      ar: 'في الوتر فقط، في الركعة الثالثة: بعد الفاتحة (دون سورة أخرى) قل „الله أكبر" وارفع يديك واقرأ هذا الدعاء سراً، ثم اركع. عند الحنفية قبل الركوع؛ وغيرهم يقنت بعد الركوع أو في النصف الثاني من رمضان.',
      es: 'Solo en witr, en la 3.ª raka: tras Al-Fatiha (sin sura adicional) di «Allahu Akbar», levanta las manos y recita esta súplica en voz baja, luego inclínate en ruku. Hanafí: ANTES del ruku; otras escuelas lo recitan tras el ruku, o sobre todo en la segunda mitad del Ramadán.',
      fr: 'Uniquement au witr, à la 3e rak’a : après Al-Fatiha (sans autre sourate), dis « Allahu Akbar », lève les mains et récite cette invocation à voix basse, puis effectue le ruku. Hanafite : AVANT le ruku ; les autres écoles la récitent après le ruku, ou surtout dans la seconde moitié du Ramadan.',
      id: 'Hanya pada Witir, di rakaat ketiga: setelah Al-Fatihah (tanpa surah tambahan) ucapkan “Allahu Akbar”, angkat tangan dan bacalah doa ini dengan lirih, lalu rukuklah. Mazhab Hanafi: SEBELUM rukuk; mazhab lain membacanya setelah rukuk, atau terutama pada paruh kedua Ramadan.',
      bn: 'কেবল বিতরে, তৃতীয় রাকাতে: আল-ফাতিহার পর (অতিরিক্ত সূরা ছাড়া) “আল্লাহু আকবার” বলো, হাত তোলো এবং এই দোয়াটি নিচু স্বরে পড়ো, তারপর রুকু করো। হানাফি মাযহাবে রুকুর আগে; অন্যান্য মাযহাবে রুকুর পর, অথবা মূলত রমজানের দ্বিতীয়ার্ধে পড়া হয়।',
      fa: 'تنها در وتر، در رکعت سوم: پس از فاتحه (بدون سورهٔ دیگر) «الله اکبر» بگو، دست‌ها را بالا ببر و این دعا را آهسته بخوان، سپس به رکوع برو. نزد حنفی پیش از رکوع؛ سایر مذاهب قنوت را پس از رکوع، یا بیشتر در نیمهٔ دوم رمضان می‌خوانند.',
      ms: 'Hanya pada Witir, di rakaat ketiga: selepas Al-Fatihah (tanpa surah tambahan) ucapkan “Allahu Akbar”, angkat tangan dan bacalah doa ini dengan perlahan, kemudian rukuk. Mazhab Hanafi: SEBELUM rukuk; mazhab lain membacanya selepas rukuk, atau lazimnya pada separuh kedua Ramadan.',
      ur: 'صرف وتر میں، تیسری رکعت میں: الفاتحہ کے بعد (بغیر کسی اضافی سورت کے) «اللہ اکبر» کہو، ہاتھ اٹھاؤ اور یہ دعا آہستہ پڑھو، پھر رکوع کرو۔ حنفی مسلک میں رکوع سے پہلے؛ دیگر مسالک میں رکوع کے بعد، یا زیادہ تر رمضان کے دوسرے نصف میں۔',
      sw: 'Katika Witri pekee, katika rakaa ya tatu: baada ya Al-Fatiha (bila sura ya ziada) sema “Allahu Akbar”, nyanyua mikono na usome dua hii kwa sauti ya chini, kisha uiname (rukuu). Madhehebu ya Kihanafi: KABLA ya rukuu; madhehebu mengine huisoma baada ya rukuu, au hasa katika nusu ya pili ya Ramadhani.',
      ru: 'Только в витре, в третьем ракате: после «Аль-Фатихи» (без дополнительной суры) скажи «Аллаху акбар», подними руки и прочти эту мольбу тихо, затем соверши поясной поклон. У ханафитов — ДО поясного поклона; другие мазхабы читают кунут после поклона либо преимущественно во второй половине Рамадана.',
      ps: 'يوازې په وتر کې، په درېیم رکعت کې: له فاتحې وروسته (پرته له بل سورت نه) «الله اکبر» ووایه، لاسونه پورته کړه او دا دعا ورو ولوله، بیا رکوع وکړه. په حنفي مذهب کې له رکوع دمخه؛ نور مذهبونه قنوت له رکوع وروسته، یا زیاتره د رمضان په دویمه نیمایي کې لولي.',
    },
  };
}

function rukuStep(rakah: number): PrayStep {
  return {
    posture: 'ruku',
    rakah,
    label: {
      de: 'Ruku – Verbeugung',
      en: 'Ruku – bowing',
      tr: 'Rükû',
      ar: 'الركوع',
      es: 'Ruku – inclinación',
      fr: 'Ruku – inclinaison',
      id: 'Rukuk – membungkuk',
      bn: 'রুকু – ঝুঁকে পড়া',
      fa: 'رکوع – خم شدن',
      ms: 'Rukuk – tunduk',
      ur: 'رکوع – جھکنا',
      sw: 'Ruku – kuinama',
      ru: 'Руку — поясной поклон',
      ps: 'رکوع – ټیټیدل',
    },
    arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    transliteration: 'subḥāna rabbiya l-ʿaẓīm',
    repeat: '×3',
    translation: {
      de: 'Gepriesen sei mein Herr, der Gewaltige.',
      en: 'Glory to my Lord, the Magnificent.',
      tr: 'Yüce Rabbimi tesbih ederim.',
      ar: 'سبحان ربي العظيم.',
      es: 'Gloria a mi Señor, el Grandioso.',
      fr: 'Gloire à mon Seigneur, le Grandiose.',
      id: 'Mahasuci Tuhanku Yang Mahaagung.',
      bn: 'আমার মহান রবের পবিত্রতা ঘোষণা করছি।',
      fa: 'پاک و منزه است پروردگار بزرگ من.',
      ms: 'Maha Suci Tuhanku Yang Maha Agung.',
      ur: 'پاک ہے میرا عظیم رب۔',
      sw: 'Ametakasika Mola wangu Mtukufu.',
      ru: 'Пречист мой Господь Великий.',
      ps: 'پاک دی زما لوی پالونکی.',
    },
    note: {
      de: 'Mit „Allahu Akbar" verbeugen: Rücken gerade, Hände auf den Knien. Mindestens dreimal wiederholen.',
      en: 'Bow saying “Allahu Akbar”: back straight, hands on the knees. Repeat at least three times.',
      tr: '„Allahu Ekber" ile eğil: sırt düz, eller dizlerde. En az üç kez tekrarla.',
      ar: 'اركع بـ„الله أكبر": الظهر مستوٍ واليدان على الركبتين. كرّر ثلاثاً على الأقل.',
      es: 'Inclínate diciendo «Allahu Akbar»: espalda recta, manos sobre las rodillas. Repite al menos tres veces.',
      fr: 'Incline-toi en disant « Allahu Akbar » : dos droit, mains sur les genoux. Répète au moins trois fois.',
      id: 'Rukuklah sambil mengucap “Allahu Akbar”: punggung lurus, tangan di lutut. Ulangi sekurang-kurangnya tiga kali.',
      bn: '“আল্লাহু আকবার” বলে রুকু করো: পিঠ সোজা, হাত দুই হাঁটুর ওপর। অন্তত তিনবার পড়ো।',
      fa: 'با «الله اکبر» رکوع کن: پشت صاف، دست‌ها بر زانوها. دست‌کم سه بار تکرار کن.',
      ms: 'Rukuk sambil mengucap “Allahu Akbar”: belakang lurus, tangan di atas lutut. Ulangi sekurang-kurangnya tiga kali.',
      ur: '«اللہ اکبر» کہہ کر رکوع کرو: پیٹھ سیدھی، ہاتھ گھٹنوں پر۔ کم از کم تین بار دہراؤ۔',
      sw: 'Inama ukisema “Allahu Akbar”: mgongo ulionyooka, mikono magotini. Rudia angalau mara tatu.',
      ru: 'Соверши поясной поклон со словами «Аллаху акбар»: спина ровная, руки на коленях. Повтори не менее трёх раз.',
      ps: 'په «الله اکبر» سره رکوع وکړه: ملا سمه، لاسونه پر زنګنونو. لږ تر لږه درې ځله ویې وایه.',
    },
  };
}

function itidalStep(rakah: number): PrayStep {
  return {
    posture: 'itidal',
    rakah,
    label: {
      de: 'I’tidal – Aufrichten',
      en: 'I’tidal – standing up',
      tr: 'Kavme – doğrulma',
      ar: 'الاعتدال – الرفع من الركوع',
      es: 'I’tidal – levantarse',
      fr: 'I’tidal – se relever',
      id: 'Iktidal – berdiri kembali',
      bn: 'ইতিদাল – উঠে দাঁড়ানো',
      fa: 'اعتدال – برخاستن',
      ms: 'Iktidal – berdiri kembali',
      ur: 'اعتدال – کھڑا ہونا',
      sw: 'Itidali – kusimama tena',
      ru: 'Итидаль — выпрямление',
      ps: 'اعتدال – بیا ودریدل',
    },
    arabic: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ · رَبَّنَا وَلَكَ الْحَمْدُ',
    transliteration: 'samiʿa llāhu li-man ḥamidah · rabbanā wa-laka l-ḥamd',
    translation: {
      de: 'Allah hört den, der Ihn lobt. – Unser Herr, Dir gebührt das Lob.',
      en: 'Allah hears the one who praises Him. — Our Lord, to You belongs all praise.',
      tr: 'Allah kendisine hamd edeni işitir. – Rabbimiz, hamd Sanadır.',
      ar: 'سمع الله لمن حمده. – ربنا ولك الحمد.',
      es: 'Alá escucha a quien Lo alaba. – Señor nuestro, a Ti pertenece toda alabanza.',
      fr: 'Allah entend celui qui Le loue. – Notre Seigneur, à Toi appartient la louange.',
      id: 'Allah mendengar orang yang memuji-Nya. – Ya Tuhan kami, bagi-Mu segala puji.',
      bn: 'আল্লাহ তাঁর প্রশংসাকারীর কথা শোনেন। – হে আমাদের রব, সমস্ত প্রশংসা তোমারই।',
      fa: 'خداوند شنوای کسی است که او را می‌ستاید. – پروردگارا، ستایش تنها از آنِ توست.',
      ms: 'Allah mendengar orang yang memuji-Nya. – Wahai Tuhan kami, bagi-Mu segala pujian.',
      ur: 'اللہ نے سن لیا جس نے اس کی تعریف کی۔ – اے ہمارے رب، تمام تعریف تیرے ہی لیے ہے۔',
      sw: 'Allah humsikia anayemsifu. – Mola wetu, sifa zote ni zako.',
      ru: 'Аллах слышит того, кто восхваляет Его. – Господь наш, Тебе хвала.',
      ps: 'الله د هغه چا اوري چې د هغه ستاینه کوي. – ای زموږ پالونکیه، ټوله ستاینه یوازې ستا ده.',
    },
    note: {
      de: 'Beim Aufrichten „Sami’Allahu liman hamidah" sagen, im vollständigen Stand „Rabbana wa lakal-hamd".',
      en: 'While rising say “Sami‘Allahu liman hamidah”, and when fully upright “Rabbana wa lakal-hamd”.',
      tr: 'Doğrulurken „Semi’allahu limen hamideh", tam ayaktayken „Rabbena leke’l-hamd".',
      ar: 'ترفع قائلاً „سمع الله لمن حمده"، وعند الاعتدال „ربنا ولك الحمد".',
      es: 'Al levantarte di «Sami‘Allahu liman hamidah» y ya erguido «Rabbana wa lakal-hamd».',
      fr: 'En te relevant, dis « Sami‘Allahu liman hamidah », puis debout « Rabbana wa lakal-hamd ».',
      id: 'Saat bangkit ucapkan “Sami‘Allahu liman hamidah”, dan setelah berdiri tegak “Rabbana wa lakal-hamd”.',
      bn: 'ওঠার সময় “সামি‘আল্লাহু লিমান হামিদাহ” বলো, আর পুরোপুরি সোজা দাঁড়িয়ে “রাব্বানা ওয়া লাকাল-হামদ” বলো।',
      fa: 'هنگام برخاستن «سمع الله لمن حمده» بگو و در حال ایستادن کامل «ربنا ولک الحمد».',
      ms: 'Ketika bangun ucapkan “Sami‘Allahu liman hamidah”, dan setelah berdiri tegak “Rabbana wa lakal-hamd”.',
      ur: 'اٹھتے وقت «سمع اللہ لمن حمدہ» کہو اور پوری طرح سیدھے کھڑے ہو کر «ربنا ولک الحمد»۔',
      sw: 'Unaposimama sema “Sami‘Allahu liman hamidah”, na ukishasimama wima “Rabbana wa lakal-hamd”.',
      ru: 'Поднимаясь, скажи «Сами‘Аллаху лиман хамидах», а выпрямившись полностью — «Раббана ва лакаль-хамд».',
      ps: 'د پاڅېدو پر مهال «سمع الله لمن حمده» ووایه او په بشپړ ولاړ حالت کې «ربنا ولک الحمد».',
    },
  };
}

function sujudStep(rakah: number, order: 1 | 2): PrayStep {
  return {
    posture: 'sujud',
    rakah,
    label: {
      de: `Sujud – Niederwerfung (${order}. von 2)`,
      en: `Sujud – prostration (${order} of 2)`,
      tr: `Secde (${order}. / 2)`,
      ar: `السجود (${order} من 2)`,
      es: `Sujud – postración (${order} de 2)`,
      fr: `Sujud – prosternation (${order} sur 2)`,
      id: `Sujud (${order} dari 2)`,
      bn: `সিজদা (${order}/২)`,
      fa: `سجده (${order} از ۲)`,
      ms: `Sujud (${order} daripada 2)`,
      ur: `سجدہ (${order} از ۲)`,
      sw: `Sijida (${order} kati ya 2)`,
      ru: `Суджуд — земной поклон (${order} из 2)`,
      ps: `سجده (${order} له ۲ نه)`,
    },
    arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    transliteration: 'subḥāna rabbiya l-aʿlā',
    repeat: '×3',
    translation: {
      de: 'Gepriesen sei mein Herr, der Höchste.',
      en: 'Glory to my Lord, the Most High.',
      tr: 'En yüce Rabbimi tesbih ederim.',
      ar: 'سبحان ربي الأعلى.',
      es: 'Gloria a mi Señor, el Altísimo.',
      fr: 'Gloire à mon Seigneur, le Très-Haut.',
      id: 'Mahasuci Tuhanku Yang Mahatinggi.',
      bn: 'আমার সর্বোচ্চ রবের পবিত্রতা ঘোষণা করছি।',
      fa: 'پاک و منزه است پروردگار برتر من.',
      ms: 'Maha Suci Tuhanku Yang Maha Tinggi.',
      ur: 'پاک ہے میرا سب سے بلند رب۔',
      sw: 'Ametakasika Mola wangu Aliye Juu.',
      ru: 'Пречист мой Господь Всевышний.',
      ps: 'پاک دی زما تر ټولو لوړ پالونکی.',
    },
    note: {
      de: 'Mit „Allahu Akbar" niederwerfen – Stirn, Nase, beide Handflächen, Knie und Zehenspitzen berühren den Boden. Mindestens dreimal wiederholen.',
      en: 'Prostrate saying “Allahu Akbar” — forehead, nose, both palms, knees and toes touch the ground. Repeat at least three times.',
      tr: '„Allahu Ekber" ile secdeye git – alın, burun, iki avuç, dizler ve ayak parmakları yerde. En az üç kez tekrarla.',
      ar: 'اسجد بـ„الله أكبر": الجبهة والأنف والكفان والركبتان وأطراف القدمين على الأرض. كرّر ثلاثاً على الأقل.',
      es: 'Póstrate diciendo «Allahu Akbar»: frente, nariz, ambas palmas, rodillas y dedos de los pies tocan el suelo. Repite al menos tres veces.',
      fr: 'Prosterne-toi en disant « Allahu Akbar » : front, nez, les deux paumes, genoux et orteils au sol. Répète au moins trois fois.',
      id: 'Sujudlah sambil mengucap “Allahu Akbar” – dahi, hidung, kedua telapak tangan, kedua lutut dan ujung jari kaki menyentuh lantai. Ulangi sekurang-kurangnya tiga kali.',
      bn: '“আল্লাহু আকবার” বলে সিজদা করো – কপাল, নাক, দুই হাতের তালু, দুই হাঁটু ও পায়ের আঙুল মাটিতে ঠেকবে। অন্তত তিনবার পড়ো।',
      fa: 'با «الله اکبر» به سجده برو – پیشانی، بینی، کف دست‌ها، زانوها و انگشتان پا بر زمین. دست‌کم سه بار تکرار کن.',
      ms: 'Sujudlah sambil mengucap “Allahu Akbar” – dahi, hidung, kedua tapak tangan, kedua lutut dan hujung jari kaki menyentuh lantai. Ulangi sekurang-kurangnya tiga kali.',
      ur: '«اللہ اکبر» کہہ کر سجدہ کرو – پیشانی، ناک، دونوں ہتھیلیاں، گھٹنے اور پاؤں کی انگلیاں زمین پر ہوں۔ کم از کم تین بار دہراؤ۔',
      sw: 'Sujudu ukisema “Allahu Akbar” – paji la uso, pua, viganja, magoti na vidole vya miguu vinagusa ardhi. Rudia angalau mara tatu.',
      ru: 'Соверши земной поклон со словами «Аллаху акбар» — лоб, нос, обе ладони, колени и пальцы ног касаются земли. Повтори не менее трёх раз.',
      ps: 'په «الله اکبر» سره سجده وکړه – تندی، پزه، د لاسونو تلي، زنګنونه او د پښو ګوتې ځمکې ته ونښلوه. لږ تر لږه درې ځله ویې وایه.',
    },
  };
}

function jalsaStep(rakah: number): PrayStep {
  return {
    posture: 'jalsa',
    rakah,
    label: {
      de: 'Jalsa – Sitzen zwischen den Niederwerfungen',
      en: 'Jalsa – sitting between prostrations',
      tr: 'Celse – iki secde arası oturuş',
      ar: 'الجلسة بين السجدتين',
      es: 'Jalsa – sentarse entre las postraciones',
      fr: 'Jalsa – s’asseoir entre les prosternations',
      id: 'Duduk di antara dua sujud',
      bn: 'দুই সিজদার মধ্যে বসা',
      fa: 'نشستن بین دو سجده',
      ms: 'Duduk antara dua sujud',
      ur: 'دو سجدوں کے درمیان بیٹھنا',
      sw: 'Kuketi baina ya sijida mbili',
      ru: 'Джальса — сидение между двумя суджудами',
      ps: 'د دوو سجدو ترمنځ ناستل',
    },
    arabic: 'رَبِّ اغْفِرْ لِي',
    transliteration: 'rabbi ghfir lī',
    translation: {
      de: 'Mein Herr, vergib mir.',
      en: 'My Lord, forgive me.',
      tr: 'Rabbim, beni bağışla.',
      ar: 'رب اغفر لي.',
      es: 'Señor mío, perdóname.',
      fr: 'Mon Seigneur, pardonne-moi.',
      id: 'Tuhanku, ampunilah aku.',
      bn: 'হে আমার রব, আমাকে ক্ষমা করো।',
      fa: 'پروردگارا، مرا بیامرز.',
      ms: 'Tuhanku, ampunilah daku.',
      ur: 'اے میرے رب، مجھے بخش دے۔',
      sw: 'Mola wangu, nisamehe.',
      ru: 'Господь мой, прости меня.',
      ps: 'ای زما ربه، ما وبخښه.',
    },
    note: {
      de: 'Mit „Allahu Akbar" kurz aufsitzen, um Vergebung bitten, danach folgt die zweite Niederwerfung.',
      en: 'Sit up briefly with “Allahu Akbar”, ask for forgiveness, then the second prostration follows.',
      tr: '„Allahu Ekber" ile kısaca otur, bağışlanma dile, sonra ikinci secde gelir.',
      ar: 'اجلس قليلاً بـ„الله أكبر" واطلب المغفرة، ثم تأتي السجدة الثانية.',
      es: 'Siéntate brevemente con «Allahu Akbar», pide perdón y luego viene la segunda postración.',
      fr: 'Assieds-toi brièvement avec « Allahu Akbar », demande pardon, puis vient la seconde prosternation.',
      id: 'Duduklah sejenak dengan “Allahu Akbar”, mohon ampun, lalu sujud kedua kalinya.',
      bn: '“আল্লাহু আকবার” বলে অল্প সময় বসো, ক্ষমা প্রার্থনা করো, তারপর দ্বিতীয় সিজদা করো।',
      fa: 'با «الله اکبر» کوتاه بنشین، آمرزش بخواه، سپس سجدهٔ دوم را به‌جا آور.',
      ms: 'Duduk sebentar dengan “Allahu Akbar”, mohon keampunan, kemudian sujud kali kedua.',
      ur: '«اللہ اکبر» کہہ کر تھوڑی دیر بیٹھو، مغفرت مانگو، پھر دوسرا سجدہ کرو۔',
      sw: 'Kaa kitambo kwa “Allahu Akbar”, omba msamaha, kisha usujudu mara ya pili.',
      ru: 'Ненадолго сядь со словами «Аллаху акбар», попроси прощения, затем следует второй земной поклон.',
      ps: 'په «الله اکبر» سره لنډ کېنه، بښنه وغواړه، بیا دویمه سجده وکړه.',
    },
  };
}

function tashahhudStep(rakah: number, final: boolean): PrayStep {
  return {
    posture: 'tashahhud',
    rakah,
    label: final
      ? {
          de: 'Tashahhud – letztes Sitzen',
          en: 'Tashahhud – final sitting',
          tr: 'Tahiyyat – son oturuş',
          ar: 'التشهد – الجلوس الأخير',
          es: 'Tashahhud – sesión final',
          fr: 'Tashahhud – dernière position assise',
          id: 'Tasyahud – duduk akhir',
          bn: 'তাশাহহুদ – শেষ বৈঠক',
          fa: 'تشهد – نشست پایانی',
          ms: 'Tasyahud – duduk akhir',
          ur: 'تشہد – آخری قعدہ',
          sw: 'Tashahhud – kikao cha mwisho',
          ru: 'Ташаххуд — последнее сидение',
          ps: 'تشهد – وروستۍ کیناستل',
        }
      : {
          de: 'Tashahhud – erstes Sitzen',
          en: 'Tashahhud – first sitting',
          tr: 'Tahiyyat – ilk oturuş',
          ar: 'التشهد – الجلوس الأول',
          es: 'Tashahhud – primera sesión',
          fr: 'Tashahhud – première position assise',
          id: 'Tasyahud – duduk pertama',
          bn: 'তাশাহহুদ – প্রথম বৈঠক',
          fa: 'تشهد – نشست نخست',
          ms: 'Tasyahud – duduk pertama',
          ur: 'تشہد – پہلا قعدہ',
          sw: 'Tashahhud – kikao cha kwanza',
          ru: 'Ташаххуд — первое сидение',
          ps: 'تشهد – لومړۍ کیناستل',
        },
    arabic:
      'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration:
      'at-taḥiyyātu lillāh, waṣ-ṣalawātu waṭ-ṭayyibāt, as-salāmu ʿalayka ayyuhā n-nabiyyu wa-raḥmatu llāhi wa-barakātuh, as-salāmu ʿalaynā wa-ʿalā ʿibādi llāhi ṣ-ṣāliḥīn, ashhadu an lā ilāha illā llāh wa-ashhadu anna muḥammadan ʿabduhū wa-rasūluh',
    translation: {
      de: 'Alle Ehrerbietungen, Gebete und guten Taten gehören Allah. Friede sei auf dir, o Prophet, und die Barmherzigkeit Allahs und Seine Segnungen. Friede sei auf uns und auf den rechtschaffenen Dienern Allahs. Ich bezeuge, dass es keinen Gott gibt außer Allah, und ich bezeuge, dass Muhammad Sein Diener und Gesandter ist.',
      en: 'All greetings, prayers and good deeds belong to Allah. Peace be upon you, O Prophet, and the mercy of Allah and His blessings. Peace be upon us and upon the righteous servants of Allah. I bear witness that there is no god but Allah, and I bear witness that Muhammad is His servant and messenger.',
      tr: 'Bütün tahiyyeler, salavatlar ve güzel işler Allah’a mahsustur. Selam, rahmet ve bereket sana olsun ey Peygamber. Selam bize ve Allah’ın salih kullarına olsun. Şehadet ederim ki Allah’tan başka ilah yoktur ve şehadet ederim ki Muhammed O’nun kulu ve elçisidir.',
      ar: 'التحيات لله والصلوات والطيبات، السلام عليك أيها النبي ورحمة الله وبركاته، السلام علينا وعلى عباد الله الصالحين، أشهد أن لا إله إلا الله وأشهد أن محمداً عبده ورسوله.',
      es: 'Todos los saludos, oraciones y buenas obras pertenecen a Alá. La paz sea contigo, oh Profeta, y la misericordia de Alá y Sus bendiciones. La paz sea con nosotros y con los siervos justos de Alá. Atestiguo que no hay más dios que Alá y atestiguo que Muhammad es Su siervo y mensajero.',
      fr: 'Toutes les salutations, prières et bonnes actions appartiennent à Allah. Que la paix soit sur toi, ô Prophète, ainsi que la miséricorde d’Allah et Ses bénédictions. Que la paix soit sur nous et sur les serviteurs vertueux d’Allah. J’atteste qu’il n’y a de divinité qu’Allah et j’atteste que Muhammad est Son serviteur et Son messager.',
      id: 'Segala penghormatan, salawat dan segala kebaikan milik Allah. Salam sejahtera atasmu, wahai Nabi, dan rahmat Allah serta berkah-Nya. Salam sejahtera atas kami dan atas hamba-hamba Allah yang saleh. Aku bersaksi bahwa tidak ada tuhan selain Allah, dan aku bersaksi bahwa Muhammad adalah hamba-Nya dan utusan-Nya.',
      bn: 'সকল অভিবাদন, সালাত ও সকল সৎকাজ আল্লাহর জন্য। হে নবী, আপনার প্রতি শান্তি, আল্লাহর করুণা ও তাঁর বরকত বর্ষিত হোক। শান্তি বর্ষিত হোক আমাদের ওপর এবং আল্লাহর সৎকর্মশীল বান্দাদের ওপর। আমি সাক্ষ্য দিচ্ছি যে আল্লাহ ছাড়া কোনো উপাস্য নেই, এবং আমি সাক্ষ্য দিচ্ছি যে মুহাম্মদ তাঁর বান্দা ও তাঁর রাসূল।',
      fa: 'همهٔ تحیات، درودها و کارهای نیک از آنِ خداست. سلام بر تو باد، ای پیامبر، و رحمت خدا و برکات او. سلام بر ما و بر بندگان شایستهٔ خدا. گواهی می‌دهم که هیچ معبودی جز خدا نیست، و گواهی می‌دهم که محمد بندهٔ او و رسول اوست.',
      ms: 'Segala penghormatan, selawat dan segala kebaikan milik Allah. Salam sejahtera ke atasmu, wahai Nabi, dan rahmat Allah serta berkat-Nya. Salam sejahtera ke atas kami dan ke atas hamba-hamba Allah yang soleh. Aku bersaksi bahawa tiada tuhan selain Allah, dan aku bersaksi bahawa Muhammad adalah hamba-Nya dan utusan-Nya.',
      ur: 'سب تعظیمیں، صلاتیں اور نیک اعمال اللہ کے لیے ہیں۔ اے نبی، آپ پر سلامتی ہو اور اللہ کی رحمت اور اس کی برکتیں۔ ہم پر اور اللہ کے نیک بندوں پر سلامتی ہو۔ میں گواہی دیتا ہوں کہ اللہ کے سوا کوئی معبود نہیں، اور میں گواہی دیتا ہوں کہ محمد اس کا بندہ اور اس کا رسول ہے۔',
      sw: 'Salamu zote, sala na matendo mema ni za Allah. Amani iwe juu yako, ewe Nabii, na rehema ya Allah na baraka Zake. Amani iwe juu yetu na juu ya waja wema wa Allah. Nashuhudia kwamba hakuna mola isipokuwa Allah, na nashuhudia kwamba Muhammad ni mja Wake na mtume Wake.',
      ru: 'Все приветствия, молитвы и добрые дела принадлежат Аллаху. Мир тебе, о Пророк, и милость Аллаха и Его благословения. Мир нам и праведным рабам Аллаха. Свидетельствую, что нет божества, кроме Аллаха, и свидетельствую, что Мухаммад — Его раб и Его посланник.',
      ps: 'ټول درنښتونه، لمونځونه او ښې کړنې د الله لپاره دي. سلام دې پر تا وي، ای پیغمبره، او د الله رحمت او د هغه برکتونه. پر موږ او د الله پر صالحو بندګانو دې سلام وي. شاهدي ورکوم چې پرته له الله نه هېڅ معبود نشته، او شاهدي ورکوم چې محمد د هغه بنده او د هغه استازی دی.',
    },
    note: final
      ? {
          de: 'Im Sitzen leise sprechen. Beim Schahada-Teil den rechten Zeigefinger heben (Sunnah). Danach folgen Salawat und der Salam.',
          en: 'Recited quietly while sitting. Raise the right index finger at the shahada part (sunnah). Salawat and the salam follow.',
          tr: 'Otururken sessizce oku. Şehadet kısmında sağ işaret parmağını kaldır (sünnet). Sonra salavat ve selam gelir.',
          ar: 'يُقال سراً في الجلوس. عند الشهادة يُرفع السبابة اليمنى (سنة). ثم تأتي الصلاة الإبراهيمية والتسليم.',
          es: 'Se recita en voz baja sentado. En la shahada levanta el índice derecho (sunna). Siguen la salawat y el salam.',
          fr: 'À réciter à voix basse, assis. Lève l’index droit lors de la shahada (sunna). Suivent la salawat et le salam.',
          id: 'Dibaca lirih sambil duduk. Pada bagian syahadat, angkat jari telunjuk kanan (sunah). Setelah itu menyusul selawat dan salam.',
          bn: 'বসা অবস্থায় নিচু স্বরে পড়ো। শাহাদাতের অংশে ডান হাতের শাহাদাত আঙুল তোলো (সুন্নত)। এরপর দরূদ ও সালাম।',
          fa: 'نشسته و آهسته خوانده می‌شود. در بخش شهادت، انگشت اشارهٔ راست را بلند کن (سنت). سپس صلوات و سلام می‌آید.',
          ms: 'Dibaca perlahan sambil duduk. Pada bahagian syahadah, angkat jari telunjuk kanan (sunat). Selepas itu menyusul selawat dan salam.',
          ur: 'بیٹھ کر آہستہ پڑھو۔ شہادت کے حصے میں دائیں ہاتھ کی شہادت کی انگلی اٹھاؤ (سنت)۔ اس کے بعد درود اور سلام ہے۔',
          sw: 'Husomwa kwa sauti ya chini ukiwa umeketi. Katika sehemu ya shahada nyanyua kidole cha shahada cha kulia (sunna). Kisha hufuata salawat na salamu.',
          ru: 'Читается тихо сидя. На словах шахады подними указательный палец правой руки (сунна). Затем следуют салават и салам.',
          ps: 'ناست او ورو لوستل کیږي. د شهادت په برخه کې د ښي لاس شهادت ګوته پورته کړه (سنت). بیا درود او سلام راځي.',
        }
      : {
          de: 'Nach der zweiten Rak’ah im Sitzen leise sprechen. Beim Schahada-Teil den rechten Zeigefinger heben (Sunnah). Danach zur nächsten Rak’ah aufstehen.',
          en: 'After the second rakah, recited quietly while sitting. Raise the right index finger at the shahada part (sunnah). Then stand up for the next rakah.',
          tr: 'İkinci rekâttan sonra otururken sessizce oku. Şehadette sağ işaret parmağını kaldır (sünnet). Sonra bir sonraki rekât için ayağa kalk.',
          ar: 'بعد الركعة الثانية يُقال سراً في الجلوس. عند الشهادة يُرفع السبابة (سنة). ثم تقوم للركعة التالية.',
          es: 'Tras la segunda raka, se recita sentado en voz baja. En la shahada levanta el índice (sunna). Luego levántate para la siguiente raka.',
          fr: 'Après la deuxième rak’a, à réciter assis à voix basse. Lève l’index lors de la shahada (sunna). Lève-toi ensuite pour la rak’a suivante.',
          id: 'Setelah rakaat kedua, dibaca lirih sambil duduk. Pada bagian syahadat, angkat jari telunjuk kanan (sunah). Lalu berdirilah untuk rakaat berikutnya.',
          bn: 'দ্বিতীয় রাকাতের পর বসে নিচু স্বরে পড়ো। শাহাদাতের অংশে শাহাদাত আঙুল তোলো (সুন্নত)। এরপর পরবর্তী রাকাতের জন্য দাঁড়াও।',
          fa: 'پس از رکعت دوم، نشسته و آهسته خوانده می‌شود. در بخش شهادت انگشت اشاره را بلند کن (سنت). سپس برای رکعت بعدی برخیز.',
          ms: 'Selepas rakaat kedua, dibaca perlahan sambil duduk. Pada bahagian syahadah, angkat jari telunjuk (sunat). Kemudian bangunlah untuk rakaat berikutnya.',
          ur: 'دوسری رکعت کے بعد بیٹھ کر آہستہ پڑھو۔ شہادت کے حصے میں شہادت کی انگلی اٹھاؤ (سنت)۔ پھر اگلی رکعت کے لیے کھڑے ہو جاؤ۔',
          sw: 'Baada ya rakaa ya pili, husomwa kwa sauti ya chini ukiwa umeketi. Katika sehemu ya shahada nyanyua kidole cha shahada (sunna). Kisha simama kwa rakaa inayofuata.',
          ru: 'После второго раката читается тихо сидя. На словах шахады подними указательный палец (сунна). Затем встань для следующего раката.',
          ps: 'له دویم رکعت وروسته، ناست او ورو لوستل کیږي. د شهادت په برخه کې شهادت ګوته پورته کړه (سنت). بیا د راتلونکي رکعت لپاره ودرېږه.',
        },
  };
}

function salawatStep(rakah: number): PrayStep {
  return {
    posture: 'tashahhud',
    rakah,
    label: {
      de: 'Salawat – Segenswünsche auf den Propheten ﷺ',
      en: 'Salawat – blessings upon the Prophet ﷺ',
      tr: 'Salli-Barik – Peygamber’e ﷺ salavat',
      ar: 'الصلاة الإبراهيمية',
      es: 'Salawat – bendiciones sobre el Profeta ﷺ',
      fr: 'Salawat – bénédictions sur le Prophète ﷺ',
      id: 'Selawat – salawat atas Nabi ﷺ',
      bn: 'সালাওয়াত – নবী ﷺ-এর ওপর দরূদ',
      fa: 'صلوات – درود بر پیامبر ﷺ',
      ms: 'Selawat – selawat ke atas Nabi ﷺ',
      ur: 'درود – نبی ﷺ پر درود',
      sw: 'Salawat – rehema juu ya Mtume ﷺ',
      ru: 'Салават — благословение на Пророка ﷺ',
      ps: 'درود – پر نبي ﷺ درود',
    },
    arabic:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ. اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    transliteration:
      'allāhumma ṣalli ʿalā muḥammadin wa-ʿalā āli muḥammad, kamā ṣallayta ʿalā ibrāhīma wa-ʿalā āli ibrāhīm, innaka ḥamīdun majīd. allāhumma bārik ʿalā muḥammadin wa-ʿalā āli muḥammad, kamā bārakta ʿalā ibrāhīma wa-ʿalā āli ibrāhīm, innaka ḥamīdun majīd',
    translation: {
      de: 'O Allah, segne Muhammad und die Familie Muhammads, wie Du Ibrahim und die Familie Ibrahims gesegnet hast; wahrlich, Du bist lobenswert, ruhmreich. O Allah, sei gnädig zu Muhammad und der Familie Muhammads, wie Du Ibrahim und der Familie Ibrahims gnädig warst; wahrlich, Du bist lobenswert, ruhmreich.',
      en: 'O Allah, send blessings upon Muhammad and the family of Muhammad, as You blessed Ibrahim and the family of Ibrahim; indeed, You are praiseworthy, glorious. O Allah, bless Muhammad and the family of Muhammad, as You blessed Ibrahim and the family of Ibrahim; indeed, You are praiseworthy, glorious.',
      tr: 'Allah’ım, İbrahim’e ve İbrahim’in ailesine salat ettiğin gibi Muhammed’e ve ailesine salat et; şüphesiz Sen övgüye layıksın, şanlısın. Allah’ım, İbrahim’i ve ailesini mübarek kıldığın gibi Muhammed’i ve ailesini mübarek kıl; şüphesiz Sen övgüye layıksın, şanlısın.',
      ar: 'اللهم صل على محمد وعلى آل محمد كما صليت على إبراهيم وعلى آل إبراهيم إنك حميد مجيد. اللهم بارك على محمد وعلى آل محمد كما باركت على إبراهيم وعلى آل إبراهيم إنك حميد مجيد.',
      es: 'Oh Alá, bendice a Muhammad y a la familia de Muhammad, como bendijiste a Ibrahim y a la familia de Ibrahim; en verdad, Tú eres digno de alabanza, glorioso. Oh Alá, colma de gracia a Muhammad y a su familia, como lo hiciste con Ibrahim y su familia; en verdad, Tú eres digno de alabanza, glorioso.',
      fr: 'Ô Allah, bénis Muhammad et la famille de Muhammad, comme Tu as béni Ibrahim et la famille d’Ibrahim ; en vérité, Tu es digne de louange, glorieux. Ô Allah, accorde Ta grâce à Muhammad et à sa famille, comme Tu l’as fait pour Ibrahim et sa famille ; en vérité, Tu es digne de louange, glorieux.',
      id: 'Ya Allah, limpahkanlah selawat kepada Muhammad dan keluarga Muhammad, sebagaimana Engkau limpahkan selawat kepada Ibrahim dan keluarga Ibrahim; sesungguhnya Engkau Maha Terpuji lagi Mahamulia. Ya Allah, berkahilah Muhammad dan keluarga Muhammad, sebagaimana Engkau berkahi Ibrahim dan keluarga Ibrahim; sesungguhnya Engkau Maha Terpuji lagi Mahamulia.',
      bn: 'হে আল্লাহ, মুহাম্মদ ও মুহাম্মদের পরিবারের প্রতি রহমত বর্ষণ করো, যেমন তুমি ইব্রাহীম ও ইব্রাহীমের পরিবারের প্রতি রহমত বর্ষণ করেছিলে; নিশ্চয়ই তুমি প্রশংসিত, গৌরবময়। হে আল্লাহ, মুহাম্মদ ও মুহাম্মদের পরিবারের প্রতি বরকত দাও, যেমন তুমি ইব্রাহীম ও ইব্রাহীমের পরিবারের প্রতি বরকত দিয়েছিলে; নিশ্চয়ই তুমি প্রশংসিত, গৌরবময়।',
      fa: 'خدایا، بر محمد و بر خاندان محمد درود فرست، همان‌گونه که بر ابراهیم و بر خاندان ابراهیم درود فرستادی؛ همانا تو ستوده و باشکوهی. خدایا، بر محمد و بر خاندان محمد برکت ده، همان‌گونه که بر ابراهیم و بر خاندان ابراهیم برکت دادی؛ همانا تو ستوده و باشکوهی.',
      ms: 'Ya Allah, limpahkanlah selawat kepada Muhammad dan keluarga Muhammad, sebagaimana Engkau limpahkan selawat kepada Ibrahim dan keluarga Ibrahim; sesungguhnya Engkau Maha Terpuji lagi Maha Mulia. Ya Allah, berkatilah Muhammad dan keluarga Muhammad, sebagaimana Engkau berkati Ibrahim dan keluarga Ibrahim; sesungguhnya Engkau Maha Terpuji lagi Maha Mulia.',
      ur: 'اے اللہ، محمد پر اور محمد کی آل پر درود بھیج، جس طرح تو نے ابراہیم پر اور ابراہیم کی آل پر درود بھیجا؛ بے شک تو لائقِ تعریف، بزرگی والا ہے۔ اے اللہ، محمد پر اور محمد کی آل پر برکت دے، جس طرح تو نے ابراہیم پر اور ابراہیم کی آل پر برکت دی؛ بے شک تو لائقِ تعریف، بزرگی والا ہے۔',
      sw: 'Ewe Allah, teremsha rehema juu ya Muhammad na jamaa ya Muhammad, kama ulivyoteremsha rehema juu ya Ibrahim na jamaa ya Ibrahim; hakika Wewe unasifiwa, ni mtukufu. Ewe Allah, bariki juu ya Muhammad na jamaa ya Muhammad, kama ulivyobariki juu ya Ibrahim na jamaa ya Ibrahim; hakika Wewe unasifiwa, ni mtukufu.',
      ru: 'О Аллах, пошли благословения на Мухаммада и на семью Мухаммада, как Ты благословил Ибрахима и семью Ибрахима; поистине, Ты достохвальный, славный. О Аллах, благослови Мухаммада и семью Мухаммада, как Ты благословил Ибрахима и семью Ибрахима; поистине, Ты достохвальный, славный.',
      ps: 'يا الله، پر محمد او د محمد پر کورنۍ درود ولېږه، لکه څنګه چې دې پر ابراهيم او د ابراهيم پر کورنۍ درود لېږلی؛ یقینا ته ستایل شوی، لوی مرتبې يې. يا الله، پر محمد او د محمد پر کورنۍ برکت ورکړه، لکه څنګه چې دې پر ابراهيم او د ابراهيم پر کورنۍ برکت ورکړی؛ یقینا ته ستایل شوی، لوی مرتبې يې.',
    },
    note: {
      de: 'Im letzten Sitzen direkt nach dem Tashahhud.',
      en: 'In the final sitting, directly after the tashahhud.',
      tr: 'Son oturuşta, tahiyyattan hemen sonra.',
      ar: 'في الجلوس الأخير بعد التشهد مباشرة.',
      es: 'En la sesión final, justo después del tashahhud.',
      fr: 'Dans la dernière position assise, juste après le tashahhud.',
      id: 'Pada duduk terakhir, tepat setelah tasyahud.',
      bn: 'শেষ বৈঠকে, তাশাহহুদের ঠিক পরে।',
      fa: 'در نشست پایانی، بلافاصله پس از تشهد.',
      ms: 'Pada duduk terakhir, sejurus selepas tasyahud.',
      ur: 'آخری قعدے میں، تشہد کے فوراً بعد۔',
      sw: 'Katika kikao cha mwisho, mara tu baada ya tashahhud.',
      ru: 'В последнем сидении, сразу после ташаххуда.',
      ps: 'په وروستۍ کیناستلو کې، له تشهد وروسته سمدستي.',
    },
  };
}

function refugeDuaStep(rakah: number): PrayStep {
  return {
    posture: 'tashahhud',
    rakah,
    label: {
      de: 'Bittgebet vor dem Salam (Sunnah)',
      en: 'Supplication before the salam (sunnah)',
      tr: 'Selamdan önce dua (sünnet)',
      ar: 'دعاء قبل السلام (سنة)',
      es: 'Súplica antes del salam (sunna)',
      fr: 'Invocation avant le salam (sunna)',
      id: 'Doa sebelum salam (sunah)',
      bn: 'সালামের আগের দোয়া (সুন্নত)',
      fa: 'دعا پیش از سلام (سنت)',
      ms: 'Doa sebelum salam (sunat)',
      ur: 'سلام سے پہلے دعا (سنت)',
      sw: 'Dua kabla ya salamu (sunna)',
      ru: 'Мольба перед саламом (сунна)',
      ps: 'له سلام دمخه دعا (سنت)',
    },
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ',
    transliteration:
      'allāhumma innī aʿūdhu bika min ʿadhābi l-qabr, wa-min fitnati l-masīḥi d-dajjāl, wa-min fitnati l-maḥyā wa-l-mamāt',
    translation: {
      de: 'O Allah, ich suche Zuflucht bei Dir vor der Strafe des Grabes, vor der Versuchung des Dajjal und vor der Versuchung des Lebens und des Todes.',
      en: 'O Allah, I seek refuge in You from the punishment of the grave, from the trial of the Dajjal, and from the trial of life and death.',
      tr: 'Allah’ım, kabir azabından, Deccal fitnesinden ve hayat ile ölüm fitnesinden Sana sığınırım.',
      ar: 'اللهم إني أعوذ بك من عذاب القبر، ومن فتنة المسيح الدجال، ومن فتنة المحيا والممات.',
      es: 'Oh Alá, busco refugio en Ti del castigo de la tumba, de la prueba del Dajjal y de la prueba de la vida y de la muerte.',
      fr: 'Ô Allah, je cherche refuge auprès de Toi contre le châtiment de la tombe, contre l’épreuve du Dajjal et contre l’épreuve de la vie et de la mort.',
      id: 'Ya Allah, sesungguhnya aku berlindung kepada-Mu dari siksa kubur, dari fitnah Al-Masih Dajjal, dan dari fitnah kehidupan dan kematian.',
      bn: 'হে আল্লাহ, নিশ্চয়ই আমি তোমার কাছে আশ্রয় চাই কবরের আযাব থেকে, মাসীহ দাজ্জালের ফিতনা থেকে এবং জীবন ও মৃত্যুর ফিতনা থেকে।',
      fa: 'خدایا، همانا من به تو پناه می‌برم از عذاب قبر، از فتنهٔ مسیح دجّال، و از فتنهٔ زندگی و مرگ.',
      ms: 'Ya Allah, sesungguhnya aku berlindung kepada-Mu dari azab kubur, dari fitnah Al-Masih Dajjal, dan dari fitnah kehidupan dan kematian.',
      ur: 'اے اللہ، بے شک میں تیری پناہ چاہتا ہوں عذابِ قبر سے، مسیح دجال کے فتنے سے، اور زندگی اور موت کے فتنے سے۔',
      sw: 'Ewe Allah, hakika mimi najikinga Kwako na adhabu ya kaburi, na fitna ya Masihi Dajjali, na fitna ya uhai na kifo.',
      ru: 'О Аллах, поистине, я прибегаю к Тебе от наказания могилы, от искушения Лжемессии (Даджаля) и от искушения жизни и смерти.',
      ps: 'یا الله، زه یقینا په تا پناه غواړم د قبر له عذاب نه، د مسیح دجال له فتنې نه، او د ژوند او مرګ له فتنې نه.',
    },
    note: {
      de: 'Empfohlen (Sunnah) im letzten Sitzen nach der Salawat, vor dem Salam. Danach darf man mit eigenen Worten bitten.',
      en: 'Recommended (sunnah) in the final sitting after the salawat, before the salam. You may then make your own supplication.',
      tr: 'Son oturuşta salavattan sonra, selamdan önce müstehaptır. Ardından kendi sözlerinle dua edebilirsin.',
      ar: 'يُستحب في الجلوس الأخير بعد الصلاة الإبراهيمية وقبل السلام. ثم تدعو بما شئت.',
      es: 'Recomendada (sunna) en la sesión final tras la salawat, antes del salam. Luego puedes suplicar con tus propias palabras.',
      fr: 'Recommandée (sunna) dans la dernière position assise après la salawat, avant le salam. Tu peux ensuite invoquer avec tes propres mots.',
      id: 'Dianjurkan (sunah) pada duduk terakhir setelah selawat, sebelum salam. Setelah itu kamu boleh berdoa dengan kata-katamu sendiri.',
      bn: 'শেষ বৈঠকে দরূদের পর, সালামের আগে পড়া মুস্তাহাব (সুন্নত)। এরপর নিজের ভাষায় দোয়া করতে পারো।',
      fa: 'در نشست پایانی پس از صلوات و پیش از سلام مستحب (سنت) است. سپس می‌توانی با سخنان خود دعا کنی.',
      ms: 'Disunatkan pada duduk terakhir selepas selawat, sebelum salam. Selepas itu kamu boleh berdoa dengan kata-katamu sendiri.',
      ur: 'آخری قعدے میں درود کے بعد اور سلام سے پہلے مستحب (سنت) ہے۔ اس کے بعد تم اپنے الفاظ میں دعا کر سکتے ہو۔',
      sw: 'Inapendekezwa (sunna) katika kikao cha mwisho baada ya salawat, kabla ya salamu. Baada ya hapo waweza kuomba kwa maneno yako mwenyewe.',
      ru: 'Желательна (сунна) в последнем сидении после салавата, перед саламом. Затем можно обратиться с мольбой своими словами.',
      ps: 'په وروستۍ کیناستلو کې له درود وروسته او له سلام دمخه مستحب (سنت) دی. بیا کولای شې په خپلو خبرو دعا وکړې.',
    },
  };
}

function salamStep(rakah: number): PrayStep {
  return {
    posture: 'salam',
    rakah,
    label: {
      de: 'Salam – Abschluss',
      en: 'Salam – closing',
      tr: 'Selam – bitiriş',
      ar: 'التسليم',
      es: 'Salam – cierre',
      fr: 'Salam – clôture',
      id: 'Salam – penutup',
      bn: 'সালাম – সমাপ্তি',
      fa: 'سلام – پایان',
      ms: 'Salam – penutup',
      ur: 'سلام – اختتام',
      sw: 'Taslim – mwisho',
      ru: 'Салам — завершение',
      ps: 'سلام – پای',
    },
    arabic: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
    transliteration: 'as-salāmu ʿalaykum wa-raḥmatullāh',
    translation: {
      de: 'Friede sei mit euch und die Barmherzigkeit Allahs.',
      en: 'Peace be upon you and the mercy of Allah.',
      tr: 'Selam ve Allah’ın rahmeti üzerinize olsun.',
      ar: 'السلام عليكم ورحمة الله.',
      es: 'La paz sea con vosotros y la misericordia de Alá.',
      fr: 'Que la paix soit sur vous et la miséricorde d’Allah.',
      id: 'Salam sejahtera atas kalian dan rahmat Allah.',
      bn: 'তোমাদের ওপর শান্তি ও আল্লাহর রহমত বর্ষিত হোক।',
      fa: 'سلام بر شما و رحمت خدا.',
      ms: 'Salam sejahtera ke atas kamu dan rahmat Allah.',
      ur: 'تم پر سلامتی ہو اور اللہ کی رحمت۔',
      sw: 'Amani iwe juu yenu na rehema ya Allah.',
      ru: 'Мир вам и милость Аллаха.',
      ps: 'پر تاسو دې سلام وي او د الله رحمت.',
    },
    note: {
      de: 'Den Kopf nach rechts drehen und den Friedensgruß sprechen, dann nach links wiederholen. Das Gebet ist damit beendet.',
      en: 'Turn the head to the right with the greeting of peace, then repeat to the left. The prayer is now complete.',
      tr: 'Başını sağa çevirip selam ver, sonra sola tekrarla. Namaz tamamlandı.',
      ar: 'التفت بوجهك يميناً بالسلام ثم كرّر يساراً. بهذا تمت الصلاة.',
      es: 'Gira la cabeza a la derecha con el saludo de paz y repite a la izquierda. La oración ha terminado.',
      fr: 'Tourne la tête vers la droite avec la salutation de paix, puis répète vers la gauche. La prière est terminée.',
      id: 'Palingkan kepala ke kanan sambil mengucap salam, lalu ulangi ke kiri. Salat pun selesai.',
      bn: 'মাথা ডানে ফিরিয়ে সালাম দাও, তারপর বাঁয়ে একইভাবে। এতেই নামাজ শেষ।',
      fa: 'سر را به راست بگردان و سلام بده، سپس به چپ تکرار کن. نماز پایان یافت.',
      ms: 'Palingkan kepala ke kanan sambil mengucap salam, kemudian ulangi ke kiri. Solat pun selesai.',
      ur: 'سر دائیں طرف پھیر کر سلام کہو، پھر بائیں طرف دہراؤ۔ نماز مکمل ہو گئی۔',
      sw: 'Geuza kichwa kulia ukitoa salamu, kisha rudia kushoto. Swala imekamilika.',
      ru: 'Поверни голову направо с приветствием мира, затем повтори налево. Молитва завершена.',
      ps: 'سر ښي خوا ته وګرځوه او سلام ووایه، بیا کیڼې خوا ته تکرار کړه. لمونځ پای ته ورسېد.',
    },
  };
}

/**
 * Baut die vollständige Schrittfolge für ein Gebet nach verbreiteter
 * (hanafitischer) Ordnung. Ablauf je Rak'ah: Rezitation → (Witr: Qunut in
 * Rak'ah 3) → Ruku → I'tidal → Sujud 1 → Jalsa → Sujud 2. Nach der 2. Rak'ah
 * (bei Gebeten mit > 2 Rak'ah bzw. Witr) folgt das erste Tashahhud; in der
 * letzten Rak'ah das abschließende Tashahhud + Salawat + Zuflucht-Bittgebet +
 * Salam.
 */
export function buildSteps(id: PrayerId, opts?: { witrSurahInThird?: boolean }): PrayStep[] {
  const prayer = prayerById(id);
  if (!prayer) return [];
  const { rakahs, witr } = prayer;
  const steps: PrayStep[] = [takbirStep(), sanaStep()];

  for (let r = 1; r <= rakahs; r++) {
    // Die zusätzliche Sure nach Al-Fatiha wird standardmäßig NUR in den ersten
    // beiden Rak'ah gelesen. Für Witr kann der Nutzer – je nach Rechtsschule –
    // optional auch in der 3. Rak'ah (vor dem Qunut) eine Sure aktivieren
    // (opts.witrSurahInThird). Der In-App-Hinweis empfiehlt dazu einen Gelehrten.
    const withSurah = r <= 2 || (!!witr && r === 3 && !!opts?.witrSurahInThird);
    steps.push(recitationStep(r, withSurah));
    // Nach Al-Fatiha die kurze Sure als eigener Schritt (Rak'ah 1 → Al-Ikhlas,
    // Rak'ah 2 → Al-Kawthar).
    if (withSurah) steps.push(shortSurahStep(r));
    if (witr && r === 3) steps.push(qunutStep(r));
    steps.push(rukuStep(r), itidalStep(r), sujudStep(r, 1), jalsaStep(r), sujudStep(r, 2));

    const isFinal = r === rakahs;
    if (isFinal) {
      steps.push(tashahhudStep(r, true), salawatStep(r), refugeDuaStep(r), salamStep(r));
    } else if (r === 2) {
      // Erstes Sitzen nach der 2. Rak'ah (bei 3/4-Rak'ah-Gebeten und Witr).
      steps.push(tashahhudStep(r, false));
    }
  }

  return steps;
}

// ── Kern-Texte für die Lern-Ansicht ("Beten lernen") ─────────────────────────
// Die drei Texte, die Anfänger als Erstes vollständig können müssen: die
// komplette Al-Fatiha (7 Verse, in jeder Rak'ah Pflicht) sowie die beiden
// kürzesten Suren Al-Ikhlas und Al-Kawthar. Alle drei stammen 1:1 aus den
// oben geprüften Konstanten/Schritten — hier wird nichts dupliziert.
const AL_FATIHA_LABEL: LocalizedText = {
  de: 'Al-Fatiha – die Eröffnende (Pflicht in jeder Rak’ah)',
  en: 'Al-Fatiha – the Opening (required in every rakah)',
  tr: 'Fâtiha – açılış suresi (her rekâtta farz)',
  ar: 'الفاتحة – فاتحة الكتاب (ركن في كل ركعة)',
  es: 'Al-Fatiha – la Apertura (obligatoria en cada raka)',
  fr: 'Al-Fatiha – l’Ouverture (obligatoire à chaque rak’a)',
  id: 'Al-Fatihah – Pembuka (wajib pada setiap rakaat)',
  bn: 'আল-ফাতিহা – সূচনাকারী সূরা (প্রতি রাকাতে ফরজ)',
  fa: 'فاتحه – گشایندهٔ کتاب (در هر رکعت واجب)',
  ms: 'Al-Fatihah – Pembuka (wajib pada setiap rakaat)',
  ur: 'الفاتحہ – کھولنے والی سورت (ہر رکعت میں لازم)',
  sw: 'Al-Fatiha – Ufunguzi (ni lazima katika kila rakaa)',
  ru: '«Аль-Фатиха» — Открывающая (обязательна в каждом ракате)',
  ps: 'الفاتحه – پرانیستونکې (په هر رکعت کې فرض)',
};

export const LEARN_CORE_TEXTS: PrayStep[] = [
  {
    posture: 'qiyam',
    isSurah: true,
    label: AL_FATIHA_LABEL,
    arabic: AL_FATIHA_ARABIC,
    transliteration: AL_FATIHA_TRANSLIT,
    translation: AL_FATIHA_TRANSLATION,
  },
  shortSurahStep(1), // Al-Ikhlas
  shortSurahStep(2), // Al-Kawthar
];

// ── UI-Texte (inline lokalisiert, keine i18n-Keys → keine locales/*.json-Änderung,
//    resolveText fällt für nicht abgedeckte Sprachen auf en/de zurück, wie bei
//    guides.json) ───────────────────────────────────────────────────────────
export const PRAY_ALONG_ENTRY = {
  title: {
    de: 'Gebet mitbeten',
    en: 'Pray along',
    tr: 'Namaza eşlik et',
    ar: 'صلِّ خطوة بخطوة',
    es: 'Reza paso a paso',
    fr: 'Prier pas à pas',
    id: 'Salat bersama panduan',
    bn: 'সঙ্গে সঙ্গে নামাজ পড়ো',
    fa: 'همراه با راهنما نماز بخوان',
    ms: 'Solat bersama panduan',
    ur: 'ساتھ ساتھ نماز پڑھیں',
    sw: 'Swali ukifuatana na mwongozo',
    ru: 'Молиться шаг за шагом',
    ps: 'ګام په ګام لمونځ وکړه',
  } as LocalizedText,
  subtitle: {
    de: 'Halte den Bildschirm während des Gebets offen und folge Wortlaut und Haltung Schritt für Schritt.',
    en: 'Keep the screen open during prayer and follow the words and postures step by step.',
    tr: 'Namaz boyunca ekranı açık tut; sözleri ve hareketleri adım adım takip et.',
    ar: 'أبقِ الشاشة مفتوحة أثناء الصلاة وتابع النص والحركات خطوة بخطوة.',
    es: 'Mantén la pantalla abierta durante la oración y sigue las palabras y posturas paso a paso.',
    fr: 'Garde l’écran ouvert pendant la prière et suis les paroles et les postures étape par étape.',
    id: 'Biarkan layar tetap terbuka selama salat dan ikuti bacaan serta gerakannya langkah demi langkah.',
    bn: 'নামাজের সময় স্ক্রিন খোলা রাখো এবং ধাপে ধাপে পাঠ ও ভঙ্গি অনুসরণ করো।',
    fa: 'در طول نماز صفحه را باز نگه دار و متن و حالت‌ها را گام به گام دنبال کن.',
    ms: 'Biarkan skrin terbuka sepanjang solat dan ikuti bacaan serta gerakannya langkah demi langkah.',
    ur: 'نماز کے دوران اسکرین کھلی رکھو اور الفاظ اور حالتوں کی قدم بہ قدم پیروی کرو۔',
    sw: 'Acha skrini iwe wazi wakati wa swala na ufuate maneno na hali hatua kwa hatua.',
    ru: 'Держи экран открытым во время молитвы и шаг за шагом следуй за словами и положениями тела.',
    ps: 'د لمانځه پر مهال سکرین خلاص وساته او متن او حالتونه ګام په ګام تعقیب کړه.',
  } as LocalizedText,
};

export const PRAY_ALONG_UI = {
  title: PRAY_ALONG_ENTRY.title,
  pickPrompt: {
    de: 'Welches Gebet möchtest du mitbeten?',
    en: 'Which prayer would you like to pray along?',
    tr: 'Hangi namaza eşlik etmek istersin?',
    ar: 'أي صلاة تريد أن تتابعها؟',
    es: '¿Qué oración quieres seguir?',
    fr: 'Quelle prière veux-tu suivre ?',
    id: 'Salat mana yang ingin kamu ikuti?',
    bn: 'কোন নামাজ পড়তে চাও?',
    fa: 'کدام نماز را می‌خواهی همراهی کنی؟',
    ms: 'Solat manakah yang ingin kamu ikuti?',
    ur: 'تم کون سی نماز ساتھ پڑھنا چاہتے ہو؟',
    sw: 'Ni swala ipi unayotaka kuifuata?',
    ru: 'Какую молитву ты хочешь совершить?',
    ps: 'کوم لمونځ غواړې ورسره وکړې؟',
  } as LocalizedText,
  disclaimer: {
    de: 'Ablauf nach verbreiteter (hanafitischer) Zählung; Unterschiede der Rechtsschulen sind als Hinweis markiert. Nur die Fard-Rak’ah werden gezeigt.',
    en: 'Sequence follows the widespread (Hanafi) count; differences between schools are marked as hints. Only the fard rakahs are shown.',
    tr: 'Sıra yaygın (Hanefî) sayıma göredir; mezhep farkları hinweis olarak işaretlidir. Yalnız farz rekâtlar gösterilir.',
    ar: 'الترتيب على المشهور عند الحنفية؛ اختلاف المذاهب مذكور كتنبيه. تُعرض ركعات الفرض فقط.',
    es: 'La secuencia sigue el recuento (hanafí) más extendido; las diferencias entre escuelas se marcan como notas. Solo se muestran las rakat fard.',
    fr: 'La séquence suit le décompte (hanafite) répandu ; les différences entre écoles sont indiquées. Seules les rak’a fard sont montrées.',
    id: 'Urutannya mengikuti hitungan (mazhab Hanafi) yang lazim; perbedaan antarmazhab ditandai sebagai catatan. Hanya rakaat fardu yang ditampilkan.',
    bn: 'ধারাক্রম প্রচলিত (হানাফি) গণনা অনুসারে; মাযহাবগুলোর পার্থক্য নোট হিসেবে চিহ্নিত। কেবল ফরজ রাকাত দেখানো হয়।',
    fa: 'ترتیب بر پایهٔ شمارش رایج (حنفی) است؛ اختلاف مذاهب به‌صورت یادداشت مشخص شده است. تنها رکعت‌های فرض نمایش داده می‌شوند.',
    ms: 'Urutannya mengikut kiraan (mazhab Hanafi) yang lazim; perbezaan antara mazhab ditandakan sebagai nota. Hanya rakaat fardu ditunjukkan.',
    ur: 'ترتیب رائج (حنفی) شمار کے مطابق ہے؛ مسالک کے اختلافات نوٹ کے طور پر نشان زد ہیں۔ صرف فرض رکعتیں دکھائی جاتی ہیں۔',
    sw: 'Mpangilio unafuata hesabu iliyoenea (ya Kihanafi); tofauti kati ya madhehebu zimewekwa alama kama vidokezo. Rakaa za faradhi pekee ndizo zinaonyeshwa.',
    ru: 'Последовательность следует распространённому (ханафитскому) счёту; различия между мазхабами отмечены как примечания. Показаны только ракаты фард.',
    ps: 'ترتیب د دودیزې (حنفي) شمېرنې له مخې دی؛ د مذهبونو توپیرونه د یادونې په توګه نښه شوي دي. يوازې فرض رکعتونه ښودل کیږي.',
  } as LocalizedText,
  step: {
    de: 'Schritt',
    en: 'Step',
    tr: 'Adım',
    ar: 'خطوة',
    es: 'Paso',
    fr: 'Étape',
    id: 'Langkah',
    bn: 'ধাপ',
    fa: 'گام',
    ms: 'Langkah',
    ur: 'مرحلہ',
    sw: 'Hatua',
    ru: 'Шаг',
    ps: 'ګام',
  } as LocalizedText,
  rakahLabel: {
    de: 'Rak’ah',
    en: 'Rak’ah',
    tr: 'Rekât',
    ar: 'ركعة',
    es: 'Raka',
    fr: 'Rak’a',
    id: 'Rakaat',
    bn: 'রাকাত',
    fa: 'رکعت',
    ms: 'Rakaat',
    ur: 'رکعت',
    sw: 'Rakaa',
    ru: 'Ракат',
    ps: 'رکعت',
  } as LocalizedText,
  next: {
    de: 'Weiter',
    en: 'Next',
    tr: 'İleri',
    ar: 'التالي',
    es: 'Siguiente',
    fr: 'Suivant',
    id: 'Lanjut',
    bn: 'পরবর্তী',
    fa: 'بعدی',
    ms: 'Seterusnya',
    ur: 'آگے',
    sw: 'Endelea',
    ru: 'Далее',
    ps: 'بل',
  } as LocalizedText,
  prev: {
    de: 'Zurück',
    en: 'Back',
    tr: 'Geri',
    ar: 'السابق',
    es: 'Atrás',
    fr: 'Précédent',
    id: 'Kembali',
    bn: 'পেছনে',
    fa: 'قبلی',
    ms: 'Kembali',
    ur: 'پیچھے',
    sw: 'Rudi',
    ru: 'Назад',
    ps: 'شاته',
  } as LocalizedText,
  finish: {
    de: 'Beenden',
    en: 'Finish',
    tr: 'Bitir',
    ar: 'إنهاء',
    es: 'Terminar',
    fr: 'Terminer',
    id: 'Selesai',
    bn: 'শেষ করো',
    fa: 'پایان',
    ms: 'Selesai',
    ur: 'ختم کریں',
    sw: 'Maliza',
    ru: 'Завершить',
    ps: 'پای ته ورسوه',
  } as LocalizedText,
  change: {
    de: 'Gebet wechseln',
    en: 'Change prayer',
    tr: 'Namazı değiştir',
    ar: 'تغيير الصلاة',
    es: 'Cambiar oración',
    fr: 'Changer de prière',
    id: 'Ganti salat',
    bn: 'নামাজ পরিবর্তন করো',
    fa: 'تغییر نماز',
    ms: 'Tukar solat',
    ur: 'نماز تبدیل کریں',
    sw: 'Badilisha swala',
    ru: 'Сменить молитву',
    ps: 'لمونځ بدل کړه',
  } as LocalizedText,
  tapToHear: {
    de: 'Zum Anhören auf den arabischen Text tippen',
    en: 'Tap the Arabic text to listen',
    tr: 'Dinlemek için Arapça metne dokun',
    ar: 'انقر على النص العربي للاستماع',
    es: 'Toca el texto árabe para escuchar',
    fr: 'Touche le texte arabe pour écouter',
    id: 'Ketuk teks Arab untuk mendengarkan',
    bn: 'শোনার জন্য আরবি লেখায় চাপ দাও',
    fa: 'برای شنیدن روی متن عربی بزن',
    ms: 'Ketik teks Arab untuk mendengar',
    ur: 'سننے کے لیے عربی متن پر ٹیپ کریں',
    sw: 'Gusa maandishi ya Kiarabu ili kusikiliza',
    ru: 'Нажми на арабский текст, чтобы прослушать',
    ps: 'د اورېدو لپاره په عربي متن ټک ووهه',
  } as LocalizedText,
  // Witr-spezifische Option + Hinweis (nur im Witr sichtbar).
  witrSurahLabel: {
    de: 'Witr: Sure auch in der 3. Rak’ah',
    en: 'Witr: surah also in the 3rd rakah',
    tr: 'Vitir: 3. rekâtta da sure',
    ar: 'الوتر: سورة في الركعة الثالثة أيضاً',
    es: 'Witr: sura también en la 3.ª raka',
    fr: 'Witr : sourate aussi à la 3e rak’a',
    id: 'Witir: surah juga pada rakaat ketiga',
    bn: 'বিতর: তৃতীয় রাকাতেও সূরা',
    fa: 'وتر: سوره در رکعت سوم نیز',
    ms: 'Witir: surah juga pada rakaat ketiga',
    ur: 'وتر: تیسری رکعت میں بھی سورت',
    sw: 'Witri: sura pia katika rakaa ya tatu',
    ru: 'Витр: сура и в третьем ракате',
    ps: 'وتر: په درېیم رکعت کې هم سورت',
  } as LocalizedText,
  witrScholarNote: {
    de: 'Die Form des Witr – besonders ob in der 3. Rak’ah nach Al-Fatiha eine Sure folgt und wo der Qunut steht – unterscheidet sich je nach Rechtsschule. Richte dich nach deiner Rechtsschule und frage im Zweifel einen Gelehrten.',
    en: 'The form of witr – especially whether a surah follows Al-Fatiha in the 3rd rakah and where the qunut is placed – differs between the schools of law. Follow your own school and, when in doubt, ask a scholar.',
    tr: 'Vitrin şekli – özellikle 3. rekâtta Fâtiha’dan sonra sure okunup okunmayacağı ve Kunut’un yeri – mezhebe göre değişir. Kendi mezhebine uy ve şüphe hâlinde bir âlime danış.',
    ar: 'تختلف صفة الوتر بين المذاهب – خاصة هل تُقرأ سورة بعد الفاتحة في الركعة الثالثة وأين يكون القنوت. اتبع مذهبك، وعند الشك اسأل عالماً.',
    es: 'La forma del witr – en especial si tras Al-Fatiha se recita una sura en la 3.ª raka y dónde se coloca el qunut – varía según la escuela jurídica. Sigue tu escuela y, en caso de duda, consulta a un sabio.',
    fr: 'La forme du witr – notamment si une sourate suit Al-Fatiha à la 3e rak’a et où se place le qunut – diffère selon les écoles juridiques. Suis ton école et, en cas de doute, demande à un savant.',
    id: 'Bentuk salat Witir – terutama apakah setelah Al-Fatihah dibaca surah pada rakaat ketiga dan di mana letak qunut – berbeda menurut mazhab. Ikutilah mazhabmu dan bila ragu, tanyakan kepada ulama.',
    bn: 'বিতরের রূপ – বিশেষত তৃতীয় রাকাতে আল-ফাতিহার পর সূরা পড়া হবে কি না এবং কুনুত কোথায় হবে – মাযহাব অনুযায়ী ভিন্ন। নিজের মাযহাব অনুসরণ করো এবং সন্দেহ হলে আলেমকে জিজ্ঞাসা করো।',
    fa: 'شکل وتر – به‌ویژه اینکه آیا در رکعت سوم پس از فاتحه سوره خوانده می‌شود و قنوت کجاست – بسته به مذهب متفاوت است. از مذهب خود پیروی کن و در صورت تردید از عالمی بپرس.',
    ms: 'Bentuk solat Witir – terutamanya sama ada selepas Al-Fatihah dibaca surah pada rakaat ketiga dan di mana letaknya qunut – berbeza mengikut mazhab. Ikutlah mazhabmu dan jika ragu, tanyalah kepada ulama.',
    ur: 'وتر کی صورت – خاص طور پر یہ کہ تیسری رکعت میں الفاتحہ کے بعد سورت پڑھی جائے یا نہیں اور قنوت کہاں ہو – مسالک کے مطابق مختلف ہے۔ اپنے مسلک کی پیروی کرو اور شک ہو تو کسی عالم سے پوچھو۔',
    sw: 'Muundo wa Witri – hasa iwapo baada ya Al-Fatiha husomwa sura katika rakaa ya tatu na qunut inawekwa wapi – hutofautiana kwa mujibu wa madhehebu. Fuata madhehebu yako na ukiwa na shaka mwulize mwanachuoni.',
    ru: 'Форма витра – особенно читается ли сура после «Аль-Фатихи» в третьем ракате и где помещается кунут – различается по мазхабам. Следуй своему мазхабу, а при сомнении спроси учёного.',
    ps: 'د وتر بڼه – په ځانګړي ډول دا چې په درېیم رکعت کې له فاتحې وروسته سورت لوستل کیږي که نه او قنوت چېرته دی – د مذهب له مخې توپیر لري. د خپل مذهب پیروي وکړه او که شک دې و، له عالم نه وپوښته.',
  } as LocalizedText,
};
