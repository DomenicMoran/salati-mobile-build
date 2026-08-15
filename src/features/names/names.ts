// Die 99 Namen Allahs (al-Asma al-Husna) nach der verbreiteten
// Tirmidhi-Liste. Bedeutungen bewusst knapp (1 Zeile) in allen 14
// App-Sprachen. ar zeigt nur den Namen (keine eigene Bedeutung).
//
// Datenpflege: ROWS trägt arabisch/translit + de/en/tr (unverändert).
// EXTRA_ROWS ergänzt index-gleich die 10 weiteren Sprachen. Ein
// Ausrichtungs-Guard beim Aufbau (norm-Vergleich der Transliteration)
// wirft sofort, falls die beiden Tabellen aus dem Takt geraten.

export interface DivineName {
  n: number;
  arabic: string;
  translit: string;
  de: string;
  en: string;
  tr: string;
  es: string;
  fr: string;
  id: string;
  bn: string;
  fa: string;
  ms: string;
  ur: string;
  sw: string;
  ru: string;
  ps: string;
}

type Row = [string, string, string, string, string];

const ROWS: Row[] = [
  ['الرَّحْمَنُ', 'Ar-Rahman', 'Der Allerbarmer', 'The Most Merciful', 'Rahmeti sonsuz olan'],
  ['الرَّحِيمُ', 'Ar-Rahim', 'Der Barmherzige', 'The Bestower of Mercy', 'Merhameti sonsuz olan'],
  ['الْمَلِكُ', 'Al-Malik', 'Der König', 'The King', 'Mülkün sahibi'],
  ['الْقُدُّوسُ', 'Al-Quddus', 'Der Heilige', 'The Most Holy', 'Her eksiklikten uzak'],
  ['السَّلَامُ', 'As-Salam', 'Der Frieden', 'The Source of Peace', 'Esenlik veren'],
  ['الْمُؤْمِنُ', 'Al-Mu’min', 'Der Sicherheit Gebende', 'The Giver of Security', 'Güven veren'],
  ['الْمُهَيْمِنُ', 'Al-Muhaymin', 'Der Bewahrer', 'The Guardian', 'Gözetip koruyan'],
  ['الْعَزِيزُ', 'Al-Aziz', 'Der Allmächtige', 'The Almighty', 'Mutlak galip'],
  ['الْجَبَّارُ', 'Al-Jabbar', 'Der Bezwinger', 'The Compeller', 'Dilediğini yaptıran'],
  ['الْمُتَكَبِّرُ', 'Al-Mutakabbir', 'Der Erhabene', 'The Supreme', 'Büyüklükte eşsiz'],
  ['الْخَالِقُ', 'Al-Khaliq', 'Der Schöpfer', 'The Creator', 'Yaratan'],
  ['الْبَارِئُ', 'Al-Bari', 'Der Gestalter', 'The Originator', 'Örneksiz yaratan'],
  ['الْمُصَوِّرُ', 'Al-Musawwir', 'Der Formgeber', 'The Fashioner', 'Şekil veren'],
  ['الْغَفَّارُ', 'Al-Ghaffar', 'Der immer wieder Vergebende', 'The All-Forgiving', 'Çok bağışlayan'],
  ['الْقَهَّارُ', 'Al-Qahhar', 'Der Alles-Bezwingende', 'The Subduer', 'Her şeye galip gelen'],
  ['الْوَهَّابُ', 'Al-Wahhab', 'Der Freigebige', 'The Bestower', 'Karşılıksız veren'],
  ['الرَّزَّاقُ', 'Ar-Razzaq', 'Der Versorger', 'The Provider', 'Rızık veren'],
  ['الْفَتَّاحُ', 'Al-Fattah', 'Der Öffnende', 'The Opener', 'Kapıları açan'],
  ['الْعَلِيمُ', 'Al-Alim', 'Der Allwissende', 'The All-Knowing', 'Her şeyi bilen'],
  ['الْقَابِضُ', 'Al-Qabid', 'Der Zurückhaltende', 'The Withholder', 'Daraltan'],
  ['الْبَاسِطُ', 'Al-Basit', 'Der Gewährende', 'The Extender', 'Genişleten'],
  ['الْخَافِضُ', 'Al-Khafid', 'Der Erniedrigende', 'The Abaser', 'Alçaltan'],
  ['الرَّافِعُ', 'Ar-Rafi', 'Der Erhöhende', 'The Exalter', 'Yücelten'],
  ['الْمُعِزُّ', 'Al-Mu’izz', 'Der Ehre Verleihende', 'The Giver of Honor', 'Şeref veren'],
  ['الْمُذِلُّ', 'Al-Mudhill', 'Der Demütigende', 'The Humiliator', 'Zillete düşüren'],
  ['السَّمِيعُ', 'As-Sami', 'Der Allhörende', 'The All-Hearing', 'Her şeyi işiten'],
  ['الْبَصِيرُ', 'Al-Basir', 'Der Allsehende', 'The All-Seeing', 'Her şeyi gören'],
  ['الْحَكَمُ', 'Al-Hakam', 'Der Richter', 'The Judge', 'Hükmeden'],
  ['الْعَدْلُ', 'Al-Adl', 'Der Gerechte', 'The Just', 'Mutlak adil'],
  ['اللَّطِيفُ', 'Al-Latif', 'Der Feinfühlige', 'The Subtle One', 'Lütfu ince olan'],
  ['الْخَبِيرُ', 'Al-Khabir', 'Der Kundige', 'The All-Aware', 'Her şeyden haberdar'],
  ['الْحَلِيمُ', 'Al-Halim', 'Der Nachsichtige', 'The Forbearing', 'Cezada acele etmeyen'],
  ['الْعَظِيمُ', 'Al-Azim', 'Der Gewaltige', 'The Magnificent', 'Azamet sahibi'],
  ['الْغَفُورُ', 'Al-Ghafur', 'Der Vielvergebende', 'The Forgiving', 'Günahları örten'],
  ['الشَّكُورُ', 'Ash-Shakur', 'Der Dankbare', 'The Appreciative', 'Az amele çok veren'],
  ['الْعَلِيُّ', 'Al-Ali', 'Der Höchste', 'The Most High', 'En yüce'],
  ['الْكَبِيرُ', 'Al-Kabir', 'Der Große', 'The Most Great', 'En büyük'],
  ['الْحَفِيظُ', 'Al-Hafiz', 'Der Behütende', 'The Preserver', 'Koruyup gözeten'],
  ['الْمُقِيتُ', 'Al-Muqit', 'Der Erhalter', 'The Sustainer', 'Her canlının azığını veren'],
  ['الْحَسِيبُ', 'Al-Hasib', 'Der Abrechnende', 'The Reckoner', 'Hesaba çeken'],
  ['الْجَلِيلُ', 'Al-Jalil', 'Der Majestätische', 'The Majestic', 'Celal sahibi'],
  ['الْكَرِيمُ', 'Al-Karim', 'Der Großzügige', 'The Generous', 'Cömertliği sonsuz'],
  ['الرَّقِيبُ', 'Ar-Raqib', 'Der Wachende', 'The Watchful', 'Her an gözeten'],
  ['الْمُجِيبُ', 'Al-Mujib', 'Der Erhörende', 'The Responsive', 'Duaları kabul eden'],
  ['الْوَاسِعُ', 'Al-Wasi', 'Der Allumfassende', 'The All-Encompassing', 'İlmi ve rahmeti geniş'],
  ['الْحَكِيمُ', 'Al-Hakim', 'Der Allweise', 'The All-Wise', 'Hüküm ve hikmet sahibi'],
  ['الْوَدُودُ', 'Al-Wadud', 'Der Liebevolle', 'The Loving', 'Kullarını seven'],
  ['الْمَجِيدُ', 'Al-Majid', 'Der Ruhmreiche', 'The Glorious', 'Şanı yüce'],
  ['الْبَاعِثُ', 'Al-Ba’ith', 'Der Auferweckende', 'The Resurrector', 'Ölüleri dirilten'],
  ['الشَّهِيدُ', 'Ash-Shahid', 'Der Zeuge', 'The Witness', 'Her şeye şahit'],
  ['الْحَقُّ', 'Al-Haqq', 'Die Wahrheit', 'The Truth', 'Mutlak gerçek'],
  ['الْوَكِيلُ', 'Al-Wakil', 'Der Sachwalter', 'The Trustee', 'Kendisine güvenilen'],
  ['الْقَوِيُّ', 'Al-Qawiyy', 'Der Starke', 'The All-Strong', 'Kudreti sonsuz'],
  ['الْمَتِينُ', 'Al-Matin', 'Der Feste', 'The Firm', 'Sarsılmaz güç sahibi'],
  ['الْوَلِيُّ', 'Al-Waliyy', 'Der Beschützer', 'The Protecting Friend', 'Dost ve yardımcı'],
  ['الْحَمِيدُ', 'Al-Hamid', 'Der Lobenswerte', 'The Praiseworthy', 'Övgüye layık'],
  ['الْمُحْصِي', 'Al-Muhsi', 'Der Alles-Erfassende', 'The Accounter', 'Her şeyi tek tek bilen'],
  ['الْمُبْدِئُ', 'Al-Mubdi', 'Der Beginnende', 'The Originator', 'İlk kez yaratan'],
  ['الْمُعِيدُ', 'Al-Mu’id', 'Der Wiederholende', 'The Restorer', 'Yeniden dirilten'],
  ['الْمُحْيِي', 'Al-Muhyi', 'Der Lebensspender', 'The Giver of Life', 'Hayat veren'],
  ['الْمُمِيتُ', 'Al-Mumit', 'Der Tod Gebende', 'The Bringer of Death', 'Öldüren'],
  ['الْحَيُّ', 'Al-Hayy', 'Der Lebendige', 'The Ever-Living', 'Daima diri'],
  ['الْقَيُّومُ', 'Al-Qayyum', 'Der Beständige', 'The Self-Subsisting', 'Her şeyi ayakta tutan'],
  ['الْوَاجِدُ', 'Al-Wajid', 'Der Findende', 'The Perceiver', 'Dilediğini bulan'],
  ['الْمَاجِدُ', 'Al-Majid', 'Der Edle', 'The Illustrious', 'Şeref ve kerem sahibi'],
  ['الْوَاحِدُ', 'Al-Wahid', 'Der Eine', 'The One', 'Tek olan'],
  ['الْأَحَدُ', 'Al-Ahad', 'Der Einzige', 'The Unique', 'Bir olan'],
  ['الصَّمَدُ', 'As-Samad', 'Der Absolute', 'The Eternal Refuge', 'Her şey O’na muhtaç'],
  ['الْقَادِرُ', 'Al-Qadir', 'Der Mächtige', 'The Capable', 'Güç yetiren'],
  ['الْمُقْتَدِرُ', 'Al-Muqtadir', 'Der Allvermögende', 'The Omnipotent', 'Kudreti her şeye yeten'],
  ['الْمُقَدِّمُ', 'Al-Muqaddim', 'Der Vorziehende', 'The Expediter', 'Öne alan'],
  ['الْمُؤَخِّرُ', 'Al-Mu’akhkhir', 'Der Aufschiebende', 'The Delayer', 'Geriye bırakan'],
  ['الْأَوَّلُ', 'Al-Awwal', 'Der Erste', 'The First', 'Başlangıcı olmayan'],
  ['الْآخِرُ', 'Al-Akhir', 'Der Letzte', 'The Last', 'Sonu olmayan'],
  ['الظَّاهِرُ', 'Az-Zahir', 'Der Offenbare', 'The Manifest', 'Varlığı apaçık'],
  ['الْبَاطِنُ', 'Al-Batin', 'Der Verborgene', 'The Hidden', 'Gizliye de hâkim'],
  ['الْوَالِي', 'Al-Wali', 'Der Herrscher', 'The Governor', 'İşleri yöneten'],
  ['الْمُتَعَالِي', 'Al-Muta’ali', 'Der Hocherhabene', 'The Most Exalted', 'Yüceler yücesi'],
  ['الْبَرُّ', 'Al-Barr', 'Der Gütige', 'The Source of Goodness', 'İyiliği bol'],
  ['التَّوَّابُ', 'At-Tawwab', 'Der Reue Annehmende', 'The Acceptor of Repentance', 'Tevbeleri kabul eden'],
  ['الْمُنْتَقِمُ', 'Al-Muntaqim', 'Der Vergeltende', 'The Avenger', 'Suçluları cezalandıran'],
  ['الْعَفُوُّ', 'Al-Afuww', 'Der Verzeihende', 'The Pardoner', 'Affeden'],
  ['الرَّءُوفُ', 'Ar-Ra’uf', 'Der Mitfühlende', 'The Compassionate', 'Çok şefkatli'],
  ['مَالِكُ الْمُلْكِ', 'Malik-ul-Mulk', 'Der Herr der Herrschaft', 'Owner of Sovereignty', 'Mülkün ebedî sahibi'],
  ['ذُو الْجَلَالِ وَالْإِكْرَامِ', 'Dhul-Jalali wal-Ikram', 'Herr von Majestät und Ehre', 'Lord of Majesty and Honor', 'Celal ve ikram sahibi'],
  ['الْمُقْسِطُ', 'Al-Muqsit', 'Der Gerecht Handelnde', 'The Equitable', 'Adaletle hükmeden'],
  ['الْجَامِعُ', 'Al-Jami', 'Der Versammelnde', 'The Gatherer', 'Toplayıp bir araya getiren'],
  ['الْغَنِيُّ', 'Al-Ghaniyy', 'Der Reiche', 'The Self-Sufficient', 'Hiçbir şeye muhtaç olmayan'],
  ['الْمُغْنِي', 'Al-Mughni', 'Der Reich Machende', 'The Enricher', 'Zengin eden'],
  ['الْمَانِعُ', 'Al-Mani', 'Der Verwehrende', 'The Preventer', 'Dilediğini engelleyen'],
  ['الضَّارُّ', 'Ad-Darr', 'Der Schaden Zulassende', 'The Afflicter', 'Zarara izin veren'],
  ['النَّافِعُ', 'An-Nafi', 'Der Nützende', 'The Benefiter', 'Fayda veren'],
  ['النُّورُ', 'An-Nur', 'Das Licht', 'The Light', 'Nur'],
  ['الْهَادِي', 'Al-Hadi', 'Der Rechtleitende', 'The Guide', 'Hidayet veren'],
  ['الْبَدِيعُ', 'Al-Badi', 'Der Urheber ohne Vorbild', 'The Incomparable Originator', 'Eşsiz yaratan'],
  ['الْبَاقِي', 'Al-Baqi', 'Der Ewig-Bleibende', 'The Everlasting', 'Bâki olan'],
  ['الْوَارِثُ', 'Al-Warith', 'Der Erbe', 'The Inheritor', 'Her şeyin son sahibi'],
  ['الرَّشِيدُ', 'Ar-Rashid', 'Der Rechtweisende', 'The Guide to the Right Path', 'Doğru yola ileten'],
  ['الصَّبُورُ', 'As-Sabur', 'Der Geduldige', 'The Patient', 'Sabrı sonsuz'],
];

// Zusatz-Sprachen, index-gleich zu ROWS.
// Reihenfolge: [translit-Label, es, fr, id, bn, fa, ms, ur, sw, ru, ps]
// Das translit-Label dient nur der Ausrichtungs-Kontrolle (siehe Guard).
type ExtraRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

const EXTRA_ROWS: ExtraRow[] = [
  ['Ar-Rahman', 'El Clementísimo', 'Le Tout-Miséricordieux', 'Yang Maha Pengasih', 'পরম করুণাময়', 'بخشندهٔ مهربان', 'Yang Maha Pengasih', 'بے حد رحم کرنے والا', 'Mwingi wa Rehema', 'Милостивый', 'ډېر مهربان'],
  ['Ar-Rahim', 'El Misericordioso', 'Le Très-Miséricordieux', 'Yang Maha Penyayang', 'অতি দয়ালু', 'مهربان', 'Yang Maha Penyayang', 'نہایت مہربان', 'Mwenye Kurehemu', 'Милосердный', 'بې‌حده رحم کوونکی'],
  ['Al-Malik', 'El Rey', 'Le Roi', 'Yang Maharaja', 'সর্বময় অধিপতি', 'پادشاه هستی', 'Yang Maha Merajai', 'حقیقی بادشاہ', 'Mfalme', 'Владыка', 'حقیقي بادشاه'],
  ['Al-Quddus', 'El Santísimo', 'Le Très-Saint', 'Yang Mahasuci', 'পরম পবিত্র', 'پاک و منزه', 'Yang Maha Suci', 'نہایت پاک', 'Mtakatifu', 'Пресвятой', 'ډېر پاک'],
  ['As-Salam', 'La Fuente de la Paz', 'La Source de la Paix', 'Yang Maha Sejahtera', 'শান্তির আধার', 'سرچشمهٔ آرامش', 'Yang Maha Sejahtera', 'سلامتی دینے والا', 'Chanzo cha Amani', 'Источник мира', 'سلامتي ورکوونکی'],
  ['Al-Mumin', 'El Dador de Seguridad', 'Le Dispensateur de Sécurité', 'Yang Maha Memberi Keamanan', 'নিরাপত্তা দানকারী', 'امنیت‌بخش', 'Yang Maha Mengurniakan Keamanan', 'امن دینے والا', 'Mtoaji wa Usalama', 'Дарующий безопасность', 'امن ورکوونکی'],
  ['Al-Muhaymin', 'El Guardián', 'Le Gardien', 'Yang Maha Memelihara', 'রক্ষণাবেক্ষণকারী', 'نگاهبان', 'Yang Maha Mengawal', 'نگہبان', 'Mlinzi', 'Хранитель', 'ساتونکی'],
  ['Al-Aziz', 'El Todopoderoso', 'Le Tout-Puissant', 'Yang Mahaperkasa', 'মহাপরাক্রমশালী', 'شکست‌ناپذیر', 'Yang Maha Perkasa', 'سب پر غالب', 'Mwenye Nguvu Zote', 'Всемогущий', 'پر هرچا برلاسی'],
  ['Al-Jabbar', 'El Dominador', 'Le Contraignant', 'Yang Maha Memaksa', 'মহাপ্রতাপশালী', 'چیره و مقتدر', 'Yang Maha Memaksa', 'زبردست جبار', 'Mwenye Kulazimisha', 'Принуждающий', 'زورواکی'],
  ['Al-Mutakabbir', 'El Supremo', 'Le Suprême', 'Yang Maha Memiliki Kebesaran', 'মহাগৌরবের অধিকারী', 'صاحب بزرگی', 'Yang Maha Memiliki Kebesaran', 'کبریائی والا', 'Mwenye Ukuu', 'Превознесённый', 'د کبریا خاوند'],
  ['Al-Khaliq', 'El Creador', 'Le Créateur', 'Yang Maha Pencipta', 'সৃষ্টিকর্তা', 'آفریننده', 'Yang Maha Pencipta', 'پیدا کرنے والا', 'Muumba', 'Творец', 'پیدا کوونکی'],
  ['Al-Bari', 'El Originador', 'Le Producteur', 'Yang Maha Mengadakan', 'উদ্ভাবক স্রষ্টা', 'پدیدآورنده', 'Yang Maha Menjadikan', 'عدم سے وجود بخشنے والا', 'Muanzishaji', 'Создатель', 'له نشته څخه جوړوونکی'],
  ['Al-Musawwir', 'El Formador', 'Le Façonneur', 'Yang Maha Membentuk Rupa', 'আকৃতিদানকারী', 'صورتگر', 'Yang Maha Pembentuk Rupa', 'صورت بنانے والا', 'Mtengenezaji wa Sura', 'Дающий облик', 'بڼه ورکوونکی'],
  ['Al-Ghaffar', 'El Sumamente Perdonador', 'Le Grand Pardonneur', 'Yang Maha Pengampun', 'পরম ক্ষমাশীল', 'بسیار آمرزنده', 'Yang Maha Pengampun', 'بہت بخشنے والا', 'Mwingi wa Kusamehe', 'Всепрощающий', 'ډېر بښونکی'],
  ['Al-Qahhar', 'El Subyugador', 'Le Dominateur Suprême', 'Yang Maha Menundukkan', 'সর্বপ্রভাবশালী দমনকারী', 'قهار چیره', 'Yang Maha Menundukkan', 'سب پر قہر و غلبہ رکھنے والا', 'Mwenye Kushinda Vyote', 'Покоряющий', 'پر هرڅه برلاسی'],
  ['Al-Wahhab', 'El Dadivoso', 'Le Donateur', 'Yang Maha Pemberi Karunia', 'মহাদাতা', 'بسیار بخشنده', 'Yang Maha Pemberi Kurnia', 'بہت عطا کرنے والا', 'Mpaji Mkarimu', 'Дарующий блага', 'ډېر عطا کوونکی'],
  ['Ar-Razzaq', 'El Proveedor', 'Le Pourvoyeur', 'Yang Maha Pemberi Rezeki', 'রিযিকদাতা', 'روزی‌دهنده', 'Yang Maha Pemberi Rezeki', 'رزق دینے والا', 'Mtoaji Riziki', 'Наделяющий пропитанием', 'روزي ورکوونکی'],
  ['Al-Fattah', 'El Abridor', 'Celui qui Ouvre', 'Yang Maha Pembuka', 'উন্মোচনকারী', 'گشاینده', 'Yang Maha Pembuka', 'کھولنے والا', 'Mwenye Kufungua', 'Открывающий', 'پرانیستونکی'],
  ['Al-Alim', 'El Omnisciente', 'L’Omniscient', 'Yang Maha Mengetahui', 'সর্বজ্ঞ', 'دانای همه چیز', 'Yang Maha Mengetahui', 'سب کچھ جاننے والا', 'Mjuzi wa Kila Kitu', 'Всезнающий', 'پر هر څه پوه'],
  ['Al-Qabid', 'El Que Restringe', 'Celui qui Restreint', 'Yang Maha Menyempitkan', 'সংকোচনকারী', 'تنگی‌دهنده', 'Yang Maha Menyempitkan', 'تنگی کرنے والا', 'Mwenye Kubana', 'Удерживающий', 'تنگوونکی'],
  ['Al-Basit', 'El Que Extiende', 'Celui qui Étend', 'Yang Maha Melapangkan', 'প্রসারণকারী', 'گشایش‌دهنده', 'Yang Maha Melapangkan', 'فراخی دینے والا', 'Mwenye Kupanua', 'Расширяющий', 'پراخوونکی'],
  ['Al-Khafid', 'El Que Rebaja', 'Celui qui Abaisse', 'Yang Maha Merendahkan', 'অবনতকারী', 'پست‌کننده', 'Yang Maha Merendahkan', 'پست کرنے والا', 'Mwenye Kushusha', 'Принижающий', 'ټیټوونکی'],
  ['Ar-Rafi', 'El Que Eleva', 'Celui qui Élève', 'Yang Maha Meninggikan', 'উন্নতকারী', 'بلندکننده', 'Yang Maha Meninggikan', 'بلند کرنے والا', 'Mwenye Kunyanyua', 'Возвышающий', 'لوړوونکی'],
  ['Al-Muizz', 'El Que Honra', 'Celui qui Honore', 'Yang Maha Memuliakan', 'সম্মানদানকারী', 'عزت‌بخش', 'Yang Maha Memuliakan', 'عزت دینے والا', 'Mwenye Kutukuza', 'Возвеличивающий', 'عزت ورکوونکی'],
  ['Al-Mudhill', 'El Que Humilla', 'Celui qui Humilie', 'Yang Maha Menghinakan', 'অপমানকারী', 'خوارکننده', 'Yang Maha Menghina', 'ذلت دینے والا', 'Mwenye Kudhalilisha', 'Унижающий', 'سپکوونکی'],
  ['As-Sami', 'El Que Todo lo Oye', 'Celui qui Entend Tout', 'Yang Maha Mendengar', 'সর্বশ্রোতা', 'شنوای همه چیز', 'Yang Maha Mendengar', 'سب کچھ سننے والا', 'Msikizi wa Kila Kitu', 'Всеслышащий', 'پر هر څه اورېدونکی'],
  ['Al-Basir', 'El Que Todo lo Ve', 'Celui qui Voit Tout', 'Yang Maha Melihat', 'সর্বদ্রষ্টা', 'بینای همه چیز', 'Yang Maha Melihat', 'سب کچھ دیکھنے والا', 'Mwenye Kuona Vyote', 'Всевидящий', 'پر هر څه لیدونکی'],
  ['Al-Hakam', 'El Juez', 'Le Juge', 'Yang Maha Menetapkan Hukum', 'বিচারক', 'داور', 'Yang Maha Menghakimi', 'فیصلہ کرنے والا', 'Hakimu', 'Судья', 'پرېکړه کوونکی'],
  ['Al-Adl', 'El Justo', 'Le Juste', 'Yang Mahaadil', 'ন্যায়পরায়ণ', 'دادگر', 'Yang Maha Adil', 'انصاف والا', 'Mwenye Uadilifu', 'Справедливый', 'عادل'],
  ['Al-Latif', 'El Sutil', 'Le Subtil', 'Yang Mahalembut', 'সূক্ষ্মদর্শী দয়াময়', 'لطیف و باریک‌بین', 'Yang Maha Halus', 'باریک بیں مہربان', 'Mpole Mjuzi', 'Проницательный', 'نازک‌بین مهربان'],
  ['Al-Khabir', 'El Bien Informado', 'Le Parfaitement Informé', 'Yang Maha Mengenal', 'সম্যক অবগত', 'آگاه از همه چیز', 'Yang Maha Waspada', 'ہر بات سے باخبر', 'Mwenye Habari za Yote', 'Ведающий', 'پر هر څه خبردار'],
  ['Al-Halim', 'El Indulgente', 'Le Longanime', 'Yang Maha Penyantun', 'অত্যন্ত সহনশীল', 'بردبار', 'Yang Maha Penyantun', 'بردبار', 'Mstahamilivu', 'Кроткий', 'زغمناک'],
  ['Al-Azim', 'El Grandioso', 'L’Immense', 'Yang Mahaagung', 'মহান', 'با عظمت', 'Yang Maha Agung', 'بہت عظمت والا', 'Mkuu Mno', 'Великий', 'د لوی عظمت خاوند'],
  ['Al-Ghafur', 'El Perdonador', 'Le Pardonneur', 'Yang Maha Pemberi Ampun', 'ক্ষমাশীল', 'آمرزنده', 'Yang Maha Pemberi Keampunan', 'بخشنے والا', 'Mwenye Kusamehe', 'Прощающий', 'بښونکی'],
  ['Ash-Shakur', 'El Agradecido', 'Le Reconnaissant', 'Yang Maha Mensyukuri', 'গুণগ্রাহী', 'قدردان', 'Yang Maha Bersyukur', 'قدر دان', 'Mwenye Shukrani', 'Благодарный', 'قدرپېژندونکی'],
  ['Al-Ali', 'El Altísimo', 'Le Très-Haut', 'Yang Mahatinggi', 'সর্বোচ্চ', 'بلندمرتبه', 'Yang Maha Tinggi', 'سب سے بلند', 'Aliye Juu Zaidi', 'Всевышний', 'تر ټولو اوچت'],
  ['Al-Kabir', 'El Grande', 'Le Grand', 'Yang Mahabesar', 'সর্ববৃহৎ', 'بس بزرگ', 'Yang Maha Besar', 'سب سے بڑا', 'Mkubwa Kuliko Wote', 'Превеликий', 'تر ټولو لوی'],
  ['Al-Hafiz', 'El Preservador', 'Le Préservateur', 'Yang Maha Menjaga', 'সংরক্ষণকারী', 'نگهدارنده', 'Yang Maha Memelihara', 'حفاظت کرنے والا', 'Mhifadhi', 'Хранящий', 'خوندي ساتونکی'],
  ['Al-Muqit', 'El Sustentador', 'Le Nourricier', 'Yang Maha Pemberi Kecukupan', 'জীবিকা রক্ষাকারী', 'قوت‌رسان', 'Yang Maha Pemberi Kecukupan', 'قوت و رزق دینے والا', 'Mruzuku wa Chakula', 'Питающий', 'روزي او قوت ورکوونکی'],
  ['Al-Hasib', 'El Que Ajusta las Cuentas', 'Celui qui Règle les Comptes', 'Yang Maha Membuat Perhitungan', 'হিসাবগ্রহণকারী', 'حسابرس', 'Yang Maha Membuat Perhitungan', 'حساب لینے والا', 'Mwenye Kuhesabu', 'Ведущий счёт', 'حساب اخیستونکی'],
  ['Al-Jalil', 'El Majestuoso', 'Le Majestueux', 'Yang Mahaluhur', 'মহামহিম', 'باشکوه', 'Yang Maha Luhur', 'بڑی شان والا', 'Mwenye Enzi', 'Величественный', 'د لوی شان خاوند'],
  ['Al-Karim', 'El Generoso', 'Le Généreux', 'Yang Maha Pemurah', 'অত্যন্ত দানশীল', 'بخشندهٔ کریم', 'Yang Maha Pemurah', 'بہت کرم کرنے والا', 'Mkarimu', 'Щедрый', 'سخي کریم'],
  ['Ar-Raqib', 'El Vigilante', 'Le Vigilant', 'Yang Maha Mengawasi', 'সদা পর্যবেক্ষক', 'مراقب', 'Yang Maha Mengawasi', 'نگرانی کرنے والا', 'Mchunguzi', 'Наблюдающий', 'تل څارونکی'],
  ['Al-Mujib', 'El Que Responde', 'Celui qui Exauce', 'Yang Maha Mengabulkan', 'প্রার্থনা কবুলকারী', 'اجابت‌کننده', 'Yang Maha Memperkenankan', 'دعائیں قبول کرنے والا', 'Mwenye Kuitikia Maombi', 'Внемлющий мольбам', 'دعاوې قبلوونکی'],
  ['Al-Wasi', 'El Que Todo lo Abarca', 'Celui qui Embrasse Tout', 'Yang Mahaluas', 'সর্বব্যাপী', 'فراگیر', 'Yang Maha Luas', 'وسعت والا', 'Mwenye Wasaa', 'Всеобъемлющий', 'د پراخۍ خاوند'],
  ['Al-Hakim', 'El Sabio', 'Le Sage', 'Yang Mahabijaksana', 'প্রজ্ঞাময়', 'فرزانه', 'Yang Maha Bijaksana', 'بڑی حکمت والا', 'Mwenye Hekima', 'Мудрый', 'د حکمت خاوند'],
  ['Al-Wadud', 'El Amoroso', 'Le Tout-Aimant', 'Yang Maha Mengasihi', 'প্রেমময়', 'بسیار دوستدار', 'Yang Maha Mengasihi', 'بہت محبت کرنے والا', 'Mwenye Kupenda', 'Любящий', 'ډېر مینه‌ناک'],
  ['Al-Majid', 'El Glorioso', 'Le Glorieux', 'Yang Mahamulia', 'মহিমান্বিত', 'شکوهمند', 'Yang Maha Mulia', 'بزرگی والا', 'Mtukufu', 'Славный', 'د عزت خاوند'],
  ['Al-Baith', 'El Resucitador', 'Celui qui Ressuscite', 'Yang Maha Membangkitkan', 'পুনরুত্থানকারী', 'برانگیزاننده', 'Yang Maha Membangkitkan', 'مُردوں کو اٹھانے والا', 'Mwenye Kufufua', 'Воскрешающий', 'مړي بیا ژوندي کوونکی'],
  ['Ash-Shahid', 'El Testigo', 'Le Témoin', 'Yang Maha Menyaksikan', 'সর্বসাক্ষী', 'گواه بر همه چیز', 'Yang Maha Menyaksikan', 'ہر چیز پر گواہ', 'Shahidi wa Kila Kitu', 'Свидетель', 'پر هر څه شاهد'],
  ['Al-Haqq', 'La Verdad', 'La Vérité', 'Yang Mahabenar', 'পরম সত্য', 'حق مطلق', 'Yang Maha Benar', 'حق و سچ', 'Ukweli', 'Истина', 'حق'],
  ['Al-Wakil', 'El Fiduciario', 'Le Garant', 'Yang Maha Terpercaya', 'কর্মবিধায়ক', 'کارساز', 'Yang Maha Pentadbir', 'کارساز', 'Mtegemewa', 'Попечитель', 'کارساز'],
  ['Al-Qawiyy', 'El Fuerte', 'Le Fort', 'Yang Mahakuat', 'মহাশক্তিশালী', 'نیرومند', 'Yang Maha Kuat', 'بڑی قوت والا', 'Mwenye Nguvu', 'Всесильный', 'ډېر زورور'],
  ['Al-Matin', 'El Firme', 'Le Ferme', 'Yang Mahakokoh', 'সুদৃঢ়', 'استوار', 'Yang Maha Teguh', 'نہایت مضبوط', 'Madhubuti', 'Крепкий', 'ټینګ'],
  ['Al-Waliyy', 'El Amigo Protector', 'Le Protecteur', 'Yang Maha Melindungi', 'অভিভাবক', 'سرپرست و یاور', 'Yang Maha Melindungi', 'مددگار دوست', 'Mlinzi na Rafiki', 'Покровитель', 'ملاتړی دوست'],
  ['Al-Hamid', 'El Digno de Alabanza', 'Le Digne de Louange', 'Yang Maha Terpuji', 'প্রশংসিত', 'ستوده', 'Yang Maha Terpuji', 'تعریف کے لائق', 'Mwenye Kusifiwa', 'Достохвальный', 'د ستاینې وړ'],
  ['Al-Muhsi', 'El Que Todo lo Enumera', 'Celui qui Dénombre Tout', 'Yang Maha Menghitung', 'সবকিছুর গণনাকারী', 'شمارندهٔ همه چیز', 'Yang Maha Menghitung', 'ہر چیز کا شمار رکھنے والا', 'Mwenye Kuhesabu Kila Kitu', 'Учитывающий всё', 'د هر څه شمېرونکی'],
  ['Al-Mubdi', 'El Iniciador', 'L’Initiateur', 'Yang Maha Memulai', 'সূচনাকারী', 'آغازگر', 'Yang Maha Memulakan', 'پہلی بار پیدا کرنے والا', 'Mwanzishaji wa Uumbaji', 'Изначально Творящий', 'لومړی پیدا کوونکی'],
  ['Al-Muid', 'El Restaurador', 'Le Restaurateur', 'Yang Maha Mengembalikan', 'পুনঃসৃষ্টিকারী', 'بازگرداننده', 'Yang Maha Mengembalikan', 'دوبارہ پیدا کرنے والا', 'Mwenye Kurudisha', 'Воссоздающий', 'بیا پیدا کوونکی'],
  ['Al-Muhyi', 'El Vivificador', 'Celui qui Donne la Vie', 'Yang Maha Menghidupkan', 'জীবনদাতা', 'زندگی‌بخش', 'Yang Maha Menghidupkan', 'زندگی دینے والا', 'Mtoaji wa Uhai', 'Оживляющий', 'ژوند ورکوونکی'],
  ['Al-Mumit', 'El Que Da la Muerte', 'Celui qui Donne la Mort', 'Yang Maha Mematikan', 'মৃত্যুদাতা', 'میراننده', 'Yang Maha Mematikan', 'موت دینے والا', 'Mtoaji wa Mauti', 'Умерщвляющий', 'مرګ ورکوونکی'],
  ['Al-Hayy', 'El Viviente', 'Le Vivant', 'Yang Mahahidup', 'চিরঞ্জীব', 'زندهٔ جاوید', 'Yang Maha Hidup', 'ہمیشہ زندہ', 'Aliye Hai Milele', 'Вечно Живой', 'تل ژوندی'],
  ['Al-Qayyum', 'El Subsistente', 'Le Subsistant', 'Yang Maha Mandiri', 'স্বয়ংসম্পূর্ণ ধারক', 'پاینده', 'Yang Maha Berdiri Sendiri', 'سب کو قائم رکھنے والا', 'Mwenye Kujisimamia', 'Сущий', 'پر خپل ولاړ'],
  ['Al-Wajid', 'El Que Todo lo Halla', 'Celui qui Trouve Tout', 'Yang Maha Menemukan', 'সন্ধানকারী', 'یابنده', 'Yang Maha Menemui', 'ہر چیز کو پانے والا', 'Mpataji', 'Находящий', 'موندونکی'],
  ['Al-Majid', 'El Ilustre', 'L’Illustre', 'Yang Maha Mulia lagi Luhur', 'গৌরবান্বিত', 'شریف و بزرگوار', 'Yang Maha Mulia lagi Agung', 'بزرگی و بزرگواری والا', 'Mwenye Hadhi Kubwa', 'Благородный', 'د لوړ شرف خاوند'],
  ['Al-Wahid', 'El Uno', 'L’Un', 'Yang Maha Esa', 'এক', 'یگانه', 'Yang Maha Esa', 'اکیلا', 'Mmoja', 'Единый', 'یو'],
  ['Al-Ahad', 'El Único', 'L’Unique', 'Yang Maha Tunggal', 'অদ্বিতীয়', 'یکتا', 'Yang Maha Tunggal', 'یکتا', 'Wa Pekee', 'Единственный', 'یوازینی'],
  ['As-Samad', 'El Refugio Eterno', 'Le Refuge Éternel', 'Yang Menjadi Tempat Bergantung', 'চিরন্তন আশ্রয়', 'بی‌نیازِ پناه‌بخش', 'Yang Menjadi Tumpuan', 'بے نیاز سہارا', 'Kimbilio la Milele', 'Вечное Прибежище', 'بې‌نیازه پناه'],
  ['Al-Qadir', 'El Capaz', 'Le Puissant', 'Yang Mahakuasa', 'সর্বশক্তিমান', 'توانا', 'Yang Maha Kuasa', 'قدرت والا', 'Mwenye Uwezo', 'Могущественный', 'وسمن'],
  ['Al-Muqtadir', 'El Omnipotente', 'L’Omnipotent', 'Yang Maha Berkuasa', 'পূর্ণ ক্ষমতাধর', 'بس توانا', 'Yang Maha Berkuasa', 'پوری قدرت رکھنے والا', 'Mwenye Uwezo Kamili', 'Всевластный', 'بشپړ قدرتمن'],
  ['Al-Muqaddim', 'El Que Adelanta', 'Celui qui Avance', 'Yang Maha Mendahulukan', 'অগ্রসরকারী', 'پیش‌دارنده', 'Yang Maha Mendahulukan', 'آگے کرنے والا', 'Mwenye Kutanguliza', 'Выдвигающий вперёд', 'مخکې کوونکی'],
  ['Al-Muakhkhir', 'El Que Retrasa', 'Celui qui Diffère', 'Yang Maha Mengakhirkan', 'বিলম্বকারী', 'واپس‌دارنده', 'Yang Maha Mengemudiankan', 'پیچھے کرنے والا', 'Mwenye Kuchelewesha', 'Отсрочивающий', 'وروسته کوونکی'],
  ['Al-Awwal', 'El Primero', 'Le Premier', 'Yang Maha Awal', 'প্রথম', 'نخستین', 'Yang Maha Awal', 'سب سے پہلا', 'Wa Kwanza', 'Первый', 'تر ټولو لومړی'],
  ['Al-Akhir', 'El Último', 'Le Dernier', 'Yang Maha Akhir', 'সর্বশেষ', 'واپسین', 'Yang Maha Akhir', 'سب سے آخر', 'Wa Mwisho', 'Последний', 'تر ټولو وروستی'],
  ['Az-Zahir', 'El Manifiesto', 'L’Apparent', 'Yang Maha Nyata', 'প্রকাশ্য', 'آشکار', 'Yang Maha Zahir', 'ظاہر', 'Aliye Dhahiri', 'Явный', 'څرګند'],
  ['Al-Batin', 'El Oculto', 'Le Caché', 'Yang Maha Gaib', 'অন্তর্যামী গুপ্ত', 'پنهان', 'Yang Maha Batin', 'پوشیدہ', 'Aliye Fiche', 'Скрытый', 'پټ'],
  ['Al-Wali', 'El Gobernador', 'Le Régisseur', 'Yang Maha Memerintah', 'সর্বময় শাসক', 'گردانندهٔ کارها', 'Yang Maha Menguasai', 'کارفرما', 'Mtawala wa Mambo', 'Управляющий', 'د چارو واکمن'],
  ['Al-Mutaali', 'El Excelso', 'Le Sublime', 'Yang Maha Tinggi lagi Agung', 'সর্বোচ্চ সমুন্নত', 'بس والا', 'Yang Maha Tinggi lagi Suci', 'سب سے بلند و برتر', 'Aliye Juu Kabisa', 'Высочайший', 'ډېر اوچت'],
  ['Al-Barr', 'El Bondadoso', 'Le Bienfaiteur', 'Yang Maha Melimpahkan Kebaikan', 'কল্যাণময়', 'نیکوکار', 'Yang Maha Melimpahkan Kebaikan', 'بھلائی کرنے والا', 'Mwenye Wema', 'Благостный', 'نیکي کوونکی'],
  ['At-Tawwab', 'El Que Acepta el Arrepentimiento', 'Celui qui Accueille le Repentir', 'Yang Maha Penerima Tobat', 'তওবা কবুলকারী', 'توبه‌پذیر', 'Yang Maha Penerima Taubat', 'توبہ قبول کرنے والا', 'Mwenye Kupokea Toba', 'Принимающий покаяние', 'توبه قبلوونکی'],
  ['Al-Muntaqim', 'El Vengador', 'Le Vengeur', 'Yang Maha Pemberi Balasan', 'প্রতিশোধ গ্রহণকারী', 'انتقام‌گیرنده', 'Yang Maha Pembalas', 'بدلہ لینے والا', 'Mwenye Kulipiza Kisasi', 'Отмщающий', 'بدل اخیستونکی'],
  ['Al-Afuww', 'El Indultador', 'Celui qui Absout', 'Yang Maha Pemaaf', 'মার্জনাকারী', 'بسیار عفوکننده', 'Yang Maha Pemaaf', 'معاف کرنے والا', 'Mwenye Kusamehe Makosa', 'Извиняющий', 'له ګناهونو تېرېدونکی'],
  ['Ar-Rauf', 'El Compasivo', 'Le Compatissant', 'Yang Maha Belas Kasih', 'অতি স্নেহশীল', 'دلسوز مهربان', 'Yang Maha Belas Kasihan', 'بہت شفقت کرنے والا', 'Mwenye Huruma', 'Сострадательный', 'زړه‌سواند مهربان'],
  ['Malik-ul-Mulk', 'El Dueño de la Soberanía', 'Le Détenteur de la Royauté', 'Pemilik Kerajaan', 'সমগ্র রাজত্বের অধিপতি', 'دارندهٔ فرمانروایی', 'Pemilik Kerajaan', 'تمام بادشاہت کا مالک', 'Mmiliki wa Ufalme Wote', 'Властелин царства', 'د ټول واک مالک'],
  ['Dhul-Jalali wal-Ikram', 'El Poseedor de la Majestad y la Honra', 'Le Seigneur de la Majesté et de la Générosité', 'Yang Maha Memiliki Keagungan dan Kemuliaan', 'মহিমা ও সম্মানের অধিকারী', 'دارای شکوه و بزرگواری', 'Yang Maha Memiliki Keagungan dan Kemuliaan', 'عظمت و بزرگی والا', 'Mwenye Enzi na Ukarimu', 'Обладатель величия и щедрости', 'د لوی شان او عزت خاوند'],
  ['Al-Muqsit', 'El Equitativo', 'L’Équitable', 'Yang Maha Berlaku Adil', 'সুবিচারক', 'دادگستر', 'Yang Maha Saksama', 'انصاف سے فیصلہ کرنے والا', 'Mwenye Insafu', 'Беспристрастный', 'په انصاف پرېکړه کوونکی'],
  ['Al-Jami', 'El Congregador', 'Le Rassembleur', 'Yang Maha Mengumpulkan', 'একত্রকারী', 'گردآورنده', 'Yang Maha Menghimpun', 'سب کو جمع کرنے والا', 'Mwenye Kukusanya', 'Собирающий', 'راټولوونکی'],
  ['Al-Ghaniyy', 'El Autosuficiente', 'Celui qui se Suffit à Lui-Même', 'Yang Mahakaya', 'অভাবমুক্ত', 'بی‌نیاز', 'Yang Maha Kaya', 'بے نیاز', 'Asiyehitaji Kitu', 'Самодостаточный', 'بې‌نیازه'],
  ['Al-Mughni', 'El Enriquecedor', 'Celui qui Enrichit', 'Yang Maha Memberi Kekayaan', 'অভাবমোচনকারী', 'بی‌نیازکننده', 'Yang Maha Pemberi Kekayaan', 'غنی و مالدار کرنے والا', 'Mwenye Kutajirisha', 'Обогащающий', 'بې‌نیازه کوونکی'],
  ['Al-Mani', 'El Que Impide', 'Celui qui Empêche', 'Yang Maha Mencegah', 'প্রতিরোধকারী', 'بازدارنده', 'Yang Maha Mencegah', 'روکنے والا', 'Mwenye Kuzuia', 'Препятствующий', 'مخنیوی کوونکی'],
  ['Ad-Darr', 'El Que Permite el Daño', 'Celui qui Permet le Mal', 'Yang Maha Pemberi Derita', 'ক্ষতির নিয়ন্ত্রক', 'روادارندهٔ زیان', 'Yang Maha Pemberi Mudarat', 'نقصان دینے والا', 'Mwenye Kuleta Dhara', 'Насылающий беды', 'د زیان رسوونکی'],
  ['An-Nafi', 'El Que Beneficia', 'Celui qui Profite', 'Yang Maha Pemberi Manfaat', 'উপকারদাতা', 'سودرساننده', 'Yang Maha Pemberi Manfaat', 'نفع دینے والا', 'Mwenye Kunufaisha', 'Приносящий пользу', 'ګټه رسوونکی'],
  ['An-Nur', 'La Luz', 'La Lumière', 'Yang Maha Bercahaya', 'জ্যোতি', 'نور', 'Yang Maha Bercahaya', 'نور', 'Nuru', 'Свет', 'رڼا'],
  ['Al-Hadi', 'El Guía', 'Le Guide', 'Yang Maha Pemberi Petunjuk', 'পথপ্রদর্শক', 'هدایت‌کننده', 'Yang Maha Pemberi Hidayah', 'ہدایت دینے والا', 'Mwenye Kuongoza', 'Ведущий прямым путём', 'لارښوونکی'],
  ['Al-Badi', 'El Originador Incomparable', 'Le Créateur Incomparable', 'Yang Maha Pencipta yang Tiada Bandingnya', 'অতুলনীয় স্রষ্টা', 'پدیدآورندهٔ بی‌همتا', 'Yang Maha Pencipta yang Tiada Tolok Bandingnya', 'بے مثال پیدا کرنے والا', 'Muumba wa Kipekee Asiye na Mfano', 'Первосоздатель', 'بې‌ساری پنځوونکی'],
  ['Al-Baqi', 'El Perdurable', 'L’Éternel', 'Yang Maha Kekal', 'চিরস্থায়ী', 'جاودان', 'Yang Maha Kekal', 'ہمیشہ باقی رہنے والا', 'Adumuye Milele', 'Вечносущий', 'تلپاتې'],
  ['Al-Warith', 'El Heredero', 'L’Héritier', 'Yang Maha Pewaris', 'চূড়ান্ত উত্তরাধিকারী', 'وارث همه', 'Yang Maha Mewarisi', 'سب کا وارث', 'Mrithi wa Vyote', 'Наследник', 'د ټولو وارث'],
  ['Ar-Rashid', 'El Guía al Camino Recto', 'Le Guide vers la Voie Droite', 'Yang Maha Membimbing ke Jalan Lurus', 'সঠিক পথের দিশারি', 'راهنمای راه راست', 'Yang Maha Membimbing ke Jalan Lurus', 'سیدھی راہ دکھانے والا', 'Mwenye Kuongoza kwenye Njia Sahihi', 'Направляющий к истине', 'سمې لارې ته لارښوونکی'],
  ['As-Sabur', 'El Paciente', 'Le Patient', 'Yang Maha Penyabar', 'পরম ধৈর্যশীল', 'بسیار شکیبا', 'Yang Maha Penyabar', 'بہت صبر کرنے والا', 'Mwenye Subira', 'Терпеливый', 'ډېر صبرناک'],
];

// Transliteration normalisieren (Apostrophe/Bindestriche/Case egal),
// damit der Ausrichtungs-Guard robust gegen ’ vs ' vs '' bleibt.
const normTranslit = (s: string): string => s.replace(/[’'`\-\s]/g, '').toLowerCase();

if (EXTRA_ROWS.length !== ROWS.length) {
  throw new Error(
    `names.ts: EXTRA_ROWS (${EXTRA_ROWS.length}) und ROWS (${ROWS.length}) haben unterschiedliche Länge`,
  );
}

export const DIVINE_NAMES: DivineName[] = ROWS.map((r, i) => {
  const e = EXTRA_ROWS[i];
  if (normTranslit(e[0]) !== normTranslit(r[1])) {
    throw new Error(`names.ts: Ausrichtung bei Index ${i} falsch — ROWS "${r[1]}" vs EXTRA "${e[0]}"`);
  }
  return {
    n: i + 1,
    arabic: r[0],
    translit: r[1],
    de: r[2],
    en: r[3],
    tr: r[4],
    es: e[1],
    fr: e[2],
    id: e[3],
    bn: e[4],
    fa: e[5],
    ms: e[6],
    ur: e[7],
    sw: e[8],
    ru: e[9],
    ps: e[10],
  };
});

export function nameMeaning(name: DivineName, locale: string): string {
  switch (locale) {
    case 'de':
      return name.de;
    case 'tr':
      return name.tr;
    case 'es':
      return name.es;
    case 'fr':
      return name.fr;
    case 'id':
      return name.id;
    case 'bn':
      return name.bn;
    case 'fa':
      return name.fa;
    case 'ms':
      return name.ms;
    case 'ur':
      return name.ur;
    case 'sw':
      return name.sw;
    case 'ru':
      return name.ru;
    case 'ps':
      return name.ps;
    case 'ar':
      return ''; // Arabische UI zeigt nur den Namen selbst
    default:
      return name.en;
  }
}
