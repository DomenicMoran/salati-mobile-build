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
};

// Roh-Quelle je Slides-Sprache (Ordner unter store-assets/device/phone/).
export const RAW_LOCALE = { de: 'de-DE', en: 'en-US' };

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
