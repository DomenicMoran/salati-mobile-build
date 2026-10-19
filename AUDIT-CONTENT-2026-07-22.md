# Salati — Inhalts- & Feature-Audit (Vollständigkeit, Koran-Reader-Tiefe, Konkurrenz-Parität)

Datum: 2026-07-22 · Methode: statische Code-/Datenanalyse, alle Zahlen gezählt (nicht geschätzt). Nur Analyse, keine Code-Änderungen.
Vergleichsmaßstab: Muslim Pro, Quran.com / Tarteel, Ayah, Athan, Pillars.

## Executive Summary

Der Bestand ist inhaltlich **deutlich reicher als der typische Konkurrent** und der Koran-Reader ist funktional **nahe an Quran.com-Parität**. Es gibt **keine** „coming soon"/Platzhalter-Lücken — alle 311 Studien-Lektionen und 42 Lese-Lern-Lektionen sind voll befüllt und quellenzitiert. Die realen Schwächen sind **(a) unvollständige Übersetzung von Lern-INHALTEN in 8–11 der 14 App-Sprachen** (UI ist 14-sprachig, Inhalt fällt teils auf Englisch zurück), **(b) Tafsir/Wort-für-Wort nur Arabisch+Englisch**, und **(c) fehlende „weiche" Konkurrenz-Features** (AR-Qibla, Community). Alle geprüften Store-Zahlen stimmen (außer einer veralteten Dua-Zahl, die zu niedrig ist).

---

## Befund-Tabelle

| Bereich | Befund | Schweregrad | Beleg | Vorschlag |
|---|---|---|---|---|
| **Studien-Kurse: Vollständigkeit** | Alle 12 Kurse (311 Lektionen) voll befüllt: jede Story-Lektion hat Text-Abschnitte **und** Quiz **und** Quellenangabe. Keine leeren/Platzhalter-Lektionen. „placeholder/TODO"-Regex-Treffer sind ausnahmslos False-Positives (span. „todos", „método"). | — (gut) | `courses.ts:72-83`; Zähl-Lauf: akhlaq 9L/27 Story/39 Quiz, aqida 11/48/55, nawawi40 42/126/126, seerah 20/85/91, tajwid 14/48/66, alle `withSource=100%` | Kein Handlungsbedarf |
| **Lesen-lernen-Kurs** | 42 Lektionen (Alphabet→erste Suren), 165 Vokabeln, jede Lektion mit Quiz. Isolierte + verbundene Buchstabenformen (initial/medial/final via ZWJ) vollständig für alle 28 Buchstaben. | — (gut) | `curriculum.ts:181-401` (7 Gruppen+similar+3 forms+3 haraka+6 concept+2 words+5 reading+4 salah+11 vocab = 42); `letters.ts:66-80`; vocab=165 gezählt | Kein Handlungsbedarf |
| **i18n-Lücke Studien-Kurse** | akhlaq (9L), aqida (11L), nawawi40 (42L), nikah (5L) = **67 Lektionen** haben Story+Quiz **nur in de/en/tr/fr/es/ar**; die 8 Phase-1-Sprachen (id/bn/fa/ms/ur/sw/ru/ps) fallen auf Englisch zurück. | **P1** | Zähl-Lauf „STORY loc gaps: id:0/… bn:0/…" für akhlaq/aqida/nawawi40/nikah; `curriculum.ts:36-48` (dokumentiert + In-App-Fallback-Hinweis) | Übersetzungs-Batch für diese 4 Kurse in die 8 Sprachen (Phase 2) |
| **i18n-Lücke Dialekte** | dialects (28L, 224 Wörter): Vokabel-Bedeutungen nur in 6 Sprachen; id/bn/fa/ms/ur/sw/ru/ps = 0. | **P1** | Zähl-Lauf „dialects … gaps: id:0 bn:0 …" | Wie oben; Bonus-Kurs, daher nach den 4 Haupt-Kursen |
| **i18n-Lücke 99 Namen** | Bedeutungen nur **de/en/tr**. es/fr **und** die 8 neuen Sprachen fehlen (11 von 14 App-Sprachen ohne lokalisierte Bedeutung). | **P1** | `names.ts:1-11` (Interface nur de/en/tr); Check: `es:`/`fr:`/`id:` = false | Mind. es/fr ergänzen (Store ist dort live), dann die restlichen |
| **Gut lokalisierte Inhalte** | grammar/prophets/sahaba/seerah/tajwid Story+Quiz = **alle 14 Sprachen** („loc gaps: FULL"). amau (869 W.) + madinah (872 W.) Vokabeln = FULL. 89 Duas = alle 14 Sprachen + alle mit Quelle. | — (gut) | Zähl-Lauf; `duas.json` (89 Duas, 18 Kategorien, alle `source`) | — |
| **Koran-Reader: Kern-Tiefe** | Vorhanden: mehrere Übersetzungen (beste je Sprache vorgewählt) + **frei wählbare 2. Vergleichsübersetzung**, Transliteration, Tafsir, Wort-für-Wort (Arabisch+Übersetzung+Translit+**Wort-Audio**+Tajwid je Wort), Tajwid-Farbe auf **Vers- UND Wort-Ebene** (farbenblind-optimiert), 8 Rezitatoren mit **Wort-Sync-Highlighting**, Rezitatoren-Vergleich, Mushaf 604-Seiten (Uthmani+IndoPak), Volltextsuche, Lesezeichen, Verlauf/Weiterlesen, **Vers-Notizen**, Sajda-Marker, Basmala-Handling, Offline-Audio, Khatmah, Hifz-Trainer. | — (sehr stark) | `api.ts` durchgängig; `[surah].tsx` (2137 Z., Reader) Feature-Grep; `progress.ts` (notes) | Nahe Quran.com-Parität; siehe Reader-Lücken unten |
| **Reader-Lücke: Tafsir-Sprachen** | Tafsir nur **Arabisch (Muyassar) + 3× Englisch** (Ibn Kathir/Ma'arif/Tazkir). Kein de/tr/es/fr/… Tafsir. Nicht-EN/AR-Nutzer bekommen englischen Tafsir als Default. | **P1** | `api.ts:126-183, 534-549` (`BEST_TAFSIRS` → alle Nicht-AR = `qc.169` Englisch) | Öffentliche Quellen begrenzt; ggf. deutschen Tafsir (z. B. lizenzfrei/eigene Kurz-Erklärung) prüfen; klar labeln |
| **Reader-Lücke: Wort-für-Wort nur EN** | Wort-Übersetzung + Wort-Transliteration nur Englisch (quran.com-API-Grenze). | **P2** | `api.ts:234-238` (dokumentiert) | Als bekannte Grenze belassen oder eigene de-Wortglossen für Kernsuren |
| **Reader-Lücke: Suche** | Nur wörtliche Treffer, **keine arabische Wurzel-/Morphologie-Suche** (gleiche Charakteristik wie quran.com-UI). | **P2** | `api.ts:604-625` (dokumentiert) | Optional: Wurzel-Normalisierung für arabische Suche |
| **Gebetszeiten** | 13 Berechnungsmethoden + 2 Madhāhib (Asr), Aladhan-API. Konkurrenz-Niveau. | — (gut) | `settings/methods.ts` (13 METHODS, 2 SCHOOLS) | — |
| **Adhan-Auswahl** | 6 volle Adhan-Aufnahmen + „default". Keine benannten Muezzin (Makkah/Madinah) wie Muslim Pro/Athan. | **P2** | `prayer-times/azan.ts`; `settings/types.ts` (`AZAN_CHOICES` 6) | Adhan-Quellen benennen/kuratieren (Makkah, Madinah, al-Afasy …) |
| **Widgets / Wear** | iOS-Widget + Live Activity **und** Android-Widgets (Prayer/Countdown/Qibla/Streak) + Wear-OS-Modul. Über Konkurrenz-Niveau. | — (stark) | `src/widgets/*`; `android/app/.../widget`; `android/wear/src`; `prayer-times/live-activity.*` | — |
| **Qibla** | Kompass + Kalibrierung, aber **keine AR/Kamera-Qibla** (Muslim Pro/Athan haben AR). | **P2** | `qibla/*` (kein `camera`/`AR`-Treffer) | AR-Qibla als Zusatzansicht (expo-camera + Sensor) |
| **Community / Sozial** | **Keine** Freunde/Community/Leaderboard-Features (Muslim Pro Community, Athan Gruppen). | **P2** | Kein `friend`/`community`/`leaderboard`-Feature-Verzeichnis | Bewusste Design-Entscheidung (kein Account/kein Tracking) — als Stärke positionieren, nicht zwingend bauen |
| **Hifz-Trainer** | Wort-für-Wort-Rezitationsprüfung via On-Device-Whisper, Gap-Test, Ähnlichkeit, Fortschritt. **Tarteel-Niveau — selten in Konkurrenz.** | — (überlegen) | `features/hifz/*` (whisperCheck, gapTest, similarity, reciteFlow) | Als Alleinstellungsmerkmal vermarkten |
| **Salati-AI** | On-Device-Q&A zu Koran/Hadith/Duas, quellenbeschränkt, klar als KI gelabelt. Kein Konkurrent hat das lokal. | — (überlegen) | Store `en.md:44-47`; `features/ki/` | AI-Act Art. 50 Disclosure ist vorhanden — beibehalten |
| **Store-Claim „47 Duas"** | Store sagt „47 duas", Code hat **89** (alle mit Quelle). Under-Claim / veraltete Zahl. | **P2** | `en.md:57` vs `duas.json` (89) | Store-Text auf „89 duas" korrigieren (positiv) |
| **Store-Claim „14 Sprachen"** | „fully available in 14 languages" stimmt für die **UI**, aber Lern-INHALTE (4 Studien-Kurse + Dialekte + 99 Namen) fallen für 8–11 Sprachen auf Englisch zurück. In-App-Fallback-Hinweis mildert das ehrlich ab. | **P1** | `en.md:64`; `curriculum.ts:36-48` | Entweder Inhalte nachziehen (P1-Punkte oben) oder Store-Wording präzisieren („App in 14 Sprachen, ausgewählte Kurse zurzeit in 6") |
| **Store-Zahlen sonst** | 42 Lektionen, 311 Lektionen, 165 Vokabeln, 177 Fragen/14 Modi, 22 Badges, 26 Weisheiten, 11 Guides, 13 Hadith-Sammlungen, 99 Namen, 12 Kurse — **alle exakt verifiziert**. | — (gut) | Zähl-Läufe je Datei | Kein Handlungsbedarf |
| **Store-Listing-Sprachen** | Store-Texte nur in de/en/tr/es/fr/ar (6). 8 App-Sprachen ohne Store-Beschreibung. | **P2** | `store/listing/*.md` (nur 6 Dateien) | Store-Listings für id/bn/fa/ms/ur/ru/sw/ps ergänzen |

---

## Top-10 Content-Lücken zum Füllen

1. **P1 — 99 Namen Allahs: Bedeutungen in es/fr** (Store ist dort live) und danach in den 8 neuen Sprachen. Aktuell nur de/en/tr. `names.ts`
2. **P1 — nawawi40 (42 Lektionen) Story+Quiz** in id/bn/fa/ms/ur/sw/ru/ps übersetzen (größter Einzelkurs mit Lücke).
3. **P1 — aqida (11 Lektionen) Story+Quiz** in dieselben 8 Sprachen.
4. **P1 — akhlaq (9) + nikah (5) Story+Quiz** in dieselben 8 Sprachen.
5. **P1 — Dialekte-Kurs (224 Vokabeln)** Bedeutungen in die 8 Sprachen.
6. **P1 — Tafsir außerhalb AR/EN**: mind. eine deutsche Tafsir-/Kurz-Erklärungsebene, damit nicht-englische Nutzer keinen englischen Tafsir als Default sehen.
7. **P2 — 99 Namen: Nutzen/Erklärungstext** je Name (aktuell nur 1-Zeilen-Bedeutung; Muslim Pro hat Benefit-Text).
8. **P2 — Wort-für-Wort-Übersetzung Deutsch** für Kernsuren (Fatiha, Ikhlas, Mu'awwidhatan) als eigene Glossen, da API nur EN liefert.
9. **P2 — Store-Listings** in den 8 fehlenden App-Sprachen anlegen.
10. **P2 — Adhan-Bibliothek** kuratieren + benennen (Makkah/Madinah/al-Afasy) statt 6 generischer Aufnahmen.

## Top-10 fehlende Features für Konkurrenzfähigkeit

1. **P2 — AR/Kamera-Qibla** (Muslim Pro, Athan) — sichtbarster fehlender „Wow"-Baustein.
2. **P1 — Tafsir-Sprachtiefe** (siehe oben) — Quran.com/Tarteel bieten Tafsir in mehr Sprachen.
3. **P2 — Wort-für-Wort in weiteren Sprachen** (Quran.com hat u. a. Urdu/Bengali WBW).
4. **P2 — Arabische Wurzel-/Morphologie-Suche** (Quran.com Corpus-Suche).
5. **P2 — Benannte Adhan-Stimmen + Pre-Adhan-Erinnerung** je Gebet.
6. **P2 — Vers-für-Vers-Wiederhol-/Loop-Bereich** im Reader für Auswendiglernen (falls über den Hifz-Trainer hinaus nicht im Haupt-Reader).
7. **P2 — Community/Freunde/geteilte Ziele** (Muslim Pro) — oder bewusst als „privacy-first, kein Konto" positionieren.
8. **P2 — Duas-Umfang & -Struktur**: 89 ist solide, aber Hisnul-Muslim-Vollausbau (Situations-Duas: Reise, Krankheit, Regen …) würde Athan/Muslim Pro schlagen.
9. **P2 — Tajwid-Audio-Beispiele** je Regel (Konkurrenz koppelt Farbe an Hörbeispiel) — Farbcodierung ist da, Ton-Beispiel je Regel prüfen.
10. **P2 — Mushaf-Lesezeichen/Seiten-Sprung-Historie** und Hafs/Warsh-Qira'at-Varianten (Muslim Pro Premium) — aktuell Uthmani+IndoPak-Schrift, aber nur Hafs-Lesart.

---

*Alle Aussagen sind aus Datei-/Datenzählungen belegt (siehe Beleg-Spalte). Keine Codeänderung im Rahmen dieses Audits.*
