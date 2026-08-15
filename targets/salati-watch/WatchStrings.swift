// Sichtbare Texte der watchOS-App in allen 14 App-Sprachen.
//
// WARUM KEINE .lproj/Localizable.strings: @bacons/apple-targets haengt den
// Ziel-Ordner als "file system synchronized group" ins Xcode-Projekt
// (node_modules/@bacons/apple-targets/build/with-xcode-changes.js,
// PBXFileSystemSynchronizedRootGroup) und registriert dabei KEINE
// knownRegions/Localizations. Eine .lproj-Struktur waere damit nicht
// verlaesslich als Lokalisierung erkannt. Eine reine Swift-Tabelle ist
// deterministisch, braucht keine Build-System-Aenderung und kann ohne Mac
// gegengelesen werden.
//
// QUELLE: bis auf "openOnPhone" sind ALLE Zeichenketten woertlich aus
// src/locales/<lang>.json uebernommen (Schluessel s. unten) — hier wurde
// nichts neu uebersetzt. Wird eine dieser Zeichenketten in src/locales
// geaendert, muss sie hier nachgezogen werden.
//
//   navPrayerTimes      nav.prayerTimes
//   navQibla            nav.qibla
//   nextPrayer          prayer.next
//   fajr/dhuhr/asr/maghrib/isha   prayers.*
//   sunrise             settings.timeAdjust.sunrise
//   qiblaDistanceKm     qibla.distanceKm            ({km}-Platzhalter)
//   qiblaBearingInfo    qibla.bearingInfo
//   qiblaNoMagnetometer qibla.noMagnetometer
//   qiblaAligned        qibla.aligned
//   dirN..dirNW         qibla.dir.n|no|o|so|s|sw|w|nw
//   offline             common.offline
//   openOnPhone         (nur hier — kein Pendant in src/locales)
//
// SPRACHWAHL: die Uhr kennt die In-App-Sprachwahl der iPhone-App nicht
// (die liegt in AsyncStorage, nicht in der App-Group). Gewaehlt wird daher
// die Systemsprache der UHR. Weicht die In-App-Sprache davon ab, zeigt die
// Uhr die Systemsprache — dokumentiert in
// docs/audit-2026-07-27/APPLE-WATCH-AUSBAU.md.
//
// GENERIERT aus src/locales/*.json (Stand: siehe git log). Nicht von Hand
// erweitern, ohne den Kommentar oben mitzupflegen.

import SwiftUI

enum WatchStrings {
    /// Sprachcode der Uhr, auf die 14 App-Sprachen reduziert (Fallback: en).
    static let language: String = {
        for tag in Locale.preferredLanguages {
            let code = String(tag.prefix(2)).lowercased()
            if table[code] != nil { return code }
        }
        return "en"
    }()

    /// Rechts-nach-links-Sprachen der App (Arabisch, Farsi, Paschtu, Urdu).
    static var isRTL: Bool { rtlLanguages.contains(language) }

    static func t(_ key: String) -> String {
        table[language]?[key] ?? table["en"]?[key] ?? key
    }

    /// Ersetzt einen einzelnen {name}-Platzhalter (gleiche Konvention wie i18n in der App).
    static func t(_ key: String, _ placeholder: String, _ value: String) -> String {
        t(key).replacingOccurrences(of: "{\(placeholder)}", with: value)
    }

    /// Himmelsrichtung als Wort — spiegelt cardinalKey() aus src/features/qibla/cardinal.ts.
    static func cardinal(_ bearing: Double) -> String {
        let keys = ["dirN", "dirNE", "dirE", "dirSE", "dirS", "dirSW", "dirW", "dirNW"]
        let normalized = (bearing.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        let index = Int((normalized / 45).rounded()) % 8
        return t(keys[index])
    }

    private static let rtlLanguages: Set<String> = ["ar", "fa", "ps", "ur"]

    private static let table: [String: [String: String]] = [
        "ar": [
            "navPrayerTimes": "الصلاة",
            "navQibla": "القبلة",
            "nextPrayer": "الصلاة القادمة",
            "fajr": "الفجر",
            "dhuhr": "الظهر",
            "asr": "العصر",
            "maghrib": "المغرب",
            "isha": "العشاء",
            "sunrise": "الشروق",
            "qiblaDistanceKm": "{km} كم إلى الكعبة",
            "qiblaBearingInfo": "اتجاه الكعبة من موقعك",
            "qiblaNoMagnetometer": "لا يوجد مقياس مغناطيسي في هذا الجهاز - يعتمد الاتجاه على زاوية الكعبة فقط، وليس على اتجاه الجهاز.",
            "qiblaAligned": "الاتجاه صحيح - أنت مواجه للكعبة",
            "dirN": "الشمال",
            "dirNE": "الشمال الشرقي",
            "dirE": "الشرق",
            "dirSE": "الجنوب الشرقي",
            "dirS": "الجنوب",
            "dirSW": "الجنوب الغربي",
            "dirW": "الغرب",
            "dirNW": "الشمال الغربي",
            "offline": "غير متصل - يتم عرض آخر البيانات المحفوظة.",
            "openOnPhone": "افتح التطبيق على الـ iPhone لتحميل مواقيت الصلاة.",
        ],
        "bn": [
            "navPrayerTimes": "নামাজ",
            "navQibla": "কিবলা",
            "nextPrayer": "পরবর্তী নামাজ",
            "fajr": "ফজর",
            "dhuhr": "জোহর",
            "asr": "আসর",
            "maghrib": "মাগরিব",
            "isha": "এশা",
            "sunrise": "সূর্যোদয়",
            "qiblaDistanceKm": "কাবার দূরত্ব {km} কিমি",
            "qiblaBearingInfo": "তোমার অবস্থান থেকে কাবার দিক",
            "qiblaNoMagnetometer": "এই ডিভাইসে কোনো ম্যাগনেটোমিটার পাওয়া যায়নি - দিক শুধু কাবার বিয়ারিং-এর উপর ভিত্তি করে, ডিভাইসের অভিমুখের উপর নয়।",
            "qiblaAligned": "দিক সঠিক - তুমি কাবার দিকে তাকিয়ে আছো",
            "dirN": "উত্তর",
            "dirNE": "উত্তর-পূর্ব",
            "dirE": "পূর্ব",
            "dirSE": "দক্ষিণ-পূর্ব",
            "dirS": "দক্ষিণ",
            "dirSW": "দক্ষিণ-পশ্চিম",
            "dirW": "পশ্চিম",
            "dirNW": "উত্তর-পশ্চিম",
            "offline": "অফলাইন - শেষ সংরক্ষিত তথ্য দেখানো হচ্ছে।",
            "openOnPhone": "নামাজের সময় লোড করতে iPhone-এ অ্যাপটি খুলুন।",
        ],
        "de": [
            "navPrayerTimes": "Gebet",
            "navQibla": "Qibla",
            "nextPrayer": "Nächstes Gebet",
            "fajr": "Fajr",
            "dhuhr": "Dhuhr",
            "asr": "Asr",
            "maghrib": "Maghrib",
            "isha": "Isha",
            "sunrise": "Sonnenaufgang",
            "qiblaDistanceKm": "{km} km bis zur Kaaba",
            "qiblaBearingInfo": "Bearing zur Kaaba ab deinem Standort",
            "qiblaNoMagnetometer": "Kein Magnetometer auf diesem Gerät gefunden - Richtung basiert nur auf dem Kaaba-Bearing, nicht auf der Geräte-Ausrichtung.",
            "qiblaAligned": "Richtung stimmt - du blickst zur Kaaba",
            "dirN": "Norden",
            "dirNE": "Nordosten",
            "dirE": "Osten",
            "dirSE": "Südosten",
            "dirS": "Süden",
            "dirSW": "Südwesten",
            "dirW": "Westen",
            "dirNW": "Nordwesten",
            "offline": "Offline - zuletzt gespeicherte Daten werden angezeigt.",
            "openOnPhone": "Auf dem iPhone öffnen, um Gebetszeiten zu laden.",
        ],
        "en": [
            "navPrayerTimes": "Prayer",
            "navQibla": "Qibla",
            "nextPrayer": "Next prayer",
            "fajr": "Fajr",
            "dhuhr": "Dhuhr",
            "asr": "Asr",
            "maghrib": "Maghrib",
            "isha": "Isha",
            "sunrise": "Sunrise",
            "qiblaDistanceKm": "{km} km to the Kaaba",
            "qiblaBearingInfo": "Bearing to the Kaaba from your location",
            "qiblaNoMagnetometer": "No magnetometer found on this device - the direction is based only on the Kaaba bearing, not on device orientation.",
            "qiblaAligned": "Aligned - you are facing the Kaaba",
            "dirN": "north",
            "dirNE": "northeast",
            "dirE": "east",
            "dirSE": "southeast",
            "dirS": "south",
            "dirSW": "southwest",
            "dirW": "west",
            "dirNW": "northwest",
            "offline": "Offline - showing last saved data.",
            "openOnPhone": "Open the app on your iPhone to load prayer times.",
        ],
        "es": [
            "navPrayerTimes": "Oración",
            "navQibla": "Qibla",
            "nextPrayer": "Próxima oración",
            "fajr": "Fajr",
            "dhuhr": "Dhuhr",
            "asr": "Asr",
            "maghrib": "Maghrib",
            "isha": "Isha",
            "sunrise": "Amanecer",
            "qiblaDistanceKm": "{km} km hasta la Kaaba",
            "qiblaBearingInfo": "Rumbo a la Kaaba desde tu ubicación",
            "qiblaNoMagnetometer": "No se encontró magnetómetro en este dispositivo - la dirección se basa solo en el rumbo a la Kaaba, no en la orientación del dispositivo.",
            "qiblaAligned": "Alineado: estás mirando hacia la Kaaba",
            "dirN": "norte",
            "dirNE": "noreste",
            "dirE": "este",
            "dirSE": "sureste",
            "dirS": "sur",
            "dirSW": "suroeste",
            "dirW": "oeste",
            "dirNW": "noroeste",
            "offline": "Sin conexión - mostrando los últimos datos guardados.",
            "openOnPhone": "Abre la app en el iPhone para cargar los horarios de oración.",
        ],
        "fa": [
            "navPrayerTimes": "نماز",
            "navQibla": "قبله",
            "nextPrayer": "نماز بعدی",
            "fajr": "فجر",
            "dhuhr": "ظهر",
            "asr": "عصر",
            "maghrib": "مغرب",
            "isha": "عشاء",
            "sunrise": "طلوع آفتاب",
            "qiblaDistanceKm": "{km} کیلومتر تا کعبه",
            "qiblaBearingInfo": "جهت به کعبه از موقعیت تو",
            "qiblaNoMagnetometer": "هیچ مغناطیس‌سنجی روی این دستگاه یافت نشد - جهت فقط بر اساس زاویه به کعبه است، نه جهت‌گیری دستگاه.",
            "qiblaAligned": "جهت درست است - رو به کعبه هستی",
            "dirN": "شمال",
            "dirNE": "شمال شرقی",
            "dirE": "شرق",
            "dirSE": "جنوب شرقی",
            "dirS": "جنوب",
            "dirSW": "جنوب غربی",
            "dirW": "غرب",
            "dirNW": "شمال غربی",
            "offline": "آفلاین - آخرین داده‌های ذخیره‌شده نمایش داده می‌شود.",
            "openOnPhone": "برای بارگذاری اوقات نماز، برنامه را روی iPhone باز کن.",
        ],
        "fr": [
            "navPrayerTimes": "Prière",
            "navQibla": "Qibla",
            "nextPrayer": "Prochaine prière",
            "fajr": "Fajr",
            "dhuhr": "Dhuhr",
            "asr": "Asr",
            "maghrib": "Maghrib",
            "isha": "Isha",
            "sunrise": "Lever du soleil",
            "qiblaDistanceKm": "{km} km jusqu'à la Kaaba",
            "qiblaBearingInfo": "Cap vers la Kaaba depuis votre position",
            "qiblaNoMagnetometer": "Aucun magnétomètre détecté sur cet appareil - la direction repose uniquement sur le cap vers la Kaaba, pas sur l'orientation de l'appareil.",
            "qiblaAligned": "Aligné - tu fais face à la Kaaba",
            "dirN": "nord",
            "dirNE": "nord-est",
            "dirE": "est",
            "dirSE": "sud-est",
            "dirS": "sud",
            "dirSW": "sud-ouest",
            "dirW": "ouest",
            "dirNW": "nord-ouest",
            "offline": "Hors ligne - affichage des dernières données enregistrées.",
            "openOnPhone": "Ouvre l'app sur l'iPhone pour charger les horaires de prière.",
        ],
        "id": [
            "navPrayerTimes": "Salat",
            "navQibla": "Kiblat",
            "nextPrayer": "Salat berikutnya",
            "fajr": "Subuh",
            "dhuhr": "Zuhur",
            "asr": "Asar",
            "maghrib": "Magrib",
            "isha": "Isya",
            "sunrise": "Matahari terbit",
            "qiblaDistanceKm": "{km} km menuju Kakbah",
            "qiblaBearingInfo": "Arah ke Kakbah dari lokasimu",
            "qiblaNoMagnetometer": "Tidak ditemukan magnetometer di perangkat ini - arah hanya berdasarkan bearing ke Kakbah, bukan orientasi perangkat.",
            "qiblaAligned": "Arah sudah tepat - kamu menghadap ke Kakbah",
            "dirN": "Utara",
            "dirNE": "Timur Laut",
            "dirE": "Timur",
            "dirSE": "Tenggara",
            "dirS": "Selatan",
            "dirSW": "Barat Daya",
            "dirW": "Barat",
            "dirNW": "Barat Laut",
            "offline": "Offline - menampilkan data terakhir yang tersimpan.",
            "openOnPhone": "Buka aplikasi di iPhone untuk memuat jadwal salat.",
        ],
        "ms": [
            "navPrayerTimes": "Solat",
            "navQibla": "Kiblat",
            "nextPrayer": "Solat seterusnya",
            "fajr": "Subuh",
            "dhuhr": "Zohor",
            "asr": "Asar",
            "maghrib": "Maghrib",
            "isha": "Isyak",
            "sunrise": "Matahari terbit",
            "qiblaDistanceKm": "{km} km ke Kaabah",
            "qiblaBearingInfo": "Arah ke Kaabah dari lokasi anda",
            "qiblaNoMagnetometer": "Tiada magnetometer dijumpai pada peranti ini - arah hanya berdasarkan bearing ke Kaabah, bukan orientasi peranti.",
            "qiblaAligned": "Arah adalah betul - anda menghadap ke Kaabah",
            "dirN": "Utara",
            "dirNE": "Timur Laut",
            "dirE": "Timur",
            "dirSE": "Tenggara",
            "dirS": "Selatan",
            "dirSW": "Barat Daya",
            "dirW": "Barat",
            "dirNW": "Barat Laut",
            "offline": "Luar talian - data terakhir yang disimpan dipaparkan.",
            "openOnPhone": "Buka aplikasi pada iPhone untuk memuatkan waktu solat.",
        ],
        "ps": [
            "navPrayerTimes": "لمونځ",
            "navQibla": "قبله",
            "nextPrayer": "راتلونکی لمونځ",
            "fajr": "فجر",
            "dhuhr": "ماسپخین",
            "asr": "مازیګر",
            "maghrib": "ماښام",
            "isha": "ماخستن",
            "sunrise": "لمر خاته",
            "qiblaDistanceKm": "تر کعبې پورې {km} کیلومتره",
            "qiblaBearingInfo": "ستاسو له موقعیت څخه کعبې ته لور",
            "qiblaNoMagnetometer": "پدې ډیوایس کې هیڅ مقناطیس پیمانه ونه موندل شوه - لور یوازې د کعبې پر اړخ بنسټ لري، نه د ډیوایس لور.",
            "qiblaAligned": "لور سم دی - تاسو کعبې ته اړوند یاست",
            "dirN": "شمال",
            "dirNE": "شمال ختیځ",
            "dirE": "ختیځ",
            "dirSE": "جنوب ختیځ",
            "dirS": "جنوب",
            "dirSW": "جنوب لویدیځ",
            "dirW": "لویدیځ",
            "dirNW": "شمال لویدیځ",
            "offline": "آفلاین - وروستي ثبت شوي معلومات ښودل کیږي.",
            "openOnPhone": "د لمانځه وختونه بارولو لپاره اپلیکیشن په iPhone کې پرانیزئ.",
        ],
        "ru": [
            "navPrayerTimes": "Намаз",
            "navQibla": "Кибла",
            "nextPrayer": "Следующий намаз",
            "fajr": "Фаджр",
            "dhuhr": "Зухр",
            "asr": "Аср",
            "maghrib": "Магриб",
            "isha": "Иша",
            "sunrise": "Восход",
            "qiblaDistanceKm": "{km} км до Каабы",
            "qiblaBearingInfo": "Направление к Каабе от вашего местоположения",
            "qiblaNoMagnetometer": "На этом устройстве не найден магнитометр - направление основано только на азимуте к Каабе, а не на ориентации устройства.",
            "qiblaAligned": "Направление верное - вы смотрите на Каабу",
            "dirN": "Север",
            "dirNE": "Северо-восток",
            "dirE": "Восток",
            "dirSE": "Юго-восток",
            "dirS": "Юг",
            "dirSW": "Юго-запад",
            "dirW": "Запад",
            "dirNW": "Северо-запад",
            "offline": "Офлайн - показаны последние сохранённые данные.",
            "openOnPhone": "Откройте приложение на iPhone, чтобы загрузить время молитв.",
        ],
        "sw": [
            "navPrayerTimes": "Sala",
            "navQibla": "Kibla",
            "nextPrayer": "Sala inayofuata",
            "fajr": "Fajr",
            "dhuhr": "Dhuhr",
            "asr": "Asr",
            "maghrib": "Maghrib",
            "isha": "Isha",
            "sunrise": "Macheo",
            "qiblaDistanceKm": "Kilomita {km} hadi Kaaba",
            "qiblaBearingInfo": "Mwelekeo wa Al-Kaaba kutoka eneo lako",
            "qiblaNoMagnetometer": "Hakuna kipima sumaku kilichopatikana kwenye kifaa hiki - mwelekeo unategemea tu mwelekeo wa Al-Kaaba, si mwelekeo wa kifaa.",
            "qiblaAligned": "Mwelekeo ni sahihi - unaelekea Al-Kaaba",
            "dirN": "Kaskazini",
            "dirNE": "Kaskazini Mashariki",
            "dirE": "Mashariki",
            "dirSE": "Kusini Mashariki",
            "dirS": "Kusini",
            "dirSW": "Kusini Magharibi",
            "dirW": "Magharibi",
            "dirNW": "Kaskazini Magharibi",
            "offline": "Nje ya mtandao - data ya mwisho iliyohifadhiwa inaonyeshwa.",
            "openOnPhone": "Fungua programu kwenye iPhone ili kupakia nyakati za sala.",
        ],
        "tr": [
            "navPrayerTimes": "Namaz",
            "navQibla": "Kıble",
            "nextPrayer": "Sonraki namaz",
            "fajr": "Sabah",
            "dhuhr": "Öğle",
            "asr": "İkindi",
            "maghrib": "Akşam",
            "isha": "Yatsı",
            "sunrise": "Güneş doğuşu",
            "qiblaDistanceKm": "Kâbe'ye {km} km",
            "qiblaBearingInfo": "Bulunduğun yerden Kâbe yönü",
            "qiblaNoMagnetometer": "Bu cihazda manyetometre bulunamadı - yön yalnızca Kâbe açısına dayanır, cihaz yönüne değil.",
            "qiblaAligned": "Yön doğru - Kâbe'ye bakıyorsun",
            "dirN": "kuzey",
            "dirNE": "kuzeydoğu",
            "dirE": "doğu",
            "dirSE": "güneydoğu",
            "dirS": "güney",
            "dirSW": "güneybatı",
            "dirW": "batı",
            "dirNW": "kuzeybatı",
            "offline": "Çevrimdışı - son kaydedilen veriler gösteriliyor.",
            "openOnPhone": "Namaz vakitlerini yüklemek için uygulamayı iPhone'da aç.",
        ],
        "ur": [
            "navPrayerTimes": "نماز",
            "navQibla": "قبلہ",
            "nextPrayer": "اگلی نماز",
            "fajr": "فجر",
            "dhuhr": "ظہر",
            "asr": "عصر",
            "maghrib": "مغرب",
            "isha": "عشاء",
            "sunrise": "طلوع آفتاب",
            "qiblaDistanceKm": "کعبہ تک {km} کلومیٹر",
            "qiblaBearingInfo": "آپ کے مقام سے کعبہ کی سمت",
            "qiblaNoMagnetometer": "اس آلے میں کوئی میگنیٹومیٹر نہیں ملا - سمت صرف کعبہ کی جانب زاویے پر مبنی ہے، آلے کی سمت پر نہیں۔",
            "qiblaAligned": "سمت درست ہے - آپ کعبہ کی طرف ہیں",
            "dirN": "شمال",
            "dirNE": "شمال مشرق",
            "dirE": "مشرق",
            "dirSE": "جنوب مشرق",
            "dirS": "جنوب",
            "dirSW": "جنوب مغرب",
            "dirW": "مغرب",
            "dirNW": "شمال مغرب",
            "offline": "آف لائن - آخری محفوظ شدہ ڈیٹا دکھایا جا رہا ہے۔",
            "openOnPhone": "نماز کے اوقات لوڈ کرنے کے لیے ایپ کو iPhone پر کھولیں۔",
        ],
    ]
}
