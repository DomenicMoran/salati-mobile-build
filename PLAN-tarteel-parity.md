# Plan: Tarteel-Parität, Settings-Redesign, Onboarding, Gebets-Guide

Stand: 2026-07-22. Nutzer-Auftrag (mehrteilig). Entscheidung Modell:
**Koran-Base f16 (148 MB) als Standard + Alignment-Methode**; large-v3-Tarteel
optional als „Maximum"-Download (später, muss konvertiert+gehostet werden).

Leitprinzip: Tarteels Genauigkeit = ~80% Methode (Vers-Conditioning +
Wort-für-Wort-Alignment + Echtzeit-VAD), ~20% Modellgröße. Methode zuerst.

---

## Phase A — Speech-Engine-Umbau (Kern, höchste Priorität)
- [ ] A1 Echtzeit-Streaming statt Batch: whisper.rn `RealtimeTranscriber`
      (VAD → echtes Auto-Stop, statt RMS-Timer). Ersetzt speech.ts-Batch-Pfad.
- [x] A2 `initialPrompt` = erwarteter Ayah-Text (Conditioning) → massiv genauer.
      transcribePcm(expectedText) + prompt in transcribe(); durchgereicht bis
      [surah].tsx runRecitation. tsc/lint/jest grün. (vc17)
- [ ] A3 Wort-für-Wort „leeres Mushaf füllt sich": erwarteter Vers wird
      Token-weise sichtbar/eingefärbt, während erkannt wird (Follow-along).
- [x] A4 Fehlererkennung existiert bereits (alignWords/similarity.ts, Wort-
      Markierung + Makhradsch-Tipps). Mit Conditioning jetzt treffsicherer.
- [ ] A5 Auto-Stop schnell: stoppt sobald erwarteter Vers vollständig gematcht
      ODER VAD-Stille — nicht erst nach fixen Sekunden. (Teil von A1)
- [ ] A6 Zuverlässigkeit: Download NICHT mehr an Record koppeln; Record setzt
      geladenes Modell voraus, sonst klarer Hinweis „Modell in Einstellungen laden".
- [x] A7 Modell-Set final: base=tarteel-ai-Finetune (Standard, 148 MB) /
      turbo=large-v3-turbo (574 MB) / large=large-v3 (1,08 GB, „Maximum").
      Alles on-device, kein Hosting, keine externe Datenverarbeitung. i18n 14x.

## Phase B — Modell-/Offline-Download-Manager
- [x] B1 Modell-Download aus den Einstellungen (vc18): Storage-Screen hat jetzt
      einen Download-Button mit Fortschritt + Größe fürs Whisper-Modell (lädt
      das gewählte base/turbo), statt nur beim Aufnehmen. i18n 14x.
- [ ] B2 Onboarding-Vordownload: Sprachmodell + Rezitator-Audio + KI-Modell
      optional gleich beim Einrichten laden.
- [ ] B3 (Stretch) large-v3-Tarteel: 6 GB safetensors → GGML q5 (~1,1 GB),
      n_text_ctx=448 prüfen, hosten, als „Maximum" anbieten.

## Phase C — Settings-Redesign + RTL + Audit
- [ ] C1 Kohärentes Premium-Design (Tarteel/Babbel-Niveau), saubere Gruppierung.
- [ ] C2 RTL-Fix: ar/ur/fa/ps rechtsbündig (writingDirection/textAlign, Row-Layout).
- [ ] C3 Audit: tote/funktionslose Einstellungen raus oder reparieren;
      Defaults prüfen.

## Phase D — Onboarding-Upgrade („keine Beta")
- [ ] D1 Nach Berechtigungen: Kern-Settings durchführen (Madhhab, Sprache,
      Rezitator, Modell) → vorkonfiguriert.
- [ ] D2 Offline-Assets-Angebot (s. B2). Polierter, nicht-Beta-Look.

## Phase E — Gebets-Schritt-für-Schritt-Guide (delegierbar)
- [ ] E1 Neuer Screen: Handy während des Gebets offen, Schritt-für-Schritt,
      Gebet in lateinischer Umschrift + was zu tun ist je Schritt.
- [ ] E2 Schönes Design (Store-Asset-Pipeline-Niveau).

## Ship
- [ ] Rebuild APK, tsc/lint/jest grün, Website-Deploy (Test).
- [ ] Nach User-Bestätigung (echtes Gerät): Play Store + iOS.

Verifikation: Emulator hat KEIN Mikro → Speech-Pfad kann nur der User auf
echtem Gerät final testen. Alles andere (Design/RTL/Guide/Download-UI) per
Web-Export/Emulator/Playwright verifizierbar.

---

## BATCH 2 (Nutzer 2026-07-22, nach vc17-Test)

### F — Speech: „zu streng / erkennt nicht / keine 100%"
- [x] F1 Bewertung großzügiger (vc18): excellent 0.85→0.72, good 0.6→0.45,
      near-Schwelle len/3→len/2 (min 2), near-Gewicht 0.5→0.8. Tests angepasst.
- [x] F2 Normalisierung toleranter (vc18): persische/urdu Buchstabenformen
      (ک ی ے ھ گ) auf Arabisch gemappt — wurden vorher zu Leerzeichen zerstört.
- [ ] F3 Realtime-Wort-für-Wort statt Batch (= E/„leerer Mushaf") ist der
      eigentliche Robustheits-Fix; s. E unten.

### G — Gebet-mitbeten (pray-along) Umbau
- [x] G1 Step-Reihenfolge (vc18): HINWEISE → UMSCHRIFT (groß, Held, tap-to-hear)
      → Übersetzung → Arabisch kompakt ganz unten.
- [x] G2 Takbir-Rendering (vc18): Umschrift jetzt großer zentrierter Held →
      „allāhu akbar" vollständig; Truncation-Quelle weg.
- [ ] G3 Für die ersten beiden Rak'ah jedes Gebets die zwei kurzen Anfänger-
      Suren (Al-Fatiha + kurze Sure, z. B. Al-Ikhlas/Al-Kawthar). Braucht
      verifizierte Quran-Text+Umschrift (nichts erfinden) — eigene Runde.

### E — Leerer Mushaf — ERLEDIGT (Geräte-Test durch User offen)
- [x] E-safe (vc20): Versteckter Vers zeigt Wort-Lücken; nach Aufsagen füllen
      sich die Wörter gestaffelt, eingefärbt nach Korrektheit.
- [x] E1 Realtime (vc23): recognizeArabicStreaming transkribiert WÄHREND des
      Aufsagens periodisch (snapshot() der PCM-Aufnahme) und füllt den Vers Wort
      für Wort live; finale Bewertung bleibt der volle Durchlauf (robust, kein
      Bruch bei Partial-Fehlern). Kein RealtimeTranscriber-Native-Umbau nötig.
      Nur auf echtem Gerät (Mikro) final testbar.

### H — Widgets — GROSS (nativ)
- [~] H-Android (in Arbeit, Agent): mehr Themes (durchsichtig/schwarz/weiß/lila/
      orange), app-Setting-gesteuerte Widget-Farbe, resizable, neue Widget-Typen.
- [ ] H-iOS (WidgetKit/Swift, targets/): mehr Familien (large + Lock-Screen-
      Accessory), Tints, neue Widgets. Nur mit iOS-Build/Gerät verifizierbar —
      nicht blind, kommt wenn iOS-Build ansteht.

### Aus Batch 1 mitgenommen
- [x] Natives Keep-Awake (vc23): expo-keep-awake installiert + in keepAwake.ts
      nativ verdrahtet (activateKeepAwakeAsync); Build linkt es sauber.
- [ ] Gebets-Texte religiös gegenprüfen (USER-TODO).

### D — Onboarding (nach Widget-Agent, weil types/store/settings geteilt)
- [ ] Erst-Start: Berechtigungen (Benachrichtigung/Standort) + Kern-Settings
      vorkonfigurieren + optional Offline-Assets (Sprachmodell/KI/Rezitator)
      vorab laden. „Keine Beta"-Politur.

Reihenfolge/Impact: F1+F2 (schnell, größter Schmerz) → G1+G2+G3 → Keep-Awake
→ dann die großen Brocken E (Realtime-Mushaf) und H (Widgets) je eigene Runde.

---

## BATCH 3 (Nutzer 2026-07-22, nach vc23-Test) — „arbeite bis alles besser ist"

### I — Speech-Download-Zuverlässigkeit (WURZEL vieler Probleme)
- [ ] I1 istWhisperModellHeruntergeladen: Teil-Datei (>0 B) gilt als „fertig, 30 MB"
      → auf ERWARTETE Größe prüfen (>= groesse*0.98), sonst nicht-fertig.
- [ ] I2 Download als Modul-Singleton: Navigieren bricht ihn NICHT ab, läuft
      unabhängig vom Screen weiter, mehrere Screens teilen sich Fortschritt.
      Nach Ende Größe verifizieren, sonst löschen+Fehler.
- [ ] I3 Aufsagen NICHT während der Aufnahme downloaden (scheitert, 12s vs. Min).
      Vor Aufnahme prüfen: Modell da? sonst Download-Prompt (persistent, Screen
      verlassbar), erst wenn fertig aufnehmen.

### J — Speech-Erkennung „erkennt oft nichts / abgebrochen"
- [ ] J1 RMS-Schwelle VOICE_RMS_THRESHOLD 0.02 zu hoch (leise Wiedergabe vom
      2. Handy < Schwelle → hasSpeech=false → []). Senken/adaptiv.
- [ ] J2 Streaming-Pfad prüfen (vc23) auf Bugs/Contention; „abgebrochen" fassen.
- [ ] J3 Qualität generell besser (nach I gelöst evtl. schon deutlich besser).

### K — Leerer Mushaf (Klarstellung des Users) — KONTINUIERLICH GANZE SURE
- [ ] K1 NICHT Vers-für-Vers: Modell STARTEN → ganze Sure als verdeckter Mushaf
      → Nutzer sagt „Bismillah…" + rezitiert die ganze Sure → Modell läuft
      DURCHGEHEND, deckt Verse auf sobald korrekt erkannt; falsch → trotzdem
      aufgedeckt aber markiert. Läuft bis Sure fertig oder Stopp gedrückt.

### L — Einstellungen-Sortierung + Offline-Verzahnung
- [ ] L1 „Speicher verwalten" nahe „Offline verfügbar machen" gruppieren.
- [ ] L2 Speicher-Screen zeigt ALLES aus Offline (Koran/Suren/Rezitator/Modelle)
      an — muss ineinandergreifen.

### M — Widgets (Android) tiefer
- [ ] M1 Tap → Deep-Link zum passenden Screen (Dua-Widget → Dua, Gebets-Widget
      → Gebetszeiten-Tab), nicht „zuletzt offen".
- [ ] M2 Design deutlich besser; leere schwarze Balken bei bestimmten Größen weg
      (Content passt sich der Resize-Größe an).
- [ ] M3 Konfiguration: Farbe/Inhalt/Transparenz/Schriftart pro Widget (via
      „Bearbeiten" → App-Konfig-Screen). react-native-android-widget 0.21 ohne
      Config-Activity → App-Screen-Ansatz.

### N — Beten lernen (ruhig, IN der App) + Pray-Along-Anpassung
- [ ] N1 „Beten lernen"-Modus (nicht während des Gebets): ganze App ruhig, mit
      lateinischer UND arabischer Schrift, + die zwei kurzen Suren.
- [ ] N2 „Gebet mitbeten": Schriftgröße + Anordnung anpassbar.

Start: I (Download-Wurzel) → J → dann K/L/M/N.
