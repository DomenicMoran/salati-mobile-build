import { notifyLocalesChanged } from '@/lib/translate';

// Deutsche Bedeutungs-Namen der 114 Suren (Audit 2026-07-19 B2): die
// AlQuran.cloud-Metadaten liefern die Namensbedeutung nur auf Englisch
// ("The Cow"). Namen folgen den im Deutschen etablierten Renderings
// (Bubenheim/Elyas-Umfeld, deutschsprachige Koranliteratur).
const GERMAN_SURAH_NAMES: Record<number, string> = {
  1: 'Die Eröffnung',
  2: 'Die Kuh',
  3: 'Die Familie Imrans',
  4: 'Die Frauen',
  5: 'Der Tisch',
  6: 'Das Vieh',
  7: 'Die Höhen',
  8: 'Die Beute',
  9: 'Die Reue',
  10: 'Yunus (Jona)',
  11: 'Hud',
  12: 'Yusuf (Josef)',
  13: 'Der Donner',
  14: 'Ibrahim (Abraham)',
  15: 'Al-Hidschr',
  16: 'Die Biene',
  17: 'Die Nachtreise',
  18: 'Die Höhle',
  19: 'Maryam (Maria)',
  20: 'Ta-Ha',
  21: 'Die Propheten',
  22: 'Die Pilgerfahrt',
  23: 'Die Gläubigen',
  24: 'Das Licht',
  25: 'Die Unterscheidung',
  26: 'Die Dichter',
  27: 'Die Ameisen',
  28: 'Die Geschichten',
  29: 'Die Spinne',
  30: 'Die Römer',
  31: 'Luqman',
  32: 'Die Niederwerfung',
  33: 'Die Verbündeten',
  34: 'Saba',
  35: 'Der Erschaffer',
  36: 'Ya-Sin',
  37: 'Die sich Reihenden',
  38: 'Sad',
  39: 'Die Scharen',
  40: 'Der Vergebende',
  41: 'Ausführlich dargelegt',
  42: 'Die Beratung',
  43: 'Der Goldschmuck',
  44: 'Der Rauch',
  45: 'Die Kniende',
  46: 'Die Sanddünen',
  47: 'Muhammad',
  48: 'Der Sieg',
  49: 'Die Gemächer',
  50: 'Qaf',
  51: 'Die Aufwirbelnden',
  52: 'Der Berg',
  53: 'Der Stern',
  54: 'Der Mond',
  55: 'Der Allerbarmer',
  56: 'Das eintreffende Ereignis',
  57: 'Das Eisen',
  58: 'Die Streitende',
  59: 'Die Versammlung',
  60: 'Die Geprüfte',
  61: 'Die Reihe',
  62: 'Der Freitag',
  63: 'Die Heuchler',
  64: 'Die Übervorteilung',
  65: 'Die Scheidung',
  66: 'Das Verbot',
  67: 'Die Herrschaft',
  68: 'Die Feder',
  69: 'Die fällig Werdende',
  70: 'Die Aufstiegswege',
  71: 'Nuh (Noah)',
  72: 'Die Dschinn',
  73: 'Der Eingehüllte',
  74: 'Der Zugedeckte',
  75: 'Die Auferstehung',
  76: 'Der Mensch',
  77: 'Die Entsandten',
  78: 'Die Kunde',
  79: 'Die Entreißenden',
  80: 'Er runzelte die Stirn',
  81: 'Das Einrollen',
  82: 'Die Spaltung',
  83: 'Die das Maß Kürzenden',
  84: 'Das Sich-Spalten',
  85: 'Die Sternbilder',
  86: 'Der Nachtstern',
  87: 'Der Allerhöchste',
  88: 'Die Bedeckende',
  89: 'Die Morgendämmerung',
  90: 'Die Stadt',
  91: 'Die Sonne',
  92: 'Die Nacht',
  93: 'Die Morgenhelle',
  94: 'Die Weitung',
  95: 'Die Feige',
  96: 'Der Blutklumpen',
  97: 'Die Bestimmung',
  98: 'Der klare Beweis',
  99: 'Das Erdbeben',
  100: 'Die Galoppierenden',
  101: 'Das Verhängnis',
  102: 'Die Vermehrung',
  103: 'Das Zeitalter',
  104: 'Der Verleumder',
  105: 'Der Elefant',
  106: 'Die Quraisch',
  107: 'Die Hilfeleistung',
  108: 'Der Überfluss',
  109: 'Die Ungläubigen',
  110: 'Die Hilfe',
  111: 'Die Palmfasern',
  112: 'Die Aufrichtigkeit',
  113: 'Der Tagesanbruch',
  114: 'Die Menschen',
};

// Arabischer Originalname jeder Sure (sprachneutral; Quelle: en.wikipedia.org
// "List of chapters in the Quran", gegen die Arabisch-Spalte von api.alquran.cloud
// geprüft, 2026-09-06). Für Sprachen, deren etablierte Koran-Lesepraxis den
// Surennamen NICHT übersetzt, sondern in arabischer Schrift belässt (Urdu,
// Persisch — s. Aufgabenstellung — sowie, aus demselben Grund, Paschtu, das
// ebenfalls in Perso-Arabischer Schrift gelesen wird): dort ist dieser Name
// selbst die korrekte "Übersetzung". Für Arabisch als UI-Sprache ist er die
// einzig richtige Wahl (keine Bedeutungs-Übersetzung nötig/sinnvoll, es IST die
// eigene Sprache).
const ARABIC_SURAH_NAMES: Record<number, string> = {
  1: 'الفاتحة', 2: 'البقرة', 3: 'آل عمران', 4: 'النساء', 5: 'المائدة',
  6: 'الأنعام', 7: 'الأعراف', 8: 'الأنفال', 9: 'التوبة', 10: 'يونس',
  11: 'هود', 12: 'يوسف', 13: 'الرعد', 14: 'إبراهيم', 15: 'الحجر',
  16: 'النحل', 17: 'الإسراء', 18: 'الكهف', 19: 'مريم', 20: 'طه',
  21: 'الأنبياء', 22: 'الحج', 23: 'المؤمنون', 24: 'النور', 25: 'الفرقان',
  26: 'الشعراء', 27: 'النمل', 28: 'القصص', 29: 'العنكبوت', 30: 'الروم',
  31: 'لقمان', 32: 'السجدة', 33: 'الأحزاب', 34: 'سبأ', 35: 'فاطر',
  36: 'يس', 37: 'الصافات', 38: 'ص', 39: 'الزمر', 40: 'غافر',
  41: 'فصلت', 42: 'الشورى', 43: 'الزخرف', 44: 'الدخان', 45: 'الجاثية',
  46: 'الأحقاف', 47: 'محمد', 48: 'الفتح', 49: 'الحجرات', 50: 'ق',
  51: 'الذاريات', 52: 'الطور', 53: 'النجم', 54: 'القمر', 55: 'الرحمن',
  56: 'الواقعة', 57: 'الحديد', 58: 'المجادلة', 59: 'الحشر', 60: 'الممتحنة',
  61: 'الصف', 62: 'الجمعة', 63: 'المنافقون', 64: 'التغابن', 65: 'الطلاق',
  66: 'التحريم', 67: 'الملك', 68: 'القلم', 69: 'الحاقة', 70: 'المعارج',
  71: 'نوح', 72: 'الجن', 73: 'المزمل', 74: 'المدثر', 75: 'القيامة',
  76: 'الإنسان', 77: 'المرسلات', 78: 'النبأ', 79: 'النازعات', 80: 'عبس',
  81: 'التكوير', 82: 'الانفطار', 83: 'المطففين', 84: 'الانشقاق', 85: 'البروج',
  86: 'الطارق', 87: 'الأعلى', 88: 'الغاشية', 89: 'الفجر', 90: 'البلد',
  91: 'الشمس', 92: 'الليل', 93: 'الضحى', 94: 'الشرح', 95: 'التين',
  96: 'العلق', 97: 'القدر', 98: 'البينة', 99: 'الزلزلة', 100: 'العاديات',
  101: 'القارعة', 102: 'التكاثر', 103: 'العصر', 104: 'الهمزة', 105: 'الفيل',
  106: 'قريش', 107: 'الماعون', 108: 'الكوثر', 109: 'الكافرون', 110: 'النصر',
  111: 'المسد', 112: 'الإخلاص', 113: 'الفلق', 114: 'الناس',
};

// Locales, die den Surennamen in arabischer Schrift zeigen statt ihn zu
// übersetzen (s. Kommentar bei ARABIC_SURAH_NAMES).
const ARABIC_SCRIPT_LOCALES = new Set(['ar', 'fa', 'ur', 'ps']);

type SurahNameDict = Record<string, string>;

/**
 * Suaheli-Lücke, Runde 1 (Audit 2026-09-06 A): `data/surah-names/sw.json`
 * enthielt bis dahin für alle 114 Suren nur die Umschrift (z. B.
 * "Al-Baqarah"), keine Bedeutung — ein früherer Lauf fand keine verlässliche
 * vollständige Quelle und hat bewusst nicht geraten. Erneute gezielte Suche
 * (quranenc.com/Al-Barwani- und Abubakr-Übersetzung, sw.wikipedia.org,
 * al-islam.org/sw, alhidaaya.com, IIUM-Suaheli-Index, der vollständige
 * Al-Barwani-Fließtext auf archive.org/stream/quranswahili_202002 sowie
 * Dutzende Einzelartikel von bongoclass.com) ergab weiterhin KEINE einzige
 * Quelle mit einer vollständigen 114-Suren-Bedeutungsliste auf Kiswahili.
 * Direkt zitierbare, explizite Bedeutungsangaben ("Maana ya jina hili kwa
 * Kiswahili ni …") fanden sich nur für 8 Suren, alle auf bongoclass.com
 * (Asbab-Nuzul-Reihe): 1 Al-Fatiha (Ufunguzi), 102 At-Takathur (nach Ibn
 * Abbas: tamaa nyingi ya mali na watoto), 104 Al-Humazah (Msingiziaji),
 * 106 Quraish (Kabila la Kuraishi), 111 Al-Masad (Kamba), 112 Al-Ikhlas
 * (Uaminifu wa Imani), 113 Al-Falaq (Mapambazuko), 114 An-Nas (Watu) —
 * jeweils als "Umschrift — Bedeutung", HERKUNFT: zitiert.
 *
 * Suaheli-Lücke, Runde 2 (Audit 2026-09-06 B): Die verbliebenen 106 Suren
 * wurden erneut einzeln geprüft — diesmal mit der Frage, ob der arabische
 * Name ein gewöhnliches Wort ist (dann ist die Kiswahili-Entsprechung eine
 * lexikalische Übersetzung, keine theologische Auslegung, s. u.
 * SW_SURAH_CLASSIFICATION) statt eine unbelegbare Gesamtquelle zu suchen.
 * Ergebnis: 81 der 106 sind klar lexikalisch und jetzt übersetzt (Tiere,
 * Naturdinge, Menschen/Gruppen, Handlungen, Orte — z. B. 2 Al-Baqarah
 * "Ng'ombe"/Kuh, 91 Ash-Shams "Jua"/Sonne, 22 Al-Hajj "Hija"/Pilgerfahrt),
 * HERKUNFT: übersetzt (nicht zitiert — kein Kiswahili-Beleg, sondern eigene
 * Übertragung aus dem Arabischen, gegengeprüft gegen id.json/ms.json).
 * 25 bleiben Umschrift: 15 Buchstabensuren/Eigennamen (Propheten, Personen,
 * ein benanntes Reich/Ort/Paradiesobjekt) und 10 theologisch aufgeladene
 * oder mehrdeutige Namen (Namen/Attribute Allahs, Fachbegriffe ohne
 * durchgesetzte Standardübersetzung, Grenzfälle mit widersprüchlichen
 * Referenzquellen) — s. SW_SURAH_CLASSIFICATION für die vollständige,
 * begründete Zuordnung. surahNames.test.ts prüft jetzt die REGEL (Gruppe a
 * hat eine Bedeutung, Gruppen b/c keine erfundene) statt nur eine Zahl.
 */

/**
 * Klassifizierung der 106 Suren ohne belegte Kiswahili-Bedeutung (Runde 2,
 * s. o.) in drei Gruppen. Grundlage für sw.json UND für surahNames.test.ts —
 * die Zuordnung ist damit nachvollziehbar und später korrigierbar (z. B.
 * wenn doch eine zitierbare Kiswahili-Quelle für eine 'b'/'c'-Sure auftaucht,
 * oder wenn sich eine 'a'-Übersetzung als falsch erweist).
 *
 * Kriterium je Gruppe:
 *   'a' — klar lexikalisch: ein gewöhnliches arabisches Wort mit eindeutiger
 *         Bedeutung (Tier, Naturding, Mensch/Gruppe, Handlung, Ort,
 *         Stammes-/Volksname). Übersetzt in sw.json, Ausgangspunkt das
 *         arabische Wort, gegengeprüft gegen id.json/ms.json (Indonesisch/
 *         Malaiisch — dieselbe islamische Bildungstradition, echte
 *         Bedeutungen statt Umschrift). Wichen id.json und ms.json inhaltlich
 *         voneinander ab (z. B. Nr. 58 Al-Mujadilah: "Klage einreichen" vs.
 *         "bitten/beschwichtigen"), oder hedgte eine der beiden Quellen
 *         selbst — nannte also den arabischen Namen zusätzlich zur
 *         Übersetzung, statt ihr zu vertrauen (z. B. Nr. 15 Al-Hijr: ms.json
 *         schreibt "Kawasan Berbatu, Al-Hijr") — zählte das als
 *         Unsicherheitssignal, Einordnung dann 'b' statt 'a'.
 *   'b' — theologisch aufgeladen oder mehrdeutig: Namen/Attribute Allahs
 *         (Ar-Rahman, Ghafir, Fatir, Al-Aala — jeweils einer der 99 Namen),
 *         Begriffe mit mehreren islamrechtlich/-theologisch relevanten
 *         Fachbedeutungen (Al-Qadr: Bestimmung/Wert/Nacht der Macht;
 *         Al-Furqan: Unterscheidung Wahr/Falsch — beide in der
 *         Aufgabenstellung genannt; Al-Araf: die Höhen als Zwischenreich)
 *         oder ganz ohne durchgesetzte Standardübersetzung (Al-Haqqah,
 *         At-Taghabun), plus die oben genannten id/ms-Grenzfälle. Bleibt
 *         Umschrift.
 *   'c' — Buchstabensuren (Ta-Ha, Ya-Sin, Sad, Qaf: der Name IST die
 *         Buchstabenfolge) oder Eigennamen ohne Bedeutung im gewöhnlichen
 *         Sinn: Propheten/Personen (Yunus, Hud, Yusuf, Ibrahim, Maryam,
 *         Luqman, Muhammad, Nuh, die Familie in Ali-Imran) sowie ein
 *         benanntes Reich/Ort/Paradiesobjekt (Saba, Al-Kawthar). Bleibt
 *         Umschrift.
 *
 * Die 8 bereits vorhandenen zitierten Bedeutungen (1, 102, 104, 106, 111,
 * 112, 113, 114) sind NICHT Teil dieser Tabelle — sie entstanden unabhängig
 * davon (bongoclass.com-Zitate, s. o.) und bleiben unverändert.
 */
export const SW_SURAH_CLASSIFICATION: Record<number, 'a' | 'b' | 'c'> = {
  2: 'a', 3: 'c', 4: 'a', 5: 'a', 6: 'a', 7: 'b', 8: 'a', 9: 'a', 10: 'c',
  11: 'c', 12: 'c', 13: 'a', 14: 'c', 15: 'b', 16: 'a', 17: 'a', 18: 'a',
  19: 'c', 20: 'c', 21: 'a', 22: 'a', 23: 'a', 24: 'a', 25: 'b', 26: 'a',
  27: 'a', 28: 'a', 29: 'a', 30: 'a', 31: 'c', 32: 'a', 33: 'a', 34: 'c',
  35: 'b', 36: 'c', 37: 'a', 38: 'c', 39: 'a', 40: 'b', 41: 'a', 42: 'a',
  43: 'a', 44: 'a', 45: 'a', 46: 'a', 47: 'c', 48: 'a', 49: 'a', 50: 'c',
  51: 'a', 52: 'a', 53: 'a', 54: 'a', 55: 'b', 56: 'a', 57: 'a', 58: 'b',
  59: 'a', 60: 'a', 61: 'a', 62: 'a', 63: 'a', 64: 'b', 65: 'a', 66: 'a',
  67: 'a', 68: 'a', 69: 'b', 70: 'a', 71: 'c', 72: 'a', 73: 'a', 74: 'a',
  75: 'a', 76: 'a', 77: 'a', 78: 'a', 79: 'a', 80: 'a', 81: 'a', 82: 'a',
  83: 'a', 84: 'a', 85: 'a', 86: 'a', 87: 'b', 88: 'a', 89: 'a', 90: 'a',
  91: 'a', 92: 'a', 93: 'a', 94: 'a', 95: 'a', 96: 'a', 97: 'b', 98: 'a',
  99: 'a', 100: 'a', 101: 'a', 103: 'a', 105: 'a', 107: 'a', 108: 'c',
  109: 'a', 110: 'a',
};

/**
 * Die übrigen 8 Sprachen (tr/id/ms/ru/fr/es/bn/sw) werden NICHT statisch
 * gebündelt, sondern genau wie die Sprachdateien selbst (`lib/translate.ts`)
 * per literalem dynamic `import()` je Sprache nachgeladen — 114 Namen × 8
 * Sprachen wären sonst toter Code in jedem Bundle, obwohl pro Sitzung immer
 * nur eine UI-Sprache aktiv ist. Metro braucht dafür einen statischen
 * Pfad-String, deshalb die explizite Map statt eines Template-Pfads.
 */
const SURAH_NAME_LOADERS: Record<string, () => Promise<{ default: SurahNameDict }>> = {
  tr: () => import('./data/surah-names/tr.json'),
  id: () => import('./data/surah-names/id.json'),
  ms: () => import('./data/surah-names/ms.json'),
  ru: () => import('./data/surah-names/ru.json'),
  fr: () => import('./data/surah-names/fr.json'),
  es: () => import('./data/surah-names/es.json'),
  bn: () => import('./data/surah-names/bn.json'),
  sw: () => import('./data/surah-names/sw.json'),
};

const loadedDicts: Partial<Record<string, SurahNameDict>> = {};
const pendingLoads = new Map<string, Promise<void>>();

/**
 * Stößt das Nachladen der Suren-Namen einer Sprache an (idempotent, wirft nie).
 * `surahNameTranslation` selbst wartet die zurückgegebene Promise NICHT ab —
 * beim ersten Aufruf greift noch der englische Fallback, korrekt wird es erst
 * nach Abschluss, wenn `notifyLocalesChanged()` die an `useTranslation()`
 * hängenden Aufrufer zum Neu-Rendern bringt (s. `lib/translate.ts`). Exportiert
 * (analog zu `preloadLocale` in `lib/translate.ts`), damit Tests den Ladevorgang
 * explizit abwarten können, statt auf einen zufälligen Render zu spekulieren.
 */
export function ensureSurahNamesLoaded(locale: string): Promise<void> {
  if (loadedDicts[locale]) return Promise.resolve();
  const existing = pendingLoads.get(locale);
  if (existing) return existing;
  const loader = SURAH_NAME_LOADERS[locale];
  if (!loader) return Promise.resolve();
  const task = loader()
    .then((mod) => {
      loadedDicts[locale] = (mod as { default?: SurahNameDict })?.default ?? (mod as unknown as SurahNameDict);
      notifyLocalesChanged();
    })
    .catch(() => {
      // Sprachdatei nicht ladbar (z. B. offline beim ersten Sprachwechsel auf
      // Web) — Fallback auf Englisch bleibt, ein späterer Aufruf versucht es erneut.
      pendingLoads.delete(locale);
    });
  pendingLoads.set(locale, task);
  return task;
}

/**
 * Bedeutungs-/Anzeigename einer Sure in der UI-Sprache. Deckt alle 14
 * UI-Sprachen ab (Audit 2026-09-06: zuvor nur Deutsch, alle anderen sahen die
 * englische API-Bedeutung, auch auf Arabisch):
 *
 * - de: fest hinterlegte deutsche Bedeutungsnamen (s. GERMAN_SURAH_NAMES).
 * - en: die von der API gelieferte `englishNameTranslation` (kein eigener
 *   Datensatz nötig, das IST bereits Englisch).
 * - ar/fa/ur/ps: der arabische Originalname (s. ARABIC_SURAH_NAMES) — die in
 *   diesen Sprachen etablierte Praxis, den Namen in arabischer Schrift zu
 *   belassen statt ihn zu übersetzen.
 * - tr/id/ms/ru/fr/es/bn/sw: je Sprache nachgeladene Bedeutungs- bzw.
 *   Umschrift-Tabelle (s. `data/surah-names/*.json` und deren Quellenangaben
 *   im Build-Skript-Kommentar). Solange die Datei noch nicht geladen ist (oder
 *   falls sie fehlschlägt), fällt die Funktion auf `englishFallback` zurück.
 *
 * Fällt bei unbekannter Surennummer (außerhalb 1..114) oder unbekannter
 * Sprache immer auf `englishFallback` zurück statt einen leeren String zu
 * liefern.
 */
export function surahNameTranslation(
  surahNumber: number,
  locale: string,
  englishFallback: string,
): string {
  if (locale === 'de') return GERMAN_SURAH_NAMES[surahNumber] ?? englishFallback;
  if (locale === 'en') return englishFallback;
  if (ARABIC_SCRIPT_LOCALES.has(locale)) return ARABIC_SURAH_NAMES[surahNumber] ?? englishFallback;
  if (SURAH_NAME_LOADERS[locale]) {
    ensureSurahNamesLoaded(locale);
    const dict = loadedDicts[locale];
    return dict?.[String(surahNumber)] ?? englishFallback;
  }
  return englishFallback;
}
