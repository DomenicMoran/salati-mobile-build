// Slide-Konfiguration fuer die App-Store-Screenshots (DE + EN).
//
// shot = Dateiname OHNE Endung in der Roh-Quelle. Quelle sind seit 2026-07-29
// die echten Geraete-Aufnahmen unter store-assets/device/phone/<locale>/
// (1080x2400, aufgenommen mit scripts/device-screenshots.mjs auf einem
// Android-Emulator mit der Release-APK 1.39.0).
//
// head = Headline, {..} markiert das Gold-Highlight-Wort. sub = Unterzeile.
// Jede Aussage muss in der App belegbar sein:
//   · Gebetszeiten/Adhan  -> features/prayer-times/, settings.tsx (3 Adhan-Aufnahmen)
//   · Koran               -> app/(tabs)/quran/[surah].tsx (Uebersetzung, Wort-fuer-Wort, Rezitatoren)
//   · KI                  -> app/ki-native.tsx + features/ki/zitat.ts (Zitat-Modus, lokal)
//   · Moschee-Abgleich    -> app/prayer-times-mosque.tsx + features/prayer-times/mosque-match.ts
//                            (23 Behoerden in features/settings/methods.ts, belegt durch
//                             methoden-abgleich.live.test.ts gegen api.aladhan.com)
//   · Qibla/Tracker/Tasbih/Kalender -> app/(tabs)/qibla.tsx, tracker.tsx, tasbih.tsx, calendar.tsx
//
// Die KI-Folie fehlte bis 1.39.0 im englischen Satz, weil der Zitat-Modus
// ausserhalb des Deutschen keine Belegstelle fand (siehe
// docs/STORE-BILDER-2026-07-29.md) — Ursache war die immer deutsch
// abgeschickte Beispielfrage (features/ki/beispielfragen.ts, behoben in
// 1.40.0). Seit der Korrektur zeigt die englische Aufnahme eine echte,
// belegte Antwort; die Folie ist damit wieder in beiden Saetzen.
export const SLIDES = {
  de: [
    { shot: '01-gebetszeiten',  head: 'Nie wieder ein {Gebet} verpassen', sub: 'Präzise Gebetszeiten für deinen Ort — mit Countdown & Adhan.' },
    { shot: '02-koran',         head: 'Der ganze {Koran} — lesen & hören', sub: 'Mit Übersetzung, Wort-für-Wort und mehreren Rezitatoren.' },
    { shot: '03-ki',            head: 'Antworten mit {Quellenangabe}', sub: 'Die Salati KI zitiert wörtlich aus Koran, Hadith und geprüften Duas — auf deinem Gerät.' },
    { shot: '04-moschee',       head: 'Zeiten, die zu deiner {Moschee} passen', sub: 'Zeiten vom Aushang abtippen — Salati findet die passende Behörde aus 23 und stellt sie ein.' },
    { shot: '05-qibla',         head: 'Die {Qibla} — überall & sofort', sub: 'Finde die Gebetsrichtung mit dem Live-Kompass.' },
    { shot: '06-tracker',       head: 'Bleib {dran} — Tag für Tag', sub: 'Gebets-Tracker, Serie und Qada-Zähler für verpasste Gebete.' },
    { shot: '07-tasbih',        head: '{Dhikr} zählen — überall', sub: 'Digitaler Tasbih mit Tagesziel und 7-Tage-Verlauf.' },
    { shot: '08-kalender',      head: 'Der islamische {Kalender}', sub: 'Hijri-Datum, Feiertage und wichtige Anlässe auf einen Blick.' },
  ],
  en: [
    { shot: '01-gebetszeiten',  head: 'Never miss a {prayer} again', sub: 'Accurate prayer times for your location — with countdown & Adhan.' },
    { shot: '02-koran',         head: 'The entire {Quran} — read & listen', sub: 'With translation, word-by-word and multiple reciters.' },
    { shot: '03-ki',            head: 'Answers with a {source}', sub: 'The Salati AI quotes verbatim from Quran, Hadith and verified duas — on your device.' },
    { shot: '04-moschee',       head: 'Times that match {your mosque}', sub: 'Type in the times from its timetable — Salati finds the right authority out of 23 and sets it.' },
    { shot: '05-qibla',         head: 'Find the {Qibla} — anywhere', sub: 'The prayer direction with a live compass.' },
    { shot: '06-tracker',       head: 'Keep your {streak} — day by day', sub: 'Prayer tracker, streaks and a Qada counter for missed prayers.' },
    { shot: '07-tasbih',        head: 'Count your {Dhikr} — anywhere', sub: 'Digital Tasbih with a daily goal and 7-day history.' },
    { shot: '08-kalender',      head: 'The Islamic {calendar}', sub: 'Hijri dates, holidays and key occasions at a glance.' },
  ],
  ar: [
    { shot: '01-gebetszeiten', head: 'لن تفوّت {صلاة} بعد اليوم', sub: 'مواقيت صلاة دقيقة لموقعك — مع عدّ تنازلي وأذان.' },
    { shot: '02-koran', head: 'كل {القرآن} — قراءة واستماع', sub: 'بترجمة وعرض كلمة بكلمة، ومع عدة قرّاء.' },
    { shot: '03-ki', head: 'إجابات بذكر {المصدر}', sub: 'ذكاء سلاتي الاصطناعي يقتبس حرفيًا من القرآن والحديث والأدعية الموثقة — على جهازك.' },
    { shot: '04-quelle', head: 'من أين تأتي {مواقيتك}', sub: 'الطريقة والزوايا ومذهب العصر بوضوح — أو أدخل أوقات جدول مسجدك.' },
    { shot: '05-qibla', head: '{القبلة} — أينما كنت وفورًا', sub: 'اعثر على اتجاه القبلة ببوصلة حية.' },
    { shot: '06-tracker', head: 'حافظ على {سلسلتك} يومًا بيوم', sub: 'متابعة الصلاة وسلسلة الإنجاز وعدّاد القضاء للصلوات الفائتة.' },
    { shot: '07-tasbih', head: 'عدّ {الذكر} — في أي مكان', sub: 'تسبيح رقمي مع هدف يومي وسجل 7 أيام.' },
    { shot: '08-kalender', head: '{التقويم} الإسلامي', sub: 'التاريخ الهجري والأعياد والمناسبات المهمة بلمحة.' },
  ],
  ur: [
    { shot: '01-gebetszeiten', head: 'کبھی کوئی {نماز} نہ چھوٹے', sub: 'آپ کے مقام کے لیے درست نماز کے اوقات — الٹی گنتی اور اذان کے ساتھ۔' },
    { shot: '02-koran', head: 'مکمل {قرآن} — پڑھیں اور سنیں', sub: 'ترجمہ، لفظ بہ لفظ منظر اور متعدد قاریوں کے ساتھ۔' },
    { shot: '03-ki', head: 'جوابات {ماخذ} کے ساتھ', sub: 'سلاتی اے آئی قرآن، حدیث اور تصدیق شدہ دعاؤں سے لفظاً حوالہ دیتی ہے — آپ کے آلے پر۔' },
    { shot: '04-quelle', head: 'آپ کے {اوقات} کہاں سے آتے ہیں', sub: 'طریقہ، زاویے اور عصر کا مسلک واضح — یا مسجد کے نقشے کے اوقات درج کریں۔' },
    { shot: '05-qibla', head: '{قبلہ} — ہر جگہ اور فوراً', sub: 'لائیو کمپاس کے ساتھ نماز کی سمت معلوم کریں۔' },
    { shot: '06-tracker', head: 'اپنا {سلسلہ} برقرار رکھیں', sub: 'نماز ٹریکر، سلسلہ اور چھوٹی ہوئی نمازوں کے لیے قضا شمار کنندہ۔' },
    { shot: '07-tasbih', head: 'اپنا {ذکر} گنیں — ہر جگہ', sub: 'روزانہ ہدف اور 7 دن کی تاریخ کے ساتھ ڈیجیٹل تسبیح۔' },
    { shot: '08-kalender', head: 'اسلامی {کیلنڈر}', sub: 'ہجری تاریخ، تہوار اور اہم مواقع ایک نظر میں۔' },
  ],
  bn: [
    { shot: '01-gebetszeiten', head: 'আর কখনো {নামাজ} মিস নয়', sub: 'আপনার অবস্থানের জন্য নির্ভুল নামাজের সময় — কাউন্টডাউন ও আজানসহ।' },
    { shot: '02-koran', head: 'পুরো {কুরআন} — পড়ুন ও শুনুন', sub: 'অনুবাদ, শব্দে শব্দে ভিউ ও একাধিক ক্বারিসহ।' },
    { shot: '03-ki', head: '{উৎস} উল্লেখসহ উত্তর', sub: 'সালাতি এআই কুরআন, হাদিস ও যাচাইকৃত দোয়া থেকে হুবহু উদ্ধৃত করে — আপনার ডিভাইসে।' },
    { shot: '04-quelle', head: 'আপনার {সময়} কোথা থেকে আসে', sub: 'পদ্ধতি, কোণ ও আসরের মাযহাব স্পষ্ট — বা মসজিদের তালিকার সময় লিখুন।' },
    { shot: '05-qibla', head: '{কিবলা} — যেকোনো জায়গায় তৎক্ষণাৎ', sub: 'লাইভ কম্পাস দিয়ে নামাজের দিক খুঁজুন।' },
    { shot: '06-tracker', head: 'দিন দিন {ধারা} ধরে রাখুন', sub: 'নামাজ ট্র্যাকার, ধারা ও ছুটে যাওয়া নামাজের জন্য কাজা গণনাকারী।' },
    { shot: '07-tasbih', head: '{জিকির} গুনুন — যেকোনো জায়গায়', sub: 'দৈনিক লক্ষ্য ও ৭ দিনের ইতিহাসসহ ডিজিটাল তসবিহ।' },
    { shot: '08-kalender', head: 'ইসলামি {ক্যালেন্ডার}', sub: 'হিজরি তারিখ, ছুটির দিন ও গুরুত্বপূর্ণ উপলক্ষ্য এক নজরে।' },
  ],
  id: [
    { shot: '01-gebetszeiten', head: 'Jangan pernah lewatkan {salat}', sub: 'Waktu salat akurat untuk lokasimu — dengan hitung mundur & azan.' },
    { shot: '02-koran', head: 'Seluruh {Al-Qur’an} — baca & dengar', sub: 'Dengan terjemahan, kata demi kata, dan beragam qari.' },
    { shot: '03-ki', head: 'Jawaban dengan {sumber}', sub: 'Salati AI mengutip langsung dari Al-Qur’an, hadis & doa terverifikasi — di perangkatmu.' },
    { shot: '04-quelle', head: 'Dari mana {waktu salat} berasal', sub: 'Metode, sudut, dan mazhab Asar terbuka — atau ketik waktu dari jadwal masjidmu.' },
    { shot: '05-qibla', head: '{Kiblat} — di mana saja & langsung', sub: 'Temukan arah kiblat dengan kompas langsung.' },
    { shot: '06-tracker', head: 'Jaga {rentetan} salatmu', sub: 'Pelacak salat, rentetan, dan penghitung qada untuk salat yang terlewat.' },
    { shot: '07-tasbih', head: 'Hitung {dzikir} — di mana saja', sub: 'Tasbih digital dengan target harian dan riwayat 7 hari.' },
    { shot: '08-kalender', head: '{Kalender} Islam', sub: 'Tanggal Hijriah, hari besar, dan momen penting sekali lihat.' },
  ],
  ms: [
    { shot: '01-gebetszeiten', head: 'Jangan terlepas {solat} lagi', sub: 'Waktu solat tepat untuk lokasi anda — dengan kira detik & azan.' },
    { shot: '02-koran', head: 'Seluruh {Al-Quran} — baca & dengar', sub: 'Dengan terjemahan, perkataan demi perkataan, dan pelbagai qari.' },
    { shot: '03-ki', head: 'Jawapan dengan {sumber}', sub: 'Salati AI memetik terus daripada Al-Quran, hadis & doa yang disahkan — pada peranti anda.' },
    { shot: '04-quelle', head: 'Dari mana {waktu solat} anda', sub: 'Kaedah, sudut, dan mazhab Asar didedahkan — atau taip waktu dari jadual masjid anda.' },
    { shot: '05-qibla', head: '{Kiblat} — di mana-mana & segera', sub: 'Cari arah kiblat dengan kompas langsung.' },
    { shot: '06-tracker', head: 'Kekalkan {rentetan} solat anda', sub: 'Penjejak solat, rentetan, dan kaunter qada bagi solat yang tertinggal.' },
    { shot: '07-tasbih', head: 'Kira {zikir} — di mana-mana', sub: 'Tasbih digital dengan sasaran harian dan sejarah 7 hari.' },
    { shot: '08-kalender', head: '{Kalendar} Islam', sub: 'Tarikh Hijrah, cuti, dan detik penting sekali imbas.' },
  ],
  ru: [
    { shot: '01-gebetszeiten', head: 'Больше не пропустите {намаз}', sub: 'Точное время намаза для вашего места — с обратным отсчётом и азаном.' },
    { shot: '02-koran', head: 'Весь {Коран} — читать и слушать', sub: 'С переводом, пословным разбором и разными чтецами.' },
    { shot: '03-ki', head: 'Ответы с {источником}', sub: 'ИИ Salati дословно цитирует Коран, хадисы и проверенные дуа — на вашем устройстве.' },
    { shot: '04-quelle', head: 'Откуда берётся {время намаза}', sub: 'Метод, углы и мазхаб для асра — или введите время с расписания вашей мечети.' },
    { shot: '05-qibla', head: '{Кибла} — везде и сразу', sub: 'Найдите направление киблы с помощью живого компаса.' },
    { shot: '06-tracker', head: 'Держите {серию} день за днём', sub: 'Трекер намазов, серии и счётчик када для пропущенных молитв.' },
    { shot: '07-tasbih', head: 'Считайте {зикр} — везде', sub: 'Цифровой тасбих с дневной целью и историей за 7 дней.' },
    { shot: '08-kalender', head: 'Исламский {календарь}', sub: 'Даты хиджры, праздники и важные события на одном экране.' },
  ],
  es: [
    { shot: '01-gebetszeiten', head: 'Nunca más te pierdas una {oración}', sub: 'Horarios de oración precisos para tu ubicación — con cuenta atrás y Adhan.' },
    { shot: '02-koran', head: 'El {Corán} entero — leer y escuchar', sub: 'Con traducción, palabra por palabra y varios recitadores.' },
    { shot: '03-ki', head: 'Respuestas con {fuente} citada', sub: 'La IA de Salati cita textualmente el Corán, hadices y duas verificadas — en tu dispositivo.' },
    { shot: '04-quelle', head: 'De dónde vienen tus {horarios}', sub: 'Método, ángulo y escuela de Asr, a la vista — o copia el cartel de tu mezquita.' },
    { shot: '05-qibla', head: 'La {Qibla} — al instante, donde sea', sub: 'Encuentra la dirección de la oración con la brújula en vivo.' },
    { shot: '06-tracker', head: 'Mantén tu {racha} — día a día', sub: 'Registro de oración, racha y contador de qada para días pendientes.' },
    { shot: '07-tasbih', head: 'Cuenta tu {Dhikr} — donde sea', sub: 'Tasbih digital con meta diaria e historial de 7 días.' },
    { shot: '08-kalender', head: 'El {calendario} islámico', sub: 'Fecha hijri, festividades y fechas importantes de un vistazo.' },
  ],
  fr: [
    { shot: '01-gebetszeiten', head: 'Ne manquez plus une {prière}', sub: 'Heures de prière précises pour votre lieu — avec compte à rebours et Adhan.' },
    { shot: '02-koran', head: 'Tout le {Coran}, à lire et écouter', sub: 'Avec traduction, mot à mot et plusieurs récitateurs.' },
    { shot: '03-ki', head: 'Réponses avec une {source} citée', sub: 'L’IA Salati cite mot à mot le Coran, les hadiths et douas vérifiés — sur votre appareil.' },
    { shot: '04-quelle', head: 'D’où viennent vos {horaires}', sub: 'Méthode, angle et école pour l’Asr visibles — ou recopiez les horaires de votre mosquée.' },
    { shot: '05-qibla', head: 'La {Qibla} — partout, instantanément', sub: 'Trouvez la direction de la prière avec la boussole en direct.' },
    { shot: '06-tracker', head: 'Gardez votre {série} — jour par jour', sub: 'Suivi des prières, série et compteur de qada pour les jours manqués.' },
    { shot: '07-tasbih', head: 'Comptez vos {Dhikr} — partout', sub: 'Tasbih numérique avec objectif quotidien et historique sur 7 jours.' },
    { shot: '08-kalender', head: 'Le {calendrier} islamique', sub: 'Dates hégiriennes, jours fériés et occasions importantes en un coup d’œil.' },
  ],
  tr: [
    { shot: '01-gebetszeiten', head: 'Artık hiçbir {namazı} kaçırma', sub: 'Bulunduğun yer için doğru namaz vakitleri — geri sayım ve ezanla.' },
    { shot: '02-koran', head: 'Bütün {Kur’an} — oku ve dinle', sub: 'Meal, kelime kelime çeviri ve birden fazla kâriyle.' },
    { shot: '03-ki', head: '{Kaynak} gösteren yanıtlar', sub: 'Salati yapay zekâsı Kur’an, hadis ve dualardan birebir alıntılar yapar — cihazınızda.' },
    { shot: '04-quelle', head: '{Vakitlerin} nereden geldiği', sub: 'Yöntem, açı ve İkindi mezhebi görünür — ya da caminin vakitlerini elle gir.' },
    { shot: '05-qibla', head: '{Kıble} — her yerde, anında', sub: 'Canlı pusulayla namaz yönünü bul.' },
    { shot: '06-tracker', head: '{Serini} sürdür — gün be gün', sub: 'Namaz takibi, seri ve kaçırılan günler için kaza sayacı.' },
    { shot: '07-tasbih', head: '{Zikrini} say — her yerde', sub: 'Günlük hedef ve 7 günlük geçmişle dijital tesbih.' },
    { shot: '08-kalender', head: 'Hicri {takvim}', sub: 'Hicri tarih, dini günler ve önemli tarihler tek bakışta.' },
  ],
};

// Roh-Quelle je Slides-Sprache (Ordner unter store-assets/device/phone/).
export const RAW_LOCALE = { de: 'de-DE', en: 'en-US', ar: 'ar', ur: 'ur', bn: 'bn-BD', id: 'id', ms: 'ms', ru: 'ru-RU', es: 'es-ES', fr: 'fr-FR', tr: 'tr-TR' };
// Nur de/en haben zusaetzlich iPad-Aufnahmen (device/ipad). Fuer die neun
// weiteren Sprachen gibt es ausschliesslich Telefon-Aufnahmen; der App
// Store zeigt dort fuer die iPad-Klasse die Bilder der Primaersprache.

// statusBar: 'ios' zeichnet in render.mjs eine iOS-Statusleiste ueber die
// Android-Statusleiste der Roh-Aufnahmen. Pflicht fuer den App Store
// (Guideline 2.3.10: keine fremden Plattformen in den Screenshots, Ablehnung
// von 1.33.0). Der Play Store bekommt seit 2026-07-29 die ungerahmten
// Original-Aufnahmen (scripts/play-upload-screenshots.mjs) — dort ist die
// Android-Leiste die richtige Plattform.
export const CANVASES = {
  // iPhone 6,7" — Rohaufnahmen store-assets/device/phone (1080x2400)
  appstore: { w: 1290, h: 2796, statusBar: 'ios', geraet: 'phone', shotH: 2400 },
  // iPad Pro 12,9" (APP_IPAD_PRO_3GEN_129) — Rohaufnahmen
  // store-assets/device/ipad (2048x2732). Bis 1.40.0 lagen im App Store fuer
  // diese Klasse noch Bilder MIT Android-Statusleiste; render.mjs zeichnet die
  // iOS-Leiste jetzt auch in Tablet-Massen (Richtlinie 2.3.10).
  appstoreIpad: { w: 2048, h: 2732, statusBar: 'ios', geraet: 'ipad', shotH: 2732 },
};
