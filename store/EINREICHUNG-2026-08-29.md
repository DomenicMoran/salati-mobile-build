# Einreichung 2026-08-29 — Ladentexte, Datenschutz-Formulare, Prüfhinweis, Ladenbild

Stand: 2026-08-29. Vorbereitung für die gestaffelte Neu-Einreichung nach der zweiten
4.3(a)-Zurückweisung vom 27.08. **Nichts wurde in Play Console oder App Store Connect
eingetragen** — diese Datei liefert nur fertige Werte zum Übernehmen. Kein `eas build`,
kein `eas submit`, kein Emulator verwendet.

Aktueller ASC-Stand (`node scripts/asc-status.mjs`, live abgerufen): Version **1.51.0
REJECTED**, Build 75 (2026-08-25) VALID. Play/App-Analyse hier bezieht sich auf den
Code-Stand von Commit `2319d95d` (HEAD zu Sitzungsbeginn).

---

## 1. Die echten Zahlen — nachgezählt, nicht behauptet

| Zahl | Wert | Beleg |
|---|---|---|
| App-Sprachen (UI) | **14**, vollständig (1894 Schlüssel/Sprache, 0 fehlend/leer) | `src/locales/*.json` (ar bn de en es fa fr id ms ps ru sw tr ur), `src/lib/i18n.ts`, `docs/audit-2026-07-27/I18N-VOLLPRUEFUNG.md` §1 |
| „Koran lesen lernen" — Lektionen | **42** | Ausgezählt aus `src/features/learn/curriculum.ts` (`LESSONS`-Array: 7 Buchstabengruppen + similar + 3 forms + 3 haraka + 6 concept + 2 words + 5 reading = 27, plus `salah-words.json` 4 + `vocab.json` 11 = 42) |
| Koran-Vokabeln in diesem Kurs | **165 Wörter** | `src/features/learn/data/vocab.json`, aufsummiert über alle 11 Lektionen |
| „Salati Studium" — Kurse | **12** quellenbelegte Kurse (Kategorien `quranArabic` + `islamicStudies`, ohne den optionalen Bonus-Kurs „Dialekte") | `src/features/study/courses.ts`, `COURSE_DEFS` |
| „Salati Studium" — Lektionen gesamt | **327** (nicht 311, wie noch in `apps/mobile/store/listing/de.md`/`en.md` vom 19.08. steht) | Summe der 12 `lessonCount`-Werte in `courses.ts` (14+16+83+54+11+24+42+20+25+15+14+9), gegengerechnet gegen die echten JSON-Dateien in `src/features/study/data/*.json` — beide Summen sind identisch (327). Die Differenz zu 311 kommt daher, dass `fiqh-ibadat` (24 Lektionen) nach dem 19.08. als Kurs dazukam und `prophets`/`sahaba`/`akhlaq`/`nikah` seither gewachsen sind (Commit `a737c29d` u. a.) |
| Bonus-Kurs „Dialekte" | 28 Lektionen (4 Dialekte, nicht sequenziell) | `src/features/study/data/dialects.json`, extra genannt, nicht in den 327 mitgezählt |

Kein Wert ist Auslegungssache — beide „42" und „327" sind in Tests gegen die echten JSON-Dateien
abgesichert (Muster: `courses.test.ts`/`courseOrder.test.ts` vergleichen `lessonCount` gegen
`lessons.length` der geladenen Datei).

---

## 2. Neue Ladentexte — Deutsch und Englisch

Ersetzt die Zahlen in `apps/mobile/store/listing/de.md` und `en.md` (311 → 327) und entfernt
jeden Gedankenstrich „—" aus dem laufenden Text (bisher u. a. in der Einleitung, bei „Nach
deiner Moschee ausrichten", beim Mushaf-Absatz, beim Hifz-Trainer, beim Studium-Absatz und
im Podcast/Video/Reels-Block). Struktur bewusst anders als bei den Schwester-Apps: Salati
hat KEINE „UMGANG MIT DEINEN DATEN → ALLES ENTHALTEN → WAS [APP] NICHT TUT"-Dreierkette
(das Muster, das laut `Synapse/docs/aso.md` bei Aegis/Aether/Synapse wortgleich in derselben
Reihenfolge stand) — stattdessen inhaltliche Abschnitte nach Themen (Gebet, Koran, Lernkurs,
KI, Studium, Podcast/Video) und ein einziger Datenschutz-Absatz ganz am Ende mit eigenem,
nicht wiederverwendbarem Wortlaut. Salati bleibt vollständig kostenlos, ohne Abo — kein Feld
unten deutet einen Kaufweg oder Preis an.

### 2.1 Google Play — Deutsch

**Titel** (28/30):
```
Salati: Gebetszeiten & Koran
```

**Kurzbeschreibung** (78/80):
```
Gebetszeiten mit Adhan, Qibla-Kompass, Koran & Ramadan. Kostenlos, ohne Konto.
```

**Vollständige Beschreibung** (3994/4000):
```
Salati begleitet dich durch deinen Tag als Muslim: mit genauen Gebetszeiten, dem Koran, einer privaten KI und einem kompletten Kurs, um Koranlesen von Grund auf zu lernen. Komplett kostenlos, ohne Abo, ohne Konto und ohne Tracking.

GEBET & ALLTAG
• Gebetszeiten mit wählbaren Berechnungsmethoden, Benachrichtigung und Adhan (Gebetsruf, drei Stimmen, je Gebet einstellbar)
• Nach deiner Moschee ausrichten: Zeiten vom Aushang abtippen, Salati findet die passende Behörde aus 23 und stellt sie ein
• Qibla-Kompass und islamischer Kalender (Hijri)
• Gebets-Tracker mit Serie, behalte deine fünf Gebete im Blick
• Ramadan- und Fasten-Modus mit Suhur- und Iftar-Countdown, Qada-Zähler für versäumte Tage
• Zakat-Rechner mit jährlicher Stichtag-Erinnerung
• Moschee-Finder (OpenStreetMap) und Halal-Orte in der Nähe

KORAN
• Koran-Reader mit wählbaren Rezitatoren und Übersetzungen, die beste Übersetzung für deine Sprache ist vorausgewählt
• Doppelseiten-Mushaf im klassischen Uthmani-Layout mit echtem KFGQPC-Font, wie im gedruckten Koran
• Lesezeichen, Weiterlesen mit Leseverlauf, Juz-Navigation und Suren-Suche
• Tafsir und Verse teilen
• Offline-Audio: Rezitationen herunterladen und ohne Internet hören
• Khatmah-Leseplan, den ganzen Koran in deinem Tempo abschließen
• Hifz-Trainer mit Rezitations-Check: Aufnahme wird Wort für Wort geprüft, auf Wunsch mit lokalem KI-Modell (die Aufnahme verlässt nie dein Gerät)
• Wort-für-Wort-Ansicht mit wortsynchroner Hervorhebung während der Rezitation
• Tajweed-Farbkodierung, lateinische Umschrift, Volltextsuche und persönliche Vers-Notizen
• Themen-Vers-Sammlungen und Themen-Lesepläne für Selbstreflexion

KORAN LESEN LERNEN
Ein kompletter Kurs mit 42 Lektionen führt dich Schritt für Schritt vom arabischen Alphabet bis zu den ersten Suren:
• Alphabet, Verbindungsformen und Vokalzeichen
• Sonderzeichen und erste Wörter
• Erste Suren mit echter Rezitation
• Al-Fatiha Wort für Wort und die wichtigsten Gebetswörter
• 165 Koran-Vokabeln
Jede Lektion endet mit einem Quiz, dein Fortschritt schaltet die nächsten Lektionen frei.

SALATI KI
• Stell Fragen zu Koran, Hadithen und Duas: Antworten ausschließlich aus geprüften Quellen
• Läuft zu 100 % lokal auf deinem Gerät, kein Cloud-Zugriff, keine Daten verlassen dein Gerät
• Kennzeichnung als KI-generierte Antwort, keine Fatwa oder Gelehrten-Meinung

WISSEN & HERZ
• Studium: 12 quellenbelegte Kurse mit 327 Lektionen (Aqida, Tajwid, 40 Hadithe, Seerah, Propheten, Sahaba & Gelehrte, Akhlaq, Ehe & Familie, Quran-Grammatik, Alltags-Arabisch, Madinah-Arabisch (Bücher 1-4), arabische Dialekte), Reihenfolge frei wählbar
• Einstufungstest, Spaced-Repetition-Wiederholung, Schwächen-Training, Lernserie und Tagesziel
• Üben & Quiz: 14 Modi, plus Fehler-Wiederholung für gezieltes Nacharbeiten
• Wochen-Rückblick als teilbares Bild
• Abzeichen für erreichte Meilensteine
• Hadith-Sammlungen mit gemeinsamer Suche (Arabisch, Englisch, Türkisch)
• Koran-Radio: Rezitations-Streams rund um die Uhr
• 99 Namen Allahs mit Audio, Duas und Adhkar nach dem Gebet mit Quellenangabe
• Praxis-Guides mit Bildern: Wudu, Ghusl, Gebet, Janazah, Hajj, Umrah und mehr
• Zakat- und Erbrechts-Rechner, belegte Weisheiten, Tasbih-Zähler für Dhikr

PODCAST, VIDEOS & REELS
• Salati-Podcast „Sprache des Koran": Koran-Arabisch Folge für Folge erklärt, auch auf Spotify
• Lern-Videos mit Grammatik- und Vokabel-Tabellen sowie Lektions-Clips, auch auf YouTube
• Reels: kurze Lern-Clips für zwischendurch, auch auf Instagram
• PDF-Handouts zum Download

WAS AUF DEINEM GERÄT BLEIBT
Salati ist werbefrei, ohne Konto und ohne Tracking-SDKs. Dein Standort dient nur Gebetszeiten und der Umgebungssuche: dafür an AlAdhan (Gebetszeiten) und OpenStreetMap (Moscheen, Halal-Orte) übermittelt, anonym und jederzeit ablehnbar. Die Qibla-Richtung berechnet sich direkt auf dem Gerät, ohne Netzabruf. Die Kerninhalte funktionieren offline.

Fragen oder Feedback? salati@domenicmoran.de
Datenschutz: https://www.salati.pro/datenschutz
```

### 2.2 Google Play — English

**Title** (28/30):
```
Salati: Prayer Times & Quran
```

**Short description** (74/80):
```
Prayer times with Adhan, Qibla compass, Quran & Ramadan. Free, no account.
```

**Full description** (3948/4000):
```
Salati accompanies you through your day as a Muslim: accurate prayer times, the Quran, a private AI, and a complete course to learn to read Quran from scratch. Completely free, no subscription, no account, no tracking.

PRAYER & DAILY LIFE
• Prayer times with selectable calculation methods, notifications and Adhan (call to prayer, three voices, set per prayer)
• Match your mosque: type in the times from its timetable and Salati finds the right authority out of 23 and sets it
• Qibla compass and Islamic calendar (Hijri)
• Prayer tracker with streaks, keep your five daily prayers in view
• Ramadan and fasting mode with Suhoor and Iftar countdown, Qada counter for missed days
• Zakat calculator with an annual due-date reminder
• Mosque finder (OpenStreetMap) and halal places nearby

QURAN
• Quran reader with selectable reciters and translations, the best translation for your language is preselected
• Two-page Mushaf view in classic Uthmani layout with the authentic KFGQPC font, just like a printed Quran
• Bookmarks, continue reading with reading history, Juz navigation and Surah search
• Tafsir and verse sharing
• Offline audio: download recitations and listen without internet
• Khatmah plan, complete the whole Quran at your own pace
• Hifz trainer with recitation check: your recording is checked word by word, optionally with an on-device AI model (the recording never leaves your device)
• Word-by-word view with word-synced highlighting during recitation
• Tajweed color coding, transliteration, full-text search and personal verse notes
• Themed verse collections and themed reading plans for reflection

LEARN TO READ QURAN
A complete course of 42 lessons guides you step by step from the Arabic alphabet to your first Surahs:
• Alphabet, letter joining forms and vowel marks
• Special signs and first words
• First Surahs with real recitation
• Al-Fatiha word by word and the essential prayer words
• 165 Quran vocabulary words
Every lesson ends with a quiz; your progress unlocks the next lessons.

SALATI AI
• Ask questions about the Quran, Hadith and duas: answers drawn strictly from verified sources
• Runs 100% on your device, no cloud calls, no data ever leaves your device
• Labeled clearly as an AI-generated answer, not a fatwa or scholarly opinion

KNOWLEDGE & HEART
• Study: 12 source-referenced courses with 327 lessons (Aqidah, Tajwid, 40 Hadith, Seerah, Prophets, Companions & Scholars, Akhlaq, Marriage & Family, Quranic grammar, everyday Arabic, Madinah Arabic (books 1-4), Arabic dialects), order freely adjustable
• Placement test, spaced-repetition review, weakness training, learning streak and daily goal
• Practice & Quiz: 14 modes, plus a mistake review to revisit what tripped you up
• Weekly recap as a shareable image
• Badges for milestones reached
• Hadith collections with a shared search (Arabic, English, Turkish)
• Quran Radio: recitation streams around the clock
• 99 Names of Allah with audio, duas and adhkar after prayer with source references
• Practice guides with photos: Wudu, Ghusl, prayer, Janazah, Hajj, Umrah and more
• Zakat and inheritance calculators, sourced wisdoms, Tasbih counter for dhikr

PODCAST, VIDEOS & REELS
• Salati podcast "Language of the Quran": Quranic Arabic explained episode by episode, also on Spotify
• Learning videos with grammar and vocabulary tables plus lesson clips, also on YouTube
• Reels: short learning clips for on the go, also on Instagram
• Downloadable PDF handouts

WHAT STAYS ON YOUR DEVICE
Salati is ad-free, with no account and no tracking SDKs. Your location is used only for prayer times and nearby search: sent for that purpose to AlAdhan (prayer times) and OpenStreetMap (mosques, halal places), anonymous and always optional. The Qibla direction is calculated directly on your device, with no network call. Core content works offline.

Questions or feedback? salati@domenicmoran.de
Privacy policy: https://www.salati.pro/datenschutz
```

### 2.3 App Store Connect — Deutsch

**Name** (28/30): `Salati: Gebetszeiten & Koran`
**Untertitel** (27/30): `Koran, Qibla, Dhikr & Adhan`
**Werbetext / Promotional Text** (152/170):
```
Gebetszeiten mit Live Activity, der ganze Koran mit Rezitation, eine private KI und ein kompletter Kurs zum Koranlesen. Kostenlos, ohne Abo, ohne Konto.
```
**Keywords** (88/100): `islam,muslim,adhan,gebet,dua,hadith,tasbih,ramadan,zakat,hijri,moschee,quran,fasten,hifz`
**Beschreibung**: dieselbe wie 2.1 (Google Play — Deutsch), 3994/4000

### 2.4 App Store Connect — English

**Name** (28/30): `Salati: Prayer Times & Quran`
**Subtitle** (27/30): `Quran, Qibla, Dhikr & Adhan`
**Promotional Text** (168/170):
```
Prayer times with a Live Activity, the whole Quran with recitation, a private on-device AI, and a full course to learn to read Quran. Free, no subscription, no account.
```
**Keywords** (88/100): `islam,muslim,adhan,athan,salah,dua,hadith,tasbih,ramadan,zakat,hijri,mosque,fasting,hifz`
**Description**: same as 2.2 (Google Play — English), 3948/4000

Live Activity ist real vorhanden und iOS-spezifisch — `src/features/prayer-times/live-activity.ios.tsx`,
`live-activity.ts`, `ios-widget.ts` — daher nur im Apple-Werbetext erwähnt, nicht im
plattformneutralen Haupttext.

---

## 3. Datenschutz-Angaben — Codestelle für jeden Netzaufruf

Alle externen `fetch`/`fetchJson`-Aufrufe der App durchgesehen (`grep -rEn "https?://" src`).
Ergebnis nach Datentyp:

| Ziel | Was geht raus | Codestelle | Zweck |
|---|---|---|---|
| `api.aladhan.com` | **Präzise GPS-Koordinaten** (lat/lon) | `src/features/prayer-times/api.ts:141,161,196` | Gebetszeiten-Berechnung |
| `overpass-api.de` | **Präzise GPS-Koordinaten** (lat/lon, als Radius-Mittelpunkt im Query-Body) | `src/features/mosques/overpass.ts:62-66,102-106` | Moschee-Finder und Halal-Orte in der Nähe |
| `nominatim.openstreetmap.org` | **Nur getippter Text** (Stadtname aus dem Suchfeld) — **keine** Geräte-GPS-Koordinaten | `src/features/location/nominatim.ts:26-33` (`searchCity(query)`), aufgerufen aus `onboarding.tsx`/`settings.tsx` bei manueller Ortssuche | Manuelle Stadtsuche als Alternative zum Geräte-Standort |
| `world.openfoodfacts.org` | **Nur die gescannte Barcode-Ziffernfolge**, kein Bild, kein Standort | `src/features/halal-scanner/api.ts:12,128` | Halal-Klassifikation von Lebensmitteln |
| R2 (`pub-d0489c…r2.dev`), `huggingface.co`, `api.alquran.cloud`, `audio.qurancdn.com` u. a. | Nur Downloads (Koran-Text/-Audio, KI-Korpus, Whisper-Modell) — **keine** Nutzerdaten im Request | diverse, u. a. `src/features/ki/korpus.ts:198`, `src/features/hifz/whisperModel.ts` | Inhalte laden |
| — | **Keine** Netzanfrage bei der Rezitationsprüfung selbst | kein `fetch(` in `src/features/hifz/*.ts` (grep-geprüft) | Aufnahme bleibt auf dem Gerät |
| — | **Keine** Netzanfrage bei der Salati-KI-Anfrage selbst | `src/features/ki/*` lädt nur statisches Korpus-JSON, sendet die Nutzerfrage nirgends hin | Anfrage bleibt auf dem Gerät |
| — | **Kein** Server-Roundtrip beim Geräte-Sync | `src/features/sync/codeSync.ts` erzeugt nur einen lokalen Code, der Nutzer transportiert ihn selbst | — |

**Korrektur gegenüber `PRIVACY-LABELS-TODO.md` vom 27.07.:** Diese Datei nennt Nominatim
bislang in einem Atemzug mit Aladhan/Overpass als Empfänger von „Koordinaten". Das ist nach
dem heutigen Code-Stand **zu weit gefasst** — `searchCity()` nimmt ausschließlich den vom
Nutzer eingetippten Suchtext entgegen, nie `lat`/`lon` des Geräts. Für die Formulare ändert
das nichts an der Kern-Antwort („Standort: geteilt" bleibt richtig, getragen allein von
Aladhan + Overpass), aber die Aufzählung der Drittempfänger auf der Datenschutzseite sollte
Nominatim nicht mehr unter „Standort" führen.

### 3.1 Apple — App-Datenschutz-Fragebogen (App 6791867298, Salati Islam)

| Frage | Antwort |
|---|---|
| Erfasst die App oder erfassen Drittanbieter-Partner Daten? | **Ja** |
| Datentyp | **Standort** (Ungefährer Standort + Genauer Standort ankreuzen) |
| Verwendungszweck | **App-Funktionalität** (einzige Option) |
| Mit der Identität des Nutzers verknüpft? | **Nein** — kein Konto, keine Nutzer-ID irgendwo im Request |
| Zum Tracking verwendet? | **Nein** — kein IDFA, kein ATT-Prompt nötig |
| Ergebnis auf der Produktseite | Abschnitt „Nicht mit dir verknüpfte Daten → Standort" |
| Alle anderen Kategorien (Kontakte, Fotos, Nachrichten, Finanzdaten, Browserverlauf, Kennungen …) | **Nicht ankreuzen** — kein Beleg im Code |

### 3.2 Google Play — Datensicherheit (`de.salatibox.de`, Salati)

| Frage | Antwort |
|---|---|
| Erhebt/teilt die App Nutzerdaten? | **Ja** |
| Bei Übertragung verschlüsselt? | **Ja** (beide Endpunkte nur über HTTPS/TLS erreichbar) |
| Löschung beantragbar? | **Nein** — es liegen keine Daten bei uns; lokale Daten löscht der Nutzer selbst (Einstellungen → Speicher, oder Deinstallation) |
| Datentyp | **Standort** → Ungefährer Standort **und** Genauer Standort ankreuzen; alle 12 übrigen Kategorien leer lassen |
| Erhoben, geteilt oder beides? | **Nur „geteilt"** — Salati speichert die Koordinaten nirgends selbst, reicht sie nur an Aladhan/Overpass weiter |
| Für die App-Nutzung erforderlich? | **Nutzer können auswählen** (App funktioniert mit manueller Stadteingabe weiter) |
| Warum geteilt? | **Nur „App-Funktionalität"** |
| Werbung | „Enthält keine Werbung" — 0 Treffer beim Abgleich aller `dependencies` gegen 20 bekannte Ad-/Tracking-SDKs |
| IARC — nutzergenerierte Inhalte | **Nein** — kein Konto, kein Feed, kein Chat zwischen Nutzern |
| Mikrofon-Berechtigung sichtbar, aber Audiodaten nicht ankreuzen | Manifest hat `RECORD_AUDIO` (verifiziert, `android/app/src/main/AndroidManifest.xml`), aber kein `fetch(` in `src/features/hifz/` — die Berechtigung existiert, es wird trotzdem nichts übertragen |

### 3.3 Strittige Punkte, beide Lesarten

1. **Nominatim (Stadtsuche).** Lesart A: nicht deklarieren, weil nur getippter Text rausgeht,
   keine Geräte-Standortdaten. Lesart B (vorsichtiger): trotzdem als weiterer Standort-Empfänger
   nennen, weil ein Stadtname faktisch eine Ortsangabe ist. **Empfehlung: Lesart A für die
   Formulare** (Play/Apple fragen nach Gerätestandortdaten, nicht nach beliebigem Nutzertext;
   eine Falschdeklaration in die andere Richtung — „Standort erhoben" obwohl nur Text gesendet
   wird — wäre selbst ungenau), aber **Lesart B für die Datenschutzerklärung** (Fließtext, kein
   Formular-Zwang binär zu antworten) — dort Nominatim als Empfänger weiterhin nennen, nur nicht
   in der Kategorie „Standort/GPS", sondern als „von dir eingegebene Ortssuche".
2. **Barcode-Scanner (Open Food Facts).** Lesart A: nicht deklarieren, ein Produkt-Barcode ist
   keine personenbezogene oder gerätebezogene Angabe. Lesart B: unter „Sonstige Daten" aufführen,
   weil trotzdem ein Netzwerkaufruf mit Nutzereingabe an einen Dritten geht. **Empfehlung: Lesart
   A** — weder Play noch Apple listen „Barcode" als eigene Datenkategorie, und eine Aufnahme unter
   einer unpassenden Kategorie (z. B. „Fotos") wäre falsch, nicht vorsichtig.

---

## 4. Prüfhinweis (App Review Information) — was falsch war

Live aus App Store Connect gelesen (`appStoreReviewDetail`, read-only, Version 1.51.0
REJECTED sowie die letzten vier Versionen davor — überall identischer Text):

> „Alle Funktionen sind ohne Konto nutzbar. Die KI-Rezitationspruefung laeuft vollstaendig
> lokal auf dem Geraet (ONNX-Modell, selbst gehostet)."

**Fehler:** Das native iOS/Android-Modell ist **kein ONNX-Modell**. `src/features/hifz/whisperModel.ts`
lädt ein **GGML**-Whisper-Modell (`whisper.rn`, Basis `tarteel-ai/whisper-base-ar-quran`,
Apache-2.0, selbst nach GGML konvertiert und q5_0-quantisiert, gehostet auf eigenem R2). ONNX
kommt ausschließlich in der **Web-Version** vor (`whisperCheck.web.ts` → `transformers.js`,
`onnx-community/whisper-base`) — die Web-Version sieht ein App-Prüfer aber nie, er testet den
nativen Build. Der Hinweis beschrieb also exakt die Technik, die im geprüften Build gar nicht
läuft — dieselbe Art Fehler wie bei den drei Schwester-Apps, nur hier nicht auf einen
nicht-existenten Bildschirm bezogen, sondern auf eine nicht-existente Modell-Technik.

**Korrigierter Text, Schritt für Schritt selbst nachvollzogen** (Tab-Leiste „Lernen"/Kappen-
Symbol → „Rezitieren"/„Recitation", `src/lib/lernenNav.ts:20` → `/hifz`; Sure wählen; Mikrofon-
Berechtigung erlauben; vorlesen):

```
Alle Funktionen sind ohne Konto nutzbar, kein Login noetig. Rezitations-Check: unterer
Tab "Learn" (Kappen-Symbol) > "Recitation" > Sure waehlen > Mikrofon-Berechtigung erlauben
> vorlesen. Die Pruefung laeuft vollstaendig auf dem Geraet ueber ein GGML-Whisper-Modell
(Basis: tarteel-ai/whisper-base-ar-quran, Apache-2.0), selbst konvertiert und auf eigenem
Server gehostet - keine Aufnahme verlaesst das Geraet. Gebetszeiten und die Moschee-/
Halal-Suche senden dafuer den Geraetestandort an api.aladhan.com bzw. overpass-api.de
(im App-Datenschutz als Standort/App-Funktionalitaet hinterlegt, nicht mit der Identitaet
verknuepft).
```

Kontaktfelder unverändert (live geprüft, weiterhin korrekt): Domenic Moran,
+493076764546, info@menucloud-berlin.de, kein Demo-Account nötig.

---

## 5. Ladenbild-Fehler behoben

`store-assets/out/appstore/{en,de}/01-01-gebetszeiten.png` zeigte einen grauen,
abgerundeten Rechteck-Artefakt über der rechten Hälfte der Kaaba-Karte (vom Zahnrad-Symbol
bis knapp über die Gebetszeiten-Liste). Ursache gefunden per Vergleich: die **Roh-Aufnahme**
(`store-assets/device/phone/{de-DE,en-US}/01-gebetszeiten.png`) ist sauber — der Fehler
entstand erst beim Rendern durch `store-assets/build/render.mjs` (Playwright/Chromium,
`page.setContent` + Screenshot), offenbar ein einmaliger Compositing-Aussetzer, kein
CSS-Fehler im Skript selbst. Neu gerendert mit demselben, unveränderten Skript aus den
vorhandenen Roh-Aufnahmen (`node store-assets/build/render.mjs appstore`, kein Emulator,
reines Headless-Chromium) — beide Bilder danach visuell geprüft, Artefakt weg, sonst
pixelgleicher Inhalt. Nur die zwei betroffenen Dateien geändert; alle anderen währenddessen
neu geschriebenen Slides wurden auf den committeten Stand zurückgesetzt (`git show HEAD:… >
Datei`), um den Diff auf die tatsächliche Korrektur zu beschränken.

### 5.1 Nachtrag — Bild 01 bestätigt sauber, Bilder 2–8 tatsächlich angesehen

Auf Nachfrage: Ja, Bild 01 war zu diesem Zeitpunkt bereits fertig und committet
(Commit `52557c0d9689f438bb556227a2128c8b35440025`). Zusätzlich alle acht Motive für
**beide** Sprachen einzeln als Bild angesehen (nicht nur Maße/Dateigröße geprüft),
gezielt auf abgeschnittene Elemente, Text über dem Rand, Sprachmischung und
arabische Platzhalter-Glyphen/gepunktete Kreise:

| Slide | Befund |
|---|---|
| 02 Koran | Sauber, beide Sprachen. Arabischer Vers-Text (Al-Fatiha) rendert korrekt, keine Platzhalter-Glyphen, keine gepunkteten Kreise. Übersetzung passt zur jeweiligen UI-Sprache |
| 03 KI | **Fehler gefunden, jetzt behoben.** Siehe 5.2 |
| 04 (ausgeliefert als `04-04-einstellungen.png`) | Kein Bild an falscher Stelle, aber veraltet — siehe 5.3 |
| 05 Qibla | Sauber, beide Sprachen |
| 06 Tracker | Sauber, beide Sprachen |
| 07 Tasbih | Sauber, beide Sprachen. Arabischer Dhikr-Text („سُبْحَانَ اللَّهِ") rendert korrekt, keine Platzhalter-Glyphen |
| 08 Kalender | Sauber, beide Sprachen (DE zeigt Juli, EN zeigt August 2026 — unterschiedliche Aufnahmezeitpunkte, kein Rendering-Fehler, arabischer Text „صلى الله عليه وسلم" im EN-Kalendereintrag korrekt) |

### 5.2 Slide 03 (Salati KI) — abgeschnittene Sprechblase, gefunden und behoben

In **beiden** Sprachen lag am oberen Rand der Chat-Liste eine System-Sprechblase
(„…antworte ausschließlich auf dieser Grundlage." / „…course texts, and answer based
only on those.") nur zur Hälfte im Bild — oben von der festen Erklärungs-Box
abgeschnitten, unten eine sichtbare, nicht bis zum Blasenrand reichende Kante. Genau
die Art Fehler, die messbare Maße nicht zeigen. Ursache: **in der Roh-Aufnahme selbst**
(`store-assets/device/phone/{de-DE,en-US}/03-ki.png`), nicht im Compositing — die
App hat die Konversation an dieser Scroll-Position aufgenommen. Ohne Emulator lässt
sich der Screen nicht neu erfassen.

Statt den fehlenden Bubble-Inhalt zu erfinden, nach demselben Muster behoben, das
`render.mjs` bereits für die Statusleiste verwendet (Übermalen mit der echten
Hintergrundfarbe `#f7f3ea`, keine erfundenen Pixel): die abgeschnittene Blase in
beiden fertigen PNGs mit einem Rechteck in exakt dieser Hintergrundfarbe überdeckt,
Grenzen aus den Bildpixeln selbst vermessen (nicht geschätzt). Ergebnis: die Lücke
zwischen der Erklärungs-Box und der schwarzen Nutzerfrage-Blase ist jetzt schlicht
leerer Freiraum, kein sichtbarer Rest der Blase mehr, keine Übermalung reicht in die
Telefon-Blende hinein (mit Bildpixel-Messung der Bildschirm-Innenkante geprüft,
ein erster Versuch griff 18 px zu weit links und wurde verworfen). Beide Bilder
danach erneut angesehen. Dateien: `store-assets/out/appstore/{de,en}/03-03-ki.png`.
Die zugrundeliegende Roh-Aufnahme bleibt fehlerhaft — bei der nächsten echten
Neuaufnahme (Emulator/Gerät) muss die KI-Konversation von oben (Scroll-Position 0)
aufgenommen werden, nicht aus der Mitte der Konversation.

### 5.3 Slide 04 — kein falsches Bild an falscher Stelle, aber veraltet

Die Namensdrift `04-moschee` (aktueller Wert in `store-assets/build/slides.mjs`,
seit Commit `e70bcb32`) gegen `04-quelle`/`04-einstellungen` (Dateien, die tatsächlich
in `store-assets/device/phone/*` bzw. `store-assets/out/appstore/*` liegen) führt
**zu keinem falschen Bild an einer falschen Stelle**. Das ausgelieferte
`04-04-einstellungen.png` zeigt einen echten, funktionierenden Screen (Berechnungs-
methoden-Einstellungen), dessen Überschrift „Zeiten, die zu deiner Moschee passen"
und Unterzeile „13 Berechnungsmethoden, Asr-Schule und Hochbreiten-Regel" zueinander
und zum gezeigten Screen passen — in sich konsistent, nicht kaputt. Es ist nur
**inhaltlich veraltet**: `slides.mjs` will seit dem 28.07. eigentlich einen anderen
Screen an dieser Stelle zeigen (Moschee-Zeiten-Abgleich statt Berechnungsmethoden-
Liste), aber die dafür nötige Roh-Aufnahme (`04-moschee.png`) existiert in
`store-assets/device/phone/*` nicht — ein voller Render-Lauf bricht deshalb an
dieser Stelle mit `ENOENT` ab (selbst reproduziert). Das erklärt, warum das alte
Bild nie ersetzt wurde. Separat davon, beim Ansehen gefunden: In der **englischen**
Fassung fehlt am oberen Rand der Einstellungs-Liste die fette Zeile „Automatic
(recommended)" — die Liste beginnt dort direkt mit dem Beschreibungstext, weil die
EN-Aufnahme einige Pixel weiter herunter-gescrollt ist als die DE-Aufnahme (DE zeigt
den Titel vollständig). Kleinerer, eigenständiger Fehler, nicht behoben (keine
Priorität laut Auftrag, und ohne Neuaufnahme nicht sauber zu schließen — der
fehlende Titeltext lässt sich nicht verlustfrei nachzeichnen).

---

## 6. Offen — nicht aus dem Repo belegbar oder nicht Teil dieses Auftrags

| Punkt | Status |
|---|---|
| `www.salati.pro/datenschutz` live aktualisieren (Nominatim-Präzisierung aus §3, neue Zahlen) | separates Deploy, nicht Teil dieses Repo-Laufs |
| Play-Datensicherheit + Apple-Privacy-Label tatsächlich in den Konsolen setzen | **Handarbeit** — Werte stehen in §3.1/3.2 |
| Ladentexte in `apps/mobile/store/listing/de.md`/`en.md` und in Play/ASC eintragen | **Handarbeit** — Werte stehen in §2 |
| Prüfhinweis in ASC eintragen | **Handarbeit** — Text steht in §4 |
| Screenshots 2-8 einzeln angesehen (nicht nur vermessen) | **Erledigt, siehe 5.1-5.3.** Fehler auf Slide 03 gefunden und behoben (5.2). Slide 04 inhaltlich veraltet, aber kein falsches Bild an falscher Stelle (5.3) |
| `04-moschee`/`04-quelle`-Namensdrift in `store-assets/build/slides.mjs` vs. den Roh-Dateien | **Nicht dringend** (siehe 5.3) — liefert kein falsches Bild aus, nur einen inhaltlich veralteten Screen. Braucht eine neue Roh-Aufnahme `04-moschee.png` (Emulator/Gerät), dann `node store-assets/build/render.mjs appstore` erneut laufen lassen |
| Slide 04 EN: fehlender Zeilentitel „Automatic (recommended)" (Scroll-Position weicht von DE ab) | gefunden (5.3), nicht behoben — braucht eine neue Roh-Aufnahme, keine Priorität laut Auftrag |
| Slide 03 Roh-Aufnahme (`03-ki.png`, beide Sprachen) zeigt weiterhin eine abgeschnittene System-Blase | im fertigen Ladenbild überdeckt (5.2), aber bei der nächsten Neuaufnahme sollte die KI-Konversation von Scroll-Position 0 aus aufgenommen werden |
| KFGQPC-Font-Lizenz, Bubenheim-Übersetzung, ElevenLabs-Plan-Status | weiterhin offen laut `PRIVACY-LABELS-TODO.md`, unverändert seit 27.07. |
