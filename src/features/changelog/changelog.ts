// Datenquelle für den "Was ist neu"-Screen (src/app/changelog.tsx).
//
// Sprachabdeckung (User-Entscheidung, siehe Session-Bericht): Texte liegen
// vollständig auf Deutsch + Englisch vor. Für die übrigen 12 App-Sprachen
// gibt es bewusst KEINE separate Übersetzung — getChangelogText() fällt für
// jede Sprache außer 'de' auf Englisch zurück. Grund: 33 Versionen x bis zu
// 4 Einträge x 12 Sprachen wäre reine Fleißarbeit ohne Mehrwert gegenüber
// einem sauberen Englisch-Fallback (bei einer 100%-lokalen Islam-App lesen
// die allermeisten Nutzer ohnehin Englisch als Zweitsprache im Store).
//
// Reihenfolge hier: aufsteigend (älteste zuerst) - der Screen dreht die
// Liste für die Anzeige um (neueste Version oben).

export type ChangelogEntryType = 'feature' | 'improvement' | 'fix';

export interface ChangelogEntry {
  type: ChangelogEntryType;
  de: string;
  en: string;
}

export interface ChangelogVersion {
  version: string;
  /** ISO-Datum (YYYY-MM-DD) */
  date: string;
  entries: ChangelogEntry[];
}

export const CHANGELOG: ChangelogVersion[] = [
  {
    version: '1.0.0',
    date: '2026-07-12',
    entries: [
      {
        type: 'feature',
        de: 'Erstveröffentlichung: Gebetszeiten, Qibla-Kompass, Koran-Reader, islamischer Kalender und Duas – komplett werbefrei',
        en: 'First release: prayer times, Qibla compass, Quran reader, Islamic calendar and duas – completely ad-free',
      },
      {
        type: 'feature',
        de: 'Hadith-Sammlung, erweiterte Einstellungen und ein Moschee-Finder in der Nähe',
        en: 'Hadith collection, advanced settings and a nearby mosque finder',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-07-12',
    entries: [
      {
        type: 'feature',
        de: 'Neues Lernmodul für die arabische Schrift (Alif-Ba-Kurs)',
        en: 'New learning module for the Arabic alphabet (Alif-Ba course)',
      },
      {
        type: 'feature',
        de: 'Koran-Rezitation zum Anhören und Vorlesefunktion (Text-zu-Sprache)',
        en: 'Quran recitation audio and text-to-speech read-aloud',
      },
      {
        type: 'feature',
        de: 'Quiz-Bereich mit 9 verschiedenen Spielmodi',
        en: 'Quiz hub with 9 different game modes',
      },
      {
        type: 'feature',
        de: 'Hifz-Trainer zum Auswendiglernen und digitaler Tasbih-Zähler',
        en: 'Hifz memorization trainer and digital Tasbih counter',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-07-13',
    entries: [
      {
        type: 'feature',
        de: 'Gebets-Anleitungen (Guides) und tägliche Weisheiten',
        en: 'Step-by-step prayer guides and daily wisdom quotes',
      },
      { type: 'feature', de: 'Tafsir (Koran-Auslegung) ergänzt', en: 'Tafsir (Quran commentary) added' },
      {
        type: 'improvement',
        de: 'App jetzt auch auf Spanisch und Französisch verfügbar',
        en: 'App now also available in Spanish and French',
      },
      { type: 'feature', de: '30 neue Quizfragen', en: '30 new quiz questions' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-07-13',
    entries: [
      {
        type: 'feature',
        de: 'Gebets-Tracker, Fasten-Modus für den Ramadan und Khatmah-Leseplan zum Koran-Durchlesen',
        en: 'Prayer tracker, Ramadan fasting mode and Khatmah plan for reading the whole Quran',
      },
      {
        type: 'feature',
        de: 'Zakat-Rechner und die 99 Namen Allahs',
        en: 'Zakat calculator and the 99 Names of Allah',
      },
      {
        type: 'feature',
        de: 'Halal-Finder in der Nähe und Koran-Audio zum Offline-Hören',
        en: 'Nearby halal finder and offline Quran audio downloads',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-07-15',
    entries: [
      {
        type: 'feature',
        de: 'Neuer Studienbereich: Arabisch-Grammatikkurs',
        en: 'New Study section: Arabic grammar course',
      },
      {
        type: 'feature',
        de: 'Alle 42 Hadithe der Nawawi-40-Sammlung',
        en: 'All 42 hadiths of the Nawawi-40 collection',
      },
      {
        type: 'improvement',
        de: 'Einstufungstest: direkt mit der passenden Lektion starten statt immer bei Lektion 1',
        en: 'Placement test: start at the right lesson instead of always lesson 1',
      },
      {
        type: 'feature',
        de: 'Neuer Kurs für den arabischen Alltagswortschatz',
        en: 'New course for everyday Arabic vocabulary',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-07-15',
    entries: [
      {
        type: 'feature',
        de: 'Kompletter Madinah-Arabisch-Kurs: alle 4 Bücher mit 83 Lektionen für die klassische arabische Grammatik',
        en: 'Complete Madinah Arabic course: all 4 books, 83 lessons of classical Arabic grammar',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-07-15',
    entries: [
      {
        type: 'improvement',
        de: 'Aqida-Kurs (Glaubenslehre) deutlich vertieft',
        en: 'Aqida (creed) course significantly expanded',
      },
      {
        type: 'feature',
        de: 'Neue Kurse: Gefährten & Gelehrte des Propheten sowie Fiqh der Ehe & Familie',
        en: 'New courses: Companions & Scholars of the Prophet, and Family & Marriage Fiqh',
      },
      {
        type: 'feature',
        de: 'Neuer Erbrechts-Rechner (Mirath) nach islamischem Recht',
        en: 'New Islamic inheritance calculator (Mirath)',
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-07-16',
    entries: [
      {
        type: 'feature',
        de: 'Koran-Reader großes Update: Umschrift, isolierte Buchstabenformen, englisches Tafsir, Wort-für-Wort-Übersetzung, farbige Tajweed-Regeln und Volltextsuche',
        en: 'Major Quran reader update: transliteration, isolated letter forms, English tafsir, word-by-word translation, color-coded Tajweed rules and full-text search',
      },
      {
        type: 'feature',
        de: 'Hadith-Bibliothek erweitert (Riyad as-Salihin, Bulugh al-Maram, Al-Adab Al-Mufrad) mit Kapitel-Browsing',
        en: 'Hadith library expanded (Riyad as-Salihin, Bulugh al-Maram, Al-Adab Al-Mufrad) with chapter browsing',
      },
      {
        type: 'feature',
        de: 'Neue Kurse: Charakter/Akhlaq und arabische Dialekte',
        en: 'New courses: Character/Akhlaq and Arabic dialects',
      },
    ],
  },
  {
    version: '1.7.1',
    date: '2026-07-16',
    entries: [
      {
        type: 'improvement',
        de: 'App jetzt optimiert für Tablets und faltbare Geräte',
        en: 'App now optimized for tablets and foldable devices',
      },
      {
        type: 'fix',
        de: 'Bedienungshilfen (Screenreader) an vielen Stellen in der App nachgerüstet',
        en: 'Accessibility (screen reader) support added throughout the app',
      },
      {
        type: 'feature',
        de: 'Impressum und Datenschutzerklärung in der App ergänzt',
        en: 'Legal notice and privacy policy added to the app',
      },
      {
        type: 'fix',
        de: 'Automatischer Dunkelmodus auf der Webseite behoben',
        en: 'Fixed automatic dark mode on the website',
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-07-16',
    entries: [
      {
        type: 'feature',
        de: 'Eigene Notizen zu einzelnen Koran-Versen möglich',
        en: 'Personal notes on individual Quran verses',
      },
      {
        type: 'feature',
        de: 'Tägliche Lernserie (Streak) über alle Kurse hinweg',
        en: 'Daily learning streak across all courses',
      },
      {
        type: 'feature',
        de: 'Wiederholungs-Erinnerungen nach der Spaced-Repetition-Methode',
        en: 'Spaced-repetition review reminders',
      },
      { type: 'feature', de: '"Hadith des Tages"', en: '"Hadith of the Day"' },
    ],
  },
  {
    version: '1.8.1',
    date: '2026-07-16',
    entries: [
      {
        type: 'improvement',
        de: 'Webseite komplett neu gestaltet mit Animationen und echten Moschee-Fotos',
        en: 'Website redesigned with animations and real mosque photography',
      },
      {
        type: 'fix',
        de: 'Geteilte Links öffnen jetzt zuverlässig die richtige Seite',
        en: 'Shared links now reliably open the correct page',
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-07-16',
    entries: [
      {
        type: 'improvement',
        de: 'Aussprache-Check verbessert: Wort-für-Wort-Feedback und ehrliche Tajweed-Hinweise',
        en: 'Pronunciation check improved: word-by-word feedback and honest Tajweed hints',
      },
      {
        type: 'feature',
        de: 'Koran-Reader neu gestaltet mit übersichtlicherem Kopfbereich',
        en: 'Quran reader redesigned with a cleaner header',
      },
      {
        type: 'feature',
        de: 'Koran-Radio und Hadith-Suche über alle 13 Sammlungen',
        en: 'Quran radio and hadith search across all 13 collections',
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-07-17',
    entries: [
      { type: 'feature', de: 'Homescreen-Widgets für Android', en: 'Android home screen widgets' },
      {
        type: 'improvement',
        de: 'Qibla-Kompass und Gebetszeiten-Startseite neu gestaltet',
        en: 'Qibla compass and prayer times home screen redesigned',
      },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-07-17',
    entries: [
      {
        type: 'feature',
        de: 'Gebets-Benachrichtigungen: 7-Tage-Planung mit Ton und Vibration',
        en: 'Prayer notifications: 7-day scheduling with sound and vibration',
      },
      {
        type: 'feature',
        de: 'Fokus-Lesemodus mit warmem Sepia-Papierton für den Koran-Reader',
        en: 'Focus reading mode with warm sepia paper tone for the Quran reader',
      },
      {
        type: 'feature',
        de: 'Morgen- und Abend-Adhkar-Erinnerungen',
        en: 'Morning and evening Adhkar reminders',
      },
      {
        type: 'feature',
        de: 'Gebetszeiten als Kalender exportieren (ICS)',
        en: 'Export prayer times to your calendar (ICS)',
      },
    ],
  },
  {
    version: '1.12.0',
    date: '2026-07-17',
    entries: [
      {
        type: 'feature',
        de: 'Zwei neue Übungsarten: Satz-Puzzle und Paare finden',
        en: 'Two new exercise types: Sentence Puzzle and Matching Pairs',
      },
      {
        type: 'feature',
        de: 'Quiz-Duell: gegen eine zweite Person am selben Gerät antreten',
        en: 'Quiz Duel: compete against a second person on the same device',
      },
      {
        type: 'feature',
        de: 'Mushaf-Seitenansicht mit den 604 klassischen Druckseiten',
        en: 'Mushaf page view with the 604 classic print pages',
      },
    ],
  },
  {
    version: '1.13.0',
    date: '2026-07-17',
    entries: [
      {
        type: 'feature',
        de: 'Salati KI: Islam-Fragen 100% lokal auf dem Gerät beantwortet, ganz ohne Internet',
        en: 'Salati AI: Islamic questions answered 100% on-device, no internet needed',
      },
      {
        type: 'feature',
        de: 'Verse und Gebets-Statistiken als Bild teilen',
        en: 'Share verses and prayer stats as an image',
      },
      {
        type: 'feature',
        de: 'Lesezeichen-Sammlungen: Favoriten, Auswendiglernen, zum Nachdenken',
        en: 'Bookmark collections: favorites, memorizing, reflecting',
      },
    ],
  },
  {
    version: '1.14.0',
    date: '2026-07-17',
    entries: [
      {
        type: 'improvement',
        de: 'Salati KI deutlich schlauer und trifft Antworten präziser',
        en: 'Salati AI significantly smarter and more accurate',
      },
      {
        type: 'feature',
        de: 'Wort antippen im Mushaf zeigt sofort Übersetzung und Umschrift',
        en: 'Tap a word in the Mushaf to instantly see its translation and transliteration',
      },
      {
        type: 'feature',
        de: 'Halal/Haram-Scanner: Barcode scannen und Produkt prüfen',
        en: 'Halal/Haram scanner: scan a barcode to check a product',
      },
    ],
  },
  {
    version: '1.14.1',
    date: '2026-07-17',
    entries: [
      {
        type: 'improvement',
        de: 'Studienbereich neu sortiert nach Kategorien',
        en: 'Study section reorganized by category',
      },
      {
        type: 'feature',
        de: 'Dauerhafte Anzeige der nächsten Gebetszeit als Benachrichtigung (optional)',
        en: 'Persistent next-prayer-time notification (optional)',
      },
      {
        type: 'fix',
        de: 'Eigenes Fehler-Log mit Kopieren-Button für Support-Anfragen',
        en: 'Local error log with a copy button for support requests',
      },
    ],
  },
  {
    version: '1.15.0',
    date: '2026-07-18',
    entries: [
      {
        type: 'feature',
        de: 'Wort-Lexikon: Bedeutung und Tajweed-Grund direkt beim Antippen',
        en: 'Word lexicon: meaning and Tajweed reason right on tap',
      },
      {
        type: 'feature',
        de: 'Streak-Schutz: ein Joker pro Woche rettet die Lernserie',
        en: 'Streak freeze: one joker per week protects your learning streak',
      },
      {
        type: 'feature',
        de: 'Abzeichen-System und thematische Vers-Sammlungen',
        en: 'Achievement badges and thematic verse collections',
      },
      {
        type: 'improvement',
        de: 'Mushaf: Doppelseiten-Ansicht mit Khatmah-Fortschrittsanzeige',
        en: 'Mushaf: two-page view with Khatmah progress tracking',
      },
    ],
  },
  {
    version: '1.15.1',
    date: '2026-07-18',
    entries: [
      {
        type: 'feature',
        de: 'Qada-Zähler für nachzuholende Fastentage',
        en: 'Qada counter for make-up fasting days',
      },
      { type: 'feature', de: 'Jährliche Zakat-Erinnerung', en: 'Annual Zakat reminder' },
      {
        type: 'feature',
        de: "Reise-Modus: Hinweis auf verkürztes/zusammengelegtes Gebet (Qasr/Jam')",
        en: "Travel mode: reminder for shortened/combined prayers (Qasr/Jam')",
      },
      {
        type: 'fix',
        de: 'Screenshot-Galerie auf der Webseite scrollt jetzt wirklich',
        en: 'Screenshot gallery on the website now actually scrolls',
      },
    ],
  },
  {
    version: '1.16.0',
    date: '2026-07-18',
    entries: [
      {
        type: 'feature',
        de: '8 neue Sprachen: Indonesisch, Bengalisch, Persisch, Malaiisch, Urdu, Russisch, Swahili, Paschtu – jetzt 14 Sprachen insgesamt',
        en: '8 new languages: Indonesian, Bengali, Persian, Malay, Urdu, Russian, Swahili, Pashto – now 14 languages in total',
      },
      {
        type: 'improvement',
        de: 'Volle Unterstützung für rechts-nach-links-Sprachen (Arabisch, Urdu, Persisch, Paschtu)',
        en: 'Full right-to-left support (Arabic, Urdu, Persian, Pashto)',
      },
      {
        type: 'improvement',
        de: 'Alle Kurse, Duas und Inhalte in allen 14 Sprachen verfügbar',
        en: 'All courses, duas and content available in all 14 languages',
      },
    ],
  },
  {
    version: '1.16.1',
    date: '2026-07-19',
    entries: [
      {
        type: 'fix',
        de: 'Zurück-Pfeile und Menüs in rechts-nach-links-Sprachen richtig gespiegelt',
        en: 'Back arrows and menus correctly mirrored in right-to-left languages',
      },
      {
        type: 'feature',
        de: 'Salati KI: Themen-Browser und Arabisch-Modus',
        en: 'Salati AI: topic browser and Arabic mode',
      },
      {
        type: 'improvement',
        de: 'Kennzeichnung von KI-Antworten als KI-generiert (keine Fatwa)',
        en: 'AI answers labeled as AI-generated (not a fatwa)',
      },
    ],
  },
  {
    version: '1.17.0',
    date: '2026-07-19',
    entries: [
      {
        type: 'feature',
        de: 'Neues Erststart-Onboarding für neue Nutzer',
        en: 'New first-launch onboarding for new users',
      },
      {
        type: 'improvement',
        de: 'Store-Eintrag aktualisiert mit korrekten Lektions- und Sprachzahlen',
        en: 'Store listing updated with accurate lesson and language counts',
      },
    ],
  },
  {
    version: '1.17.1',
    date: '2026-07-19',
    entries: [
      {
        type: 'fix',
        de: 'Großer Audit: zahlreiche Design- und Bedienungshilfen-Fehler app-weit behoben',
        en: 'Major audit: numerous design and accessibility issues fixed app-wide',
      },
      { type: 'feature', de: '99-Namen-Lernquiz', en: '99 Names learning quiz' },
      {
        type: 'improvement',
        de: 'Tasbih-Zähler erweitert: eigenes Dhikr, Fortschrittsring, Ziel-Vibration',
        en: 'Tasbih counter expanded: custom dhikr, progress ring, goal vibration',
      },
    ],
  },
  {
    version: '1.18.0',
    date: '2026-07-19',
    entries: [
      {
        type: 'feature',
        de: 'Dua-Sammlung fast verdreifacht: jetzt 89 Bittgebete für Wetter, Kleidung, Reise, Krankheit, Familie und mehr',
        en: 'Dua collection nearly tripled: now 89 supplications for weather, clothing, travel, illness, family and more',
      },
    ],
  },
  {
    version: '1.19.0',
    date: '2026-07-19',
    entries: [
      {
        type: 'feature',
        de: 'Themen-Lesepläne: geführte Tages-Reisen zu Themen wie Ramadan-Vorbereitung, Trauer, Prüfungszeit und Versorgung (Rizq)',
        en: 'Thematic reading Journeys: guided day-by-day plans on topics like Ramadan prep, grief, exam time and provision (Rizq)',
      },
    ],
  },
  {
    version: '1.19.1',
    date: '2026-07-20',
    entries: [
      {
        type: 'improvement',
        de: 'Startbildschirm neu geordnet, Kalender-Zugriff vereinfacht',
        en: 'Home screen reorganized, calendar access simplified',
      },
      {
        type: 'feature',
        de: 'Globaler Mini-Player für laufende Rezitationen',
        en: 'Global mini player for ongoing recitations',
      },
      {
        type: 'improvement',
        de: 'Rezitations-Check läuft jetzt nativ auf dem Gerät – schneller und genauer',
        en: 'Recitation check now runs natively on-device – faster and more accurate',
      },
    ],
  },
  {
    version: '1.20.0',
    date: '2026-07-20',
    entries: [
      {
        type: 'feature',
        de: 'Offline-Verwaltung: einzelne Rezitatoren zum Offline-Hören herunterladen und wieder löschen',
        en: 'Offline manager: download individual reciters for offline listening and remove them again',
      },
      { type: 'feature', de: 'Eigenes App-Icon und App-Name', en: 'Custom app icon and app name' },
      {
        type: 'improvement',
        de: 'Studieninhalte laden schneller beim App-Start',
        en: 'Study content now loads faster on app start',
      },
    ],
  },
  {
    version: '1.20.1',
    date: '2026-07-20',
    entries: [
      {
        type: 'improvement',
        de: 'Einstellungen und Gebetszeiten-Bildschirm visuell überarbeitet (Icons, Gruppierung)',
        en: 'Settings and prayer times screen visually reworked (icons, grouping)',
      },
      {
        type: 'feature',
        de: 'Suren-übergreifende Wiedergabe im Koran-Reader',
        en: 'Cross-Surah continuous playback in the Quran reader',
      },
    ],
  },
  {
    version: '1.21.0',
    date: '2026-07-21',
    entries: [
      {
        type: 'feature',
        de: 'Fortschritt exportieren und importieren – Backup ohne Cloud-Zwang',
        en: 'Export and import your progress – backup without a cloud account',
      },
      { type: 'feature', de: 'Verse und Hadithe als Bild teilen', en: 'Share verses and hadiths as an image' },
      {
        type: 'feature',
        de: 'Neue Speicherverwaltung: sehen und löschen, was wie viel Platz braucht',
        en: "New storage management screen: see and clear what's taking up space",
      },
    ],
  },
  {
    version: '1.22.0',
    date: '2026-07-21',
    entries: [
      {
        type: 'feature',
        de: 'Suhoor-/Iftar-Countdown-Karte für den Ramadan',
        en: 'Suhoor/Iftar countdown card for Ramadan',
      },
      {
        type: 'feature',
        de: 'Zakat-Rechner nutzt jetzt den aktuellen Goldpreis live',
        en: 'Zakat calculator now uses the live gold price',
      },
      {
        type: 'feature',
        de: 'Neue app-weite Suche über Koran, Hadithe, Duas und Kurse',
        en: 'New app-wide search across Quran, hadiths, duas and courses',
      },
    ],
  },
  {
    version: '1.23.0',
    date: '2026-07-21',
    entries: [
      { type: 'feature', de: 'Zakat al-Fitr-Rechner', en: 'Zakat al-Fitr calculator' },
      {
        type: 'feature',
        de: "Neue Erinnerungen: Jumu'ah, Sunnah-Gebete (Duha/Tahajjud/Witr) und vor dem Adhan",
        en: "New reminders: Jumu'ah, Sunnah prayers (Duha/Tahajjud/Witr) and pre-Adhan",
      },
      {
        type: 'feature',
        de: 'Wochenübersicht der Gebetszeiten und mehrere gespeicherte Orte',
        en: 'Weekly prayer times table and multiple saved locations',
      },
    ],
  },
  {
    version: '1.24.0',
    date: '2026-07-21',
    entries: [
      {
        type: 'feature',
        de: 'Tasbih: Tagesziel mit Fortschrittsbalken und 7-Tage-Verlauf',
        en: 'Tasbih: daily goal with progress bar and 7-day history',
      },
      { type: 'feature', de: 'Taraweeh-Tracker für den Ramadan', en: 'Taraweeh tracker for Ramadan' },
      {
        type: 'feature',
        de: 'Hijri-Datumsumrechner und Entfernungsanzeige zur Kaaba beim Qibla-Kompass',
        en: 'Hijri date converter and distance-to-Kaaba display on the Qibla compass',
      },
      {
        type: 'feature',
        de: 'Geführter Dhikr-Zähler nach dem Gebet',
        en: 'Guided Dhikr counter after prayer',
      },
    ],
  },
  {
    version: '1.25.0',
    date: '2026-07-21',
    entries: [
      {
        type: 'feature',
        de: '"Erste Schritte"-Leitfaden für Konvertiten und Neu-Muslime',
        en: '"First Steps" guide for converts and new Muslims',
      },
      {
        type: 'feature',
        de: 'iOS Live Activity: Gebets-Countdown auf Sperrbildschirm und Dynamic Island',
        en: 'iOS Live Activity: prayer countdown on the lock screen and Dynamic Island',
      },
      {
        type: 'feature',
        de: 'App-Shortcuts (Android) und Quick Actions (iOS) für Gebet, Qibla und Radio',
        en: 'App shortcuts (Android) and quick actions (iOS) for prayer, Qibla and radio',
      },
    ],
  },
  {
    version: '1.25.1',
    date: '2026-07-21',
    entries: [
      {
        type: 'fix',
        de: 'Tajweed-Farben jetzt auch für farbenblinde Nutzer klar unterscheidbar',
        en: 'Tajweed colors now clearly distinguishable for colorblind users',
      },
      {
        type: 'feature',
        de: 'Neue Benachrichtigungs-Übersicht über alle Erinnerungs-Typen',
        en: 'New notifications overview across all reminder types',
      },
      {
        type: 'fix',
        de: 'Diverse RTL-Layout-Fixes und kleinere Korrekturen',
        en: 'Various RTL layout fixes and small corrections',
      },
    ],
  },
  {
    version: '1.26.0',
    date: '2026-07-21',
    entries: [
      {
        type: 'feature',
        de: 'Live Activity: Das nächste Gebet erscheint jetzt direkt auf dem Sperrbildschirm und in der Dynamic Island',
        en: 'Live Activity: your next prayer now appears right on the Lock Screen and in the Dynamic Island',
      },
    ],
  },
  {
    version: '1.27.0',
    date: '2026-07-21',
    entries: [
      {
        type: 'improvement',
        de: 'Genauere Rezitations-Erkennung: Koran-optimiertes Sprachmodell (wie bei Tarteel) und deutlich schnellere Auswertung',
        en: 'More accurate recitation check: a Quran-optimized speech model (like Tarteel) and much faster results',
      },
      {
        type: 'improvement',
        de: 'Überarbeiteter Aufsage-Screen mit größerem, klarerem Aufnahme-Button und übersichtlicherem Aufbau',
        en: 'Redesigned recitation screen with a larger, clearer record button and a cleaner layout',
      },
    ],
  },
  {
    version: '1.27.1',
    date: '2026-07-21',
    entries: [
      {
        type: 'fix',
        de: 'Rezitations-Erkennung ließ sich nicht starten („nicht verfügbar") — das Koran-Sprachmodell lädt jetzt wieder korrekt',
        en: 'Recitation check failed to start ("unavailable") — the Quran speech model now loads correctly again',
      },
    ],
  },
  {
    version: '1.27.2',
    date: '2026-07-21',
    entries: [
      {
        type: 'improvement',
        de: 'Rezitations-Erkennung genauer (volle Modell-Präzision) und einfacher: ein Knopf, stoppt automatisch, wenn du fertig bist',
        en: 'More accurate recitation check (full model precision) and simpler: one button that stops automatically when you finish',
      },
    ],
  },
  {
    version: '1.28.0',
    date: '2026-07-22',
    entries: [
      {
        type: 'feature',
        de: 'Neuer Medien-Hub: Podcast, Lern-Videos und Reels an einem Ort',
        en: 'New Media hub: podcast, learning videos and reels in one place',
      },
      {
        type: 'feature',
        de: 'PDF-Lernunterlagen (Handouts) direkt in der App lesen und offline speichern',
        en: 'Read PDF study handouts right in the app and save them offline',
      },
      {
        type: 'improvement',
        de: '„Auswendiglernen" heißt jetzt „Rezitieren" – mit ehrlichem Hinweis zum On-Device-Sprachmodell',
        en: '"Memorize" is now called "Recite" – with an honest note about the on-device speech model',
      },
    ],
  },
  {
    version: '1.29.0',
    date: '2026-07-22',
    entries: [
      {
        type: 'feature',
        de: 'Witr-Gebet: Sure in der 3. Rak\'ah jetzt als Option, Dua al-Qunut als Text ergänzt',
        en: 'Witr prayer: surah in the 3rd rak\'ah is now optional, Dua al-Qunut added as text',
      },
      {
        type: 'improvement',
        de: 'Arabische Fachbegriffe app-weit vereinheitlicht',
        en: 'Arabic terminology unified across the app',
      },
    ],
  },
  {
    version: '1.29.1',
    date: '2026-07-22',
    entries: [
      {
        type: 'fix',
        de: 'Homescreen-Widgets: Hintergrund aktualisiert sich jetzt zuverlässig',
        en: 'Home screen widgets: background now updates reliably',
      },
      {
        type: 'improvement',
        de: 'Alle 5 Gebetszeiten in jeder Widget-Größe + automatische Aktualisierung',
        en: 'All 5 prayer times in every widget size + automatic refresh',
      },
    ],
  },
  {
    version: '1.29.2',
    date: '2026-07-22',
    entries: [
      {
        type: 'fix',
        de: 'Einstufungstest spielt die Audio der Hörfragen jetzt ab (war komplett stumm)',
        en: 'Placement test now plays the listening-question audio (was completely silent)',
      },
    ],
  },
  {
    version: '1.30.0',
    date: '2026-07-24',
    entries: [
      {
        type: 'feature',
        de: 'Salati-TV-Verbindung: Handy als Fernbedienung für die Salati-TV-App und als Quiz-Zweitschirm',
        en: 'Salati TV connection: use your phone as a remote for the Salati TV app and as a quiz second screen',
      },
    ],
  },
  {
    version: '1.30.1',
    date: '2026-07-25',
    entries: [
      {
        type: 'fix',
        de: 'Salati KI (Beta): Modell-Download lädt jetzt korrekt und startet nach 100 % zuverlässig – kein wiederholter Download mehr',
        en: 'Salati AI (Beta): model download now completes and starts reliably after 100% – no more repeated downloads',
      },
    ],
  },
  {
    version: '1.30.3',
    date: '2026-07-26',
    entries: [
      {
        type: 'improvement',
        de: 'Salati KI (Beta): lädt das Sprachmodell jetzt speicherschonend (nur bei Bedarf statt komplett in den Arbeitsspeicher) und mit automatischem Rückfall auf reine CPU – funktioniert dadurch auf deutlich mehr Geräten',
        en: 'Salati AI (Beta): now loads the language model memory-efficiently (on demand instead of fully into RAM) and with automatic CPU fallback – so it works on many more devices',
      },
    ],
  },
  {
    version: '1.30.4',
    date: '2026-07-26',
    entries: [
      {
        type: 'fix',
        de: 'Salati KI (Beta): behoben, dass sich das heruntergeladene Modell auf dem Gerät nicht laden ließ („KI konnte nicht geladen werden") – die KI beantwortet Fragen jetzt wirklich lokal',
        en: 'Salati AI (Beta): fixed the downloaded model failing to load on the device ("AI could not be loaded") – the AI now actually answers questions locally',
      },
    ],
  },
  {
    version: '1.30.6',
    date: '2026-07-26',
    entries: [
      {
        type: 'improvement',
        de: 'Salati KI (Beta): findet jetzt deutlich besser die passenden Quellen zu deiner Frage – auch bei umgangssprachlichen Begriffen – und lädt das Modell schneller über unseren eigenen Server',
        en: 'Salati AI (Beta): now finds matching sources for your question much better – including everyday wording – and loads the model faster from our own server',
      },
    ],
  },
  {
    version: '1.30.11',
    date: '2026-07-26',
    entries: [
      {
        type: 'improvement',
        de: 'Salati KI (Beta): beantwortet jetzt auch einfache Alltagsfragen zuverlässig (fünf Gebete, Wudu, Glaubensgrundlagen …) statt zu oft auszuweichen, findet die Quellen unabhängig von der Schreibweise (ä oder ae), echter Hintergrund-Download des Modells, auch aus den Einstellungen startbar, und dank Flash-Attention schnellere Antworten',
        en: 'Salati AI (Beta): now reliably answers everyday questions too (five prayers, wudu, articles of faith …) instead of deflecting too often, finds sources regardless of spelling (ä or ae), real background model download, also startable from Settings, and faster answers thanks to flash attention',
      },
    ],
  },
  {
    version: '1.31.0',
    date: '2026-07-27',
    entries: [
      {
        type: 'improvement',
        de: 'Salati KI: Grundfragen wie „Wer ist Allah?", „Was ist Ischa?" oder „Wie mache ich Wudu?" werden jetzt vollständig beantwortet – die KI kennt zusätzlich alle Praxis-Anleitungen, alle Kurstexte und 147 neue geprüfte Wissenseinträge',
        en: 'Salati AI: basic questions like “Who is Allah?”, “What is Isha?” or “How do I perform wudu?” are now answered in full – the AI also knows all practice guides, all course texts and 147 newly verified knowledge entries',
      },
      {
        type: 'improvement',
        de: 'Salati KI: findet die passenden Stellen deutlich zuverlässiger, antwortet näher an der Quelle und wiederholt sich nicht mehr',
        en: 'Salati AI: finds matching passages far more reliably, stays closer to the source and no longer repeats itself',
      },
      {
        type: 'feature',
        de: 'Podcast: neue Reihe „Arabisch lesen – Schritt für Schritt" (6 Folgen) plus zwei neue Lernunterlagen zum Mitlesen',
        en: 'Podcast: new series “Reading Arabic – step by step” (6 episodes) plus two new handouts to read along',
      },
    ],
  },
  {
    version: '1.32.0',
    date: '2026-07-27',
    entries: [
      {
        type: 'feature',
        de: 'Salati KI antwortet jetzt in deiner Sprache: Der geprüfte Wissensspeicher liegt in allen 14 App-Sprachen vor – wer auf Türkisch, Russisch oder Bengalisch fragt, bekommt die Antwort auch in dieser Sprache, ohne Umweg über eine Übersetzung',
        en: 'Salati AI now answers in your language: the verified knowledge base exists in all 14 app languages – ask in Turkish, Russian or Bengali and the answer comes back in that language, with no detour through a translation',
      },
      {
        type: 'feature',
        de: 'Gebetszeiten funktionieren jetzt auch ohne Internet: Die App berechnet sie selbst, wenn der Server nicht erreichbar ist – samt Benachrichtigungen und Kalender-Export',
        en: 'Prayer times now work without internet: the app calculates them itself whenever the server is unreachable – including notifications and calendar export',
      },
      {
        type: 'feature',
        de: 'KI-Chat mit Gesprächsverlauf, antippbaren Quellen (ein Tipp öffnet den Vers im Koran-Reader) und Beispielfragen für den Einstieg',
        en: 'AI chat with conversation history, tappable sources (one tap opens the verse in the Quran reader) and example questions to get you started',
      },
      {
        type: 'improvement',
        de: 'Gebetszeiten lassen sich auf deine Moschee justieren: Minuten-Korrektur für jedes einzelne Gebet, dazu eine Regel für hohe Breitengrade – dadurch sind Fadschr und Ischa im europäischen Sommer endlich brauchbar',
        en: 'Prayer times can be matched to your mosque: a minute adjustment for each individual prayer plus a high-latitude rule – which finally makes Fajr and Isha usable during the European summer',
      },
      {
        type: 'improvement',
        de: 'Rezitations-Prüfung im Hifz-Trainer: neues Modell mit 55 statt 148 MB Download bei gleicher Genauigkeit',
        en: 'Recitation check in the Hifz trainer: new model with a 55 MB download instead of 148 MB at the same accuracy',
      },
      {
        type: 'improvement',
        de: 'Praxis-Anleitungen (Wudu, Ghusl, Gebet, Janazah, Hadsch) jetzt vollständig in allen 14 Sprachen, die 40 Hadithe von an-Nawawi neu auf Deutsch und Tafsir in 12 statt 3 Ausgaben',
        en: 'Practice guides (wudu, ghusl, prayer, janazah, hajj) now complete in all 14 languages, the 40 Hadith of an-Nawawi newly available in German and tafsir in 12 editions instead of 3',
      },
      {
        type: 'improvement',
        de: 'Bedienung: Jeder Bildschirm hat jetzt einen sichtbaren Zurück-Knopf, „Fertig" scrollt bei Datenschutz, AGB und Impressum nicht mehr aus dem Bild, dazu bessere Kontraste und Beschriftungen für die Sprachausgabe',
        en: 'Usability: every screen now has a visible back button, “Done” no longer scrolls out of view on the privacy, terms and imprint pages, plus better contrast and screen-reader labels',
      },
      {
        type: 'improvement',
        de: 'App und Web-Version starten spürbar schneller, der Podcast lädt zügiger und ist jetzt nach Lernweg statt nach Erscheinungsdatum sortiert',
        en: 'The app and the web version start noticeably faster, the podcast loads quicker and is now sorted by learning path instead of release date',
      },
      {
        type: 'fix',
        de: 'Witr-Anleitung korrigiert: In allen drei Rakat wird nach Al-Fatiha eine weitere Sure gelesen, der Dua al-Qunut folgt erst danach',
        en: 'Witr guide corrected: a further surah is recited after Al-Fatiha in all three rakat, and the Dua al-Qunut only follows after that',
      },
      {
        type: 'fix',
        de: 'Tadschwid-Kurs: zwei falsche Beispiele im Kapitel zur Ra-Aussprache richtiggestellt',
        en: 'Tajwid course: two incorrect examples in the chapter on Ra pronunciation put right',
      },
    ],
  },
  {
    version: '1.33.0',
    date: '2026-07-28',
    entries: [
      {
        type: 'feature',
        de: 'Hadithe jetzt auf Deutsch: Über 700 nach Themen geordnete Überlieferungen aus der Enzyklopädie der übersetzten Prophetenhadithe — mit Graduierung, Quellenangabe und Erläuterung, in allen 14 App-Sprachen',
        en: 'Hadiths now available in German: over 700 topically arranged narrations from the Encyclopedia of Translated Prophetic Hadiths - with grading, source and commentary, in all 14 app languages',
      },
      {
        type: 'feature',
        de: 'Der Gebetsbegleiter spricht jetzt deine Sprache: Ablauf, Suren und Dhikr auch auf Indonesisch, Bengalisch, Persisch, Malaiisch, Urdu, Suaheli, Russisch und Paschtu — im Wortlaut der Koranausgabe, die du auch im Leser siehst',
        en: 'The prayer companion now speaks your language: sequence, surahs and dhikr also in Indonesian, Bengali, Persian, Malay, Urdu, Swahili, Russian and Pashto - in the wording of the Quran edition you also see in the reader',
      },
      {
        type: 'improvement',
        de: 'Die Website öffnet sich rund achtmal schneller, und Bilder brauchen 86 Prozent weniger Daten',
        en: 'The website opens around eight times faster, and images need 86 per cent less data',
      },
      {
        type: 'improvement',
        de: 'Drei weitere deutsche Koran-Übersetzungen direkt zur Auswahl: Abu Rida, Khoury und Zaidan',
        en: 'Three further German Quran translations directly selectable: Abu Rida, Khoury and Zaidan',
      },
      {
        type: 'fix',
        de: 'Gebetszeiten hängen nicht mehr: Bleibt der Server stumm, bricht die App nach wenigen Sekunden ab und rechnet selbst weiter, statt ohne Meldung zu warten',
        en: 'Prayer times no longer hang: if the server stays silent the app gives up after a few seconds and calculates on its own instead of waiting without notice',
      },
      {
        type: 'fix',
        de: 'Verweigerte Berechtigungen sind keine Sackgasse mehr: Bei Standort und Benachrichtigungen führt ein Hinweis direkt in die Systemeinstellungen, statt den Schalter wirkungslos zurückspringen zu lassen',
        en: 'Denied permissions are no longer a dead end: for location and notifications a note leads straight into the system settings instead of letting the switch spring back without effect',
      },
      {
        type: 'fix',
        de: 'Mehrere Seiten, darunter der Suren-Leser, hatten keinen sichtbaren Weg zurück',
        en: 'Several screens, among them the surah reader, had no visible way back',
      },
    ],
  },
  {
    version: '1.34.0',
    date: '2026-07-28',
    entries: [
      {
        type: 'feature',
        de: 'Salati KI ist keine Beta mehr: Antworten bestehen jetzt ausschließlich aus wörtlichen Auszügen der Quellen. Die KI kann nichts mehr dazuerfinden — und der 1,1-GB-Download entfällt, sie ist sofort einsatzbereit',
        en: 'Salati AI is no longer a beta: answers now consist solely of verbatim excerpts from the sources. The AI can no longer invent anything - and the 1.1 GB download is gone, it works right away',
      },
      {
        type: 'feature',
        de: 'Deutscher Tafsir: die vom Autor frei gegebene Koran-Erläuterung von Ibn Rassoul, 114 Suren, direkt im Leser wählbar',
        en: 'German tafsir: the Quran commentary by Ibn Rassoul, released copyright-free by its author, all 114 surahs, selectable in the reader',
      },
      {
        type: 'feature',
        de: 'Wear-OS-Uhren: vollwertige App mit nächstem Gebet, Tagesliste, Qibla-Kompass und Zifferblatt-Komplikation — auch ohne Telefon in Reichweite',
        en: 'Wear OS watches: a full app with next prayer, daily list, Qibla compass and a watch-face complication - even without the phone nearby',
      },
      {
        type: 'feature',
        de: 'Apple Watch: Gebetszeiten, nächstes Gebet und Qibla auf der Uhr; die Zifferblatt-Komplikation zeigt jetzt erstmals überhaupt Daten an',
        en: 'Apple Watch: prayer times, next prayer and Qibla on the wrist; the watch-face complication now shows data for the first time at all',
      },
      {
        type: 'fix',
        de: 'Benachrichtigungen kamen in acht Sprachen auf Deutsch — Gebetszeiten, Freitagsgebet, Adhkar, Reise und Zakat sprechen jetzt überall deine Sprache',
        en: 'Notifications arrived in German for eight languages - prayer times, Friday prayer, adhkar, travel and zakat now speak your language everywhere',
      },
      {
        type: 'fix',
        de: 'Aus 32 Ansichten kam man nicht mehr heraus, wenn etwas nicht geladen werden konnte — jetzt führt überall ein Weg zurück',
        en: 'Thirty-two views had no way out when something failed to load - now there is a way back everywhere',
      },
      {
        type: 'fix',
        de: 'Salati TV: der Kopplungsbildschirm ließ sich mit der Fernbedienung nicht bedienen; Netzabrufe brechen jetzt sauber ab statt endlos zu warten',
        en: 'Salati TV: the pairing screen could not be operated with the remote; network requests now fail cleanly instead of waiting forever',
      },
    ],
  },
  {
    version: '1.35.0',
    date: '2026-07-28',
    entries: [
      {
        type: 'feature',
        de: 'Salati TV spricht jetzt alle 14 Sprachen — Oberfläche, Städte und Quiz; vom Handy aus sind jetzt alle Bildschirme des Fernsehers erreichbar',
        en: 'Salati TV now speaks all 14 languages - interface, cities and quiz; and every TV screen can now be reached from the phone',
      },
      {
        type: 'fix',
        de: 'Zeitangaben wie "noch 1 Std. 55 Min." erscheinen jetzt in deiner Sprache statt in englischen Kürzeln — in der App, im Widget und auf dem Fernseher',
        en: 'Countdowns such as "1 hr 55 min left" now appear in your language instead of English abbreviations - in the app, the widget and on the TV',
      },
      {
        type: 'fix',
        de: 'Im TV-Quiz stand die richtige Antwort immer an erster Stelle und war dadurch schon vorausgewählt',
        en: 'In the TV quiz the correct answer was always first and therefore already preselected',
      },
      {
        type: 'fix',
        de: 'Berechtigungen werden jetzt so erfragt, wie Apple es verlangt: Nach der Erklärung folgt immer die Systemabfrage, und du kannst Standort und Benachrichtigungen weiterhin überspringen',
        en: 'Permissions are now requested the way Apple requires: the system prompt always follows the explanation, and you can still skip location and notifications',
      },
      {
        type: 'fix',
        de: 'Das Symbol der Apple-Watch-App erscheint jetzt rund statt eckig',
        en: 'The Apple Watch app icon now appears circular instead of square',
      },
    ],
  },
  {
    // 1.35.0 (versionCode 55) ist bereits in Produktion — alles ab hier kam
    // NACH diesem Release dazu und darf nicht rueckwirkend dort stehen, sonst
    // verspricht der Changelog Nutzern der 1.35.0 Dinge, die sie nicht haben.
    version: '1.36.0',
    date: '2026-07-28',
    entries: [
      {
        type: 'feature',
        de: 'Für das Morgengebet gibt es jetzt einen echten Fadschr-Ruf mit dem Zusatz "Das Gebet ist besser als der Schlaf" — er ist dort voreingestellt',
        en: 'Fajr now has a real Fajr call including "Prayer is better than sleep" - preselected for that prayer',
      },
      {
        type: 'improvement',
        de: 'Die Adhan-Auswahl besteht jetzt aus drei nachweislich frei lizenzierten Aufnahmen (Wikimedia Commons, mit Urheber und Lizenz unter "Quellen & Lizenzen"); die bisherigen Aufnahmen ohne belegbare Freigabe sind entfallen. Eine alte Auswahl wird automatisch auf eine der neuen umgestellt',
        en: 'The adhan selection now consists of three recordings with proven free licences (Wikimedia Commons, author and licence listed under "Sources & Licences"); the previous recordings without a provable release have been removed. An earlier selection is switched to one of the new recordings automatically',
      },
      {
        type: 'feature',
        de: 'Neuer Kurs "Fiqh der Gottesdienste" mit 24 Lektionen zu Reinheit, Gebet, Fasten, Zakat und Hadsch; außerdem 11 neue Lektionen zu Herzenskrankheiten, Ehe- und Familienrecht sowie den zehn Gefährten, denen das Paradies bezeugt wurde',
        en: 'New course "Fiqh of Worship" with 24 lessons on purity, prayer, fasting, zakat and hajj; plus 11 new lessons on diseases of the heart, marriage and family law, and the ten Companions promised Paradise',
      },
      {
        type: 'fix',
        de: 'Beim Übertragen des Fortschritts auf ein anderes Gerät wird jetzt nachgefragt, bevor der Stand ersetzt wird — mit dem Datum des Codes, damit erkennbar ist, welcher der neuere ist. Bisher wurde ohne Warnung überschrieben',
        en: 'Transferring progress to another device now asks before replacing what is on the device - and shows the date the code was created, so you can tell which one is newer. Previously it overwrote without warning',
      },
      {
        type: 'improvement',
        de: 'Neue Abzeichen für drei abgeschlossene Studien-Kurse und für alle Kurse — bisher zahlten nur Grammatik und Tadschwied auf ein eigenes Abzeichen ein',
        en: 'New badges for completing three study courses and for completing them all - previously only grammar and tajwid had a badge of their own',
      },
    ],
  },
  {
    version: '1.38.0',
    date: '2026-07-28',
    entries: [
      {
        type: 'fix',
        de: 'Die Gebetszeiten in nördlichen Ländern passen im Sommer wieder zu dem, was andere Gebetszeit-Apps anzeigen. Bisher war für hohe Breiten eine Regel voreingestellt, die Fadschr später und Ischa früher legt als üblich — in Berlin im Hochsommer um gut eine Stunde. Wer die Regel in den Einstellungen selbst gewählt hat, behält seine Wahl',
        en: 'Prayer times in northern countries match what other prayer-time apps show in summer again. The default rule for high latitudes used to place Fajr later and Isha earlier than usual - by a good hour in Berlin at midsummer. If you picked the rule yourself in settings, your choice is kept',
      },
      {
        type: 'improvement',
        de: 'Bei der Hochbreiten-Regel steht jetzt zu jeder Auswahl, was sie an Fadschr und Ischa verschiebt, samt dem Hinweis, dass die Regeln um bis zu einer Stunde auseinanderliegen können — so findet man die, die zur eigenen Moschee passt',
        en: 'Each high-latitude rule now says what it does to Fajr and Isha, along with a note that the rules can be up to an hour apart - so you can pick the one that matches your mosque',
      },
      {
        type: 'fix',
        de: 'Im Leseheft stand in einem Übungswort ein falscher Buchstabe (Sure 80:9) und im Schlussvers von Sure An-Nas ein falsches Wort. Beide sind korrigiert; alle Koranstellen der Lese-Übungen wurden gegen den Korantext geprüft',
        en: 'A reading exercise contained a wrong letter (Surah 80:9) and the closing verse of Surah An-Nas a wrong word. Both are corrected; every Quranic passage in the reading exercises was checked against the Quran text',
      },
      {
        type: 'fix',
        de: 'Bei den Wiederholungsfragen stand die richtige Antwort immer an erster Stelle und es fehlte der Lösungsteil — beides behoben',
        en: 'In the review questions the correct answer was always listed first and the solutions were missing - both fixed',
      },
      {
        type: 'improvement',
        de: 'Wo Gelehrte unterschiedlicher Meinung sind, nennen die Kurse jetzt die Positionen, statt eine als allgemeingültig darzustellen',
        en: 'Where scholars differ, the courses now name the positions instead of presenting one as universally agreed',
      },
      {
        type: 'improvement',
        de: 'Kursinhalte lassen sich jetzt aktualisieren, ohne auf ein App-Update zu warten',
        en: 'Course content can now be updated without waiting for an app update',
      },
    ],
  },
  {
    version: '1.39.0',
    date: '2026-07-29',
    entries: [
      {
        type: 'fix',
        de: 'In den Einstellungen stand an mehreren Stellen der technische Kürzel-Text statt eines Namens — beim Gebetsruf, bei den Ramadan-Zeiten und im ganzen Gebets-Tracker. Die 49 fehlenden Texte sind in allen 14 Sprachen ergänzt',
        en: 'Several places in settings showed a technical key instead of a name - for the call to prayer, the Ramadan times and throughout the prayer tracker. The 49 missing texts have been added in all 14 languages',
      },
      {
        type: 'improvement',
        de: 'Die drei Gebetsrufe heißen jetzt schlicht "Adhan 1", "Adhan 2" und "Adhan 3" und stehen bei jedem Gebet zur Wahl. Für Fadschr bleibt der Fadschr-Ruf voreingestellt; warum, steht als Hinweis darunter. Auf der Lizenzseite steht die Nummer jetzt mit dabei, damit erkennbar ist, welcher Eintrag zu welcher Aufnahme gehört',
        en: 'The three calls to prayer are now simply named "Adhan 1", "Adhan 2" and "Adhan 3", and all three can be chosen for every prayer. Fajr still defaults to the Fajr call, with a note explaining why. The licences page now shows the number too, so you can tell which entry belongs to which recording',
      },
      {
        type: 'improvement',
        de: 'Einstellungen erklären sich jetzt selbst: Suhur, Iftar und die Vorlaufzeit im Ramadan (bisher eine nackte Minutenreihe ohne Bezug), Berechnungsmethode, Asr-Schule, Übungsart, Rezitator-Download, Qada-Zähler und befreite Tage. Die Ramadan-Einstellungen fehlten außerdem in der Suche',
        en: 'Settings now explain themselves: suhoor, iftar and the Ramadan lead time (previously a bare row of minutes with no context), calculation method, Asr school, exercise type, reciter download, qada counter and exempt days. The Ramadan settings were also missing from the settings search',
      },
      {
        type: 'fix',
        de: 'Zwei Anzeigefehler behoben: das Monatsraster im Gebets-Tracker quetschte alle Tage zu schmalen Streifen, und der Hinweis beim Fadschr-Gebetsruf drückte den Gebetsnamen zusammen',
        en: 'Two layout bugs fixed: the month grid in the prayer tracker squeezed every day into a narrow strip, and the note on the Fajr call to prayer squashed the prayer name',
      },
      {
        type: 'fix',
        de: 'Der Hinweis, Benachrichtigungen könnten aus technischen Gründen nur einen kurzen Standardton spielen, stimmte seit dem Austausch der Aufnahmen nicht mehr — Android spielt den vollen Adhan, iOS einen Schnitt daraus. Der Text sagt das jetzt',
        en: 'The note claiming notifications could only play a short default tone for technical reasons stopped being true when the recordings were replaced - Android plays the full adhan, iOS a shortened cut. The text now says so',
      },
    ],
  },
  {
    version: '1.40.0',
    date: '2026-07-29',
    entries: [
      {
        type: 'fix',
        de: 'Die KI fand außerhalb des Deutschen nichts: Wer eine der sechs Beispielfragen antippte, bekam in jeder anderen Sprache „Dazu finde ich in meinen lokalen Quellen keine Stelle". Die Frage wurde immer auf Deutsch abgeschickt, während die Quellen längst in der App-Sprache geladen werden. Jetzt passt die Frage zur Sprache der Quellen — geprüft in allen 14 Sprachen',
        en: 'The AI found nothing outside German: tapping one of the six example questions returned "I cannot find a passage on this in my local sources" in every other language. The question was always sent in German while the sources have long been loaded in the app language. The question now matches the language of the sources - verified in all 14 languages',
      },
    ],
  },
  {
    version: '1.41.0',
    date: '2026-07-29',
    entries: [
      {
        type: 'improvement',
        de: 'Auf Tablets streckte die App bisher das Telefon-Layout in die Breite — die Startseite füllte nur knapp die halbe Höhe, der Rest blieb leer. Startseite, Einstellungen, „Mehr" und „Lernen" stehen jetzt in Spalten nebeneinander; Koran-Liste, die 99 Namen, Duas, Anleitungen, Hadith und Themen erscheinen als Raster. Nachgemessen auf 600, 800 und 1024 dp, hell und dunkel, auch auf Arabisch',
        en: 'On tablets the app used to stretch the phone layout across the width - the home screen filled barely half the height and the rest stayed empty. Home, settings, "More" and "Learn" now sit side by side in columns; the Quran list, the 99 names, duas, guides, hadith and topics appear as grids. Measured at 600, 800 and 1024 dp, in light and dark, in Arabic too',
      },
      {
        type: 'fix',
        de: 'Die Gebetszeiten-Zeile war die einzige Zeile der App, die auf Arabisch, Persisch, Urdu und Paschtu nicht gespiegelt wurde — Uhrzeit und Gebetsname standen verkehrt herum. Jetzt läuft sie wie alles andere von rechts nach links',
        en: 'The prayer times row was the only row in the app that was not mirrored in Arabic, Persian, Urdu and Pashto - time and prayer name sat the wrong way round. It now runs right to left like everything else',
      },
      {
        type: 'improvement',
        de: 'Nach dem Koppeln überträgt das Handy jetzt Standort, Berechnungsmethode, Rechtsschule, Regel für nördliche Breiten, Minuten-Korrektur und Zeitformat an das Fernsehgerät. Bisher mussten beide Geräte dafür getrennt gleich eingestellt werden, sonst zeigten sie unterschiedliche Gebetszeiten',
        en: 'After pairing, the phone now sends location, calculation method, school of law, high-latitude rule, minute adjustment and time format to the TV. Until now both devices had to be set up identically by hand, otherwise they showed different prayer times',
      },
      {
        type: 'fix',
        de: 'Die Karte oben auf der Startseite ließ am rechten Rand einen schmalen Streifen ohne Foto und ohne Abdunkelung stehen',
        en: 'The card at the top of the home screen left a narrow strip on the right edge without photo and without dimming',
      },
    ],
  },
  {
    version: '1.42.0',
    date: '2026-07-30',
    entries: [
      {
        type: 'feature',
        de: 'Der Koran-Reader nennt jetzt unter jeder Sure, wessen Übersetzung du gerade liest - bei zwei eingeblendeten Übersetzungen beide',
        en: 'The Quran reader now names the translator of the text you are reading below each surah - both, if two translations are shown',
      },
      {
        type: 'fix',
        de: 'Auf Tablets und breiten Fenstern griff das Tablet-Layout im Web gar nicht: die Seite blieb in Handy-Breite stehen, bis man das Fenster veränderte',
        en: 'On tablets and wide windows the tablet layout did not apply on the web at all: the page stayed at phone width until the window was resized',
      },
      {
        type: 'fix',
        de: 'Wer die App in einer anderen Sprache als Deutsch gespeichert hatte, sah beim Öffnen der Webseite kurz einen Sprung durch das ganze Layout',
        en: 'Anyone who had saved a language other than German saw the whole layout jump briefly when opening the website',
      },
      {
        type: 'feature',
        de: 'Der Kalender zeigt auf breiten Bildschirmen neben dem Monat die nächsten islamischen Anlässe mit Datum',
        en: 'On wide screens the calendar shows the next Islamic occasions with their dates next to the month',
      },
      {
        type: 'fix',
        de: 'Die App startet schneller und ist etwas kleiner - ungenutzte Ressourcen fallen jetzt zuverlässig weg, und die Startklassen liegen vorne',
        en: 'The app starts faster and is a little smaller - unused resources are now reliably removed and the startup classes come first',
      },
    ],
  },
  {
    version: '1.43.0',
    date: '2026-07-30',
    entries: [
      {
        type: 'feature',
        de: 'Der Hadith-Bereich kommt jetzt vollständig aus der Enzyklopädie der übersetzten Prophetenhadithe - über 2.500 Hadithe auf Deutsch, nach Themen geordnet, dazu An-Nawawi 40',
        en: 'The hadith section now comes entirely from the Encyclopedia of Translated Prophetic Hadiths - thousands of hadiths in your language, ordered by topic, plus An-Nawawi 40',
      },
      {
        type: 'fix',
        de: 'Die früheren Sammlungen sind entfallen: bei ihren Übersetzungen ließ sich nicht belegen, wer sie angefertigt hat und ob wir sie weitergeben dürfen. Lieber ein Bestand mit geklärten Rechten',
        en: 'The previous collections were removed: for their translations it could not be established who made them or whether we may pass them on. We prefer a corpus with settled rights',
      },
      {
        type: 'fix',
        de: 'Die Hadith-Suche findet jetzt auch Themen, nicht nur Wörter im Text',
        en: 'Hadith search now finds topics too, not just words in the text',
      },
      {
        type: 'fix',
        de: 'Die App ist noch einmal 2,6 MB kleiner geworden',
        en: 'The app is another 2.6 MB smaller',
      },
    ],
  },
  {
    version: '1.44.0',
    date: '2026-07-31',
    entries: [
      {
        type: 'feature',
        de: 'Acht Koran-Schriftarten zur Auswahl – vom Uthmani-Druck der Madina-Ausgabe über klassischen Naskh bis zu einer serifenlosen Schrift für schwaches Sehen',
        en: 'Eight Quran fonts to choose from – from the Uthmani print of the Madinah edition through classical Naskh to a sans-serif face for low vision',
      },
      {
        type: 'feature',
        de: 'Neue Sektion „Formeln & Freitagspredigt": was gesagt wird, was es heißt und was man antwortet – inklusive dem Ablauf der Khutba, in allen 14 Sprachen',
        en: 'New section “Phrases & Friday sermon”: what is said, what it means and what you reply – including the course of the khutbah, in all 14 languages',
      },
      {
        type: 'fix',
        de: 'Der gestrichelte Kreis vor einzelnen Koran-Zeichen ist weg, und die Wort-Markierung beim Mitlesen verrutscht nicht mehr',
        en: 'The dotted circle in front of individual Quranic marks is gone, and the word highlighting no longer drifts while following along',
      },
      {
        type: 'fix',
        de: 'Das Gebetszeiten-Widget springt jetzt zur Gebetszeit selbst weiter, nicht erst beim Öffnen der App',
        en: 'The prayer times widget now moves on at the prayer time itself, not only when you open the app',
      },
    ],
  },
  {
    version: '1.45.0',
    date: '2026-07-31',
    entries: [
      {
        type: 'fix',
        de: 'Der schwarze Punkt im gepunkteten Kreis mitten im Vers ist weg. Er betraf die Schriftart „KFGQPC HAFS Uthmanic" und trat in rund einem Drittel aller Verse auf – überall dort, wo ein Buchstabe stumm bleibt, etwa in „كَفَرُوا۟" oder „أُو۟لَـٰٓئِكَ". Die Schrift ist für die hauseigene Textausgabe des King Fahd Complex gezeichnet und kannte drei Zeichen der Ausgabe nicht, die die App anzeigt; der Text wird jetzt in die Schreibweise der Madina-Ausgabe übertragen.',
        en: 'The black dot inside a dotted circle in the middle of a verse is gone. It affected the “KFGQPC HAFS Uthmanic” font and appeared in about a third of all verses – wherever a letter stays silent, as in “كَفَرُوا۟” or “أُو۟لَـٰٓئِكَ”. That font is drawn for the King Fahd Complex’s own edition and did not know three characters of the edition the app displays; the text is now converted to the Madinah edition’s spelling.',
      },
      {
        type: 'fix',
        de: 'Die Versnummer in der Mushaf-Ansicht steht bei der Uthmani-Schrift wieder im richtigen Ornament – vorher lagen zwei fremde geschweifte Klammern um den Kreis',
        en: 'In the mushaf view the verse number sits in the correct ornament again with the Uthmani font – previously two foreign curly braces framed the circle',
      },
      {
        type: 'improvement',
        de: 'IndoPak-Schriftbild: unsichtbare Sonderzeichen, die keine der acht Schriften darstellen kann, erscheinen nicht mehr als leeres Kästchen im Vers',
        en: 'IndoPak script: invisible special characters that none of the eight fonts can render no longer show up as an empty box inside the verse',
      },
      {
        type: 'improvement',
        de: 'IndoPak braucht eigene Buchstaben (ک ھ ہ ی ے), die zwei der acht Schriften nicht haben. Statt Platzhaltern zeigt die Mushaf-Ansicht diesen Text jetzt in einer Schrift, die sie hat – und sagt darunter, welche',
        en: 'IndoPak needs its own letters (ک ھ ہ ی ے) that two of the eight fonts do not have. Instead of placeholders the mushaf view now sets that text in a font which does – and says underneath which one',
      },
    ],
  },
  {
    version: '1.46.0',
    date: '2026-08-01',
    entries: [
      {
        type: 'feature',
        de: 'Du entscheidest jetzt selbst, wie das Sukūn aussieht: als kleiner Haken wie im gedruckten Madina-Mushaf, oder als vertrauter Kreis. Die Einstellung steht unter der Schriftauswahl und zeigt beide Varianten am selben Wort – sie betrifft nur die Schrift „KFGQPC HAFS Uthmanic"',
        en: 'You now decide how the sukūn looks: a small hook as in the printed Madinah mushaf, or the familiar circle. The setting sits below the font list and previews both on the same word – it only affects the “KFGQPC HAFS Uthmanic” font',
      },
    ],
  },
  {
    version: '1.47.0',
    date: '2026-08-07',
    entries: [
      {
        type: 'feature',
        de: 'Neu: „Nach meiner Moschee ausrichten". Du tippst die Zeiten vom Aushang deiner Gemeinde ab, und Salati sucht aus allen Behörden, beiden Asr-Schulen und allen Hochbreiten-Regeln die Kombination, die dazu passt – der Rest landet in der Minuten-Korrektur. Damit stimmen die Zeiten nicht nur an dem einen Tag, sondern das ganze Jahr',
        en: 'New: “Match my mosque”. Type in the times from your congregation’s timetable and Salati searches every authority, both Asr schools and all high-latitude rules for the combination that fits – the remainder goes into the minute correction. That way your times are right all year, not just on the day you typed in',
      },
      {
        type: 'feature',
        de: 'Neuer Bildschirm „Woher deine Gebetszeiten kommen": welche Behörde gerade gilt, mit welchen Winkeln, was Asr-Schule und Hochbreiten-Regel bedeuten – und die Quellen zum Nachlesen, verlinkt',
        en: 'New screen “Where your prayer times come from”: which authority currently applies, with which angles, what the Asr school and the high-latitude rule mean – plus the sources to read up on, linked',
      },
      {
        type: 'feature',
        de: 'Statt 13 stehen jetzt alle 23 Behörden zur Wahl – neu unter anderem Marokko, Algerien, Tunesien, Jordanien, Indonesien (Kemenag), Malaysia (JAKIM), Dubai, Teheran und Lissabon. Die Liste ist nach Weltregion gruppiert und nennt zu jeder Behörde ihre Winkel',
        en: 'All 23 authorities are now selectable instead of 13 – newly including Morocco, Algeria, Tunisia, Jordan, Indonesia (Kemenag), Malaysia (JAKIM), Dubai, Tehran and Lisbon. The list is grouped by world region and states each authority’s angles',
      },
      {
        type: 'improvement',
        de: 'Salati schlägt beim Einrichten die Behörde deines Landes vor und markiert sie in der Liste. Ziehst du um, weist ein Hinweis auf die dort übliche hin – umgestellt wird nur, wenn du tippst',
        en: 'Salati suggests your country’s authority during setup and marks it in the list. If you move, a note points out the one commonly used there – it only switches when you tap',
      },
      {
        type: 'improvement',
        de: 'Die Winkel jeder Behörde stehen nur noch an einer Stelle, aus der Online- und Offline-Rechnung gleichermaßen lesen. Ein Abgleich prüft alle 23 Methoden an fünf Orten und vier Terminen des Jahres gegen die Datenquelle',
        en: 'Each authority’s angles now live in a single place that both the online and the offline calculation read from. A comparison checks all 23 methods against the data source in five cities on four dates across the year',
      },
    ],
  },

  {
    version: '1.48.0',
    date: '2026-08-08',
    entries: [
      {
        type: 'feature',
        de: 'Fernseher verbinden ohne Kamera: Salati TV zeigt unter dem QR-Code eine Adresse und einen Code – die lassen sich jetzt auch von Hand eingeben. Das hilft, wenn die Kamera-Erlaubnis abgelehnt ist, die Linse verschmutzt ist oder du zu weit vom Fernseher weg sitzt, um den Code scharf zu bekommen',
        en: 'Connect your TV without the camera: Salati TV shows an address and a code below the QR code – you can now type them in by hand. That helps when camera access is denied, the lens is dirty, or you are sitting too far from the TV to get the code in focus',
      },
      {
        type: 'improvement',
        de: 'Die manuelle Eingabe steht direkt auf dem Verbinden-Bildschirm – auch dann, wenn die Kamera-Freigabe abgelehnt wurde. Vorher lag sie dahinter, also genau dort, wo sie niemand erreicht, der sie am nötigsten braucht',
        en: 'The manual entry sits right on the connect screen – including when camera permission has been declined. It used to sit behind it, exactly where the people who need it most could never reach it',
      },
    ],
  },
  {
    version: '1.49.0',
    date: '2026-08-15',
    entries: [
      {
        type: 'fix',
        de: 'Gebetszeiten-Erinnerungen kamen manchmal eine Stunde zu spät. In der Nacht der Zeitumstellung rechnete die App mit einer Uhrzeit, die es an diesem Tag gar nicht gibt, und sprang dabei eine volle Stunde weiter.',
        en: 'Prayer reminders sometimes arrived an hour late. On the night the clocks change, the app worked with a wall-clock time that does not exist on that day and skipped a full hour.',
      },
      {
        type: 'fix',
        de: 'Nach einem Zeitzonenwechsel, etwa auf Reisen, standen die geplanten Erinnerungen noch auf der alten Ortszeit. Sie werden jetzt sofort neu gesetzt, sobald das Telefon die Zeitzone wechselt.',
        en: 'After a time-zone change, for example while travelling, the scheduled reminders still pointed at the old local time. They are now rescheduled as soon as the phone switches zone.',
      },
      {
        type: 'improvement',
        de: 'Fehlt die Android-Freigabe „Wecker und Erinnerungen", steht der Hinweis jetzt direkt auf dem Gebetszeiten-Bildschirm, mit einem Knopf zum Erteilen. Ohne sie darf Android jede Erinnerung zum Stromsparen aufschieben.',
        en: 'When the Android permission for alarms and reminders is missing, the notice now sits right on the prayer times screen with a button to grant it. Without it Android is allowed to postpone every reminder to save battery.',
      },
    ],
  },
  {
    version: '1.49.1',
    date: '2026-08-15',
    entries: [
      {
        type: 'fix',
        de: 'Wer die Android-Freigabe „Wecker und Erinnerungen" nachträglich erteilt hat, bekam die Erinnerungen trotzdem weiter mit Verspätung: die bereits gesetzten Weckzeiten behalten das Zeitfenster von einer Stunde, das Android ihnen ohne die Freigabe gibt. Sie werden jetzt sofort neu gesetzt, statt erst beim nächsten Start der App.',
        en: 'If you granted the Android alarms-and-reminders permission after the fact, reminders still arrived late: the alarms already set keep the one-hour window Android gives them without the permission. They are now reset immediately instead of only on the next app start.',
      },
    ],
  },
];
/** Neueste Version zuerst - für die Anzeige im Changelog-Screen. */
export function changelogNewestFirst(): ChangelogVersion[] {
  return [...CHANGELOG].reverse();
}

/** Höchste (letzte) Versionsnummer im Changelog. */
export const LATEST_CHANGELOG_VERSION = CHANGELOG[CHANGELOG.length - 1].version;

/**
 * Liefert den Anzeigetext eines Eintrags für die aktuelle Sprache.
 * Siehe Kommentar am Dateianfang: nur 'de' hat einen eigenen Text, alle
 * anderen 13 App-Sprachen (inkl. 'en') fallen auf Englisch zurück.
 */
export function getChangelogText(entry: ChangelogEntry, locale: string): string {
  return locale === 'de' ? entry.de : entry.en;
}
