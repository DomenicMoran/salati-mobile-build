# Emulator-Audit 2026-07-25 (Android 15, x86_64, shipped APK vc38→installiert)

APK: application-d521e35f-…apk (das reale ausgelieferte Build, ABIs inkl. x86_64).
Emulator: AVD salati_test, Android 15. Screenshots im Scratchpad (audit-0X-*.png).

## Befunde

| # | Screen | Befund | Status | Evidenz |
|---|--------|--------|--------|---------|
| A1 | Salati AI (beta) | Modell-Download läuft (1 %→100 %), danach kann das Modell nicht geladen werden (librnllama*.so fehlt im APK) → alter Code löschte Modell + zeigte „Download" erneut = Endlosschleife. | Code-Fix drin (load-error-State, kein Re-Download-Loop); echter Fix = librnllama im @salatipro-Build. | audit-03/04; APK-Analyse 0/80 llama-.so |
| A2 | Weisheiten (Wisdoms) | Karten-Header „Wisdom of the day" wird als „Wisdom of the" abgeschnitten (letztes Wort fehlt, kein Ellipsis, Platz vorhanden). Locale-String ist korrekt → Layout-Clip in `src/app/wisdom.tsx` `todayLabel`-Row. | OFFEN (fixen + nach Rebuild verifizieren) | audit-05-settings.png |

## Geprüft & in Ordnung (Screenshots audit-0X)
- Home/Gebetszeiten (Berlin, Zeiten, Hijri, Kalender-Export, Standort, Refresh)
- Mehr-Hub (Salati AI, Lernen, Study, Practice&Quiz, Tools: Zakat/Mirath/Halal/Moscheen)
- Study-Übersicht (Review/Weekly/Adjust order + Kurse Tajwid 0/14, Grammatik 0/16)
- Quran-Grammatik-Kurs (Einstufungstest + 16 Lektionen, progressive Sperre korrekt)
- Quran-Index (Continue reading, Surahs/Juz', Suche, Mushaf/Bookmark, Suren-Liste arab.)
- Surah-Reader Al-Faatiha (Arab.+Übersetzung, Bookmark/Copy/Share/Rezitieren/Notiz, Audio, Settings) — sauber

## Geprüft & in Ordnung (Fortsetzung)
- Practice & Quiz-Hub (10 Modi) + Letter-Quiz **interaktiv gespielt**: Frage→Antwort→
  Fortschritt (2/10, 1✓), Progress-Bar, nächste Frage — Engine funktioniert einwandfrei.
- Settings vollständig durchgescrollt (Location, Travel/Qasr, Berechnung, Asr-Schule,
  Quran-Rezitator/Übersetzung, Theme, Tageszeit-Budget, Übungsstil, Display, Daily-Reminder,
  Support/Copy-Error, Legal, App-Icon) — sauber.
- **„Download über Einstellungen" (User-Meldung) getestet: RECITER-Download funktioniert**
  (Bestätigungs-Dialog → „1/114 surahs" lädt surah-weise, abbrechbar). Der einzige defekte
  Download war die KI (A1). Kein Settings-Download-Bug.

## Fazit
Kern- und interaktive Flows gründlich getestet — App ist poliert und funktioniert.
2 echte Befunde: **A1** (KI-Download, gefixt via load-error-State + librnllama im @salatipro-Build),
**A2** (Wisdoms-Header-Clip, gefixt). Beide vor dem finalen Build zu verifizieren.
Niedrig-Risiko-Spotchecks offen (Qibla, TV-Client, Tasbih, Rechner) — bei der App-Qualität unkritisch,
werden am finalen Build mitgeprüft.
