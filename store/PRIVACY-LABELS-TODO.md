# Datenschutz-Formulare in den Stores — was von Hand zu klicken ist

Stand: 2026-07-27. Grundlage: `docs/audit-2026-07-27/STORE-RECHT.md` §1.3 und §7,
Ausfüllhilfe mit Begründungen: `apps/mobile/store/listing/data-safety.md`.

**Warum diese Datei existiert:** Das Play-Datensicherheitsformular, die
IARC-Inhaltseinstufung und das Apple-Privacy-Label ("Nutrition Label") haben in der
Android-Publisher-API v3 bzw. in der App-Store-Connect-API **keinen Endpunkt**. Sie
lassen sich nur in der jeweiligen Web-Konsole ändern. Code und Store-Texte im Repo
sind bereits auf den unten beschriebenen Zielzustand gebracht — die Formulare fehlen.

**Dringlichkeit:** Die aktuellen Angaben ("Keine Daten erhoben" / "Data Not Collected")
sind nach dem Audit **nicht haltbar**, weil GPS-Koordinaten als Kernfunktion an
unabhängige Dritte gehen. Bei Play ist eine falsche Datensicherheitsangabe ein
Richtlinienverstoß und ein Sperrgrund, bei Apple ein Rejection-Grund.
Beides **vor der nächsten Einreichung** korrigieren.

---

## 1. Google Play Console — `de.salatibox.de` (Salati)

Pfad: **Play Console → App auswählen → Richtlinie und Programme → App-Inhalte →
Datensicherheit → Verwalten**.

1. **Datenerhebung und -sicherheit**
   - „Erhebt oder teilt Ihre App eine der erforderlichen Nutzerdatentypen?" → **Ja**
   - „Werden alle erhobenen Nutzerdaten bei der Übertragung verschlüsselt?" → **Ja**
   - „Können Nutzer die Löschung ihrer Daten beantragen?" → **Nein** (es werden bei uns
     keine Daten gespeichert; lokale Daten löscht der Nutzer in der App unter
     Einstellungen → Speicher oder durch Deinstallation)
2. **Datentypen** → Kategorie **Standort** aufklappen:
   - **Ungefährer Standort** ankreuzen
   - **Genauer Standort** ankreuzen
   - Alle übrigen Kategorien (Personenbezogene Informationen, Finanzinformationen,
     Nachrichten, Fotos und Videos, Audiodateien, Dateien und Dokumente, Kalender,
     Kontakte, App-Aktivität, Web-Browsing, App-Informationen und -Leistung,
     Geräte- oder andere IDs) **leer lassen**
3. Für **jeden** der beiden Standort-Typen im Folgedialog:
   - „Werden diese Daten erhoben, geteilt oder beides?" → **Nur geteilt**
     (Häkchen bei „geteilt", Häkchen bei „erhoben" **nicht** setzen — wir speichern
     die Koordinaten nirgends, geben sie aber an AlAdhan/OpenStreetMap weiter)
   - „Sind diese Daten verarbeitet, kurzlebig?" → erscheint nur bei „erhoben", entfällt
   - „Sind diese Nutzerdaten für die Nutzung Ihrer App erforderlich?" →
     **Nutzer können auswählen, ob diese Daten erfasst werden** (die App funktioniert
     mit manueller Stadteingabe weiter)
   - „Warum werden diese Nutzerdaten geteilt?" → **nur „App-Funktionalität"**
     (nicht Analyse, nicht Werbung/Marketing, nicht Betrugsprävention,
     nicht Personalisierung, nicht Kontoverwaltung)
4. **Vorschau prüfen:** Das Badge muss danach
   „Daten werden an Dritte weitergegeben: Standort" zeigen, **nicht**
   „Keine Daten erhoben".
5. **Speichern → Änderungen an der Datensicherheit senden.** Google prüft das
   Formular mit der nächsten Version; ein neuer App-Upload ist dafür nicht nötig.

### Ebenfalls in der Console gegenlesen (nur Kontrolle, API-blind)

- **Inhaltseinstufung (IARC-Fragebogen):** Die Frage nach **nutzergenerierten Inhalten**
  wird inzwischen auch für KI-Textausgaben gestellt. Antwort für Salati: **Nein** —
  die KI-Antworten sind nicht zwischen Nutzern teilbar, es gibt kein Konto, keinen
  Feed, keine Kommentare, keinen Chat zwischen Nutzern.
- **Werbung:** „Enthält keine Werbung" muss gesetzt sein (kein Ad-SDK im Build).
- **Kontakt-E-Mail des Entwicklers:** steht laut Audit auf `salatibox@gmail.com`.
  Zielzustand nach Vereinheitlichung (Impressum, App, Store-Texte):
  **`salatibox@gmail.com`**. Pfad: Play Console → Store-Präsenz → Store-Eintrag →
  Kontaktdaten.

## 2. Google Play Console — `de.salatibox.tv` (Salati TV)

Dieselben Standort-Angaben sind **nicht** nötig: die TV-App fragt keinen Standort ab.
Sie ruft aber dieselbe Inhalts-Infrastruktur auf (R2, Supabase, mp3quran, quran.com).
Datenschutz-URL bleibt `https://www.salati.pro/datenschutz` — die Erklärung deckt die
TV-App seit dem 2026-07-27 ausdrücklich mit ab (Abschnitt „Diese Erklärung gilt für …").

## 3. App Store Connect — App 6791867298 (Salati Islam)

Pfad: **App Store Connect → Apps → Salati Islam → App-Datenschutz → Bearbeiten**.

1. „Erfassen Sie oder Ihre Drittanbieter-Partner Daten aus dieser App?" → **Ja**
   (bisher „Nein"; Apples Ausnahme für nicht deklarierte Daten setzt voraus, dass die
   Erhebung *nicht* Teil der Hauptfunktion ist — bei Salati ist der Standort genau die
   Hauptfunktion und wird bei jedem Start abgefragt)
2. Datentypen auswählen: unter **Standort** →
   **Ungefährer Standort (Coarse Location)** und **Genauer Standort (Precise Location)**.
   Alle anderen Kategorien nicht auswählen.
3. Für jeden der beiden Typen im Folgedialog:
   - Verwendungszweck → **App-Funktionalität** (nur diese eine Option)
   - „Werden diese Daten mit der Identität des Nutzers verknüpft?" → **Nein**
   - „Werden diese Daten zum Tracking verwendet?" → **Nein**
4. Ergebnis auf der Produktseite prüfen: Abschnitt
   **„Nicht mit dir verknüpfte Daten → Standort"**.
5. **Kein ATT-Prompt nötig**, da kein Tracking und keine IDFA-Nutzung.
6. Datenschutz-URL bleibt `https://www.salati.pro/datenschutz` (de + en, bereits gesetzt).

Die Änderung kann **während einer laufenden Review** blockiert sein. Wenn 1.31.0 noch
`WAITING_FOR_REVIEW` ist: entweder vor der Einreichung der nächsten Version machen oder
nach Abschluss der laufenden Review sofort nachziehen.

---

## Offene Punkte, die aus dem Repo nicht belegbar sind

Diese Punkte sind in den Rechtstexten bewusst **nicht** behauptet worden, weil dafür
kein Nachweis vorliegt. Sie müssen extern geklärt werden:

| Punkt | Was fehlt |
|---|---|
| KFGQPC-Font (`assets/fonts/kfgqpc-hafs.ttf`) | `assets/fonts/CREDITS.md` markiert die Prüfung der **kommerziellen Store-Distribution** selbst als offen. Auf der Lizenzseite steht deshalb nur „Hersteller-Lizenz (im Font eingebettet)", keine Aussage über die Zulässigkeit der Weiterverbreitung. |
| Bubenheim-&-Elyas-Übersetzung | Kein offener Lizenztext auffindbar; auf der Lizenzseite als „Nutzungsbedingungen des Anbieters" geführt. Rechtsstatus der Abruf-Nutzung über alquran.cloud ungeklärt. |
| ElevenLabs-Stimmen (Podcast) | Kommerzielle Nutzung braucht laut `podcast/wissensbasis.txt` einen bezahlten Plan; Plan-Status nicht belegt. Auf der Lizenzseite deshalb nicht aufgeführt. |
| GGUF-Quantisierung des KI-Modells | Herkunft der Datei auf unserem R2 ist im Repo nicht dokumentiert. Genannt wird das Ursprungsmodell Qwen2.5-1.5B-Instruct (Apache-2.0). |
| `bashir-manafikhi/quran-whisper-ggml` | Lizenz der Konvertierung nicht geprüft; auf der Lizenzseite ist das Ursprungsmodell `tarteel-ai/whisper-base-ar-quran` (Apache-2.0) genannt. |
| Kleinunternehmer-Status § 19 UStG | Impressum nennt Kleinunternehmerregelung **und** USt-IdNr. Rechtlich möglich, aber steuerlich gegenprüfen. |
| iOS-Store-Beschreibung | Weiterhin zwei Feature-Generationen alt (kein KI-/Podcast-Abschnitt, „287 Lektionen", „sechs Sprachen"). Die Repo-Listing-Texte sind aktuell; der ASC-Eintrag muss noch angeglichen werden (Audit §5.3). |

---

## Nachtrag 2026-07-27: vier offene Lizenzfragen geklaert

Angaben des Betreibers, wo moeglich technisch gegengeprueft:

| Frage | Antwort | Pruefung |
|---|---|---|
| **Whisper-Modell (Hifz-Rezitationspruefung)** | Offiziell von Tarteel AI | **Bestaetigt.** `tarteel-ai/whisper-base-ar-quran` = Apache-2.0 (HuggingFace-API abgefragt). Seit dem 2026-07-27 laedt die App keine Fremdkonvertierung mehr, sondern unsere **eigene GGML-Konvertierung genau dieses Modells** von unserem R2 (`features/hifz/whisperModel.ts:52`, Beleg `docs/audit-2026-07-27/WHISPER-EIGENE-KONVERTIERUNG.md`); nur das optionale grosse Modell kommt weiterhin von `huggingface.co/ggerganov/whisper.cpp`. Ursprungsmodell und Lizenz stehen auf der Lizenzseite; Apache-2.0 verlangt genau diese Nennung |
| **Bubenheim-Uebersetzung** | Kommt ueber die API | **Bestaetigt.** Die App buendelt keinen Uebersetzungstext, sondern holt `de.bubenheim` zur Laufzeit von `api.alquran.cloud` (`features/quran/api.ts:6,507`). Die Edition ist dort als „A. S. F. Bubenheim and N. Elyas" gelistet. Salati ist damit Anzeigender, nicht Verbreiter des Textes; die Nennung von Uebersetzern und API steht auf der Lizenzseite |
| **KFGQPC-Font** | Lizenzfrei ueber GitHub | **Teilweise.** Der genutzte Spiegel `github.com/thetruetruth/quran-data-kfgqpc` fuehrt laut GitHub-API **keine Lizenzdatei**; „keine Lizenzangabe" ist rechtlich nicht dasselbe wie „lizenzfrei". Massgeblich bleibt das im Font eingebettete KFGQPC-EULA, das die Nutzung der Font-Software gestattet. Der Betreiber hat die Freigabe erklaert (dokumentiert in `assets/fonts/CREDITS.md`), die Lizenzseite nennt Font und Herausgeber. Kein Handlungsbedarf, aber die Grundlage ist die EULA, nicht der GitHub-Spiegel |
| **Supabase-Region** | Ueber die API abrufbar | **Erledigt (Angabe des Betreibers, 2026-07-27).** Region ist die EU-Region Frankfurt (`eu-central-1`); die Datenschutzerklaerung nennt sie seither im Abschnitt „Unsere eigene Infrastruktur" (Commit 10143a8, alle 14 Sprachen) |
