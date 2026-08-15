# Data Safety & Privacy — Ausfüllhilfe (Salati, `de.salatibox.de`)

Stand: 2026-07-27 (ersetzt die Fassung vom 2026-07-14, die noch das falsche Paket
`de.salatibox.app` und "Anbieter: MenuCloud Berlin" nannte und Supabase/R2/HuggingFace/KI
nicht kannte). Grundlage: tatsächliche Datenflüsse im Code (`apps/mobile`), Abgleich mit
https://www.salati.pro/datenschutz sowie `docs/audit-2026-07-27/STORE-RECHT.md`.

**Anbieter:** Salatibox — Inh. Domenic Moran, Heidelberger Str. 36, 12059 Berlin.
**Kontakt (einheitlich in Impressum, App, Play und ASC):** `salatibox@gmail.com`.
**Datenschutz-URL:** `https://www.salati.pro/datenschutz`.

> Die konkreten Klick-Anweisungen für die beiden Formulare (Play Console und App Store
> Connect) stehen in `apps/mobile/store/PRIVACY-LABELS-TODO.md` — die Formulare sind
> über keine API änderbar und müssen von Hand gepflegt werden.

## Faktische Datenlage (Code-verifiziert)

- Kein eigenes Backend für Nutzerdaten, kein Account, keine Registrierung, kein Login.
- Keine Werbe-, Analytics-, Crash- oder Tracking-SDKs in den Dependencies (kein Firebase,
  kein AdMob, kein Sentry, kein Attribution-SDK).
- Keine Push-Tokens (`getExpoPushTokenAsync` kommt im Code nicht vor); Benachrichtigungen
  werden ausschließlich lokal per `scheduleNotificationAsync` geplant.
- Alle Nutzerdaten (Lesezeichen, Lernfortschritt, Gebets-Tracker, Einstellungen,
  heruntergeladenes Audio, KI-Chatverlauf) liegen ausschließlich lokal auf dem Gerät
  (AsyncStorage / Dateisystem) bzw. im Browser-Speicher der Web-Version.
- Standort: nur "Bei Nutzung der App" (Foreground). Background-Location ist in
  `app.config.ts` explizit deaktiviert (`isIosBackgroundLocationEnabled: false`,
  `isAndroidBackgroundLocationEnabled: false`).
- Kamera (Barcode-Scanner) und Mikrofon (Rezitations-Prüfung) werden ausschließlich
  auf dem Gerät ausgewertet; keine Bilder, keine Tonaufnahmen verlassen das Gerät.

### Empfänger von Standortdaten (der entscheidende Punkt)

| Ziel | Was bekommt der Dienst | Wann |
|---|---|---|
| `api.aladhan.com` | GPS-Koordinaten (bzw. Stadtname), Datum, Berechnungsmethode | bei jedem Start / Gebetszeiten-Abruf — **Kernfunktion** |
| `overpass-api.de` | GPS-Koordinaten + Suchradius | Moscheen- und Halal-Umgebungssuche |
| `nominatim.openstreetmap.org` | Freitext-Sucheingabe (Stadt) | manuelle Ortseingabe |
| `tile.openstreetmap.org` | Kachelkoordinaten (grober Standort) + IP | Kartenansicht |

Diese drei bzw. vier Dienste sind **unabhängige Dritte**, keine Auftragsverarbeiter:
es gibt keinen Vertrag, keine Weisungsbindung und keine Zusicherung, dass die Daten
nur ephemer verarbeitet werden. Damit greift weder Googles Ausnahme "Dienstanbieter"
noch die Ausnahme "ephemere Verarbeitung" für das *Teilen*, und Apples Ausnahme für
nicht deklarierte Daten greift ebenfalls nicht, weil die Erhebung Teil der
**Hauptfunktion** ist und bei jedem Start erfolgt.

### Weitere Empfänger (ohne Standortbezug, nur IP + Anfragedaten)

`api.alquran.cloud`, `api.quran.com`, `audio.qurancdn.com`, `verses.quran.com`,
`mirrors.quranicaudio.com` (Rezitations-Audio, auf das die Quran.com-API für
einzelne Rezitatoren protokollrelativ verweist, `features/quran/api.ts:423`),
`cdn.islamic.network`, `www.mp3quran.net`, `cdn.jsdelivr.net`, `unpkg.com`,
`world.openfoodfacts.org` (gescannter Barcode), `api.gold-api.com`,
`api.frankfurter.dev`, `huggingface.co` (Download des optionalen großen
Whisper-Modells) sowie die eigene Auslieferungs-Infrastruktur Cloudflare R2
(Podcast, Handouts, Videos, Reels, KI-Quellenkorpus, KI- und Whisper-Modelldatei),
Supabase Storage (Kursinhalts-Updates, EU-Region Frankfurt) und Vercel
(nur lesende Abrufe, keine Nutzerkennung, Zugriffslogs enthalten IP-Adressen).

---

## Google Play — Data-Safety-Formular (Play Console → App-Inhalte → Datensicherheit)

| Formularfrage | Antwort | Begründung |
|---|---|---|
| Erhebt oder teilt Ihre App eine der erforderlichen Nutzerdatentypen? | **Ja** | Standort wird an unabhängige Dritte (AlAdhan, Overpass, Nominatim, OSM-Tiles) übertragen. Das ist "Teilen" im Sinne des Formulars. |
| Datentyp: **Standort → Ungefährer Standort** | erhoben: **Nein** · geteilt: **Ja** | Ortsauflösung über Stadt/IP-Ebene für Gebetszeiten und Kartenkacheln. |
| Datentyp: **Standort → Genauer Standort** | erhoben: **Nein** · geteilt: **Ja** | GPS-Koordinaten gehen an AlAdhan und Overpass. |
| Zweck (bei beiden Standort-Typen) | **App-Funktionalität** | Gebetszeiten, Qibla, Moscheen-/Halal-Suche. Keine Werbung, keine Personalisierung, keine Analyse. |
| "Sind diese Daten erforderlich?" | **Erforderlich? Nein — optional** | Ohne Standortfreigabe funktioniert die App über manuelle Stadteingabe weiter. |
| Verknüpfung mit der Identität des Nutzers | **Nein** | Es gibt keine Nutzer-ID, kein Konto, keine Geräte-Kennung im Request. |
| Wird für Tracking verwendet? | **Nein** | Kein App-/Website-übergreifendes Tracking, kein Werbe-SDK. |
| "Erhoben" bei allen übrigen Datentypen | **Nein** | Alle sonstigen Daten bleiben on-device; On-Device-Daten sind nicht deklarationspflichtig. |
| Werden alle Nutzerdaten bei der Übertragung verschlüsselt? | **Ja** | Alle Endpunkte sind ausschließlich HTTPS. |
| Bieten Sie eine Möglichkeit, die Löschung von Daten zu beantragen? | **Nein / nicht zutreffend** | Es entstehen keine gespeicherten Daten auf unserer Seite; lokale Daten löscht der Nutzer in der App (Einstellungen → Speicher) oder durch Deinstallation. |
| Unabhängige Sicherheitsüberprüfung (MASA)? | Nein | Nicht durchgeführt (optional). |
| Datenschutzerklärung (Store-Eintrag → URL) | `https://www.salati.pro/datenschutz` | Pflichtfeld. |

Ergebnis im Store-Eintrag: Badge "Daten werden an Dritte weitergegeben: Standort".
Das ist der korrekte Zustand — die frühere Angabe "Keine Daten erhoben, keine Daten an
Dritte weitergegeben" war eine Falschangabe und damit ein Play-Policy-Verstoß.

## Google Play — Weitere App-Inhalte-Angaben

- Werbung: **Enthält keine Werbung** (kein Ad-SDK).
- Zielgruppe: Nicht primär an Kinder gerichtet (allgemeines Publikum).
- Anmeldedaten für App-Zugriff (Review): "Alle Funktionen ohne Anmeldung zugänglich".
- Nutzergenerierte Inhalte: Google fragt das inzwischen auch für KI-Textausgaben ab.
  Salati hat **keine** nutzergenerierten Inhalte im Sinne der Richtlinie: die KI-Antworten
  sind nicht zwischen Nutzern teilbar, es gibt kein Konto, keinen Feed, keine Kommentare.

---

## Apple — App Privacy ("Privacy Nutrition Label", App Store Connect → App-Datenschutz)

| Formularfrage | Antwort | Begründung |
|---|---|---|
| "Do you or your third-party partners collect data from this app?" | **Ja** | Der Standort wird bei jedem Start an AlAdhan übertragen — das ist die Hauptfunktion, nicht ein gelegentlicher Sonderfall. Apples Ausnahme für nicht deklarierte Daten setzt u. a. voraus, dass die Erhebung *nicht* Teil der Hauptfunktion ist. |
| Datentyp: **Location → Coarse Location** und **Precise Location** | auswählen | Stadt-/Koordinaten-Ebene, siehe Tabelle oben. |
| Verwendungszweck | **App Functionality** | Gebetszeiten, Qibla, Umgebungssuche. |
| "Is this data linked to the user's identity?" | **Not Linked to You** | Keine Nutzer-ID, kein Konto, keine Geräte-Kennung im Request. |
| "Is this data used for tracking purposes?" | **Not Used for Tracking** | Kein ATT-Prompt nötig, keine IDFA-Nutzung. |
| Alle übrigen Datentypen (Identifiers, Usage Data, Diagnostics, Contacts …) | nicht auswählen | Wird nicht erhoben; Fehlerprotokolle bleiben lokal. |
| Privacy Policy URL | `https://www.salati.pro/datenschutz` | Pflichtfeld. |

Ergebnis auf der Produktseite: Abschnitt "Data Not Linked to You → Location".

### Privacy Manifest / Berechtigungs-Strings (technische Konsistenz)

- `NSLocationWhenInUseUsageDescription`: Zweck = Gebetszeiten, Qibla-Richtung,
  Moschee-/Halal-Suche in der Nähe. Kein "Always"-Zugriff beantragen.
- `NSCameraUsageDescription`: Barcode-Scan für den Halal-Check, Auswertung nur lokal.
- `NSMicrophoneUsageDescription`: Rezitations-Prüfung, Auswertung nur lokal.
- Benachrichtigungs-Berechtigung: lokale Gebets-Erinnerungen — keine Remote-Pushes.
- `UIBackgroundModes: audio`: nur für Rezitationen im Hintergrund, keine Datenverarbeitung.
- Required-Reason-APIs (UserDefaults/File-Timestamp): über die Expo-Modul-Privacy-Manifeste
  abgedeckt; beim Build prüfen, dass `PrivacyInfo.xcprivacy` enthalten ist.

---

## Grenzfall, den man kennen sollte (falls Review nachfragt)

Alle Dritt-APIs sehen technisch bedingt die IP-Adresse des Geräts — wie bei jedem
Internetzugriff. Das allein löst keine Deklarationspflicht aus. Deklarationspflichtig
ist hier der **Standort**, weil er als Nutzdatum bewusst mitgesendet wird. Die
Datenschutzerklärung benennt seit dem 2026-07-27 alle Empfänger namentlich,
mit Zweck, übermittelten Daten, Rechtsgrundlage und Drittlandbezug.
