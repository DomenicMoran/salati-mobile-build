// Salati KI — lokales Retrieval, 1:1 nach public/rag/suche.js portiert (BM25-lite
// + deutscher Light-Stemmer + Synonym-Expansion + Bigramm-Boost). Läuft nativ
// (kein Browser, kein DOM) — die Web-Version bleibt die separate JS-Datei
// public/rag/suche.js (Modul-Grenzen unterschiedlich: Web lädt per <script
// type="module">, nativ per Metro-Bundler). Bei Änderungen an der Such-Logik
// BEIDE Dateien synchron halten (suche.test.js deckt die Web-Seite ab,
// retrieval.test.ts diese Seite).
//
// sucheHybrid()/kosinus()/int8ZuFloat() sind mitportiert für Verhaltensparität
// und künftige Wiederverwendung, werden vom nativen KI-Screen aktuell aber
// NICHT aufgerufen — die Web-Version nutzt für Stufe 2 transformers.js/ONNX im
// Browser; ein äquivalentes On-Device-Embedding-Modell zusätzlich zu llama.rn
// einzubinden würde die App-Größe/Komplexität für die erste native Version
// unverhältnismäßig erhöhen. Reine Keyword-Suche (suche()) ist bereits die
// Stufe-1-Grundlage, die auch die Web-Version ohne WebGPU verwendet.

export interface KorpusDoc {
  id: string;
  src: string;
  t: string;
  /**
   * Zusatz-Suchbegriffe: werden mitindexiert, aber dem Modell/Nutzer NICHT
   * angezeigt. Damit trifft z. B. „isha" ein Dokument, in dem nur „Ischa"
   * steht, ohne den Antworttext mit Schreibvarianten zu verschmutzen.
   */
  k?: string;
  /**
   * App-Route des Dokuments (antippbare Quellen im KI-Chat), gesetzt von
   * scripts/build-ki-korpus.mjs — z. B. "/guides/wudu", "/study/aqida/aqida-01",
   * "/duas/morning". NICHT gesetzt für Koran- und Hadith-Dokumente: deren Route
   * ergibt sich eindeutig aus der Doc-ID (siehe features/ki/quellen.ts) und
   * würde als eigenes Feld über 6.300 Dokumente hinweg nur das Bundle aufblähen.
   */
  u?: string;
  /**
   * 1, wenn dieses Dokument in einem NICHT-deutschen Korpus nur auf Deutsch
   * vorliegt (die Quelle ist für diese Sprache noch nicht übersetzt), gesetzt
   * von scripts/build-ki-korpus.mjs. Die App zählt diese Dokumente
   * (features/ki/korpus.ts → KorpusStand.deutsch) und weist im KI-Screen darauf
   * hin, statt so zu tun, als wäre alles übersetzt. Im deutschen Korpus nie gesetzt.
   */
  fb?: 1;
}

interface IndexedDoc extends KorpusDoc {
  tok: string[];
  /** Tokens NUR aus Quellenangabe + Keywords (Titelzeile) — für den Titel-Bonus. */
  titelTok: string[];
}

export interface Index {
  docs: IndexedDoc[];
  df: Map<string, number>;
  avg: number;
}

export const STOP = new Set(
  (
    'der die das und oder ist sind war waren ein eine einen dem den des im in an auf mit für von zu über was wie wer wo aber auch nicht man es er sie ich du wir ihr euch uns sich hat haben wird werden bei aus nach vor doch denn dass wenn als so um am zum zur ' +
    // Frage-Füllwörter, die in Chat-Fragen dominieren, aber keine Inhalte tragen:
    'gegen ohne sein seine seiner seinem kann soll sollte darf muss gibt sagt steht hilft helfen macht tun etwas jemand alles diese dieser dieses damit dazu dabei dann noch nur schon sehr mehr viel viele immer welche welcher welches warum wieso weshalb wann islam koran ' +
    // Füllwörter der 13 weiteren App-Sprachen. Bis 2026-07-27 enthielt STOP nur
    // Deutsch; in den anderen Sprachen fielen kurze Funktionswörter nur zufällig
    // durch die Längenregel heraus. Seit diese für nicht-lateinische Schriften
    // bei zwei Zeichen liegt (sonst verschwand حج), kommen sie durch und
    // verrauschen die Wertung — z. B. verlor Paschtu dadurch „Tarawih".
    'the and what how why who when where does can should must with from that this ' +
    'nedir nasil ne bir icin ile mi mu bu su olan ' +
    'que qui quoi comment pourquoi est les des une dans pour avec sur ' +
    'como por para los las una con del que sobre ' +
    'apa bagaimana mengapa yang untuk dari dengan pada itu ini adalah ' +
    'apakah bagaimanakah mengapakah ialah kepada daripada ' +
    'nini vipi kwa nini ndio hii hiyo katika kwa ya wa ni ' +
    'что как почему кто где когда это для при над под есть ли ' +
    'ما هو هي هل من في عن مع لا ان الى على كيف لماذا متى اين ماذا ' +
    // Relativ- und Demonstrativpronomen (ar) sowie Kopula und Verbteile (fa).
    // Persisch schreibt zusammengesetzte Verbformen mit ZWNJ („می‌گوید"); die
    // Normalisierung trennt dort, wodurch die Fragmente „می" und „گوید" als
    // eigene Tokens auftauchen. Sie stehen in fast jedem Dokument und
    // verrauschten die Wertung: „قرآن درباره صبر چه می‌گوید؟" fand den
    // Sabr-Kurstext erst auf Rang 5, „آیا در اسلام شراب حلال است؟" den
    // Alkohol-Eintrag erst auf Rang 4.
    'الذي التي الذين هذا هذه ذلك ' +
    'که را به در از این آن با برای چیست چگونه چرا کجا کدام آیا است هست می شود کند کنم گوید دارد بود باید ' +
    'کیا ہے ہیں کا کی کو سے میں پر اور یا کیوں کیسے کہاں ' +
    'څه دی ده په له ته دا هغه چې څنګه ولې چیرته ' +
    'কি কী কেন কীভাবে কোথায় এই সেই এবং বা তার হয় করে জন্য'
  ).split(/\s+/),
);

// Arabischer Unicode-Block (Basis + Supplement + Presentation Forms A/B) wird
// NICHT weggefiltert — siehe Kommentar in suche.js für die Historie des Bugs,
// den das behebt (arabische Fragen ergaben vorher 0 Tokens).
const ARABISCH_BEREICH = '\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFC';
export const norm = (s: string): string =>
  s
    .toLowerCase()
    // Deutsche Umlaute/ß EXPLIZIT falten (ä→ae, ö→oe, ü→ue, ß→ss) — VOR jeder
    // Unicode-Normalisierung. Damit matchen Frage und Korpus unabhängig von der
    // Schreibweise: "Säulen" === "Saeulen" === (klein) "saeulen". Zusätzlich
    // hängt die Umlaut-Behandlung so NICHT mehr an .normalize('NFD') + der
    // Kombinationszeichen-Range (die in Hermes/on-device anders greifen kann als
    // in Node/Browser — mögliche Ursache dafür, dass die KI auf dem Gerät bei
    // Umlaut-Fragen "keine Quelle" meldete). MUSS identisch in public/rag/suche.js sein.
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Beibehalten wird jeder BUCHSTABE, jede ZIFFER und jedes KOMBINIERENDE
    // ZEICHEN irgendeiner Schrift (\p{L}\p{N}\p{M}) — nicht mehr nur a-z0-9 +
    // arabischer Block. Grund (2026-07-27, beim Bau der sprachspezifischen
    // Korpora gemessen): „Что такое молитва" ergab mit der alten a-z0-9-Klasse
    // NULL Tokens; für Russisch hätte das Retrieval unabhängig vom Korpus immer
    // 0 Treffer geliefert. \p{M} ist dabei Pflicht und keine Feinheit: die
    // bengalischen Vokalzeichen sind Mc/Mn, ohne sie zerfällt „ইশার নামাজ কি"
    // zu „ইশ র ন ম জ ক". Für Arabisch bleibt das Verhalten unverändert (die
    // Harakat lagen schon vorher innerhalb der beibehaltenen Blöcke).
    .replace(/[^\p{L}\p{N}\p{M} ]/gu, ' ');

const ARABISCH_BUCHSTABE = new RegExp(`[${ARABISCH_BEREICH}]`);
const BUCHSTABE = /\p{L}/u;
export function istArabisch(text: string | undefined): boolean {
  const buchstaben = [...(text ?? '')].filter((c) => BUCHSTABE.test(c));
  if (buchstaben.length === 0) return false;
  const arabisch = buchstaben.filter((c) => ARABISCH_BUCHSTABE.test(c));
  return arabisch.length / buchstaben.length > 0.5;
}

// Deutscher Light-Stemmer: Suffixe abschneiden (längste zuerst), nur wenn Reststamm >= 4 Zeichen.
// Deutsche Suffixe plus die häufigsten Plural-/Obliquus-Endungen der
// perso-arabischen Schriften. Letztere sind 2026-07-28 dazugekommen: die
// Urdu-Rückfrage „اور عورتوں کے لیے؟" traf „Frauen in der Moschee" nicht,
// weil das Fragewort عورتوں (obliquer Plural) und das Korpus-Wort عورت als
// verschiedene Tokens galten — der Eintrag landete auf Rang 86. Weil der
// Stemmer auf BEIDE Seiten (Frage und Korpus) gleich wirkt, kann er keine
// Asymmetrie erzeugen; eine gelockerte Präfix-Regel konnte das (gemessen:
// sie kostete zwei der 560 Eval-Fragen ihre einzige passende Passage).
// Deutsche Wörter können nicht auf arabische Buchstaben enden, die Listen
// stören sich also nicht. MUSS identisch in public/rag/suche.js sein.
const SUFFIXE = [
  'heiten', 'keiten', 'ungen', 'igen', 'lich', 'isch', 'heit', 'keit', 'ung', 'ige', 'ern', 'ig', 'en', 'er', 'es', 'em', 'e', 'n', 's',
  // Urdu: obliquer Plural وں, Plural یں/ے · Persisch: Plural ها/های/هایی
  'هایی', 'های', 'وں', 'یں', 'ها',
];
export function stemme(w: string): string {
  let wieder = true;
  while (wieder) {
    wieder = false;
    for (const suf of SUFFIXE) {
      if (w.length - suf.length >= 4 && w.endsWith(suf)) {
        w = w.slice(0, w.length - suf.length);
        wieder = true;
        break;
      }
    }
  }
  return w;
}

/**
 * Mindestlänge eines Tokens. Die „länger als 2 Zeichen"-Regel ist eine
 * DEUTSCHE Heuristik gegen Füllwörter („am", „im", „zu"). Auf Schriften ohne
 * lateinische Buchstaben ist sie falsch: حج (Hadsch) hat genau zwei Zeichen und
 * fiel dadurch komplett aus der Suche. Gemessen 2026-07-27:
 *   „حج څه دی"  (Paschtu)  → []            — die Frage kam nie im Index an
 *   „حج چیست"   (Persisch) → ["چیست"]      — übrig blieb nur „was ist"
 *   „حج کیا ہے" (Urdu)     → ["کیا"]       — dito
 * Deshalb greift die Grenze nur noch für lateinische Tokens; für alle anderen
 * Schriften reichen zwei Zeichen. Einzelzeichen bleiben überall draußen, sie
 * tragen in keiner der 14 Sprachen genug Bedeutung.
 */
const LATEINISCH = /^[\p{Script=Latin}\p{N}]+$/u;
const mindestlaenge = (w: string): boolean => (LATEINISCH.test(w) ? w.length > 2 : w.length >= 2);

export const tokens = (s: string): string[] =>
  norm(s)
    .split(/\s+/)
    .filter((w) => mindestlaenge(w) && !STOP.has(w))
    .map(stemme);

// Kuratierte Synonym-/Begriffsgruppen (islamisches Vokabular). WICHTIG: bildet
// MODERNE/umgangssprachliche Frage-Wörter auf die KLASSISCHE Übersetzungs-
// Terminologie ab, die tatsächlich im Korpus steht (Analyse 2026-07-26: z. B.
// "alkohol"=0 Treffer, aber "wein"=20; "geld"=8, aber "besitz/vermögen" häufig;
// "teufel"=3, aber "satan"=78; "wut"=1, aber "zorn"=26). Ohne diese Brücke gaben
// modern formulierte Fragen 0 Treffer -> "keine Quelle gefunden".
const SYNONYM_GRUPPEN = [
  ['geduld', 'sabr', 'standhaft', 'ausharren', 'erdulden', 'geduldig', 'صبر', 'الصبر'],
  ['gebet', 'salat', 'beten', 'anbetung', 'gottesdienst', 'صلاة', 'الصلاة'],
  // Die fünf täglichen Gebete: Frage-Schreibweisen (Transliteration) auf die im
  // Korpus vorkommende deutsche Schreibweise brücken (z. B. "isha" → "ischa").
  ['fajr', 'fadschr', 'morgengebet', 'morgendämmerung', 'فجر'],
  ['dhuhr', 'duhr', 'zuhr', 'mittagsgebet', 'ظهر'],
  ['asr', 'nachmittagsgebet', 'عصر'],
  ['maghrib', 'magrib', 'abendgebet', 'sonnenuntergang', 'مغرب'],
  ['isha', 'ischa', 'ishaa', 'nachtgebet', 'عشاء'],
  ['wudu', 'wudhu', 'gebetswaschung', 'waschung', 'reinigung', 'gebetsreinigung', 'وضوء'],
  ['fasten', 'sawm', 'ramadan', 'صيام', 'رمضان', 'الصيام'],
  ['almosen', 'zakat', 'spende', 'spenden', 'mildtätigkeit', 'wohltätigkeit', 'sadaqa', 'زكاة', 'الزكاة'],
  ['pilgerfahrt', 'hajj', 'hadsch', 'wallfahrt', 'حج', 'الحج'],
  ['vergebung', 'tauba', 'reue', 'verzeihen', 'vergib', 'umkehr', 'buße', 'توبة', 'التوبة'],
  ['paradies', 'dschanna', 'garten', 'gärten', 'جنة', 'الجنة'],
  ['hölle', 'feuer', 'dschahannam', 'جهنم', 'النار'],
  ['eltern', 'mutter', 'vater', 'الوالدين'],
  ['prophet', 'gesandter', 'muhammad', 'نبي', 'النبي', 'رسول', 'الرسول'],
  ['wissen', 'ilm', 'lernen', 'bildung', 'weisheit', 'علم', 'العلم'],
  ['tod', 'sterben', 'jenseits', 'auferstehung', 'gestorben', 'موت', 'الموت'],
  ['dankbarkeit', 'schukr', 'dankbar', 'dank', 'danken', 'شكر', 'الشكر'],
  ['angst', 'furcht', 'sorge', 'sorgen', 'kummer', 'خوف', 'الخوف'],
  ['hoffnung', 'zuversicht', 'رجاء', 'أمل', 'الأمل'],
  ['barmherzigkeit', 'rahma', 'gnade', 'gnädig', 'barmherzig', 'رحمة', 'الرحمة'],
  ['gottvertrauen', 'tawakkul', 'verlassen', 'verlässt', 'vertraut', 'vertrauen', 'توكل', 'التوكل'],
  // --- modern/umgangssprachlich -> klassisch ---
  ['alkohol', 'wein', 'rauschmittel', 'berauschend', 'trunkenheit', 'betrunken', 'chamr', 'خمر'],
  ['teufel', 'satan', 'schaitan', 'iblis', 'شيطان', 'إبليس'],
  ['wut', 'zorn', 'ärger', 'wütend', 'zornig', 'غضب'],
  ['geld', 'besitz', 'vermögen', 'reichtum', 'wohlstand', 'reich', 'مال'],
  ['zins', 'zinsen', 'wucher', 'riba', 'ربا'],
  ['ehrlich', 'ehrlichkeit', 'wahrhaftig', 'aufrichtig', 'wahrheit', 'wahrhaftigkeit', 'صدق'],
  ['lüge', 'lügen', 'lügner', 'falschheit', 'betrug', 'betrügen', 'كذب'],
  ['nachbar', 'nachbarn', 'جار', 'الجار'],
  ['arm', 'armut', 'bedürftig', 'armen', 'bedürftigen', 'فقير', 'مسكين'],
  ['waise', 'waisen', 'يتيم', 'اليتيم'],
  ['neid', 'eifersucht', 'missgunst', 'neidisch', 'حسد'],
  ['hochmut', 'stolz', 'arroganz', 'überheblich', 'hochmütig', 'كبر', 'تكبر'],
  ['bescheidenheit', 'demut', 'bescheiden', 'تواضع'],
  ['gerechtigkeit', 'gerecht', 'عدل', 'العدل'],
  ['unrecht', 'ungerechtigkeit', 'unterdrückung', 'ظلم', 'الظلم'],
  ['ehe', 'heirat', 'heiraten', 'ehepartner', 'ehefrau', 'ehemann', 'nikah', 'نكاح', 'زواج'],
  ['kinder', 'kind', 'nachkommen', 'söhne', 'أولاد', 'ذرية'],
  ['sünde', 'sünden', 'vergehen', 'sündigen', 'ذنب', 'إثم', 'خطيئة'],
  ['essen', 'speise', 'nahrung', 'halal', 'erlaubt', 'طعام', 'حلال'],
  ['schwein', 'schweinefleisch', 'خنزير'],
  ['streit', 'zank', 'versöhnung', 'frieden', 'aussöhnung', 'صلح', 'سلام'],
  ['zunge', 'reden', 'worte', 'sprechen', 'rede', 'لسان', 'قول'],
  ['herz', 'herzen', 'قلب', 'القلب'],
  ['seele', 'nafs', 'ego', 'نفس', 'النفس'],
  ['liebe', 'lieben', 'zuneigung', 'حب', 'المحبة'],
  ['aufrichtigkeit', 'ichlas', 'reine', 'absicht', 'إخلاص', 'نية'],
  ['nachsicht', 'milde', 'sanftmut', 'nachsichtig', 'حلم', 'رفق'],
  ['bittgebet', 'dua', 'anrufen', 'flehen', 'دعاء', 'الدعاء'],
  ['engel', 'engeln', 'ملائكة', 'ملك'],
  ['schöpfung', 'erschaffen', 'schöpfer', 'خلق', 'الخالق'],
  ['sabr', 'geduld'], // Rückrichtung für Transliterationen sichergestellt

  // ---------- sprachübliche Umschriften der 14 App-Sprachen ----------
  // Nutzer tippen islamische Fachbegriffe in der Umschrift IHRER Sprache
  // ("alquibla", "taywid", "chahada"), der Korpus führt aber die Schreibweise
  // seiner Sprache. Ohne Brücke fand die Suche dazu NICHTS (gemessen
  // 2026-07-27: es „Qué es la alquibla" und es „Qué es el taywid" lieferten 0
  // Dokumente, obwohl w-qibla bzw. k-tajwid im spanischen Korpus stehen).
  // Aufgenommen sind nur Schreibweisen, die in den übersetzten App-Daten
  // (korpus-<lang>.json / wissen-<lang>.json) tatsächlich vorkommen, plus die
  // im jeweiligen Sprachraum gängige Nutzer-Schreibweise.
  ['qibla', 'kibla', 'quibla', 'alquibla', 'kiblat', 'кибла', 'قبلة', 'قبله', 'قبلہ', 'কিবলা'],
  ['tajwid', 'tadschwied', 'tajweed', 'tecvit', 'tecvid', 'tayuid', 'taywid', 'tajwidi', 'таджвид', 'تجويد', 'تجوید', 'তাজবিদ', 'তাজবীদ'],
  ['schahada', 'shahada', 'chahada', 'sehadet', 'syahadat', 'syahadah', 'шахада', 'شهادة', 'شهادت', 'شہادت', 'শাহাদাহ'],
  ['muslim', 'muislamu', 'mwislamu', 'uislamu', 'musulman', 'musulmán', 'müslüman', 'мусульманин', 'مسلمان', 'مسلم', 'মুসলিম'],
  ['allah', 'alá', 'aláh', 'аллах', 'الله', 'اللہ', 'আল্লাহ', 'dios', 'dieu', 'tanrı', 'бог', 'خدا'],
  // Geduld/Zorn/Fasten: hier scheitert es NICHT an der Umschrift, sondern an
  // der Flexion der Fragesprache — „كيف أصبح أكثر صبرا" (ar), „چگونه صبورتر
  // شوم" (fa), „زیادہ صابر کیسے بنوں" (ur) enthalten abgeleitete Formen, die
  // der (deutsche) Stemmer nicht auf den Korpus-Stamm صبر zurückführen kann.
  ['sabr', 'صبر', 'الصبر', 'صبرا', 'صابر', 'صبور', 'صبورتر', 'صبرناک', 'sabır', 'sabar', 'subira', 'kesabaran', 'терпение', 'сабр', 'ধৈর্য', 'সবর', 'paciencia'],
  ['zorn', 'غضب', 'غضبي', 'الغضب', 'خشم', 'خشمم', 'غصه', 'غصہ', 'غوسه', 'قهر', 'hasira', 'amarah', 'öfke', 'colère', 'гнев', 'রাগ', 'ক্রোধ'],
  ['fasten', 'صيام', 'الصيام', 'الصائم', 'صوم', 'روزه', 'রোজা', 'oruç', 'puasa', 'ayuno', 'jeûne', 'пост', 'saumu', 'funga', 'swaumu'],
  // „Was BRICHT das Fasten" ist eine eigene Frage und braucht eine eigene
  // Gruppe. Bis 2026-07-28 standen يفطر und مفطرات in der Fasten-Gruppe oben —
  // damit war „bricht das Fasten" ein Synonym von „fasten", und genau die
  // Unterscheidung ging verloren, an der die Antwort hängt: in acht Sprachen
  // gewann die allgemeine Ramadan-Passage, „Was das Fasten bricht" fiel aus
  // den Treffern (ar auf Rang 8, sw gar nicht mehr).
  [
    'bricht', 'ungueltig', 'breaks', 'invalidates', 'nullifies',
    'bozar', 'bozan', 'bozulur', 'يفطر', 'مفطرات', 'يبطل', 'المفطرات',
    'rompt', 'rompre', 'invalide', 'annule', 'rompe', 'invalida', 'anula',
    'нарушает', 'нарушают', 'membatalkan', 'batal', 'ভাঙে', 'ভঙ্গ',
    'ٹوٹتا', 'توڑ', 'باطل', 'ابطال', 'ماتوي',
    'batilisha', 'kinachobatilisha', 'inavunjika', 'yanayoivunja', 'vunja', 'batili',
  ],
  ['eltern', 'পিতামাতা', 'বাবা', 'الوالدين', 'والدین', 'walidain', 'walidayn', 'parents', 'padres', 'wazazi', 'родители'],
  // Reinheit
  // Suaheli bildet das Verb mit Vorsilben (ni-na-tawadha-je); der Stemmer
  // schneidet nur Endungen ab, deshalb stehen die Frageformen hier ausdrücklich.
  // Ohne sie fand „Ninatawadhaje?" den Wudu-Guide erst auf Rang 43.
  ['wudu', 'wuduk', 'abdest', 'udhu', 'вуду', 'وضو', 'وضوء', 'অজু', 'উযু', 'ওজু', 'ninatawadhaje', 'kutawadha', 'natawadha', 'tawadha'],
  ['ghusl', 'gusl', 'ghousl', 'gusül', 'гусль', 'غسل', 'গোসল', 'josho', 'junub', 'janaba', 'جنابت'],
  ['tayammum', 'tayamum', 'teyemmüm', 'таяммум', 'تيمم', 'تیمم', 'তায়াম্মুম'],
  // Gebetszeiten und einzelne Gebete
  // عشا ohne Hamza (fa-Frageform) und die bengalische Schreibvariante ইশা
  // neben এশা: beide fehlten und kosteten fa und bn je einen Treffer.
  ['isha', 'işa', 'icha', 'isya', 'isyak', 'esha', 'иша', 'عشاء', 'عشا', 'এশা', 'ইশা', 'ইশার', 'ماخستن'],
  ['fajr', 'fecr', 'fadjr', 'subuh', 'subh', 'sobh', 'фаджр', 'فجر', 'ফজর', 'alfajiri'],
  ['dhuhr', 'zohor', 'zuhur', 'dzuhur', 'duhur', 'zohr', 'зухр', 'ظهر', 'ظہر', 'জোহর', 'যোহর', 'adhuhuri', 'ماسپخین'],
  ['asr', 'asar', 'аср', 'عصر', 'আসর', 'alasiri', 'مازیګر'],
  ['maghrib', 'mağrib', 'магриб', 'مغرب', 'মাগরিব', 'magharibi', 'ماښام'],
  ['witr', 'vitir', 'witir', 'witiri', 'витр', 'وتر', 'বিতর'],
  ['tahadschud', 'tahajjud', 'tahajud', 'teheccüd', 'tahayyud', 'тахаджуд', 'تهجد', 'تہجد', 'তাহাজ্জুদ'],
  ['rakat', 'rakaat', 'rekat', 'rekât', 'rakaa', 'ракаат', 'ركعة', 'رکعت', 'রাকাত'],
  ['tarawih', 'teravih', 'terawih', 'tarawehe', 'tarabih', 'taraweeh', 'таравих', 'تراویح', 'তারাবিহ'],
  ['qunut', 'kunut', 'кунут', 'قنوت', 'কুনুত'],
  ['dschumua', 'jumua', 'jumuah', 'jumat', 'jumaat', 'jumma', 'juma', 'cuma', 'cumua', 'yumua', 'джума', 'جمعة', 'جمعه', 'جمعہ', 'জুমা', 'ijumaa'],
  ['janaza', 'janazah', 'yanaza', 'cenaze', 'jenazah', 'jeneza', 'джаназа', 'جنازة', 'جنازه', 'جنازہ', 'জানাজা'],
  // Säulen und Grundbegriffe
  ['salat', 'salah', 'namaz', 'namaaz', 'solat', 'shalat', 'sala', 'намаз', 'لمونځ', 'لمانځه', 'نماز', 'নামাজ'],
  ['zakat', 'zekat', 'zekât', 'закят', 'زكاة', 'زکات', 'زکوٰۃ', 'যাকাত', 'zaka', 'nisab', 'nisap', 'nisabu', 'нисаб', 'نصاب', 'নিসাব'],
  ['hadsch', 'hajj', 'hac', 'hacc', 'hach', 'hadj', 'haji', 'хадж', 'حج', 'হজ', 'hija'],
  ['umra', 'umrah', 'umre', 'умра', 'عمرة', 'عمره', 'ওমরাহ'],
  ['ramadan', 'ramazan', 'ramadhan', 'ramadhani', 'ramadán', 'рамадан', 'রমজান', 'روژه'],
  ['eid', 'aïd', 'bayram', 'idul', 'aidilfitri', 'aidiladha', 'ид', 'عيد', 'عید', 'ঈদ', 'idi', 'sikukuu', 'اختر', 'akhtar'],
  ['fitr', 'fitra', 'fitrana', 'fitrah', 'fitre', 'фитр', 'фитрана', 'فطره', 'فطرانہ', 'ফিতরা'],
  ['iftar', 'futari', 'ифтар', 'افطار', 'ইফতার'],
  ['suhur', 'sahur', 'sehri', 'сухур', 'سحری', 'سحور', 'সেহরি'],
  ['sunna', 'sunnah', 'sünnet', 'sunnat', 'сунна', 'سنة', 'سنت', 'সুন্নাহ'],
  ['hadith', 'hadis', 'hadîs', 'hadits', 'хадис', 'حديث', 'حدیث', 'হাদিস'],
  ['dua', 'doa', 'дуа', 'دعا', 'দোয়া', 'maombi'],
  ['tauhid', 'tawhid', 'tawheed', 'tevhid', 'tauhidi', 'таухид', 'توحيد', 'توحید', 'তাওহিদ'],
  // Familie, Recht, Essen
  ['nikah', 'nikkah', 'nikâh', 'nikaha', 'никах', 'نكاح', 'نکاح', 'নিকাহ'],
  ['mahr', 'mehir', 'mahar', 'mahari', 'махр', 'مهر', 'مہر', 'مهریه', 'মোহর', 'sadaq'],
  ['halal', 'helal', 'халяль', 'حلال', 'হালাল', 'halali'],
  ['haram', 'харам', 'حرام', 'হারাম', 'haramu'],
];

// Lookup auf Stemm-Ebene: gestemmter Begriff -> Set gestemmter Synonyme (ohne sich selbst).
export const SYNONYME = new Map<string, Set<string>>();
for (const gruppe of SYNONYM_GRUPPEN) {
  const stems = [...new Set(gruppe.map((w) => stemme(norm(w).trim())))];
  for (const s of stems) {
    if (!SYNONYME.has(s)) SYNONYME.set(s, new Set());
    for (const other of stems) if (other !== s) SYNONYME.get(s)!.add(other);
  }
}

/**
 * Dokumenttyp-Gewichte (über das Doc-ID-Präfix, siehe scripts/build-ki-korpus.mjs).
 *
 * Warum: Ein EINZELNER Koran-Vers beantwortet fast nie eine Nutzerfrage wie
 * „Wie mache ich Wudu?" — er belegt sie höchstens. Erklärende Dokumente
 * (kuratiertes Grundwissen, Praxis-Guides, Kurstexte) beantworten sie
 * vollständig. Ohne diese Gewichtung verdrängen 6.200 Einzelverse rein durch
 * ihre Masse die wenigen Dokumente, die die Antwort tatsächlich enthalten —
 * genau der Grund für die „keine Stelle"-Antworten vom 2026-07-27.
 * Verse verschwinden dadurch nicht: Bei Fragen nach einer Koranstelle gewinnen
 * sie weiterhin über die Wortübereinstimmung.
 *
 * Das Dua-Gewicht (d:) wurde 2026-07-28 als Hebel gegen die „kurze Dua gewinnt"-
 * Regression durchgemessen und VERWORFEN: 0.9 und 0.7 ändern die Platz-1-Quote
 * über alle 560 Fragen NICHT (510 wie mit 1.1, MRR +0,0003). Grund: Der
 * Verdränger bei „Wer ist Allah" war „Salati-Wissen: Bittgebet beim Verlassen
 * des Hauses" — ein w-Dokument mit Gewicht 1.9, kein d:-Dokument. Geprüfte Duas
 * unter die Koran-Verse zu stellen, ist durch diese Messung nicht belegt und
 * würde echte Dua-Fragen ohne Gegenwert verschlechtern.
 */
export function typGewicht(id: string): number {
  if (id.startsWith('w-')) return 1.9; // kuratiertes Grundwissen
  if (id.startsWith('g-')) return 1.8; // Praxis-Guides (Wudu, Salah, Hadsch …)
  if (id.startsWith('k-')) return 1.35; // Kurstexte
  if (id.startsWith('h-')) return 1.15; // Hadithe (40 Nawawi)
  // Geprüfte Duas: 0.95 statt der früheren 1.1, also knapp UNTER einem
  // Koran-Vers. Grund (gemessen 2026-07-28): Duas sind kurz und enthalten fast
  // alle die Gottesbezeichnung — nachdem der Korpus von 47 auf alle 106 Duas
  // ergänzt wurde, verdrängten sie im spanischen Korpus die Grundlagen-Antwort
  // auf „Quién es Alá" komplett aus den Treffern („Alá" steht dort in jeder
  // Dua). Eine Dua BELEGT eine Antwort, sie IST keine. Sweep über alle 560
  // mehrsprachigen Fragen: 1.1 → 559/560 Treffer; 0.95 → 560/560 bei
  // unveränderter Platz-1-Quote (510) und minimal besserem MRR.
  if (id.startsWith('d:')) return 0.95;
  return 1; // q: Koran-Verse
}

// Gattungswörter, die in fast jeder Quellenangabe stehen ("Salati-Wissen: …",
// "Salati-Kurs Aqida: …", "an-Nawawī Nr. 5", "Koran 2:153"). Sie sagen nichts
// über das Thema aus und würden den Titel-Bonus verwässern.
//
// Die Liste enthält dieselben Etiketten in allen 14 App-Sprachen, weil die
// sprachspezifischen Korpora ihre Quellenangaben übersetzt führen ("Kursus
// Salati: …", "Курс Salati: …" — siehe ETIKETTEN in scripts/build-ki-korpus.mjs).
// Ohne das hätte in jeder Nicht-de-Sprache das Wort "Kursus"/"Курс" den
// Titel-Bonus dominiert. Gestemmt wird beim Aufbau, damit die Einträge nicht
// von Hand an den Stemmer angepasst werden müssen.
const TITEL_FUELLWORT = new Set(
  (
    'salati wissen kurs praxis nawawi dua sure ' +
    'quran course guide knowledge ' + // en
    "kur an dersi rehberi bilgi " + // tr
    'القرآن درس سلاتي دليل معرفة ' + // ar
    'coran corán curso guia guía saber ' + // es
    'cours savoir ' + // fr
    'коран курс практика знание ' + // ru
    'kursus panduan pengetahuan ' + // id/ms
    'কুরআন সালাতি কোর্স নির্দেশিকা জ্ঞান ' + // bn
    'قرآن سلاتی کورس رہنما معلومات ' + // ur
    'دوره سلاتی دانش راهنمای ' + // fa
    'سلاتي لارښود پوهه ' + // ps
    'kozi mwongozo maarifa' // sw
  )
    .split(' ')
    .filter(Boolean)
    .map((w) => stemme(norm(w).trim())),
);

// Gewichte des Titel-Bonus (empirisch am echten Korpus eingestellt, siehe
// scripts/ki-retrieval-eval.mjs): Der zweite Anteil wiegt schwerer, weil er die
// Themen-GENAUIGKEIT misst. Ohne ihn gewann bei "Wer ist Allah" der Eintrag
// "In scha Allah, ma scha Allah, alhamdulillah" — er nennt "Allah" 13-mal statt
// 3-mal und schlug den passenden Eintrag rein über die Worthäufigkeit.
//
// KERN = 2.0 und nicht 3.0: Diese Datei und public/rag/suche.js hatten den Wert
// unterschiedlich (3.0 hier, 2.0 dort) und lieferten dadurch für dieselbe Frage
// verschiedene Passagen. Statt eine Seite auf die andere zu ziehen, wurden beide
// Werte gemessen (2026-07-27, alle 560 mehrsprachigen Eval-Fragen, k1 = 0.9):
//   KERN = 2.0 → 560/560 Treffer, MRR 0,9351, Platz 1 in 501, Platz 1–2 in 530
//   KERN = 3.0 → 560/560 Treffer, MRR 0,9328, Platz 1 in 500, Platz 1–2 in 526
// Die Treffer/kein-Treffer-Quote ist gleich; 2.0 setzt die richtige Passage aber
// öfter nach ganz vorne — und die erste Passage bestimmt die Antwort des Modells
// am stärksten. 2026-07-28 mit IDF-Deckel + b = 0.3 nachgemessen: 2.5 → Platz 1
// in 507, 1.5 → 558/560 Treffer; 2.0 bleibt der beste Wert.
// MUSS identisch in suche.js sein.
const TITEL_FRAGE_GEWICHT = 0.5;
const TITEL_KERN_GEWICHT = 2.0;

export function baueIndex(docs: KorpusDoc[]): Index {
  const D: IndexedDoc[] = docs.map((d) => ({
    ...d,
    tok: tokens((d.src ?? '') + ' ' + (d.k ?? '') + ' ' + d.t),
    titelTok: tokens((d.src ?? '') + ' ' + (d.k ?? '')),
  }));
  const df = new Map<string, number>();
  for (const d of D) for (const w of new Set(d.tok)) df.set(w, (df.get(w) ?? 0) + 1);
  const avg = D.reduce((a, d) => a + d.tok.length, 0) / (D.length || 1);
  return { docs: D, df, avg };
}

/**
 * Zählt Vorkommen eines Suchworts: exakte Treffer und (nur für die
 * Original-Frageworte, nicht für Synonyme) Präfix-Treffer ab 5 Zeichen.
 *
 * Präfix-Treffer zählen nur zu 60 %, weil der Präfix-Vergleich bewusst grob
 * ist und sonst falsche Nachbarn gewinnen: „Schadda" (Tadschwied-Zeichen) und
 * „Schaden" teilen die ersten fünf Buchstaben und landeten dadurch als
 * Volltreffer bei den Hadithen über Schaden.
 */
function trefferZahl(tok: string[], w: string, praefixErlaubt: boolean): number {
  let exakt = 0;
  let praefix = 0;
  // Fünf Zeichen gemeinsamer Wortanfang, in JEDER Schrift. Die Grenze für
  // nicht-lateinische Schriften auf vier zu senken wurde 2026-07-28 gemessen
  // und VERWORFEN: sie hätte zwar die Urdu-Flexion عورتوں/عورت überbrückt,
  // kostete dafür aber zwei der 560 Eval-Fragen ihre einzige passende Passage.
  // Flexion gehört in den Stemmer (siehe SUFFIXE) — der wirkt auf Frage und
  // Korpus gleich und kann keine Asymmetrie erzeugen.
  for (const x of tok) {
    if (x === w) exakt++;
    else if (praefixErlaubt && w.length > 4 && x.length > 4 && x.startsWith(w.slice(0, 5))) praefix++;
  }
  return exakt + praefix * 0.6;
}

/** [Rangwert (mit Typ-/Titel-Bonus), Doc-Index, reiner Wortübereinstimmungs-Score] */
function rohScores(index: Index, frage: string): [number, number, number][] {
  const q = tokens(frage);
  if (q.length === 0) return [];
  const qSet = new Set(q);
  const expansion = new Set<string>();
  for (const w of q) for (const syn of SYNONYME.get(w) ?? []) if (!qSet.has(syn)) expansion.add(syn);
  const terme: [string, number][] = [...q.map((w): [string, number] => [w, 1]), ...[...expansion].map((w): [string, number] => [w, 0.5])];
  const bigramme: [string, string][] = [];
  for (let i = 0; i + 1 < q.length; i++) if (q[i] !== q[i + 1]) bigramme.push([q[i]!, q[i + 1]!]);

  const { docs, df, avg } = index;
  const N = docs.length;
  // k1 = 0.9 statt 1.4: flachere Term-Frequenz-Sättigung. Bei kurzen Fragen
  // („Wer ist Allah") gewann sonst der Text, der das Wort am häufigsten
  // nennt (13× „Allah" in den Alltagsformeln) statt der, der die Frage
  // beantwortet — gemessen am echten Korpus 2026-07-27.
  // public/rag/suche.js führte lange 1.4 und suchte dadurch anders als die App.
  // Beide Werte nachgemessen (alle 560 mehrsprachigen Eval-Fragen, KERN = 2.0):
  //   k1 = 0.9 → 560/560, MRR 0,9351, Platz 1 in 501 Fällen
  //   k1 = 1.4 → 560/560, MRR 0,9320, Platz 1 in 499 Fällen
  // 0.9 gewinnt in beiden KERN-Einstellungen; der Wert bleibt und gilt jetzt in
  // BEIDEN Dateien.
  const k1 = 0.9;
  // b = 0.3 statt 0.6: schwächere Dokumentlängen-Normalisierung. Der Typ-Bonus
  // (typGewicht) drückt bereits aus, dass die längeren ERKLÄRENDEN Dokumente
  // (w-/g-/k-) eine Frage beantworten und ein kurzer Vers/eine kurze Dua sie nur
  // belegt. Ein starkes b bestrafte genau diese Dokumente ein zweites Mal, nur
  // weil sie länger sind. Gemessen 2026-07-28 über alle 560 mehrsprachigen
  // Eval-Fragen (jeweils mit dem IDF-Deckel unten):
  //   b = 0.6  → 560/560 Treffer, Platz 1 in 501, MRR 0,9363
  //   b = 0.4  → 560/560 Treffer, Platz 1 in 505, MRR 0,9413
  //   b = 0.35 → 560/560 Treffer, Platz 1 in 507, MRR 0,9430
  //   b = 0.3  → 560/560 Treffer, Platz 1 in 510, MRR 0,9456   ← gewählt
  //   b = 0.25 → 559/560 Treffer, Platz 1 in 510, MRR 0,9455
  //   b = 0.15 → 558/560 Treffer, Platz 1 in 515, MRR 0,9493
  // Unterhalb von 0.3 fällt die Trefferquote (sw/ps „Wie werde ich geduldiger"
  // verlieren ihre einzige passende Passage). 0.3 ist damit der beste Rang bei
  // unveränderter Trefferquote. MUSS identisch in public/rag/suche.js sein.
  const b = 0.3;
  // Deckel für die IDF automatisch ergänzter Synonyme (Gewicht 0.5): Ein
  // Synonym darf nie SCHWERER wiegen als das Wort, das der Nutzer wirklich
  // getippt hat. Ohne den Deckel entschied bei kurzen Fragen die Seltenheit
  // einer Umschrift über das Ergebnis statt der Inhalt:
  //   „Wer ist Allah" → einziges Frage-Token „allah" (df 2264 von 7085, IDF
  //   1,14). Über die Umschrift-Gruppe kam „ala" (aus span. „Alá") dazu — im
  //   deutschen Korpus mit df 12 (IDF 6,3), weil dort nur die transliterierte
  //   ARABISCHE Präposition ʿalā in den Duas so geschrieben wird („tawakkaltu
  //   'ala Allah"). Selbst mit Gewicht 0.5 schlug dieser falsche Freund das
  //   eigentliche Frage-Wort um Faktor 1,8 und schob die Reise-Dua auf Platz 1;
  //   „Salati-Wissen: Wer ist Allah" rutschte auf Platz 5 (de) bzw. 6 (en).
  // Der Deckel behebt genau das, ohne eine einzige Umschrift-Brücke zu
  // entfernen: „ala" bleibt für spanische Fragen als Brücke erhalten, kann die
  // Bewertung aber nicht mehr dominieren. Gemessen (b = 0.3):
  //   ohne Deckel → 560/560, Platz 1 in 508, „Wer ist Allah" de Platz 6, en 6
  //   mit  Deckel → 560/560, Platz 1 in 510, „Wer ist Allah" de Platz 1, en 1
  // MUSS identisch in public/rag/suche.js sein.
  const idfVon = (w: string): number => {
    const dfw = df.get(w) ?? 1;
    return Math.log(1 + (N - dfw + 0.5) / (dfw + 0.5));
  };
  const idfDeckel = Math.max(...q.map(idfVon));
  const scored: [number, number, number][] = [];
  for (let di = 0; di < docs.length; di++) {
    const d = docs[di]!;
    let s = 0;
    for (const [w, gewicht] of terme) {
      // Präfix-Suche nur für die echten Frageworte (Gewicht 1), nicht für
      // automatisch ergänzte Synonyme — sonst multipliziert sich die Unschärfe.
      const tf = trefferZahl(d.tok, w, gewicht >= 1);
      if (!tf) continue;
      const idf = gewicht >= 1 ? idfVon(w) : Math.min(idfVon(w), idfDeckel);
      s += (gewicht * idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * d.tok.length) / avg));
    }
    if (s <= 0) continue;
    if (bigramme.length) {
      let boost = false;
      for (const [a, z] of bigramme) {
        for (let i = 0; i + 1 < d.tok.length; i++) {
          if (d.tok[i] === a && d.tok[i + 1] === z) {
            boost = true;
            break;
          }
        }
        if (boost) break;
      }
      if (boost) s *= 1.3;
    }
    const roh = s;
    // Titel-Bonus. Zwei Anteile, weil beide Richtungen zählen:
    //  · wie viel der FRAGE im Titel steht (Thema getroffen)
    //  · wie viel des TITELS von der Frage abgedeckt ist (Titel handelt genau davon)
    // "Wer ist Allah" trifft damit den Eintrag "Salati-Wissen: Wer ist Allah"
    // (beides voll) und nicht "In scha Allah, ma scha Allah, alhamdulillah …"
    // (Frage abgedeckt, Titel aber nur zu einem Fünftel) — genau diese
    // Verwechslung trat auf, als der Korpus auf 7.000 Dokumente wuchs.
    if (d.titelTok.length) {
      // Der Titel-Bonus vergleicht mit DERSELBEN Wortgleichheit wie der Rumpf:
      // exakt, per Wortanfang oder über ein Synonym. Vorher galt hier nur
      // Zeichengleichheit — in den 13 übersetzten Korpora feuerte der Bonus
      // dadurch oft gar nicht, weil Frage und übersetzter Titel dasselbe Wort
      // in verschiedener Form tragen. Gemessen 2026-07-28: „¿Quién es Alá?"
      // traf den Eintrag „Quién es Allah" nicht (ala ≠ allah) und verlor gegen
      // eine Dua, die „Allah" oft im Text nennt; ebenso „İslam'da alkol helal
      // midir?" gegen den Gelatine-Eintrag.
      const trifftTitel = (w: string): boolean =>
        trefferZahl(d.titelTok, w, true) > 0 || [...(SYNONYME.get(w) ?? [])].some((s) => trefferZahl(d.titelTok, s, false) > 0);
      let imTitel = 0;
      for (const w of qSet) if (trifftTitel(w)) imTitel++;
      // Der zweite Anteil (wie viel des TITELS die Frage abdeckt) bleibt bewusst
      // bei Zeichengleichheit. Mit der weichen Wortgleichheit gemessen stieg er
      // für zu viele Dokumente gleichzeitig und verlor damit seine
      // Unterscheidungskraft: drei der 560 Eval-Fragen verloren ihre einzige
      // passende Passage ganz (ar „ما هو الأذان", ar „كيف يسلم المسلمون",
      // sw „Nawezaje kuwa mvumilivu zaidi").
      const kern = d.titelTok.filter((w) => !TITEL_FUELLWORT.has(w));
      const abgedeckt = kern.length ? kern.filter((w) => qSet.has(w)).length / kern.length : 0;
      s *= 1 + TITEL_FRAGE_GEWICHT * (imTitel / qSet.size) + TITEL_KERN_GEWICHT * abgedeckt;
    }
    scored.push([s * typGewicht(d.id), di, roh]);
  }
  return scored;
}

// Höchstens so viele Passagen aus derselben Quelle (z. B. demselben Guide, der
// in mehrere Stücke zerfällt). Sonst füllen 4 Bruchstücke EINES Textes das
// gesamte Kontextfenster und dem Modell fehlt der Beleg-Vers dazu.
const MAX_JE_QUELLE = 1;

// Passagen unterhalb dieses Anteils am besten Score fliegen raus. Grund: das
// Modell bekommt sonst thematisch fremde „Auffüll"-Passagen mitgeliefert und
// mischt sie in die Antwort — bei „Wie mache ich Wudu?" landete so der
// Ghusl-Guide auf Platz 4 und das Modell schrieb Ghusl-Schritte in die
// Wudu-Anleitung (lokal mit dem echten Modell reproduziert, 2026-07-27).
//
// 0.25 und nicht 0.35 (der Wert, den public/rag/suche.js führte): gemessen über
// alle 560 mehrsprachigen Eval-Fragen liefert 0.35 nur 558/560 — die schärfere
// Schwelle wirft in zwei Sprachen die einzige passende Passage mit weg. 0.25
// gilt jetzt in BEIDEN Dateien.
const MIN_ANTEIL = 0.25;

export function suche(index: Index, frage: string, n = 6): KorpusDoc[] {
  const scored = rohScores(index, frage);
  scored.sort((a, z) => z[0] - a[0]);
  // Die Schwelle greift auf dem REINEN Wortübereinstimmungs-Score, nicht auf dem
  // gewichteten Rangwert: sonst würde ein starker Typ-/Titel-Bonus eines anderen
  // Dokuments einen thematisch passenden Beleg-Vers mit hinauswerfen.
  const besterRoh = scored.reduce((m, [, , roh]) => Math.max(m, roh), 0);
  // Erst die zu schwachen Passagen ganz verwerfen, dann aus dem Rest auswählen —
  // sonst schleichen sie sich über die Quellen-Deckelung wieder herein.
  // Die ersten beiden Plätze bleiben immer erhalten (eine erklärende Passage +
  // mindestens ein Beleg); erst ab Platz 3 wird gefiltert.
  const stark = scored.filter(([, , roh], i) => i < 2 || roh >= besterRoh * MIN_ANTEIL);
  const jeQuelle = new Map<string, number>();
  const treffer: KorpusDoc[] = [];
  const zurueckgestellt: KorpusDoc[] = [];
  for (const [, di] of stark) {
    if (treffer.length >= n) break;
    const d = index.docs[di]!;
    const anzahl = jeQuelle.get(d.src) ?? 0;
    if (anzahl >= MAX_JE_QUELLE) {
      if (zurueckgestellt.length < n) zurueckgestellt.push(d);
      continue;
    }
    jeQuelle.set(d.src, anzahl + 1);
    treffer.push(d);
  }
  // Lieber eine dritte Passage derselben (starken) Quelle als gar nichts, falls
  // der Korpus zu einer Frage insgesamt wenig hergibt.
  for (const d of zurueckgestellt) {
    if (treffer.length >= n) break;
    treffer.push(d);
  }
  return treffer;
}

// ---------- Stufe 2: Embedding-Re-Ranking (ungenutzt nativ, s. Kopfkommentar) ----------
export function kosinus(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

export function int8ZuFloat(int8arr: Int8Array): Float32Array {
  const out = new Float32Array(int8arr.length);
  for (let i = 0; i < int8arr.length; i++) out[i] = int8arr[i]! / 127;
  return out;
}

export interface Embeddings {
  vektoren: Float32Array;
  dim: number;
  queryVektor: Float32Array;
}

export function sucheHybrid(index: Index, frage: string, embeddings: Embeddings | null, n = 6, gewichtEmbedding = 0.35): KorpusDoc[] {
  if (!embeddings || embeddings.vektoren.length !== index.docs.length * embeddings.dim) {
    return suche(index, frage, n);
  }
  const keyword = rohScores(index, frage);
  if (keyword.length === 0 && !embeddings.queryVektor) return [];

  const { vektoren, dim, queryVektor } = embeddings;
  const maxKw = keyword.reduce((m, [s]) => Math.max(m, s), 0) || 1;
  const kombiniert = new Map<number, number>();
  for (const [s, di] of keyword) kombiniert.set(di, (s / maxKw) * (1 - gewichtEmbedding));

  let maxCos = 1e-9;
  const cos = new Array<number>(index.docs.length);
  for (let di = 0; di < index.docs.length; di++) {
    const off = di * dim;
    let dot = 0;
    for (let k = 0; k < dim; k++) dot += vektoren[off + k]! * queryVektor[k]!;
    cos[di] = dot;
    if (dot > maxCos) maxCos = dot;
  }
  for (let di = 0; di < cos.length; di++) {
    const normd = Math.max(0, cos[di]! / maxCos);
    if (normd <= 0) continue;
    kombiniert.set(di, (kombiniert.get(di) ?? 0) + normd * gewichtEmbedding);
  }

  return [...kombiniert.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, z) => z[1] - a[1])
    .slice(0, n)
    .map(([di]) => index.docs[di]!);
}
