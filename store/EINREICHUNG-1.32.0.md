# Einreichung 1.32.0 — Vorbereitung, Befunde und Klickliste

Stand: 2026-07-27. Erstellt vor dem Build; **es wurde nichts gebaut und nichts hochgeladen.**

Grundlage: `docs/audit-2026-07-27/*.md`, `store/PRIVACY-LABELS-TODO.md`,
`store/listing/data-safety.md`, eigene Live-Abrufe (Play-API, App-Store-Connect-API,
curl gegen `www.salati.pro`) und eigene Messungen der Store-Texte.

Jede Zeile unten ist entweder eine Messung oder ein API-Abruf. Wo etwas nicht geprüft
werden konnte, steht es ausdrücklich dabei.

---

## 1. Ampel

| | Was | Zustand |
|---|---|---|
| ROT | Version im Repo steht auf 1.31.0 | Bump fehlt (Abschnitt 3.1) |
| ROT | 7 von 14 Play-Vollbeschreibungen sind über 4000 Zeichen | `play-publish.mjs` schneidet still die Datenschutz-URL ab (3.2) |
| ROT | Live-Website ist älter als das Repo | Store-Prüfer rufen eine Datenschutzerklärung ab, die AlAdhan nicht nennt (3.3) |
| ROT | `RECORD_AUDIO` fehlt im mitgelieferten Android-Manifest | Rezitations-Prüfung würde im Release scheitern (3.4) |
| GELB | Play-Kontaktadresse und iOS-Store-Texte sind veraltet | (3.5, 3.6) |
| GELB | Screenshots stammen vom 2026-07-19 | zeigen die neuen KI-Screens nicht (3.7) |
| GRÜN | Changelog + Release-Notes 1.32.0 | erzeugt, in allen Grenzen (2.2) |
| GRÜN | Datenschutz-URL | `https://www.salati.pro/datenschutz` → HTTP 200 (5) |
| GRÜN | Keine Werbung, keine Analytik, kein Tracking-SDK | im Code verifiziert (4.0) |
| HAND | Play-Datensicherheit und Apple-Privacy-Label | haben keinen API-Endpunkt, müssen geklickt werden (4) |

---

## 2. Was im Repo vorhanden ist

### 2.1 Store-Metadaten

| Artefakt | Bestand | Bewertung |
|---|---|---|
| `store/listing/<lang>.md` | 14 Sprachen: ar bn de en es fa fr id ms ps ru sw tr ur | Titel, Kurzbeschreibung, Vollbeschreibung, Keywords, App-Store-Untertitel je Datei |
| `store/listing/data-safety.md` | 1 Datei | Ausfüllhilfe mit Begründungen für das Play-Formular |
| `store/graphics/play-icon-512.png` | 512×512, 11 KB | passt (Play verlangt 512×512, ≤ 1 MB) |
| `store/graphics/feature-graphic-1024x500.png` | 1024×500, 502 KB | passt |
| `store/screenshots/<lang>/phone` | 6 Sprachen (ar de en es fr tr) × 6 Bilder, 1290×2796 | passt für Play **und** für den Apple-6,9″-Slot |
| `store/screenshots/<lang>/tablet` | dieselben 6 Sprachen × 6 Bilder, 2048×2732 | passt für Play-10″ und Apple-13″-iPad |
| `store/release-notes-1.32.0.json` | 6 Play-Sprachen | erzeugt aus `changelog.ts` |
| `store/whatsnew-1.32.0.json` | 9 ASC-Sprachen | erzeugt aus `changelog.ts` |
| `store/release-notes-1.32.0.{de,en}.txt` | Copy-Paste-Fassung | Play- und ASC-Block je Sprache |

**Messung aller Listing-Dateien gegen die Store-Grenzen** (gleicher Parser wie
`scripts/play-publish.mjs`; Zeichen inkl. der CRLF-Zeilenenden, die in den Dateien
tatsächlich stehen):

| Sprache | Titel /30 | Kurz /80 | Voll /4000 | Untertitel /30 | Keywords /100 |
|---|---|---|---|---|---|
| ar | 29 | 69 | 3667 | 29 | 76 |
| bn | 29 | 64 | 3830 | 27 | 83 |
| de | 29 | 78 | **4013** | 27 | 88 |
| en | 29 | 79 | **4018** | 27 | 88 |
| es | 24 | 73 | **4025** | 22 | 89 |
| fa | 25 | 70 | 3845 | 23 | 73 |
| fr | 24 | 71 | **4026** | 22 | 90 |
| id | 28 | 75 | **4022** | 27 | 89 |
| ms | 28 | 74 | 3979 | 27 | 87 |
| ps | 28 | 75 | 3863 | 29 | 75 |
| ru | 29 | 70 | **4026** | 27 | 90 |
| sw | 23 | **80** | **4034** | **30** | 98 |
| tr | 29 | 76 | 3999 | 28 | 84 |
| ur | 28 | 77 | 3845 | 26 | 73 |

Fett = an oder über der Grenze. Titel, Kurzbeschreibungen, Untertitel und Keywords sind
überall zulässig (sw liegt bei Kurzbeschreibung und Untertitel exakt auf der Grenze — jede
weitere Änderung dort kippt die Datei über das Limit). Zu den sieben Vollbeschreibungen
siehe 3.2.

### 2.2 Changelog und Release-Notes 1.32.0

`src/features/changelog/changelog.ts` enthält jetzt den Block `1.32.0` (2026-07-27,
10 Einträge: 3 × feature, 5 × improvement, 2 × fix). Die Sprachpolitik der Datei bleibt
unangetastet (eigene Texte nur de + en, die übrigen 12 App-Sprachen fallen bewusst auf
Englisch zurück).

Erzeugt mit `node scripts/release-notes.mjs 1.32.0`:

- `store/release-notes-1.32.0.json` — Play, max 500: de-DE 489, en-US/tr-TR/ar/es-ES/fr-FR 479
- `store/whatsnew-1.32.0.json` — ASC, max 4000: de-DE/de 1591, alle übrigen 1521

Beide Dateien sind **generierte Artefakte**. Wird der Changelog-Text noch geändert,
den Generator erneut laufen lassen und danach die beiden `.txt` neu ableiten — nicht
von Hand nachpflegen.

### 2.3 Was in den Store-Metadaten fehlt

| Fehlt | Auswirkung |
|---|---|
| Screenshots für bn, fa, id, ms, ps, ru, sw, ur | Play zeigt dort die de-DE-Bilder; kein Ablehnungsgrund, aber die 8 Sprachen haben Texte ohne passende Bilder |
| Play-Locales für dieselben 8 Sprachen | `scripts/play-publish.mjs` kennt nur de, en, tr, ar, es, fr — die anderen 8 Listing-Dateien werden nie hochgeladen |
| ASC-Lokalisierungen außer en-US und de-DE | live abgefragt: die App hat in App Store Connect **nur diese zwei**; die 7 zusätzlichen Sprachen in `whatsnew-1.32.0.json` laufen ins Leere |
| Promotional Text (ASC) | beide Locales haben 0 Zeichen — ungenutztes Feld, ohne Review änderbar |
| 7-Zoll-Tablet-Screenshots | optional, Play verlangt sie nicht |

---

## 3. Vor dem Build im Repo zu erledigen

Diese Punkte liegen außerhalb des Bearbeitungsbereichs dieser Vorbereitung und wurden
**nicht** geändert.

### 3.1 Versionsnummern (ROT)

| Datei | steht auf | muss auf |
|---|---|---|
| `app.config.ts:7` `version` | `1.31.0` | `1.32.0` |
| `app.config.ts:61` `ios.buildNumber` | `51` | `52` |
| `android/app/build.gradle:109` `versionCode` | `51` | `52` |

Play-Produktion läuft laut API bereits auf versionCode 51 — ein erneuter Upload mit 51
wird abgelehnt. `versionName` wird aus `appVersionName` in der Gradle-Datei abgeleitet
und zieht die `expo-updates`-`runtimeVersion` mit.

### 3.2 Sieben Vollbeschreibungen über der Play-Grenze (ROT)

`scripts/play-publish.mjs:79` sendet `full.slice(0, 4000)`. Die Listing-Dateien haben
CRLF-Zeilenenden (im Git-Blob, nicht durch die Windows-Auscheckung — `core.autocrlf=false`),
und jedes `\r` zählt mit. Ergebnis für de: 4013 Zeichen, davon werden 13 abgeschnitten —
und zwar genau am Ende:

```
… salati@domenicmoran.de
Datenschutz: https://www.salati.p      ← hier endet der hochgeladene Text
```

Betroffen: de, en, es, fr, id, ru, sw. In allen sieben Fällen fällt die
Datenschutz-Zeile mitten in der URL ab. Die im Dateikopf notierten Zählungen
(„3953/4000") stimmen — sie wurden ohne die `\r` gerechnet.

Zwei mögliche Fixes, beide klein:

1. In `parseListing()` normalisieren: `md.replace(/\r\n/g, '\n')` direkt nach dem Einlesen.
   Damit landen alle 14 Sprachen unter 4000 (längste: sw 3976, dann fr 3968, de 3953) und die Zählungen im
   Dateikopf werden wieder maßgeblich. **Empfohlen.**
2. Die Dateien auf LF umstellen (`.gitattributes` mit `*.md text eol=lf`).

Ohne einen der beiden Fixes nicht hochladen.

### 3.3 Live-Website ist älter als das Repo (ROT)

`node scripts/release-check.mjs` meldet:

```
FEHLER  KI-Korpus (Web)   live 7030/w-umgang-mit-fehlern-und-reue-1
                          vs. Repo 7084/… — Website neu deployen
```

Der eigene Abruf von `https://www.salati.pro/datenschutz` bestätigt denselben Rückstand:
Die **live** ausgelieferte Erklärung nennt AlAdhan, Supabase, Cloudflare, HuggingFace,
mp3quran, Open Food Facts und Vercel **nicht** und hat weder „Rechtsgrundlagen" noch
„Speicherdauer", „Drittlandtransfer" oder Art. 77. Im Repo (`src/locales/*.json`,
`datenschutz.*`) steht die vollständige, 15-teilige Fassung aus Commit `9fbff6c`.

Das ist der eigentliche Einreichungs-Blocker: Nach Abschnitt 4 wird bei Play und Apple
erklärt, dass Standortdaten an Dritte gehen. Beide Konsolen rufen die hinterlegte
Datenschutz-URL automatisch ab. Solange dort die alte Fassung liegt, widersprechen sich
Formular und Erklärung — genau der Befund S2 des Audits.

**Also: salati.pro neu deployen, bevor die Formulare abgeschickt oder der Build
eingereicht wird.** Danach `node scripts/release-check.mjs` bis 0 Befunde.

### 3.4 `RECORD_AUDIO` fehlt im Android-Manifest (ROT)

`app.config.ts:149` setzt für `expo-audio` korrekt `recordAudioAndroid: true` samt
`microphonePermission`. Das mitgelieferte `android/app/src/main/AndroidManifest.xml`
enthält aber **keine** `RECORD_AUDIO`-Zeile (geprüft: 15 `uses-permission`-Einträge,
keiner davon Audio). `.easignore:34` behält `android/`-SOURCE bewusst im Upload — EAS
baut also aus genau diesem Manifest, ohne Prebuild.

Die Rezitations-Prüfung im Hifz-Trainer nimmt real über das Mikrofon auf
(`src/features/hifz/whisperCheck.ts` → `@fugood/react-native-audio-pcm-stream`). Ohne
die Berechtigung im Manifest scheitert sie auf Android zur Laufzeit.

Vor dem Build entweder `npx expo prebuild -p android` laufen lassen (und danach
`git status` prüfen — Prebuild löscht bekanntermaßen `android/wear/*`) oder die Zeile
`<uses-permission android:name="android.permission.RECORD_AUDIO"/>` von Hand ergänzen.
Danach im fertigen AAB/APK gegenprüfen.

Folge für die Store-Formulare: Play zeigt die Mikrofon-Berechtigung dann in der
Berechtigungsliste. Im Datensicherheitsformular ist **trotzdem nichts anzukreuzen** —
die Aufnahme verlässt das Gerät nicht (kein einziger `fetch(` in `src/features/hifz/`,
selbst geprüft).

### 3.5 Play-Kontaktadresse (GELB)

Play-API `edits/details` liefert `contactEmail: salati@domenicmoran.de`.
Impressum, App-Texte und die Listing-Dateien nennen inzwischen `salati@domenicmoran.de`.
Angleichen (Klickpfad in 4.3).

### 3.6 iOS-Store-Texte sind zwei Feature-Generationen alt (GELB)

Live aus der ASC-API:

| Locale | Beschreibung | Keywords | Untertitel |
|---|---|---|---|
| de-DE | 2831 Zeichen | 98 | „Koran, Qibla, Dhikr & Adhan" |
| en-US | 2729 Zeichen | 99 | „Quran, Qibla, Dhikr & Adhan" |

Die Repo-Fassungen sind 4013 bzw. 4018 Zeichen lang (nach dem CRLF-Fix 3953/3958) und
enthalten die KI-, Podcast- und Mushaf-Abschnitte, die in ASC fehlen. Der Untertitel im
Repo lautet abweichend „Gebetszeiten, Qibla & Koran" (27/30). Beschreibung, Keywords und
Untertitel lassen sich mit der nächsten Version einreichen; eine reine Textänderung
braucht keinen neuen Build, aber eine Version im Status „Vorbereitung".

### 3.7 Screenshots (GELB)

Die 72 Bilder stammen vom 2026-07-19 und zeigen weder den ausgebauten KI-Chat (Verlauf,
antippbare Quellen) noch die neuen Zurück-Knöpfe. Kein Ablehnungsgrund. Wenn sie neu
erzeugt werden: `scripts/marketing-screenshots.mjs` existiert bereits.

---

## 4. Was ein Mensch klicken muss

Play-Datensicherheit, IARC-Fragebogen und Apple-Privacy-Label haben in der
Android-Publisher-API v3 bzw. der App-Store-Connect-API **keinen Endpunkt**. Sie sind nur
in der Web-Konsole änderbar. Ausführliche Begründung je Feld:
`store/PRIVACY-LABELS-TODO.md` und `store/listing/data-safety.md`.

### 4.0 Die Datenlage, auf der die Antworten beruhen (selbst verifiziert)

| Behauptung | Prüfung | Ergebnis |
|---|---|---|
| Keine Werbung, keine Analytik, kein Tracking | Abgleich aller `dependencies`/`devDependencies` gegen ein Muster aus 20 Anbietern (Firebase, Sentry, Amplitude, PostHog, Mixpanel, Segment, AdMob, AppsFlyer, Adjust, Crashlytics, OneSignal, Branch …) | **0 Treffer** |
| Standort ist Kernfunktion und geht an Dritte | `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` im Manifest, `NSLocationWhenInUseUsageDescription` in `app.config.ts:76`; Koordinaten gehen an `api.aladhan.com`, `overpass-api.de`, `nominatim.openstreetmap.org` | bestätigt |
| Kein Hintergrund-Standort | nur „When in use", keine `ACCESS_BACKGROUND_LOCATION` | bestätigt |
| Mikrofon nur lokal | kein einziger `fetch(` in `src/features/hifz/`; whisper.rn arbeitet auf dem Gerät | bestätigt |
| Kamera nur für Barcodes | `expo-camera` mit `cameraPermission` für den Halal-Scanner; übertragen wird der **Barcode**, kein Bild (`src/features/halal-scanner/api.ts:12` → `world.openfoodfacts.org`) | bestätigt |
| „Fortschritt übertragen" lädt nichts hoch | Code erzeugt einen Code lokal, der Nutzer transportiert ihn selbst | bestätigt |
| Kein Konto, kein Login, keine Push-Tokens | keine Auth-Abhängigkeit, Benachrichtigungen werden lokal geplant | bestätigt |

Daraus folgt: **einziger zu deklarierender Datentyp ist der Standort, und zwar als
„geteilt", nicht als „erhoben".**

### 4.2 Google Play — Datensicherheit (`de.salatibox.de`)

Pfad: **Play Console → Salati → Richtlinie und Programme → App-Inhalte →
Datensicherheit → Verwalten**

1. Datenerhebung und -sicherheit
   - „Erhebt oder teilt Ihre App eine der erforderlichen Nutzerdatentypen?" → **Ja**
   - „Werden alle erhobenen Nutzerdaten bei der Übertragung verschlüsselt?" → **Ja**
   - „Können Nutzer die Löschung ihrer Daten beantragen?" → **Nein**
2. Datentypen → nur die Kategorie **Standort** aufklappen
   - **Ungefährer Standort** ankreuzen
   - **Genauer Standort** ankreuzen
   - alle 12 übrigen Kategorien leer lassen (Personenbezogene Informationen,
     Finanzinformationen, Nachrichten, Fotos und Videos, **Audiodateien**, Dateien und
     Dokumente, Kalender, Kontakte, App-Aktivität, Web-Browsing, App-Informationen und
     -Leistung, Geräte- oder andere IDs)
3. Für **jeden** der beiden Standort-Typen im Folgedialog:
   - „Werden diese Daten erhoben, geteilt oder beides?" → **nur „geteilt"** ankreuzen,
     „erhoben" **nicht**
   - „Sind diese Nutzerdaten für die Nutzung Ihrer App erforderlich?" →
     **Nutzer können auswählen, ob diese Daten erfasst werden**
   - „Warum werden diese Nutzerdaten geteilt?" → **nur „App-Funktionalität"**
4. Vorschau muss danach „Daten werden an Dritte weitergegeben: Standort" zeigen,
   **nicht** „Keine Daten erhoben"
5. **Speichern → Änderungen an der Datensicherheit senden**

Hinweis zu Schritt 2: Auch nach dem Manifest-Fix aus 3.4 wird **Audio nicht** angekreuzt.
Play unterscheidet Berechtigung und Datenerhebung; die Aufnahme verlässt das Gerät nicht.

### 4.3 Google Play — die drei übrigen Konsolen-Punkte

| Pfad | Zu setzen |
|---|---|
| App-Inhalte → **Inhaltseinstufung** (IARC) | Frage nach **nutzergenerierten Inhalten** → **Nein**. Die KI-Antworten sind nicht teilbar; es gibt kein Konto, keinen Feed, keine Kommentare, keinen Chat zwischen Nutzern |
| App-Inhalte → **Werbung** | „Enthält keine Werbung" — belegt durch 4.0 |
| Store-Präsenz → Store-Eintrag → **Kontaktdaten** | E-Mail von `salati@domenicmoran.de` auf **`salati@domenicmoran.de`** ändern (3.5) |

### 4.4 App Store Connect — App-Datenschutz (App 6791867298 „Salati Islam")

Pfad: **App Store Connect → Apps → Salati Islam → App-Datenschutz → Bearbeiten**

1. „Erfassen Sie oder Ihre Drittanbieter-Partner Daten aus dieser App?" → **Ja**
   (bisher „Nein". Apples Ausnahme greift nur, wenn die Erhebung *nicht* Teil der
   Hauptfunktion ist — bei Salati ist der Standort genau die Hauptfunktion)
2. Datentypen: unter **Standort** → **Ungefährer Standort** und **Genauer Standort**.
   Sonst nichts
3. Für jeden der beiden Typen:
   - Verwendungszweck → **App-Funktionalität** (nur diese)
   - „Mit der Identität des Nutzers verknüpft?" → **Nein**
   - „Zum Tracking verwendet?" → **Nein**
4. Produktseite prüfen: Abschnitt **„Nicht mit dir verknüpfte Daten → Standort"**
5. **Kein ATT-Prompt**, keine IDFA-Nutzung
6. Datenschutz-URL bleibt `https://www.salati.pro/datenschutz` (in beiden Locales bereits
   gesetzt, live abgefragt)

**Zeitpunkt beachten:** Die ASC-API meldet Version **1.31.0 im Status
`WAITING_FOR_REVIEW`** (erstellt 2026-07-27). Während einer laufenden Review ist die
Änderung des Privacy-Labels regelmäßig gesperrt. Zwei Wege: entweder die Review von
1.31.0 abwarten und das Label sofort danach setzen, oder 1.31.0 zurückziehen und direkt
mit 1.32.0 einreichen. In jedem Fall muss das Label gesetzt sein, **bevor** 1.32.0 zur
Prüfung geht.

### 4.5 Reihenfolge

1. `salati.pro` neu deployen (3.3), `release-check.mjs` auf 0 Befunde
2. Play-Datensicherheit + IARC + Kontaktadresse setzen (4.2, 4.3)
3. Apple-Privacy-Label setzen, sobald die 1.31.0-Review es zulässt (4.4)
4. Repo-Blocker 3.1, 3.2, 3.4 beheben
5. Erst dann bauen und einreichen

---

## 5. Belege der Live-Abrufe (2026-07-27)

| Prüfung | Ergebnis |
|---|---|
| `curl -L https://www.salati.pro/datenschutz` | **HTTP 200**, `text/html`, keine Weiterleitung |
| `curl -L https://www.salati.pro/impressum` | HTTP 200 |
| `curl -L https://www.salati.pro/agb` | HTTP 200 |
| `curl -L https://www.salati.pro/` | HTTP 200 |
| `curl -L https://www.salatibox.de/datenschutz` | **Host nicht auflösbar** — die Domain existiert nicht. Produktivdomain ist ausschließlich `www.salati.pro` |
| ASC `appInfoLocalizations` | `privacyPolicyUrl` = `https://www.salati.pro/datenschutz` in de-DE und en-US |
| Play `edits/listings` | 6 Locales live (de-DE, en-US, tr-TR, ar, es-ES, fr-FR), alle enden auf `Datenschutz: https://www.salati.pro/datenschutz` — die aktuell live stehende Fassung ist noch die kürzere vor dem letzten Text-Update und nennt weiterhin `salati@domenicmoran.de` |
| Play Track production | completed, versionCode 51, 1.31.0 |
| `release-check.mjs` | Play OK · ASC WAITING_FOR_REVIEW · APK 264,9 MB HTTP 200 · Podcast-Index 68 Folgen · Handout-Index 23 · KI-Korpora R2 alle 13 Sprachen erreichbar · **1 Befund: Web-Korpus veraltet** |
