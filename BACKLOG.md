# Salati — Arbeits-Backlog (Audit + Content-Ausbau)

> Lebendes Dokument. Stand 2026-07-22. Erledigtes → `[x]` mit Beleg.
> Store-/Release-Historie steht in `../../USER-TODO.md`, nicht hier.
> Aktueller Live-Stand Website: **vc31 (1.27.19)** auf www.salati.pro.
> Ziel dieses Durchgangs: alle App-Verbesserungen mergen → **vc32** deployen → User testet.

---

## Z3) vc35 (1.28.0) — laufender Release (2026-07-23), autonomer Store-Push

**Ziel:** vc35 ersetzt die noch in Review liegende vc33 in beiden Stores + Website/APK.
User-Mandat: vollständig autonom bis in die Stores, keine Rückfragen, „alles perfekt, nichts vergessen".

**App-Änderungen — GEMERGT + verifiziert (tsc0/jest978/eslint0):**
- [x] Einstellungen übersichtlicher (Benachrichtigungen/Erinnerungen getrennt, Karten zusammengefasst, Suche erhalten)
- [x] „Auswendiglernen" → „Rezitieren" (14 Sprachen) + ehrlicher On-Device-Modell-Hinweis mit Tarteel-Empfehlung
- [x] Medien-Hub `/media` (Podcast/Videos/Reels darunter) + einheitliche NavTile-Raster (Lernen wie Mehr) + Studium-Verknüpfung in /mehr + feste wachsende Zahlen entfernt
- [x] (aus vc34) Responsive/Tablet/Querformat + Orientierungssperre gelöst (Play-Empf. #2)

**App-Änderungen — LAUFENDE Agents (sofort committen bei Fertig):**
- [ ] In-App-Handouts-Feature (PDFs lesen/herunterladen; Einstieg beim Merge in lernenNav verdrahten)
- [ ] Store-Listings 14 Sprachen + Website-Landing mit neuen Angeboten (Podcast/Videos/Reels/Handouts), Zahlen raus
- [ ] Umfassendes **Lernbuch-PDF** + Themen-PDFs → R2 (`handouts/index.json`), alle Inhalte, nichts ausgelassen

**Vor dem Build noch zu tun:**
- [ ] Version auf **vc35 / versionCode 35 / 1.28.0** (aktuell steht 34/1.27.22 vom vc34-Test)
- [ ] Handouts-Einstiegspunkt verdrahten (Kachel in LERNEN_NAV/media)
- [ ] Gesamt-Verifikation tsc/eslint/jest/Locale-Parität nach allen Merges

**Build + Einreichung (autonom):**
- [ ] Android APK+AAB via GitHub (gratis) → Website-APK-Deploy + Play-Production (ersetzt vc33)
- [ ] iOS via salatipro-EAS (Standalone-Dir C:/eas-salati-ios, vc35-Code neu spiegeln; llama.rn-194MB-Download war transient → bei Flake Retry) → App-Store-Einreichung (Build ablösen)
- [ ] Store-Listings-Metadaten in Play/ASC aktualisieren (nach den md-Änderungen)

**Offen / NICHT vergessen (kein vc35-Blocker):**
- [ ] YouTube: 10/58 Videos hoch, Tageslimit — Rest hochladen sobald User Kanal verifiziert (youtube.com/verify)
- [x] **PDF-Lernbuch-Inhalte vom User gegengelesen** (2026-07-23) — freigegeben.
- [ ] Maschinelle Übersetzungen (8-Sprachen-Kurse, neue Duas, 99-Namen ps/bn): muttersprachliche/fachliche Gegenlese vor „vollständig"-Anspruch (App-Inhalte, unabhängig vom PDF)
- [ ] Play-Empf. #1/#3/#4 (Glide/Fresco edge-to-edge + AGP9-R8): erst mit Expo-SDK-58-Upgrade lösbar (57 ist aktuell) — SDK-Upgrade als geplanter Durchgang wenn 58 erscheint
- [ ] Dokumentierte Blocker: iOS Live Activity (braucht iPhone), WearOS-Runtime-Test, Web-Bundle-Splitting (Metro), voller mehrsprachiger Tafsir (keine freie Quelle), benannte Adhan-Stimmen (keine frei lizenzierten Aufnahmen bekannter Muezzin; die drei mitgelieferten sind belegt frei, s. docs/audit-2026-07-27/ADHAN-LIZENZEN.md)

---

## Z2) vc33 ABSCHLUSS (2026-07-23) — alles abgearbeitet, Code verifiziert

**Gesamt-Verifikation grün:** `tsc` 0 · `jest` 100 Suites/978 Tests · `eslint` 0 · Locale-Parität 14/14.
Version: **vc33 / 1.27.21**.

Gemergt & verifiziert (diese Runde):
- UX/Element-Größen (Title 48→34 etc.)/iOS-Settings-Inset-Umbau/ScreenHeader (nativer Zurück + Modal-Fertig)/Sure-{n}-i18n/NEU-Karten/Home-Chips
- Video-Bug gefixt (Autoplay-Kaskade → „immer letzte Folge"), Autoplay-Default aus, PiP-Manifest, Filter-Chips in Video-Übersicht
- größen-adaptive Widgets (compact/medium/tall)
- Sprachmodell: Energie-VAD, prompt-freie Endauswertung (Benchmark-belegt: Modell erkennt klare Rezitation ~perfekt), strengeres Scoring, Ganz-Sure-Fix
- 99 Namen → 14 Sprachen · Dialekte → 14 · Nawawi40 → 14 · Aqida/Akhlaq/Nikah → 14
- Quran-Suche: Alif-Wasla-Fix · Wort-für-Wort Deutsch (Kernsuren)
- AR-Kamera-Qibla (neu) · Dua-Ausbau 89→106 (authentische Quellen) · Store-Listings 8 Sprachen · Store-Zahlen aktualisiert
- WearOS-Kompilierfehler: verifiziert bereits gefixt (Gradle-Compile grün)

**⚠️ Vor Store-Freigabe:** Die 8-Sprachen-Kurs-/Dialekt-Übersetzungen + neue Duas sind MASCHINELL — muttersprachlich-fachliche Gegenlese empfohlen (v. a. ps/bn). Auf User-Entscheidung wird trotzdem ausgeliefert.

**Echt blockiert (dokumentiert, nicht wählbar):** Web-Bundle-Splitting (Metro/Expo 57), AGP-9-R8 (finalizeDsl), iOS Live Activity (braucht iPhone), voller mehrsprachiger Tafsir (keine freie Quelle), benannte Adhan-Stimmen (keine frei lizenzierten Aufnahmen bekannter Muezzin; die drei mitgelieferten sind belegt frei, s. docs/audit-2026-07-27/ADHAN-LIZENZEN.md).

**Offen bis Deploy:** iOS-Gratis-Pipeline (GitHub-macOS) am Iterieren; Android gratis (APK+AAB) bereit.

---

## Z) Voll-Audit-Runde → vc33 (Stand 2026-07-22, Nutzer: „alles abarbeiten, nichts auslassen, Build erst wenn perfekt")

**vc32 (1.27.20) ist zum Testen live** auf www.salati.pro — trägt die 5 gezielten Fixes (A1–A5).
Der Nutzer testet vc32 auf echtem Gerät; **finaler Build (vc33) wartet auf sein Feedback** — Schwerpunkt laut Nutzer: **Element-Größen zu groß / Apple-Feeling auf jedem Gerät**, und **Einstellungsmenü fühlt sich nicht wie iOS an**.

Berichte: `AUDIT-UX-2026-07-22.md`, `AUDIT-CONTENT-2026-07-22.md`. Gute Nachricht: kein P0/Crash.

**5 Agents laufen (strikt getrennte Datei-Bereiche):**
- [ ] **UX-Voll-Fix** (src/app UI + components + theme + locales): ScreenHeader (nativer Zurück-Button ~16 Screens + Modal-Schließen), Sure-{n}-i18n, NEU-Badges/Karten, Home-Touch-Targets, Badge-Skala, Studium-Kopf, u. a. — PLUS **Element-Größen/Responsiveness auf jedem Gerät** (Direktive) + **iOS-Settings-Umbau** (Direktive: gruppierte Inset-Liste, Icon-Kacheln, Footnotes, Suche bleibt).
- [ ] **99 Namen** Bedeutungen → alle 14 Sprachen (names-Daten).
- [ ] **nawawi40** (42 Lektionen) Story+Quiz → 8 Sprachen (id/bn/fa/ms/ur/sw/ru/ps).
- [ ] **aqida+akhlaq+nikah** (25 Lektionen) → 8 Sprachen.
- [ ] **Dialekte** (224 Vokabeln) → 8 Sprachen.
  (Alle Kurs-Übersetzungen sind maschinell → **muttersprachliche/fachliche Gegenlese vor Store-Claim „vollständig 14-sprachig" nötig**, v. a. ps/bn.)

**Selbst erledigt:** Store-Text „47 Duas" → „89 Duas" in de/en/es/tr/ar (Code hat 89).

**P2-Roadmap (bewusst NICHT in vc33, damit nichts still wegfällt — Entscheidung/Aufwand):**
- AR-/Kamera-Qibla (neues Feature, expo-camera + Sensor) — eigener Build.
- Deutscher/mehrsprachiger Tafsir — **blockiert**: keine freie Datenquelle (s. USER-TODO Datenquellen-Blocker); Optionen: Lizenz oder eigene Kurz-Erklärung.
- Wort-für-Wort-Übersetzung Deutsch für Kernsuren (API nur EN) — eigene Glossen.
- Arabische Wurzel-/Morphologie-Suche im Reader.
- Benannte Adhan-Stimmen (Makkah/Madinah/al-Afasy): fuer keine dieser Aufnahmen ist eine Weitergabe-Freigabe auffindbar. Ausgeliefert werden drei belegt frei lizenzierte Aufnahmen (CC0/CC BY/CC BY-SA), darunter ein Fadschr-Ruf mit Tathwib.
- Hisnul-Muslim-Dua-Ausbau (Situations-Duas) — mit Quellen, review-pflichtig.
- Store-Listings in den 8 fehlenden App-Sprachen; Apple-Datenschutz-Label (Standort) prüfen.
- 99-Namen-Benefit-Text je Name (P2, über 1-Zeilen-Bedeutung hinaus).

---

## A) App-Audit & Politur (Nutzer-Feedback-Batch 2026-07-19/22) — in vc32 deployed ✓

Läuft parallel über mehrere Agents. Merge-Reihenfolge: erst tsc/eslint/jest je Branch grün, dann in main mergen, dann vc32 bauen.

- [ ] **A1 Spracherkennung ganze Sure deutlich besser** — Agent läuft.
      Kern: Voll-Aufnahme-Endauswertung in überlappenden Fenstern statt nur
      Tail-Fenster; positions-gekoppeltes monotones Reveal; Serializer gegen
      "Context is already transcribing".
- [ ] **A2 Video-Player** — Agent läuft. Sortierung/Ordnung vor der Übersicht,
      Playlisten, Autoplay-next nach Video-Ende, Hintergrund-/PiP-Wiedergabe,
      Beschreibung-Anzahl entfernen (weil dynamisch wachsend), robuster
      Hintergrund-Download, bessere Controls, bessere Nutzung in Lektionen.
- [ ] **A3 Reels-Player** — Agent läuft. Flüssiges Snapping, Overlay/Controls,
      Doppeltipp-Like, Fortschritt scrubbar, Kuratierung/Filter, Performance.
- [ ] **A4 Settings + App-Aufgeräumtheit + Studium-Menü** — Agent läuft.
      Apple-Niveau: iOS-Settings-Gruppen, konsistente Rows/Touch-Targets ≥44pt,
      größere Studium-Buttons, klare Hierarchie, einheitliche Card/Typo/Spacing.
- [ ] **A5 Widget-Design** — Agent läuft. Modernere Typo-Hierarchie, dezenter
      hochwertiger Hintergrund, nächstes Gebet hervorgehoben, alle Größen sauber.
- [ ] **A6 Hintergrund-Download-Funktion** (Videos/Podcast/Reels) — Teil von A2;
      auf robuste Umsetzung über alle Medien achten.

## B) Content-Ausbau-Loop (Nutzer-Direktive: fehlende Lektionen füllen)

Pro fehlende Lektion die komplette Pipeline. Anforderungen/Format:
`../../podcast/PODCAST-PLAN.md`, `../../podcast/FUTURE-EPISODES.md`, `../../podcast/MEDIEN-PLAN.md`.

- [ ] **B1 Fehlende Podcast-Folgen schreiben** (ep38+) — Agent läuft. Lücken:
      Reihe E kurze Suren (Tafsir-leicht), weitere Madinah-/Wortschatz-Lektionen,
      Aqida/Seerah-Grundlagen. Voll ausgeschrieben im bestehenden Format.
- [ ] **B2 Podcast vertonen** (ElevenLabs, `podcast/scripts` Pipeline) → mp3.
- [ ] **B3 Podcast → Supabase** (`podcasts`-Bucket, `index.json` erweitern) →
      erscheint via RSS auf **Spotify** (Show 033U0teP7zMDXYm3zQ3fje).
- [ ] **B4 Videos rendern** (`video.py` / Tabellen `table_video.py`) → **R2**
      (`upload_videos_r2.py`, `videos/index.json`) + **YouTube** (`youtube_upload.py`).
- [ ] **B5 Reels rendern** (`reel.py`, 1080×1920, ~55s) → **R2**
      (`upload_reels_r2.py`, `reels/index.json`) + lokaler Ordner für Instagram.
- [ ] **B6 App-Integration** — neue Podcasts/Videos/Reels erscheinen automatisch
      über die jeweiligen `index.json`-Contracts; an den passenden Lektionen
      verlinken (PhasePodcast/Video/Table-Cards in `src/app/learn/index.tsx`).

## C) Extern / braucht den User

- [ ] **C1 YouTube-Upload OAuth** — `redirect_uri_mismatch`. User muss in Google
      Cloud Console entweder `http://localhost:8766/` als Weiterleitungs-URI beim
      OAuth-Client eintragen ODER einen **Desktop-App**-Client neu anlegen und mir
      Client-ID+Secret geben. Danach lädt `youtube_upload.py` 37 Videos + 21
      Tabellen in Reihen-Playlisten. Blockiert nichts anderes.
- [ ] **C2 Instagram-Reels** — schnellster Weg: manueller Upload aus dem lokalen
      Reels-Ordner. Graph-API-Automatisierung bräuchte Business-Account + Review
      (später). Plan in `../../podcast/MEDIEN-PLAN.md`.
- [x] **C3 344 Reels Final-Upload nach R2** — fertig, `reels/index.json` = 344 Reels online (2026-07-22).

## D) Bekannte offene Baustellen (aus USER-TODO, kein Blocker für vc32)

- Web-Bundle-Splitting (Metro serialisiert keine getrennten Chunks, Expo 57.0.7).
- WearOS-Tile Kotlin-Kompilierfehler (`PrayerTileService.kt:64`) — eigene Session.
- AGP 9.0 R8-Vollmodus — struktureller Blocker (finalizeDsl zu spät).
- iOS Live Activity (1.26) — braucht iPhone zum Testen.

---

## Deploy-Checkliste vc32

1. Alle A/B-Branches gemerged, `npx tsc --noEmit` + `npx eslint` + `npx jest` grün.
2. `src/lib/locales.test.ts` grün (14-Sprachen-Parität).
3. versionCode/versionName in `app.config.ts` hochziehen.
4. Web-Export + Website-APK (2-Teile-Split, Byte-Identität) → push → Vercel.
5. User testet auf echtem Gerät (Spracherkennung ganze Sure, Video/Reels-Player,
   Settings/Studium, Widgets).
