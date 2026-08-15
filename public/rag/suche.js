// Salati KI — lokales Retrieval (BM25-lite + deutscher Light-Stemmer + Synonym-Expansion + Bigramm-Boost)
// ES-Modul, läuft im Browser (ki.html) und in Node (Tests).

export const STOP = new Set(('der die das und oder ist sind war waren ein eine einen dem den des im in an auf mit für von zu über was wie wer wo aber auch nicht man es er sie ich du wir ihr euch uns sich hat haben wird werden bei aus nach vor doch denn dass wenn als so um am zum zur ' +
  // Frage-Füllwörter, die in Chat-Fragen dominieren, aber keine Inhalte tragen:
  'gegen ohne sein seine seiner seinem kann soll sollte darf muss gibt sagt steht hilft helfen macht tun etwas jemand alles diese dieser dieses damit dazu dabei dann noch nur schon sehr mehr viel viele immer welche welcher welches warum wieso weshalb wann islam koran ' +
  // Füllwörter der 13 weiteren App-Sprachen — SYNC mit src/features/ki/retrieval.ts (STOP).
  'the and what how why who when where does can should must with from that this ' +
  'nedir nasil ne bir icin ile mi mu bu su olan ' +
  'que qui quoi comment pourquoi est les des une dans pour avec sur ' +
  'como por para los las una con del que sobre ' +
  'apa bagaimana mengapa yang untuk dari dengan pada itu ini adalah ' +
  'apakah bagaimanakah mengapakah ialah kepada daripada ' +
  'nini vipi kwa nini ndio hii hiyo katika kwa ya wa ni ' +
  'что как почему кто где когда это для при над под есть ли ' +
  'ما هو هي هل من في عن مع لا ان الى على كيف لماذا متى اين ماذا ' +
  // Relativ-/Demonstrativpronomen (ar) und Kopula/Verbteile (fa). Persisch
  // schreibt Verbformen mit ZWNJ ('می‌گوید'); die Normalisierung trennt dort,
  // die Fragmente 'می'/'گوید' stehen in fast jedem Dokument. SYNC mit retrieval.ts.
  'الذي التي الذين هذا هذه ذلك ' +
  'که را به در از این آن با برای چیست چگونه چرا کجا کدام آیا است هست می شود کند کنم گوید دارد بود باید ' +
  'کیا ہے ہیں کا کی کو سے میں پر اور یا کیوں کیسے کہاں ' +
  'څه دی ده په له ته دا هغه چې څنګه ولې چیرته ' +
  'কি কী কেন কীভাবে কোথায় এই সেই এবং বা তার হয় করে জন্য').split(/\s+/));

// Arabischer Unicode-Block (Basis + Supplement + Presentation Forms A/B) wird
// NICHT mehr weggefiltert (vorher landete jedes arabische Schriftzeichen im
// "alles außer a-z0-9äöüß"-Ausschluss und wurde durch Leerzeichen ersetzt ->
// eine rein arabisch geschriebene Frage ergab 0 Tokens -> suche() gab sofort
// [] zurück, unabhängig vom Inhalt). Arabische Wörter werden dadurch als
// eigene Tokens erhalten (der Stemmer unten greift nicht, da seine Suffixe
// lateinische Zeichenketten sind - arabische Wörter bleiben unverändert).
const ARABISCH_BEREICH = '\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFC';
// Deutsche Umlaute/ß explizit falten (ä→ae …) VOR NFD — macht "Säulen"==="Saeulen"
// und entkoppelt die Umlaut-Behandlung von NFD+Kombinationszeichen-Range. MUSS
// identisch zu src/features/ki/retrieval.ts (norm) sein.
// Beibehalten wird jeder BUCHSTABE, jede ZIFFER und jedes KOMBINIERENDE ZEICHEN
// irgendeiner Schrift (\p{L}\p{N}\p{M}) — nicht mehr nur a-z0-9 + Arabisch.
// Grund (2026-07-27, beim Bau der sprachspezifischen Korpora gemessen):
// "Что такое молитва" ergab mit der alten a-z0-9-Klasse NULL Tokens; \p{M} ist
// Pflicht, weil die bengalischen Vokalzeichen Mc/Mn sind und "ইশার নামাজ কি"
// sonst zu "ইশ র ন ম জ ক" zerfällt. Für Arabisch bleibt alles wie vorher.
// MUSS identisch zu src/features/ki/retrieval.ts (norm) sein.
export const norm = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\p{M} ]/gu, ' ');

// Einfache Unicode-Range-Heuristik (kein NLP nötig): Anteil arabischer
// Buchstaben an allen Buchstaben in der Roheingabe. Wird für den
// Arabisch-Modus in ki.html verwendet (RTL-Darstellung, Hinweistext) - die
// Retrieval-Gewichtung selbst braucht keinen Sonderfall, weil arabische
// Suchbegriffe über SYNONYME (s. u.) automatisch auf die passenden
// deutschen/transliterierten Korpus-Begriffe gemappt werden.
const ARABISCH_BUCHSTABE = new RegExp(`[${ARABISCH_BEREICH}]`);
const BUCHSTABE = /\p{L}/u;
export function istArabisch(text) {
  const buchstaben = [...(text ?? '')].filter((c) => BUCHSTABE.test(c));
  if (buchstaben.length === 0) return false;
  const arabisch = buchstaben.filter((c) => ARABISCH_BUCHSTABE.test(c));
  return arabisch.length / buchstaben.length > 0.5;
}

// Deutscher Light-Stemmer: Suffixe abschneiden (längste zuerst), nur wenn Reststamm >= 4 Zeichen.
// Iterativ, damit z. B. "morgens" -> "morgen" -> "morg" denselben Stamm ergibt wie "morgen" -> "morg".
// Dazu die haeufigsten Plural-/Obliquus-Endungen der perso-arabischen Schriften:
// 'عورتوں' (Urdu, obliquer Plural) und 'عورت' galten sonst als verschiedene
// Tokens. Der Stemmer wirkt auf Frage UND Korpus gleich, kann also keine
// Asymmetrie erzeugen. SYNC mit src/features/ki/retrieval.ts.
const SUFFIXE = ['heiten', 'keiten', 'ungen', 'igen', 'lich', 'isch', 'heit', 'keit', 'ung', 'ige', 'ern', 'ig', 'en', 'er', 'es', 'em', 'e', 'n', 's',
  'هایی', 'های', 'وں', 'یں', 'ها'];
export function stemme(w) {
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

// Mindestlaenge: die ">2 Zeichen"-Regel ist eine deutsche Heuristik gegen
// Fuellwoerter und wirft auf arabischer/persischer/Urdu-/Paschtu-Schrift echte
// Sachwoerter weg — حج (Hadsch) hat genau zwei Zeichen. Identisch zu
// features/ki/retrieval.ts (mindestlaenge), damit Web und App gleich suchen.
const LATEINISCH = /^[\p{Script=Latin}\p{N}]+$/u;
const mindestlaenge = (w) => (LATEINISCH.test(w) ? w.length > 2 : w.length >= 2);
export const tokens = (s) => norm(s).split(/\s+/).filter((w) => mindestlaenge(w) && !STOP.has(w)).map(stemme);

// Kuratierte Synonym-/Begriffsgruppen (islamisches Vokabular). Jede Gruppe wirkt in beide Richtungen.
// Der Korpus (korpus-de.json) enthält KEINEN arabischen Text (geprüft: 0 von
// 6.643 Docs), daher kann die Retrieval-Gewichtung keine "arabischen
// Quellen" bevorzugen - es gibt keine. Was stattdessen sinnvoll ist und hier
// passiert: arabisch-schriftliche Begriffe werden als Brücken-Synonyme in
// die bestehenden Gruppen aufgenommen, damit z. B. eine Frage mit "صبر"
// über die Synonym-Expansion trotzdem die deutschen "Geduld"-Quellen findet.
// SYNC mit src/features/ki/retrieval.ts (SYNONYM_GRUPPEN) — bildet moderne/
// umgangssprachliche Fragewörter auf die KLASSISCHE Übersetzungs-Terminologie
// im Korpus ab (z. B. "alkohol"=0 Treffer, aber "wein"=20; "teufel"=3/"satan"=78).
const SYNONYM_GRUPPEN = [
  ['geduld', 'sabr', 'standhaft', 'ausharren', 'erdulden', 'geduldig', 'صبر', 'الصبر'],
  ['gebet', 'salat', 'beten', 'anbetung', 'gottesdienst', 'صلاة', 'الصلاة'],
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
  ['sabr', 'geduld'],

  // ---------- sprachübliche Umschriften der 14 App-Sprachen ----------
  // Nutzer tippen islamische Fachbegriffe in der Umschrift IHRER Sprache
  // ("alquibla", "taywid", "chahada"), der Korpus führt aber die Schreibweise
  // seiner Sprache. Ohne Brücke fand die Suche dazu NICHTS (gemessen
  // 2026-07-27). SYNC mit src/features/ki/retrieval.ts (SYNONYM_GRUPPEN).
  ['qibla', 'kibla', 'quibla', 'alquibla', 'kiblat', 'кибла', 'قبلة', 'قبله', 'قبلہ', 'কিবলা'],
  ['tajwid', 'tadschwied', 'tajweed', 'tecvit', 'tecvid', 'tayuid', 'taywid', 'tajwidi', 'таджвид', 'تجويد', 'تجوید', 'তাজবিদ', 'তাজবীদ'],
  ['schahada', 'shahada', 'chahada', 'sehadet', 'syahadat', 'syahadah', 'шахада', 'شهادة', 'شهادت', 'شہادت', 'শাহাদাহ'],
  ['muslim', 'muislamu', 'mwislamu', 'uislamu', 'musulman', 'musulmán', 'müslüman', 'мусульманин', 'مسلمان', 'مسلم', 'মুসলিম'],
  ['allah', 'alá', 'aláh', 'аллах', 'الله', 'اللہ', 'আল্লাহ', 'dios', 'dieu', 'tanrı', 'бог', 'خدا'],
  // Geduld/Zorn/Fasten: hier scheitert es NICHT an der Umschrift, sondern an
  // der Flexion der Fragesprache (صبرا/صابر/صبورتر gegen den Korpus-Stamm صبر).
  ['sabr', 'صبر', 'الصبر', 'صبرا', 'صابر', 'صبور', 'صبورتر', 'صبرناک', 'sabır', 'sabar', 'subira', 'kesabaran', 'терпение', 'сабр', 'ধৈর্য', 'সবর', 'paciencia'],
  ['zorn', 'غضب', 'غضبي', 'الغضب', 'خشم', 'خشمم', 'غصه', 'غصہ', 'غوسه', 'قهر', 'hasira', 'amarah', 'öfke', 'colère', 'гнев', 'রাগ', 'ক্রোধ'],
  ['fasten', 'صيام', 'الصيام', 'الصائم', 'صوم', 'روزه', 'রোজা', 'oruç', 'puasa', 'ayuno', 'jeûne', 'пост', 'saumu', 'funga', 'swaumu'],
  // 'Was BRICHT das Fasten' ist eine eigene Frage. Solange يفطر/مفطرات in der
  // Fasten-Gruppe standen, war 'bricht das Fasten' ein Synonym von 'fasten' —
  // und genau die Unterscheidung ging verloren. SYNC mit retrieval.ts.
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
  // schneidet nur Endungen ab, deshalb stehen die Frageformen hier ausdruecklich.
  ['wudu', 'wuduk', 'abdest', 'udhu', 'вуду', 'وضو', 'وضوء', 'অজু', 'উযু', 'ওজু', 'ninatawadhaje', 'kutawadha', 'natawadha', 'tawadha'],
  ['ghusl', 'gusl', 'ghousl', 'gusül', 'гусль', 'غسل', 'গোসল', 'josho', 'junub', 'janaba', 'جنابت'],
  ['tayammum', 'tayamum', 'teyemmüm', 'таяммум', 'تيمم', 'تیمم', 'তায়াম্মুম'],
  // Gebetszeiten und einzelne Gebete
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
export const SYNONYME = new Map();
for (const gruppe of SYNONYM_GRUPPEN) {
  const stems = [...new Set(gruppe.map((w) => stemme(norm(w).trim())))];
  for (const s of stems) {
    if (!SYNONYME.has(s)) SYNONYME.set(s, new Set());
    for (const other of stems) if (other !== s) SYNONYME.get(s).add(other);
  }
}

// Index über Dokumente {id, src, t, k?} aufbauen. src UND das optionale
// Keyword-Feld k werden mitindexiert (k ist unsichtbar für Nutzer/Modell und
// enthält Schreibvarianten wie "isha" für "Ischa"), damit z. B. "Dua",
// "Nawawi" oder Suren-Namen als Suchbegriffe funktionieren.
export function baueIndex(docs) {
  const D = docs.map((d) => ({
    ...d,
    tok: tokens((d.src ?? '') + ' ' + (d.k ?? '') + ' ' + d.t),
    // Tokens nur aus Quellenangabe + Keywords — für den Titel-Bonus in rohScores.
    titelTok: tokens((d.src ?? '') + ' ' + (d.k ?? '')),
  }));
  const df = new Map();
  for (const d of D) for (const w of new Set(d.tok)) df.set(w, (df.get(w) ?? 0) + 1);
  const avg = D.reduce((a, d) => a + d.tok.length, 0) / (D.length || 1);
  return { docs: D, df, avg };
}

// Gattungswörter aus den Quellenangaben ("Salati-Wissen: …", "an-Nawawī Nr. 5"):
// sagen nichts über das Thema und würden den Titel-Bonus verwässern. Enthält
// dieselben Etiketten in allen 14 App-Sprachen wie src/features/ki/retrieval.ts
// (die sprachspezifischen Korpora führen ihre Quellenangaben übersetzt).
const TITEL_FUELLWORT = new Set(
  ('salati wissen kurs praxis nawawi dua sure ' +
    'quran course guide knowledge ' +
    "kur an dersi rehberi bilgi " +
    'القرآن درس سلاتي دليل معرفة ' +
    'coran corán curso guia guía saber ' +
    'cours savoir ' +
    'коран курс практика знание ' +
    'kursus panduan pengetahuan ' +
    'কুরআন সালাতি কোর্স নির্দেশিকা জ্ঞান ' +
    'قرآن سلاتی کورس رہنما معلومات ' +
    'دوره سلاتی دانش راهنمای ' +
    'سلاتي لارښود پوهه ' +
    'kozi mwongozo maarifa')
    .split(' ')
    .filter(Boolean)
    .map((w) => stemme(norm(w).trim())),
);

// Gewichte identisch zu src/features/ki/retrieval.ts — der Kern-Anteil (Themen-
// Genauigkeit des Titels) wiegt schwerer als die blosse Wortüberlappung.
// KERN = 2.0 (nicht 3.0): beide Werte am 2026-07-27 über alle 560
// mehrsprachigen Eval-Fragen gemessen — gleiche Trefferquote, aber 2.0 setzt die
// richtige Passage öfter auf Platz 1 (501 statt 500) bzw. 1–2 (530 statt 526)
// und hat den besseren MRR (0,9351 statt 0,9328). Begründung ausführlich in
// src/features/ki/retrieval.ts; beide Dateien MÜSSEN denselben Wert führen.
const TITEL_FRAGE_GEWICHT = 0.5;
const TITEL_KERN_GEWICHT = 2.0;

// Dokumenttyp-Gewichte über das ID-Präfix — identisch zu
// src/features/ki/retrieval.ts (typGewicht). Erklärende Dokumente schlagen
// einzelne Verse, weil ein Vers eine Frage belegt, aber selten beantwortet.
export function typGewicht(id) {
  if (id.startsWith('w-')) return 1.9; // kuratiertes Grundwissen
  if (id.startsWith('g-')) return 1.8; // Praxis-Guides
  if (id.startsWith('k-')) return 1.35; // Kurstexte
  if (id.startsWith('h-')) return 1.15; // Hadithe
  if (id.startsWith('d:')) return 0.95; // Duas — SYNC mit retrieval.ts (typGewicht), Begruendung dort
  return 1; // Koran-Verse
}

// Exakte Treffer zählen voll, Präfix-Treffer (nur für die echten Frageworte)
// zu 60 % — sonst gewinnen falsche Nachbarn wie "Schadda"/"Schaden".
function trefferZahl(tok, w, praefixErlaubt) {
  let exakt = 0, praefix = 0;
  for (const x of tok) {
    if (x === w) exakt++;
    else if (praefixErlaubt && w.length > 4 && x.length > 4 && x.startsWith(w.slice(0, 5))) praefix++;
  }
  return exakt + praefix * 0.6;
}

// BM25-lite-Rohbewertung mit Synonym-Expansion (Gewicht 0,5) und
// Bigramm-Boost (+30 %). Gibt ein Array [score, docIndex] zurück (nur Docs
// mit score > 0), docIndex = Position in index.docs - wird von suche() UND
// von sucheHybrid() (Embedding-Kombination, s. u.) verwendet, damit beide
// exakt dieselbe Keyword-Bewertung nutzen.
function rohScores(index, frage) {
  const q = tokens(frage);
  if (q.length === 0) return [];
  const qSet = new Set(q);
  // Expansions-Terme: Synonyme der Query-Tokens, Gewicht 0,5.
  const expansion = new Set();
  for (const w of q) for (const syn of SYNONYME.get(w) ?? []) if (!qSet.has(syn)) expansion.add(syn);
  const terme = [...q.map((w) => [w, 1]), ...[...expansion].map((w) => [w, 0.5])];
  // Query-Bigramme (direkt aufeinanderfolgende Tokens).
  const bigramme = [];
  for (let i = 0; i + 1 < q.length; i++) if (q[i] !== q[i + 1]) bigramme.push([q[i], q[i + 1]]);

  const { docs, df, avg } = index;
  // k1 = 0.9 (nicht 1.4): flachere Term-Frequenz-Sättigung — identisch zu
  // src/features/ki/retrieval.ts, sonst gewinnt bei kurzen Fragen der Text mit
  // der höchsten Worthäufigkeit statt der Text, der die Frage beantwortet.
  // b = 0.3 (nicht 0.6): schwächere Dokumentlängen-Normalisierung — identisch zu
  // src/features/ki/retrieval.ts. Der Typ-Bonus drückt schon aus, dass die
  // längeren erklärenden Dokumente die Frage beantworten; ein starkes b bestrafte
  // sie ein zweites Mal. Gemessen 2026-07-28 über alle 560 mehrsprachigen
  // Eval-Fragen: b = 0.6 → Platz 1 in 501, b = 0.3 → Platz 1 in 510 (jeweils
  // 560/560 Treffer); unter 0.3 fällt die Trefferquote. Begründung ausführlich in
  // retrieval.ts.
  const N = docs.length, k1 = 0.9, b = 0.3;
  // IDF-Deckel für automatisch ergänzte Synonyme (Gewicht 0,5): Ein Synonym darf
  // nie schwerer wiegen als das vom Nutzer getippte Wort. Ohne den Deckel gewann
  // bei „Wer ist Allah" (einziges Frage-Token „allah", df 2264) die über die
  // Umschrift-Gruppe ergänzte Form „ala" (df 12) — im deutschen Korpus ist das
  // die transliterierte arabische Präposition ʿalā aus den Duas, ein falscher
  // Freund. Ergebnis war eine Reise-Dua als Hauptquelle statt der
  // Grundlagenerklärung (de Platz 5, en Platz 6 → mit Deckel beide Platz 1).
  // Identisch zu src/features/ki/retrieval.ts.
  const idfVon = (w) => { const dfw = df.get(w) ?? 1; return Math.log(1 + (N - dfw + 0.5) / (dfw + 0.5)); };
  const idfDeckel = Math.max(...q.map(idfVon));
  // Eintrag: [Rangwert (mit Typ-/Titel-Bonus), Doc-Index, reiner Wort-Score]
  const scored = [];
  for (let di = 0; di < docs.length; di++) {
    const d = docs[di];
    let s = 0;
    for (const [w, gewicht] of terme) {
      // Synonym-Expansions-Terme nur exakt matchen (kein Präfix-Fuzzing auf Synonyme).
      const tf = trefferZahl(d.tok, w, gewicht >= 1);
      if (!tf) continue;
      const idf = gewicht >= 1 ? idfVon(w) : Math.min(idfVon(w), idfDeckel);
      s += gewicht * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.tok.length / avg));
    }
    if (s <= 0) continue;
    // Bigramm-Boost: zwei Query-Tokens direkt hintereinander im Dokument -> +30 %.
    if (bigramme.length) {
      let boost = false;
      for (const [a, z] of bigramme) {
        for (let i = 0; i + 1 < d.tok.length; i++) {
          if (d.tok[i] === a && d.tok[i + 1] === z) { boost = true; break; }
        }
        if (boost) break;
      }
      if (boost) s *= 1.3;
    }
    const roh = s;
    // Titel-Bonus, beide Richtungen (identisch zu retrieval.ts): wie viel der
    // FRAGE im Titel steht und wie viel des TITELS die Frage abdeckt. So gewinnt
    // "Salati-Wissen: Wer ist Allah" gegen "In scha Allah, ma scha Allah, …".
    if (d.titelTok.length) {
      // Der erste Anteil vergleicht mit DERSELBEN Wortgleichheit wie der Rumpf:
      // exakt, per Wortanfang oder ueber ein Synonym. Vorher galt hier nur
      // Zeichengleichheit — in den 13 uebersetzten Korpora feuerte der Bonus
      // dadurch oft gar nicht. Der ZWEITE Anteil (abgedeckt) bleibt bewusst
      // bei Zeichengleichheit. SYNC mit retrieval.ts.
      const trifftTitel = (w) =>
        trefferZahl(d.titelTok, w, true) > 0 || [...(SYNONYME.get(w) ?? [])].some((sy) => trefferZahl(d.titelTok, sy, false) > 0);
      let imTitel = 0;
      for (const w of qSet) if (trifftTitel(w)) imTitel++;
      const kern = d.titelTok.filter((w) => !TITEL_FUELLWORT.has(w));
      const abgedeckt = kern.length ? kern.filter((w) => qSet.has(w)).length / kern.length : 0;
      s *= 1 + TITEL_FRAGE_GEWICHT * (imTitel / qSet.size) + TITEL_KERN_GEWICHT * abgedeckt;
    }
    scored.push([s * typGewicht(d.id), di, roh]);
  }
  return scored;
}

// Höchstens 2 Passagen aus derselben Quelle, damit ein langer, gestückelter
// Text nicht das gesamte Kontextfenster des Modells belegt.
// 1 statt 2 (gemessen 2026-07-28): zwei Stuecke DESSELBEN Textes belegten die
// Plaetze, auf denen die Passage mit der Antwort gestanden haette. Ueber alle
// 560 Eval-Fragen unveraendert 560/560 Treffer bei besserem Rang.
const MAX_JE_QUELLE = 1;

// Passagen unter diesem Anteil am besten Score fliegen raus — sonst mischt das
// Modell thematisch fremde Auffüll-Passagen in die Antwort. 0.25 und nicht 0.35
// (der frühere Wert dieser Datei): 0.35 liefert im Eval nur 558/560 statt
// 560/560 — beide Dateien führen jetzt denselben, gemessen besseren Wert.
const MIN_ANTEIL = 0.25;

export function suche(index, frage, n = 6) {
  const scored = rohScores(index, frage);
  scored.sort((a, z) => z[0] - a[0]);
  // Schwelle auf dem REINEN Wort-Score (nicht auf dem gewichteten Rangwert), und
  // die ersten beiden Plätze bleiben immer erhalten — identisch zu retrieval.ts.
  const besterRoh = scored.reduce((m, [, , roh]) => Math.max(m, roh), 0);
  const stark = scored.filter(([, , roh], i) => i < 2 || roh >= besterRoh * MIN_ANTEIL);
  const jeQuelle = new Map();
  const treffer = [];
  const zurueckgestellt = [];
  for (const [, di] of stark) {
    if (treffer.length >= n) break;
    const d = index.docs[di];
    const anzahl = jeQuelle.get(d.src) ?? 0;
    if (anzahl >= MAX_JE_QUELLE) {
      if (zurueckgestellt.length < n) zurueckgestellt.push(d);
      continue;
    }
    jeQuelle.set(d.src, anzahl + 1);
    treffer.push(d);
  }
  for (const d of zurueckgestellt) {
    if (treffer.length >= n) break;
    treffer.push(d);
  }
  return treffer;
}

// ---------- Stufe 2: Embedding-Re-Ranking (siehe scripts/generate-ki-embeddings.mjs) ----------
// Cosine-Similarity zweier gleich langer, bereits unit-normalisierter Vektoren
// ist einfach das Skalarprodukt.
export function kosinus(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// int8-quantisierte Embeddings (Werte -127..127, s. embeddings-de.meta.json
// quant:'int8') zu Float32 dequantisieren. Embeddings wurden vor der
// Quantisierung bereits L2-normalisiert -> Werte lagen in [-1, 1] -> /127.
export function int8ZuFloat(int8arr) {
  const out = new Float32Array(int8arr.length);
  for (let i = 0; i < int8arr.length; i++) out[i] = int8arr[i] / 127;
  return out;
}

// Kombiniert das bestehende Keyword-/BM25-Retrieval mit vorberechneten
// Korpus-Embeddings + einem zur Laufzeit berechneten Query-Embedding
// (gewichtete Summe, ersetzt rohScores() NICHT). embeddings = null ->
// Fallback auf reine Keyword-Suche (z. B. wenn transformers.js/Embeddings
// noch nicht geladen sind oder der Korpus seit der letzten
// Embedding-Generierung gewachsen ist).
// embeddings: { vektoren: Float32Array (docs.length * dim, dequantisiert),
//               dim: number, queryVektor: Float32Array (dim) }
export function sucheHybrid(index, frage, embeddings, n = 6, gewichtEmbedding = 0.35) {
  if (!embeddings || embeddings.vektoren.length !== index.docs.length * embeddings.dim) {
    return suche(index, frage, n);
  }
  const keyword = rohScores(index, frage);
  if (keyword.length === 0 && !embeddings.queryVektor) return [];

  const { vektoren, dim, queryVektor } = embeddings;
  const maxKw = keyword.reduce((m, [s]) => Math.max(m, s), 0) || 1;
  const kombiniert = new Map(); // docIndex -> Score
  for (const [s, di] of keyword) kombiniert.set(di, (s / maxKw) * (1 - gewichtEmbedding));

  // Cosine-Sim gegen den GESAMTEN Korpus (nicht nur Keyword-Kandidaten) -
  // genau das ist der Mehrwert von Stufe 2: rein semantische Treffer ohne
  // Wortüberlappung mit der Frage werden so trotzdem gefunden.
  let maxCos = 1e-9;
  const cos = new Array(index.docs.length);
  for (let di = 0; di < index.docs.length; di++) {
    const off = di * dim;
    let dot = 0;
    for (let k = 0; k < dim; k++) dot += vektoren[off + k] * queryVektor[k];
    cos[di] = dot;
    if (dot > maxCos) maxCos = dot;
  }
  for (let di = 0; di < cos.length; di++) {
    const norm = Math.max(0, cos[di] / maxCos);
    if (norm <= 0) continue;
    kombiniert.set(di, (kombiniert.get(di) ?? 0) + norm * gewichtEmbedding);
  }

  return [...kombiniert.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, z) => z[1] - a[1])
    .slice(0, n)
    .map(([di]) => index.docs[di]);
}
