# LUECKEN.md — paradigmen-verben.json

> **Nachtrag (neuester Lauf, diese Sitzung, 2026-09-06, Balagah-Vergleichstabellen-Auftrag):**
> Die beiden letzten offenen Posten aus dem Wortlisten-Auftrag (siehe
> Abschnitt direkt darunter) sind jetzt geschlossen: (1) die drei
> zurückgestellten Vergleichstabellen H-165/H-170/H-171 und (2) die 16
> Balagah-Tabellen H-167-169/H-172-184, für die zuvor kein Seitenbild
> vorlag. Alle nötigen Seiten (138, 159-165, 170) wurden diese Sitzung mit
> PyMuPDF gerendert (Zoom 3, Volltextseite, ausreichend scharf für alle
> Harakat). Ergebnis: 18 Vergleichstabellen (H-165, H-167 bis H-183) sind
> jetzt als neuer, eigener Datentyp `Vergleichstabelle` in `data/wortlisten.json`
> übernommen (siehe `wortlistenTypes.ts` — bewusst SEHR nah an der
> bestehenden `ParadigmTabelle`-Struktur aus `erklaerungenTypes.ts` gehalten:
> dieselben `columns`/`rows`-Typen, nur `cells` gelockert auf `{ar?, de?}`
> statt eines erzwungenen Arabisch+Deutsch-Paares, weil diese Tabellen pro
> Zelle oft nur EINEN Wert drucken). H-184 (reine Vokabelliste, S. 170) ist
> zusätzlich als 17. Wortliste `wortliste-h184-balagah-vokabular-teil1`
> übernommen (existierender `vokabelliste`-Typ, kein neuer Datentyp nötig).
> Angeschlossen über `WortlisteView.tsx` (`VergleichstabelleCard`),
> `WortlistenKatalogView.tsx` (Kapitel-Gliederung + Gesamtzahl) und
> `wortlistenLoader.ts`/`wortlistenLoader.test.ts` (Bestandszahlen
> nachgezogen: 17 Wortlisten/494 Einträge, 18 Vergleichstabellen). Siehe den
> neuen Abschnitt "Priorität 8 — Vergleichstabellen (Balagah-Auftrag, diese
> Sitzung)" sowie die abschließende "Vollständigkeitsbilanz —
> Vergleichstabellen-Auftrag" ganz unten für die vollständige, begründete
> Entscheidung zu jedem der 19 zuvor offenen Einträge. Damit ist laut
> `TABELLEN-INVENTAR.md` JEDER Eintrag des gesamten Inventars (Abschnitt A+B+C,
> 206 Einträge) entweder als Datenartefakt übernommen oder mit einer
> inhaltlichen (nicht mehr bildbezogenen) Begründung ausgelassen.

> **Nachtrag (neuester Lauf, diese Sitzung, 2026-09-06, Wortlisten-Auftrag):**
> Der Auftrag "nichts aus der Vorlage fehlt" verlangte, alle bisher mit
> "keine Paradigmentabelle" abgetanen Einträge (Vokabellisten, Partikelliste,
> Beispielsatzliste, Flussdiagramme, drei pädagogische Zwischentabellen)
> entweder als eigenen Datentyp zu übernehmen oder mit einer echten
> inhaltlichen Begründung auszulassen. Ergebnis: 16 Vokabel-/Partikellisten
> (459 Einträge), 2 Beispielsatzlisten und 2 Flussdiagramme sind jetzt in
> `data/wortlisten.json` (neuer, eigener Datentyp, siehe
> `wortlistenTypes.ts`/`wortlistenLoader.ts`) übernommen und im Reiter
> "Grammatik & Ṣarf" unter dem neuen Unterreiter "Wortlisten"
> (`WortlistenKatalogView.tsx`) sichtbar. Siehe ganz unten den neuen
> Abschnitt "Priorität 7 — wortlisten.json (Wortlisten-Auftrag, diese
> Sitzung)" sowie die abschließende "Vollständigkeitsbilanz —
> Wortlisten-Auftrag" für die vollständige, begründete Entscheidung zu JEDEM
> zuvor mit "keine Paradigmentabelle" ausgelassenen Eintrag. Dieser Abschnitt
> ist der aktuelle Stand für den Wortlisten-Teil des Inventars; die
> Paradigmentabellen-Bilanz weiter unten (Kapitel 8 Sarf usw.) bleibt
> unverändert gültig.

> **Nachtrag (neuester Lauf, diese Sitzung, 2026-09-06):** Die beiden
> letzten konkret identifizierten Lücken (H-16, H-25) sind jetzt übernommen,
> und alle ca. 19 ungeprüften Reintext-Fragmente wurden einzeln geöffnet und
> entschieden — siehe ganz unten den neuen Abschnitt "Priorität 6 —
> paradigmen-nachtrag.json (diese Sitzung) + Abschluss der Reintext-Fragmente"
> sowie die abschließende "Vollständigkeitsbilanz — Abschluss". Diese beiden
> Abschnitte sind der aktuelle Stand; alles darüber ist der unveränderte
> Bericht der vorherigen Läufe.

> **Nachtrag (neuester Lauf, diese Sitzung):** Die "letzte inhaltliche
> Lücke" außerhalb Kapitel 8 ist jetzt zu einem großen Teil geschlossen —
> siehe ganz unten den neuen Abschnitt "Priorität 5 — paradigmen-weitere.json
> (diese Sitzung)" sowie die aktualisierte "Vollständigkeitsbilanz" am Ende.
> Dieser Abschnitt ist der aktuelle Stand; alles darüber ist der
> unveränderte Bericht der vorherigen Läufe.

> **Nachtrag (neuester Lauf):** Kapitel 8's Murakkab-Familie (kombinierte
> Verbschwächen, Abbildungen 122–142) ist jetzt vollständig erfasst — siehe
> ganz unten den Abschnitt "Priorität 3c — Murakkab (Kapitel 8) vollständig,
> EIGENE Datei" sowie die abschließende "Vollständigkeitsbilanz". Diese
> beiden Abschnitte sind der aktuelle Stand; alles darüber ist der
> unveränderte Bericht der vorherigen Läufe.

Stand: siehe Git-Historie dieser Datei. Bezieht sich ausschließlich auf
`paradigmen-verben.json` (Verb-Personenmatrizen + Bab-Tabellen aus
`handout.pdf`). `paradigmen.json`/`paradigmen.test.ts` wurden NICHT
angefasst.

## Priorität 2 — vollständig (6/6 Personenmatrizen)

Alle sechs geforderten Matrizen sind fertig, zeichengenau aus den
gerenderten Seitenbildern von `handout.pdf` gelesen (Zoom ≥12, tabellen-
bereich zugeschnitten) und gegen die bereits verifizierten Formen in
`paradigmen.json` kreuzgeprüft, wo Überschneidung besteht:

- `verb-madi-nasara-aktiv-matrix` (S. 45, Abbildung 19) — inkl. 2.-Person-Dual
- `verb-mudari-nasara-aktiv-matrix` (S. 46, Abbildung 20) — inkl. Dual
- `verb-madi-nasara-passiv-matrix` (S. 64, Abbildung 29)
- `verb-mudari-nasara-passiv-matrix` (S. 65, Abbildung 30)
- `amr-nasara-matrix` (S. 50, Abbildung 27)
- `nahy-nasara-matrix` (S. 49, Abbildung 25)

Keine Lücken in diesen sechs Tabellen.

### Nachtrag: Umbau auf das Handout-Raster (5 Zeilen × 3 Spalten)

Die sechs Matrizen lagen zunächst als flache Liste (14 Zeilen × 1 Spalte
"form") vor statt im gedruckten Raster des Handouts. Sie wurden auf das im
Original abgebildete Raster umgestellt (Beleg: `handout.pdf` S. 64,
Abbildung 29 — Kopfzeile `Plural | Dual | Singular | Person`, RTL
gelesen, Personenspalte rechts):

- **Spalten** (`plural`, `dual`, `singular`), in gedruckter Links-nach-
  rechts-Reihenfolge; die Person-Spalte ist als Zeilenbeschriftung
  geführt (RTL: sie stünde rechts) — per `notes`-Eintrag je Tabelle
  dokumentiert.
- **Zeilen**: `3-m`, `3-f`, `2-m`, `2-f`, `1` (3./2. Person je maskulin/
  feminin, dann 1. Person) — exakt die im Handout gedruckte Reihenfolge.
- Die bereits extrahierten 14 Formen der vier vollständigen Verbmatrizen
  (Madi/Mudari × Aktiv/Passiv) wurden 1:1 anhand ihrer alten Zeilen-IDs
  (z. B. `3f-du` → Zeile `3-f`, Spalte `dual`) auf die 15 Rasterfelder
  verteilt — kein Wert geändert, keine Form neu erfunden.
- **Einzige echte Lücke im Raster:** Zelle `1`/`dual` ist in allen sechs
  Matrizen `null`, weil die 1. Person im Arabischen keinen eigenen Dual
  kennt (nur Singular/Plural) — keine Extraktionslücke, sondern eine im
  Arabischen fehlende Grammatikkategorie (ebenso bereits in
  `paradigmen.json`, Tabelle `pronomen-frei`, dokumentiert). Mit
  `notes`-Eintrag je Tabelle festgehalten.
- Bei `amr-nasara-matrix`/`nahy-nasara-matrix` existieren nur 5 Formen
  (nur 2. Person). Im selben 5×3-Raster sind daher die Zeilen `3-m`,
  `3-f` und `1` komplett `null` (Imperativ/Verbot kennt grammatisch nur
  die 2. Person) — mit `notes`-Eintrag dokumentiert. Die vormals
  gemeinsam geführte Dual-Zeile (`2-du`, für m/f identisch abgedruckt)
  wurde unverändert in beide Zellen `2-m`/`dual` und `2-f`/`dual`
  übernommen (keine neue Form, dieselbe geprüfte Zeichenkette zweimal
  platziert, mit Begründung in `notes`).
- Kein Rasterfeld musste mit einer unbekannten/erfundenen Form
  aufgefüllt werden — alle 14 (bzw. 5 bei Amr/Nahy) bereits verifizierten
  Formen fanden ein eindeutiges Feld im 5×3-Raster.
- Test `paradigmen-verben.test.ts` (neu angelegt, existierte vorher
  nicht) nagelt Raster, Nullzellen und die Korpus-Gegenprobe fest, inkl.
  eines Regressionsschutzes gegen versehentliches Duplizieren von Aktiv-
  und Passiv-Zellen.

## Priorität 3 — Bab-Tabellen (Kapitel 8): Mahmooz-Familie jetzt vollständig (11/11)

Kapitel 8 enthält laut `find_tables()`-Scan über die Seiten 103–130+ eine
sehr große Zahl von "Bab"-Tabellen (jeweils 3 Zeilen × 5 Spalten, ohne
gedruckte Kopfzeile). Die komplette Mahmooz-Familie (Verben mit Hamza als
Wurzelbuchstabe, Abbildungen 41–51, S. 103–105) ist jetzt vollständig und
zeichengenau extrahiert:

- `bab-fataha-mahmooz-qaraa` (S. 103, Abb. 41 — قَرَأَ, lesen)
- `bab-samia-mahmooz-amina` (S. 104, Abb. 42 — أَمِنَ, sicher sein/vertrauen)
- `bab-daraba-mahmooz-abaqa` (S. 104, Abb. 43 — أَبَقَ, weglaufen/entfliehen)
- `bab-nasara-mahmooz-akala` (S. 104, Abb. 44 — أَكَلَ, essen)
- `bab-tafil2-mahmooz-ajjara` (S. 104, Abb. 45 — أَجَّرَ, Form II, vermieten)
- `bab-mufaala3-mahmooz-aakhadha` (S. 104, Abb. 46 — آخَذَ, Form III, zur Rechenschaft ziehen)
- `bab-ifal4-mahmooz-aamana` (S. 105, Abb. 47 — آمَنَ, Form IV, glauben)
- `bab-tafaul5-mahmooz-taammala` (S. 105, Abb. 48 — تَأَمَّلَ, Form V, nachdenken)
- `bab-tafaul6-mahmooz-taamara` (S. 105, Abb. 49 — تَآمَرَ, Form VI, sich verschwören)
- `bab-iftial8-mahmooz-itamara` (S. 105, Abb. 50 — اِيْتَمَرَ, Form VIII, Befehl befolgen)
- `bab-istifal10-mahmooz-istajara` (S. 105, Abb. 51 — اِسْتَأْجَرَ, Form X, mieten)

Vorgehen bei den neun neu hinzugekommenen Tabellen (43–51): pro Tabelle
zunächst `page.find_tables()` für die exakte Zellen-Bounding-Box benutzt
(Tabellenindex je Seite protokolliert), dann die ganze Tabelle bei Zoom
20–30 gerendert (bei diesem Font/dieser Auflösung bereits scharf genug für
alle Harakat) und bei jedem Zweifelsfall (Hamza-Sitz, Fathatan vs. Hamza,
Sukun-Kreis vs. Qaf-Punkte, verschmolzenes Hamzat-al-Wasl) zusätzlich
einzelne Zellen/Wörter bei Zoom 70–200 nachgeschnitten. Jede Tabelle wurde
zusätzlich linguistisch gegengeprüft (erwartetes Bab-Muster Fatha/Damma
bzw. Fatha/Kasra etc., bekannte Ausnahmen wie أكل/أخذ/أمر ohne Hamza im
Imperativ) und stichprobenartig gegen das Quranic-Arabic-Corpus abgeglichen
(Test `paradigmen-verben.test.ts`, Block "Bab-Tabellen — Korpus-
Gegenprobe"): für alle elf Tabellen sind mindestens die Madhi-Grundformen
im Korpus belegt, abgeleitete Formen (Mudari, Masdar, Ism, verstärkte
Formen) sind mit dokumentierter, aus dem Testlauf ermittelter
Ausnahmeliste versehen — nichts wurde geraten oder unbelegt stehen
gelassen, ohne es zu kennzeichnen.

Neue Struktur-Beobachtung (in den jeweiligen `notes` dokumentiert): bei
verstärkten Formen (II, III, V, VI, VIII, X) ist die "Ableitung" in der
Imperativ-Zeile keine eigene Ism-Makan/Zaman-Bildung wie bei Form I,
sondern exakt dieselbe Ism-Maf'ul-Form wird wiederverwendet — bei mehreren
Tabellen per Zoom ≥90 gegen Verwechslung mit der Ism-Fa'il-Form (Kasra
statt Fatha) geprüft.

**Nicht extrahiert** (fehlen bewusst, kein Rateversuch unternommen) —
grober Umfang laut Seiten-Scan ca. 90 weitere Bab-Tabellen:

- **Mithal Wawi** (schwacher 1. Radikal Waw), Abbildungen 52–62, S. 106–108
  (Fataha, Sami'a, Daraba, Hasiba, Taf'il II, Mufa'ala III, If'al IV,
  Tafa'ul V/VI, Ifti'al VIII, Istif'al X)
- **Mithal Ya'i** (schwacher 1. Radikal Ya), Abbildungen 63 ff., S. 109–110
- **Ajwaf** (schwacher mittlerer Radikal), Abbildungen 73–83, S. 111–115
- **Naqis** (schwacher letzter Radikal), Abbildungen 84–95, S. 115–119
- **Lafif** (zwei schwache Radikale, Maqrun/Mafruq), Abbildungen 96–107, S. 119–122
- **Muda''af** (verdoppelter letzter Radikal), Abbildungen 108–121, S. 122–126
- **Murakkab / kombinierte Fälle** (Mithal+Mahmuz, Ajwaf+Mahmuz, Naqis+Mahmuz …),
  Abbildungen 122 ff., S. 126–130+

Empfehlung für eine Fortsetzung: gleiches Rezept wie oben (find_tables()
je Seite → ganze Tabelle bei Zoom 20–30 → Zweifelsfälle bei Zoom 70–200
nachschneiden → linguistische Musterprüfung → Korpus-Gegenprobe im Test
ergänzen). Bei den Mithal-/Ajwaf-/Naqis-/Lafif-/Muda''af-Familien treten
zusätzliche Sonderfälle auf (Elision des schwachen Radikals, Kontraktion
bei doppeltem Konsonanten) — dort ist mit mehr Lesefehlerpotential zu
rechnen als bei der (bereits abgeschlossenen) reinen Mahmooz-Familie.

## Priorität 4 — weitere Tabellen aus dem Inventar (noch nicht abgeglichen)

`TABELLEN-INVENTAR.md` (Abschnitt B: grammatik.pdf, 83 Seiten; Abschnitt C:
handout.pdf, 185 automatisch erkannte Tabellen abzüglich Bab-Tabellen und
Leerfunde) enthält über die Bab-Tabellen und die bereits in
`paradigmen.json`/`paradigmen-verben.json` übernommenen Inhalte hinaus
weitere Tabellen (u. a. Nomen-Deklinationstabellen, Zahlwörter,
Verbindungsbuchstaben-Listen, Fragewörter-Übersichten, Ism-Tafdeel-Tabellen
aus Kapitel 6, sowie diverse Tabellen aus grammatik.pdf). Diese wurden in
dieser Sitzung **nicht** systematisch gegen den Bestand abgeglichen — das
Zeitbudget floss vollständig in die (priorisierte) Bab-Familie. Für eine
Fortsetzung: `TABELLEN-INVENTAR.md` Abschnitt B und den nicht-Bab-Teil von
Abschnitt C zeilenweise gegen die vorhandenen IDs in beiden JSON-Dateien
abgleichen und fehlende Tabellen nach demselben Rezept (Bildrendering statt
Textlayer) übernehmen.

## Erkannte Fallstricke (für Fortsetzung wichtig)

- **Tanwin vs. Hamza-Glyph:** Bei Wörtern, die auf Hamza-auf-Alif enden
  (z. B. مَقْرَأ), kann der Hamza-Haken bei niedrigem Zoom wie eine
  zweite Tanwin-Strich aussehen. Bei ≥40-fachem Zoom gegengeprüft: die
  Ism-Fa'il-/Ism-Maf'ul-/Ableitungs-Formen in den bisher geprüften
  Bab-Tabellen stehen im Original OHNE Tanwin (reine Zitierform); der
  Masdar dagegen trägt in beiden geprüften Tabellen Fathatan.
- **Text-Layer von handout.pdf ist für Tabellen unbrauchbar:**
  `page.get_text()` liefert für die Bab-Tabellen und für die
  Nasara-Personentabellen eine falsche Lese-/Zeichenreihenfolge
  (Spalten vertauscht, Zeichen invertiert). Nur das gerenderte Pixelbild
  ist verlässlich.
- **PyMuPDF `find_tables()` liefert exakte Zellen-Bounding-Boxes** für
  die 3×5-Bab-Tabellen und die 6×4-Nasara-Tabellen — das spart gegenüber
  manuellem Koordinatenschätzen mehrere Zoom-Fehlversuche pro Tabelle.

## Priorität 3b — Naqis/Lafif/Muda"af (Kapitel 8) vollständig, EIGENE Datei

**Wichtig:** Diese drei Familien liegen NICHT in `paradigmen-verben.json`,
sondern in einer neuen, eigenen Datei
`paradigmen-bab-naqis-lafif-mudaaf.json` (samt eigenem Test
`paradigmen-bab-naqis-lafif-mudaaf.test.ts`), damit paralleles Arbeiten an
`paradigmen-verben.json` (Mahmooz, siehe oben) und an
`paradigmen-bab-mithal-ajwaf.json` (Mithal/Ajwaf, separater Lauf) nicht
kollidiert. Gleiches Schema wie `paradigmen-verben.json` (`{ schema: 1,
tables: [...] }`, Bab-Tabellen 3 Zeilen × 4 Spalten madhi/mudari/masdar/ism,
ohne die gedruckte "fahuwa"-Spalte).

Alle 38 Tabellen zeichengenau aus gerenderten Seitenbildern gelesen
(Zoom 12–30 für die ganze Tabelle, Zoom 40–80 für jeden Zweifelsfall
einzeln nachgeschnitten) — 12 Naqis (Abbildungen 84–95, S. 117–119), 12
Lafif (Abbildungen 96–107, S. 120–122), 14 Muda"af (Abbildungen 108–121,
S. 123–126):

- Naqis: `bab-fataha-naqis-saa`, `bab-samia-naqis-radiya`,
  `bab-daraba-naqis-rama`, `bab-nasara-naqis-daa`, `bab-tafil2-naqis-salla`,
  `bab-mufaala3-naqis-nada`, `bab-ifal4-naqis-abqa`,
  `bab-tafaul5-naqis-talaqqa`, `bab-tafaul6-naqis-talaqa`,
  `bab-infial7-naqis-inqada`, `bab-iftial8-naqis-ibtala`,
  `bab-istifal10-naqis-istaala`.
- Lafif: `bab-samia-lafif-qawiya`, `bab-daraba-lafif-rawa`,
  `bab-daraba-lafif-wafa`, `bab-hasiba-lafif-waliya`,
  `bab-tafil2-lafif-sawwa`, `bab-mufaala3-lafif-sawa`,
  `bab-ifal4-lafif-awha`, `bab-tafaul5-lafif-tawaffa`,
  `bab-tafaul6-lafif-tadawa`, `bab-infial7-lafif-inzawa`,
  `bab-iftial8-lafif-istawa`, `bab-istifal10-lafif-istawla`.
- Muda"af: `bab-samia-mudaaf-barra`, `bab-daraba-mudaaf-farra`,
  `bab-nasara-mudaaf-madda`, `bab-tafil2-mudaaf-habbaba`,
  `bab-mufaala3-mudaaf-shaqqa`, `bab-ifal4-mudaaf-ahabba`,
  `bab-tafaul5-mudaaf-tahaqqaqa`, `bab-tafaul6-mudaaf-tahajja`,
  `bab-infial7-mudaaf-inshaqqa`, `bab-iftial8-mudaaf-ishtadda`,
  `bab-ifilal9-mudaaf-ihmarra`, `bab-istifal10-mudaaf-istahabba`,
  `bab-ifilal11-mudaaf-ihmaarra`, `bab-ifillal4-mudaaf-iqshaarra`.

**Strukturabweichungen gegenüber den Mahmooz-Bab-Tabellen** (jeweils mit
Bild-Beleg, in den `notes` jeder betroffenen Tabelle dokumentiert):

- Bei allen zwölf **Lafif**-Tabellen hat die Imperativ-Zeile im Original
  KEINE dritte Ism-Zelle (nur Amr+Nahy) — anders als bei Mahmooz/Naqis, wo
  dort eine wiederverwendete Ism-Maf'ul-Form steht.
- Bei allen vierzehn **Muda"af**-Tabellen fehlt die Ism-Zelle in der
  Imperativ-Zeile ebenfalls komplett (wie bei Lafif, nicht wie bei Naqis).
- **Form VII** (Infi'al) hat grammatisch keine eigene Passivform: bei
  Naqis/Muda"af enthält die gedruckte "Passiv"-Zeile nur den (mit Aktiv
  identischen) Masdar zentriert über die ganze Zeile; bei
  `bab-infial7-lafif-inzawa` druckt das Original sogar nur 2 Zeilen
  (Aktiv, Imperativ) — dort fehlt der Schlüssel `passiv` in der JSON
  komplett. Dieselbe "nur Masdar"-Passiv-Zeile gilt für die drei
  Muda"af-Sonderformen If'ilal IX (`اِفْعَلَّ`), If'ilal XI
  (`اِفْعَالَّ`) und die im Original ausdrücklich (aber unüblich) als
  "Bab If'illal (IV)" bezeichnete Ruba'i-Mazid-Fihi-Form (`اِقْشَعَرَّ`,
  Wurzel قشعر) — alle drei sind intransitiv.

**Wichtigster belegter Sachverhalt (Auftrag):** im Apokopat/Jussiv können
bei Muda"af-Verben die beiden gleichen Radikale GETRENNT statt
verschmolzen erscheinen (Analogon zu Qur'an 2:217, يَرْتَدِدْ, Wurzel
ردد, Form VIII, MOOD:JUS). Ein direktes, aus dem Handout gelesenes Beispiel
dafür fand sich bei `bab-mufaala3-mudaaf-shaqqa` (S. 124, Abbildung 112,
Wurzel شقق): Amr lautet شَاقِقْ und Nahy لَا تُشَاقِقْ — beide mit den
zwei Qaf GETRENNT (Kasra + Sukun) statt zu einem Schadda verschmolzen. Bei
≥40-fachem Zoom mehrfach gegengeprüft (zwei eigenständige Qaf-Glyphen mit
je eigenem Vokalzeichen, kein Schadda-Zeichen). Alle übrigen dreizehn
Muda"af-Tabellen zeigen dagegen die sonst übliche verschmolzene Form
(Fekk-al-Idgham-bi-l-Fatha, z. B. `bab-ifal4-mudaaf-ahabba`: أَحِبَّ /
لَا تُحِبَّ) — Test `paradigmen-bab-naqis-lafif-mudaaf.test.ts`, Block
"Apokopat trennt gleiche Radikale", nagelt beide Fälle fest.

**Dokumentierte Unstimmigkeit im Original** (nicht korrigiert, nur
gekennzeichnet): `bab-tafaul6-naqis-talaqa` (Abbildung 92, S. 118). Die
Aktiv-/Imperativ-Zellen sind buchstabengleich mit der Nachbartabelle
`bab-tafaul5-naqis-talaqqa` (Wurzel لقي), nur ohne deren Schadda
(تَلَقَى statt تَلَقَّى) — bei ≥80-fachem Zoom mehrfach verifiziert: kein
Schadda, kein Alif zwischen Lam und Qaf. Die Passiv-Madhi-Zelle lautet
dagegen تُلُووِيَ (zwei getrennte Waw), was strukturell exakt der
Passiv-Bildung von `bab-tafaul6-lafif-tadawa` (Wurzel دوي, ebenfalls
Form VI, تُدُووِيَ) entspricht — also zu einem GANZ ANDEREN Radikal
(Waw statt Qaf) passt als die Aktiv-Zeile. Sehr wahrscheinlich ein
Original-Fehler (falsches Beispiel für die Passiv-Zeile übernommen),
zeichengenau wie gedruckt übernommen und in den `notes` sowie im Test
ausführlich dokumentiert — nichts wurde geraten oder still korrigiert.

**Weitere Muda"af-Besonderheiten** (in den jeweiligen `notes`
dokumentiert): (1) Bei Form II/V-Beispielen mit identischem 2./3.
Wurzelradikal (`habbaba` ح-ب-ب, `tahaqqaqa` ح-ق-ق) verschmilzt nur die
formeigene Verdoppelung zu einem Schadda; der dritte (Wurzel-)Radikal
bleibt als eigener Buchstabe stehen (حَبَّبَ, nicht *حَبَّ) — Amr/Nahy
enden dort auf echtem Sukun statt auf der sonst üblichen Fatha-Lösung,
weil die Idgham-Frage sich gar nicht stellt. (2) Bei drei Tabellen
(`bab-mufaala3-mudaaf-shaqqa`, `bab-tafaul6-mudaaf-tahajja`,
`bab-iftial8-mudaaf-ishtadda`) sind Aktiv- und Passiv-Mudari bzw. Ism
Fa'il/Ism Maf'ul im Original BUCHSTABENGLEICH gedruckt, weil der
unterscheidende Innenvokal genau auf dem beim Idgham verschmelzenden
Buchstaben liegt — zeichengenau übernommen, nicht künstlich
disambiguiert.

**Korpus-Gegenprobe:** vier Wurzeln (رضي, روي, دوي, زوي) kommen im
Qur'an-Korpus laut `roots.json` gar nicht vor — dort sind zwangsläufig
alle Formen der Tabelle als "Ausnahme" dokumentiert (keine Fehlerquelle,
schlicht im Korantext unbelegte Wurzeln). Bei allen anderen Tabellen ist
i. d. R. nur die verneinte Nahy-Form ("لَا تَ...") eine Ausnahme (weil
"لَا" im Korpus ein eigenes Wort-Token ist), plus vereinzelt abgeleitete
Formen (Mudari/Masdar/Ism), die im Korantext nicht in exakt dieser
Konjugation vorkommen — alle Ausnahmelisten wurden empirisch per
Testlauf ermittelt (nicht geraten).

**Nicht extrahiert bleibt weiterhin:** Mithal Wawi/Ya'i (Abb. 52–72) und
Ajwaf (Abb. 73–83) — siehe separater Lauf/Datei
`paradigmen-bab-mithal-ajwaf.json` — sowie Murakkab/kombinierte Fälle
(Abb. 122 ff., S. 126–130+), die in dieser Sitzung nicht angefasst wurden.

## Priorität 3c — Murakkab (Kapitel 8) vollständig, EIGENE Datei

**Datei:** `paradigmen-bab-murakkab.json` (samt eigenem Test
`paradigmen-bab-murakkab.test.ts`) — NICHT `paradigmen-verben.json`,
`paradigmen-bab-mithal-ajwaf.json` oder `paradigmen-bab-naqis-lafif-mudaaf.json`
angefasst. Gleiches Schema wie diese drei Dateien (`{ schema: 1, tables:
[...] }`, Bab-Tabellen mit Spalten madhi/mudari/masdar/ism, Zeilen
aktiv/passiv/imperativ).

Alle 21 Murakkab-Tabellen (Abbildungen 122-142, S. 127-132 - kombinierte
Verbschwächen: eine Familie aus Mithal/Ajwaf/Naqis/Lafif jeweils zusammen
mit einer Mahmuz-Hamza, plus zwei Mithal+Muda"af-Fälle ohne Hamza) sind
zeichengenau aus den gerenderten Seitenbildern gelesen:

- Mithal + Mahmuz: `bab-daraba-murakkab-mithal-mahmuz-waada` (Wurzel وأد),
  `bab-istifal10-murakkab-mithal-mahmuz-istayasa` (يأس),
  `bab-samia-murakkab-mithal-mahmuz-watia` (وطأ),
  `bab-iftial8-murakkab-mithal-mahmuz-ittakaa` (وكأ)
- Mithal + Muda"af (ohne Hamza): `bab-samia-murakkab-mithal-mudaaf-wadda`,
  `bab-mufaala3-murakkab-mithal-mudaaf-wadda` (beide ودد)
- Ajwaf + Mahmuz: `bab-daraba-murakkab-ajwaf-mahmuz-aada` (أيد),
  `bab-nasara-murakkab-ajwaf-mahmuz-aala` (أول),
  `bab-samia-murakkab-ajwaf-mahmuz-shaaa` (شيء),
  `bab-daraba-murakkab-ajwaf-mahmuz-jaaa` (جيء),
  `bab-nasara-murakkab-ajwaf-mahmuz-baaa` (بوأ)
- Naqis + Mahmuz: `bab-fataha-murakkab-naqis-mahmuz-abaa` (أبي),
  `bab-samia-murakkab-naqis-mahmuz-asiya` (أسي),
  `bab-daraba-murakkab-naqis-mahmuz-ataa` (أتي),
  `bab-nasara-murakkab-naqis-mahmuz-alaa` (ألو),
  `bab-tafil2-murakkab-naqis-mahmuz-addaa` (أدي),
  `bab-fataha-murakkab-naqis-mahmuz-raaa` (رأي),
  `bab-mufaala3-murakkab-naqis-mahmuz-raaa` (رأي, Form III),
  `bab-ifal4-murakkab-naqis-mahmuz-araa` (رأي, Form IV)
- Lafif + Mahmuz: `bab-daraba-murakkab-lafif-mahmuz-awaa` (أوي, Lafif
  Maqrun), `bab-daraba-murakkab-lafif-mahmuz-waaa` (وأي, Lafif Mafruq)

**Vorgehen:** pro Tabelle zunächst `page.find_tables()` für die exakte
Zellen-Bounding-Box (3 Zeilen x 5 Spalten inkl. der weggelassenen
"fahuwa"-Spalte), dann die ganze Tabelle bei Zoom 22 gerendert (bei diesem
Font/dieser Auflösung bereits klar lesbar), danach für jede Tabelle
mindestens eine Zweifelsfall-Zelle bei Zoom 35-160 einzeln nachgeschnitten
und gegengeprüft (Hamza-Sitz, Fathatan vs. Hamza, Schadda vs. getrennte
Radikale). Konkret verifiziert:

- `bab-fataha-murakkab-naqis-mahmuz-abaa`: Ism Fa'il آبٍ und Ism Maf'ul
  مَأْبِيٌّ bei 35-fachem Zoom zellenweise gegen Hamza/Tanwin-Verwechslung
  geprüft.
- `bab-nasara-murakkab-naqis-mahmuz-alaa`: Amr bei 160-fachem Zoom
  nachgeschnitten - zeigt zwei Hamza-Träger (أُؤُلْ), was von der aus der
  Grammatikregel erwarteten Form (einfaches أْلُ mit Wasl) abweicht; nicht
  stillschweigend korrigiert, sondern als Auffälligkeit in den `notes`
  dokumentiert.
- `bab-daraba-murakkab-lafif-mahmuz-awaa` (Lafif Maqrun): Masdar أَيًّا
  (mit Schadda + Fathatan, nicht ohne Schadda wie zunächst gelesen) bei
  45-fachem Zoom korrigiert; Nahy لَا تَأْوُ zeigt bei 70-fachem Zoom
  überraschend eine Damma statt der erwarteten Kasra - als dokumentierte
  Unregelmäßigkeit übernommen, nicht angeglichen.
- `bab-daraba-murakkab-lafif-mahmuz-waaa` (Lafif Mafruq + Mahmuz al-'Ain,
  Wurzel وأي): seltenste Tabelle der Datei. Amr besteht nur aus einem
  Buchstaben (إِ, bei 55-fachem Zoom bestätigt). Beim Passiv-Mudari
  (يُوْأَى) blieb die exakte Hamza-Sitz-Entscheidung (Zeile vs. Alif) auch
  bei 120-fachem Zoom ein Grenzfall - als solcher in der Tabelle selbst
  vermerkt (nicht stillschweigend als sicher ausgegeben). Diese Wurzel
  kommt weder als وأي noch als واي im Qur'an-Korpus vor - keine
  Korpus-Gegenprobe für diese eine Tabelle möglich.
- Dokumentierte Zufallshomographie: der Amr von `waada` (وأد) und von
  `aada` (أيد) sind zeichengleich (إِدْ) - beide Bilder einzeln geprüft,
  kein Kopierfehler.
- Dokumentierte Muda"af-Homographie (wie bei den bereits bekannten reinen
  Muda"af-Tabellen): `bab-mufaala3-murakkab-mithal-mudaaf-wadda` hat
  identisches Aktiv-/Passiv-Mudari (يُوَادُّ) und identisches Ism
  Fa'il/Maf'ul (مُوَادٌّ).

**Kein Korpus-Gegenprobe-Block im neuen Test** (anders als bei den beiden
Vorgänger-Bab-Dateien): ein Testlauf gegen `roots.json` zeigte, dass die
Qur'an-Uthmani-Orthographie systematisch von der Druck-/Naskh-Orthographie
des Handouts abweicht (Korpus schreibt z. B. جَآءَ mit Madda-Zeichen, das
Handout جَاءَ mit getrenntem Alif+Hamza) - ein reiner
Zeichenketten-/Skelett-Vergleich hätte für praktisch jede Zelle jeder
Tabelle einen "Treffer" als Ausnahme gemeldet, was keine belastbare Aussage
mehr liefert (bei den Vorgänger-Dateien traf dieses Problem seltener zu,
weil dort weniger Zellen ein Hamza enthielten). Die Evidenz dieser Datei
beruht daher ausschließlich auf den oben beschriebenen mehrfachen,
dokumentierten Zoom-Stufen direkt am gerenderten PDF-Bild.

## Vollständigkeitsbilanz (Stand nach diesem Lauf)

Diese Bilanz bezieht sich auf `handout/TABELLEN-INVENTAR.md` (206
Tabellen-Einträge: 21 in Abschnitt A/tabellen-sprache.pdf, 13
Verweis-Zeilen in Abschnitt B/grammatik.pdf ohne eigene Nummerierung, 185 in
Abschnitt C/handout.pdf mit den IDs H-1 bis H-185).

### Bereits vollständig abgedeckt

- **Abschnitt A (tabellen-sprache.pdf, 21 Tabellen A-1...A-21):** vollständig
  in `paradigmen.json` (21 Tabellen: nomen-muslim, pronomen-frei,
  pronomen-gebunden, hinweiswoerter, verb-madi-nasara, verb-mudari-nasara,
  praepositionen, zahlen-1-10, fragewoerter, amr-nasara, relativpronomen,
  farben, idafa-besitz, plus 8 Wortschatz-Tabellen A-14...A-21).
- **Abschnitt B (grammatik.pdf):** laut Inventar selbst wortgleich mit
  Abschnitt A, Tabellen A-1 bis A-13 (Lektionen 30-42, S. 72-80) - keine
  eigenständige Zusatzarbeit nötig, mit Abschnitt A bereits erledigt.
- **Abschnitt C, Kapitel-8-Bab-Familie (H-61...H-163, Abbildungen 41-142,
  S. 103-132):** JETZT VOLLSTÄNDIG - 102 Bab-Tabellen über vier Dateien:
  - 11 Mahmooz-Tabellen (`paradigmen-verben.json`, Abb. 41-51)
  - 32 Mithal/Ajwaf-Tabellen (`paradigmen-bab-mithal-ajwaf.json`, Abb. 52-83)
  - 38 Naqis/Lafif/Muda"af-Tabellen
    (`paradigmen-bab-naqis-lafif-mudaaf.json`, Abb. 84-121)
  - 21 Murakkab-Tabellen (`paradigmen-bab-murakkab.json`, Abb. 122-142,
    NEU in diesem Lauf)

  11+32+38+21 = 102 = exakt die Anzahl der Abbildungen 41 bis 142
  (142-41+1 = 102). Kapitel 8 Sarf ist damit für alle Bab-Konjugationstabellen
  vollständig erfasst.
- **6 Personenmatrizen** (Madi/Mudari x Aktiv/Passiv, Amr, Nahy für
  نَصَرَ) in `paradigmen-verben.json`.

### Bewusst ausgelassen - keine Paradigmentabellen (Aufzählungen/Beispiellisten)

Stichprobenartig verifiziert (Original-Spaltenköpfe zitiert, nicht nur
Vermutung):

- **H-164, H-185** (S. 133, S. 171): Vokabellisten im Raster
  "Arabisch | Deutsch | Arabisch | Deutsch" (19x4) - zweispaltige
  Wort-für-Wort-Übersetzungslisten, keine Flexionsparadigmen.
- **H-58, H-59** (S. 91-92): dieselbe Vokabelliste-Struktur.
- **H-165-H-184** (S. 138-171, Kapitel 9 Balagah/Rhetorik): Beispiel- und
  Analyse-Tabellen zu rhetorischen Stilmitteln, u. a. "Satz | Klassifikation"
  (H-165), "Partikel | Bedeutung | Beispiel" (H-166), "Mushabbah | Adat
  at-Tashbih | Mushabbah bihi | Wajh ash-Shabah" (Tashbih-Vergleichsanalyse,
  mehrfach: H-167/168/169/170/175 u. a.), "Wörtliche Bedeutung | 'Alaqa |
  Metaphorische Bedeutung" (Majaz-Analyse, mehrfach: H-172/178/181/183 u. a.)
  - durchweg Beispiel-Analysen einzelner Sätze/Figuren, kein
  Flexionsschema mit Person/Numerus/Kasus. Gehören nicht in dieses Schema.
- **H-20** (Abb. 13, S. 32, "Besondere Mudhaafs"): Vokabelliste
  "Arabisch | Bedeutung" (9x4).
- **H-22** (Abb. 14, S. 35, "Harf Nasb und ihre Bedeutung"): Partikelliste
  "Arabisch | Bedeutung" (7x2).
- **H-56** (Abb. 39, S. 81, "Häufig verwendete Fragewörter"): Partikelliste
  "Fragewort | Bedeutung" (9x2) - Überschneidung mit der bereits
  vorhandenen Tabelle `fragewoerter`, selbst wenn eigenständig, reine Liste.
- **H-19** (Abb. 12, "Deutsche Personalpronomen nach Fall"): eine
  DEUTSCHE Grammatik-Referenztabelle (Lernhilfe), kein arabisches Paradigma.
- **H-30, H-32** (Abb. 21/23, "Partikeln der leichten/leichtesten Form"):
  Partikellisten (Harf-Nasb-/Harf-Jazm-Aufzählungen), keine Flexionsform.
- **H-35** (Abb. 26, "Bildung der Befehlsform Schritt für Schritt"): eine
  Ableitungs-ANLEITUNG (Prosa/Schema in Tabellenform), kein Formenraster.

### Identifizierte, aber in diesem Lauf NICHT übernommene echte Lücken

Diese Tabellen sind nach Kopfzeile/Struktur eindeutig Paradigmentabellen
(Formen nach Person/Numerus/Kasus oder Muster/Singular/Plural gegliedert)
und passen inhaltlich in dieses Schema - aus Zeitbudget-Gründen in diesem
Lauf jedoch NICHT gebaut, um keine Formen unter Zeitdruck zu erraten. Für
eine Fortsetzung mit exaktem Fundort:

- **H-7/H-8** (Abb. 3/4, S. 14-15): "Leichte Muslimun-Tabelle" (m/w) - eine
  vereinfachte Deklinationsvariante neben der bereits vorhandenen
  vollständigen `nomen-muslim`-Tabelle.
- **H-10** (Abb. 6, S. 18, "Bestimmung der Anzahl"): Muster|Singular|
  Plural|Bedeutung - Plural-Mustertabelle (gebrochener Plural).
- **H-11** (Abb. 7, S. 22, "Ism Mousool"): Plural|Dual|Singular-Raster für
  Relativpronomen - feiner aufgelöst als die vorhandene Flachliste
  `relativpronomen`.
- **H-16** (Abb. 9, S. 28, "Freie Pronomen (Nasb-Status)").
- **H-18** (Abb. 11, S. 30, "Die vollständige Tabelle auf einen Blick").
- **H-23-H-26** (Abb. 15-18, S. 39-41): Nahe/Ferne Zeigewörter, Dual und
  Status, Übereinstimmungsregeln der Hinweiswörter.
- **H-31** (Abb. 22, S. 47, "Nasara-Tabelle (leichte Form)"): vermutlich
  die volle Personenmatrix des Mudari Mansub (Konjunktiv).
- **H-33** (Abb. 24, S. 48, "Nasara-Tabelle (leichteste Form)"): vermutlich
  die volle Personenmatrix des Mudari Majzum (Jussiv/Apokopat).
- **H-40** (Abb. 28, S. 61, "Kaana in der Vergangenheit"): Personenmatrix
  von كَانَ - bisher in keiner der vier Dateien enthalten.
- **H-43-H-50** (Abb. 31-38, S. 66-70, "Tabelle für die erste ... achte
  große Familie"): die acht Sarf-"Großfamilien" aus Kapitel 5 - je 12
  Zeilen x 5 Spalten, ohne gedruckte Kopfzeile (Struktur noch nicht
  anhand des Bildes verifiziert).
- **H-57** (Abb. 40, S. 85, "Formen der Verben mit schwerem Nun der
  Betonung"): Plural|Dual|Singular|Person-Raster - vermutlich die
  Energetikus-Formen (Nun at-Tawkid) von نَصَرَ.
- **H-9** (Abb. 5, S. 15, "Die verschiedenen Arten der Flexibilität"):
  Grenzfall - eher eine grammatische Konzept-/Klassifikationstabelle
  (Voll-/Halb-/Nicht-Flexibel) als ein Formen-Paradigma; erst nach
  genauerer Bildprüfung einzuordnen.

### Reintext-Fragmente ohne eigene inhaltliche Prüfung

- **H-1, H-2, H-4, H-5, H-12, H-13, H-14, H-21, H-27, H-37, H-38, H-39,
  H-51-H-55** (S. 1-71, ohne "Abbildung N:"-Bildunterschrift): automatisch
  erkannte Tabellenraster ohne eigene Nummerierung - in diesem Lauf nicht
  einzeln geöffnet; könnten Fortsetzungs-/Rand-Artefakte bestehender
  Abbildungen oder eigenständige kleine Tabellen sein. Für eine Fortsetzung
  einzeln zu prüfen.

### Zahlenbilanz

| Quelle | Einträge | Status |
|---|---|---|
| Abschnitt A (tabellen-sprache.pdf) | 21 | vollständig übernommen |
| Abschnitt B (grammatik.pdf) | 13 (Verweise) | deckungsgleich mit A, keine Zusatzarbeit |
| Abschnitt C: Kapitel-8-Bab-Familie (H-61...H-163) | 102 Abbildungen (41-142) | vollständig übernommen (4 Dateien) |
| Abschnitt C: Personenmatrizen (in H-28/29/34/36/40/41 enthalten) | 6 | vollständig übernommen |
| Abschnitt C: Vokabellisten/Rhetorik-Beispiele | ca. 24 (H-20,22,56,58,59,164,165-185) | bewusst ausgelassen, keine Paradigmentabellen |
| Abschnitt C: identifizierte echte Lücken | ca. 15 (H-7,8,9,10,11,16,18,23-26,31,33,40,43-50,57) | NICHT übernommen - für Fortsetzung dokumentiert |
| Abschnitt C: ungeprüfte Reintext-Fragmente | ca. 19 (H-1,2,4,5,12-14,21,27,37-39,51-55) | nicht einzeln geöffnet |

**Ehrliches Fazit:** Kapitel 8 (Sarf - Fortgeschrittene Morphologie, der
Kern des Auftrags) ist mit dieser Sitzung zu 100 % abgedeckt - alle 102
Bab-Tabellen (Mahmooz, Mithal, Ajwaf, Naqis, Lafif, Muda"af, Murakkab)
plus die 6 zentralen Personenmatrizen. Über Kapitel 8 hinaus (Kapitel 1-7
Grundlagen sowie Kapitel 9-10) bleiben nach dieser Sitzung noch ca. 15
konkret identifizierte, echte Paradigmentabellen offen (oben mit
Fundstelle aufgeführt) plus ca. 19 nicht einzeln geprüfte Fragmente - diese
wurden NICHT erfunden oder überstürzt nachgebaut, sondern als offene Liste
für eine gezielte Fortsetzung festgehalten.

## Priorität 5 — paradigmen-weitere.json (diese Sitzung)

Datei: paradigmen-weitere.json (samt eigenem Test paradigmen-weitere.test.ts)
- NICHT paradigmen-verben.json oder eine der drei Bab-Dateien angefasst.
Gleiches Schema wie diese Dateien ({ schema: 1, tables: [...] }).

Aus der oben unter "Identifizierte, aber in diesem Lauf NICHT übernommene
echte Lücken" gelisteten ca. 23 offenen Tabellen wurden in dieser Sitzung
17 Tabellen zeichengenau aus gerenderten Seitenbildern übernommen (Zoom
20-150, Zweifelsfälle zellenweise nachgeschnitten):

- Kaana-Matrix (H-40, Abb. 28, S. 61): kaana-matrix - vollständige
  Personenmatrix von كَانَ in der Vergangenheit.
- Mudari Mansub/Majzum (H-31/H-33, Abb. 22/24, S. 47/48):
  mudari-mansub-nasara-matrix, mudari-majzum-nasara-matrix - die vollen
  Personenmatrizen des Konjunktivs und Jussivs von نصر (ergänzen die
  bestehenden amr-/nahy-Kurztabellen um alle Personen).
- Nun at-Tawkid Thaqila (H-57, Abb. 40, S. 85):
  nun-tawkid-thaqila-nasara-matrix - Formen mit schwerem Betonungs-Nun.
- Die acht Sarf-Grossfamilien (H-43...H-50, Abb. 31-38, S. 66-70):
  sarf-familie-1-allama (Form II, علم) bis sarf-familie-8-istaghfara
  (Form X, غفر) - dasselbe 3x4-Bab-Raster wie Kapitel 8, hier am
  gesunden Referenzbeispiel jeder Form statt an schwachen/hamzierten
  Wurzeln, mit im Original gedruckten deutschen Begriffs-Glossen.
- "Leichte Muslimun-Tabelle" (H-7/H-8, Abb. 3/4, S. 14/15):
  leichte-muslimun-maennlich, leichte-muslimun-weiblich.
- Ism Mawsul im Plural/Dual/Singular-Raster (H-11, Abb. 7, S. 22):
  ism-mawsul-raster - dieselben sechs Formen wie die bestehende
  relativpronomen-Tabelle, hier zusätzlich als 2x3-Raster.

Zwei weitere, beim Durchgehen als echte Paradigmentabellen erkannte Fälle
(nicht in der ursprünglichen ca.-15-Liste des Auftrags, aber eindeutig
Formen-Paradigmen statt Vokabellisten, deshalb mit Begründung ergänzt statt
übergangen):

- ism-flexibilitaet-arten (H-9, Abb. 5, S. 15, "Die verschiedenen Arten
  der Flexibilität"): zeigt Voll-/Halb-/Nicht-Flexibel als drei parallele
  Kasus-Deklinationen (مُسْلِمٌ/إِبْرَاهِيمُ/مُوسَى x Raf/Nasb/Jarr) - ein
  echtes Flexions-Paradigma, kein Begriffs-Konzept wie zunächst vermutet.
- ism-plural-muster-unregelmaessig (H-10, Abb. 6 begleitende Tabelle,
  S. 18): sechs Wazn-Muster des gebrochenen Plurals (Muster/Singular/
  Plural) - ein morphologisches Bildungsmuster-Paradigma, keine reine
  Wort-für-Wort-Vokabelliste.

Bewusst NICHT übernommen (Begründung je Fall):

- H-18 ("Die vollständige Tabelle auf einen Blick", Abb. 11, S. 30): reine
  Zusammenfassung/Wiederholung von H-15+H-16+H-17 ohne neue Formen - keine
  eigenständige Lücke.
- H-23/H-24 ("Nahe/Ferne Zeigewörter", Abb. 15/16, S. 39): dieselben
  Formen (m/f x sg/du/pl x nah/fern) wie die bereits vorhandene Tabelle
  hinweiswoerter (paradigmen.json), nur auf zwei separate Tabellen
  aufgeteilt - keine neuen Formen.
- H-16 ("Freie Pronomen (Nasb-Status)", Abb. 9, S. 28) und H-25
  ("Zeigewörter im Dual und ihre Status", Abb. 17, S. 40): ECHTE, noch nicht
  erfasste Paradigmen (Akkusativ-Betonungsformen der freien Pronomen
  إِيَّاهُ usw. bzw. die case-flektierten Dual-Demonstrativpronomen
  هَذَيْنِ/هَاتَيْنِ/ذَيْنِكَ/تَيْنِكَ) - aus Zeitbudget-Gründen in dieser
  Sitzung NICHT gebaut, für eine Fortsetzung offen (Fundstelle wie
  angegeben).
- H-26 ("Übereinstimmung von Ism Ishaarah und Mushaarun Ileyh", Abb. 18,
  S. 41): laut Inventar vom automatischen Tabellenfinder nicht erfasst -
  ein einzelnes Beispiel mit Qur'an-Vers (Satz-Kongruenz-Erklärung), kein
  Formenraster.
- Alle übrigen Reintext-Fragmente (H-1, H-2, H-4, H-5, H-12-H-14, H-21,
  H-27, H-37-H-39, H-51-H-55) weiterhin ungeprüft (siehe Abschnitt oben) -
  in dieser Sitzung ebenfalls nicht geöffnet.

Kaana-Matrix, dokumentierter Druckversatz: in der Zeile "1. Person"
druckt das Original die Plural-Form كُنَّا unter der Kopfzeile "Dual" (die
Spalte "Plural" bleibt in dieser einen Zeile leer) - bei >=45-fachem Zoom
bestätigt, kein Lesefehler. Da كَانَ für die 1. Person ohnehin keinen Dual
kennt, wurde die Form semantisch korrekt unter plural einsortiert (wie in
jeder anderen Personenmatrix dieses Bestands), mit Notiz zum Druckversatz.

Leichte Muslimun-Tabelle (weiblich), echter linguistischer Befund: der
Singular ist bei >=90-fachem Zoom in ALLEN DREI Status-Zeilen (Raf/Nasb/Jarr)
zeichengleich مُسْلِمَة - die Ta-Marbuta trägt in keiner Zeile ein
Status-Vokalzeichen. Linguistisch korrekt: eine Ta-Marbuta wird in
Pausalform unabhängig vom Status als bloßes "-ah" gelesen, weshalb die
"leichte Form" hier den Status gar nicht mehr sichtbar unterscheidet. Mit
eigenem Regressionstest festgehalten (paradigmen-weitere.test.ts).

Sarf-Familie 5 (تساءل), Hamza-Träger-Unterschied: Aktiv-Masdar
تَسَاؤُلًا (Hamza auf Waw-Träger ؤ) und Passiv-Masdar تَسَائُلًا (Hamza auf
Ya-Träger ئ) sind im Original als Zeichenkette verschieden gedruckt, bei
>=120-fachem Zoom bestätigt - genau der Fall, für den die neue
Normalisierungs-Hilfsfunktion gebraucht wird (siehe unten).

Sarf-Familie 4 (تعلم), "Passiv ohne Sinn": das Original druckt für die
(laut eigenem Fließtext intransitive, "kein Passiv" besitzende) Form V alle
vier Arabisch-Formen der Passiv-Zeile, lässt aber JEDE deutsche
Bedeutungsangabe leer. Die Arabisch-Formen wurden zeichengenau übernommen,
die deutschen Felder tragen einen expliziten Hinweistext statt einer
erfundenen Übersetzung.

Sarf-Familie 6 (انكسر), keine Passiv-Zeile: anders als Familie 4 druckt
das Original hier nicht einmal eine leere/unbeschriftete Passiv-Zeile - die
Tabelle hat im Original nur zwei Datenzeilen (Aktiv, Imperativ), passend zur
ausdrücklichen Randnotiz "Alle Wörter dieser Familie sind intransitiv und
haben keine passive Form". Deshalb bewusst keine passiv-Zeile angelegt.

### Neue Normalisierungs-Hilfsfunktion: orthografieSkelett.ts

Neue, von beiden anderen parallel arbeitenden Agenten unangetastete Datei
src/features/lexikon/orthografieSkelett.ts (samt eigenem Test
orthografieSkelett.test.ts, 14 Tests) - löst genau das Problem, wegen dem
paradigmen-bab-murakkab.test.ts bisher OHNE Korpus-Gegenprobe auskam: die
Qur'an-Uthmani-Orthografie des Korpus weicht systematisch von der
Druck-/Naskh-Orthografie des Handouts ab (Madda, Hamza-Träger, UND -
empirisch beim ersten Testlauf dieser Sitzung entdeckt - der
Uthmani-Dagger-Alif (ٰ, U+0670): das Korpus schreibt einen langen
a-Laut nach bestimmten Konsonanten als hochgestellten Dagger-Alif statt als
volles Alif, z. B. جَٰدَلَ (Korpus) vs. جَادَلَ (Handout). Die bereits
vorhandenen normalisiereSkelett()-Kopien in paradigmen.test.ts und den
Bab-Testdateien behandeln diesen Fall bereits korrekt (Dagger-Alif zu Alif
statt Streichen) - nur eine aggressivere Variante mit zusätzlicher
Hamza-Träger-Vereinheitlichung (أ إ آ ٱ ؤ ئ ء zu ا) fehlte bisher als
gemeinsam nutzbare Funktion.

Verwendet für:

1. Die eigene Korpus-Gegenprobe in paradigmen-weitere.test.ts (13 von 17
   Tabellen; die restlichen vier - nun-tawkid-thaqila-nasara-matrix
   [Pronomen+Verb als ein String, kein Korpus-Token], ism-mawsul-raster
   [bereits über relativpronomen/paradigmen.test.ts gegengeprüft] sowie
   die Halb-/Nicht-Flexibel-Spalten von ism-flexibilitaet-arten
   [Eigennamen, keine dreiradikalige Wurzel im Index] - sind mit
   Begründung in den jeweiligen notes/Tests ausgenommen).
2. Nachgerüstete Korpus-Gegenprobe für paradigmen-bab-murakkab.json in
   paradigmen-bab-murakkab.test.ts (NUR der Test wurde bearbeitet, die JSON
   nicht): alle 21 Tabellen liefern jetzt eine echte, informative
   Ausnahmeliste statt des bisherigen kompletten Verzichts - die meisten
   Madhi-Grundformen (Aktiv UND Passiv) sind belegt, abgeleitete Formen und
   durchweg die verneinten Nahy-Formen ("لَا تَ...", weil لَا ein eigenes
   Korpus-Token ist) meist nicht. Zwei Wurzeln bleiben (fast) vollständig
   unbelegt: واد (nur 1 Beleg im ganzen Qur'an, passt zu keiner der sechs
   Zellen) und واي (0 Belege, bereits vorher in den notes der Tabelle
   bab-daraba-murakkab-lafif-mahmuz-waaa dokumentiert). Bei
   bab-samia-murakkab-naqis-mahmuz-asiya wurde die in den bestehenden
   notes bereits dokumentierte Alternativ-Wurzel اسو (Nebenform أسو/أسي,
   Sure 57:23) verwendet statt der naheliegenden, aber im Index nicht
   vorhandenen Schreibung اسي.

## Vollständigkeitsbilanz — Nachtrag nach dieser Sitzung

Die "ca. 15" bzw. "ca. 23" in der Tabelle oben ("Abschnitt C: identifizierte
echte Lücken") sind mit dieser Sitzung auf 17 übernommen (siehe oben),
5 bewusst als redundant/nicht extrahierbar ausgeschlossen (H-18, H-23,
H-24, H-26) und 2 echte, noch offene Lücken (H-16, H-25) verbleiben für
eine gezielte Fortsetzung. Die ca. 19 nicht einzeln geprüften Reintext-
Fragmente (H-1, H-2, H-4, H-5, H-12-H-14, H-21, H-27, H-37-H-39, H-51-H-55)
sind weiterhin ungeprüft.

Ehrliches Fazit: Kapitel 8 (Sarf) bleibt zu 100 % abgedeckt (unverändert
aus dem vorigen Lauf). Von den außerhalb Kapitel 8 identifizierten echten
Paradigmentabellen sind nach dieser Sitzung nur noch H-16 (Freie Pronomen,
Nasb-Status) und H-25 (Zeigewörter im Dual, alle drei Status) konkret offen
- beide mit exakter Fundstelle oben dokumentiert, nichts wurde unter
Zeitdruck geraten oder übersprungen ohne Vermerk.

## Priorität 6 — paradigmen-nachtrag.json (diese Sitzung) + Abschluss der Reintext-Fragmente

**Datei:** `paradigmen-nachtrag.json` (samt eigenem Test
`paradigmen-nachtrag.test.ts`) — NICHT `paradigmen.json`, `paradigmen-verben.json`,
`paradigmen-weitere.json` oder eine der drei Bab-Dateien angefasst. Gleiches
Schema (`{ schema: 1, tables: [...] }`) wie diese Dateien.

### H-16 und H-25 übernommen

Beide bei Zoom 8-22 zeichengenau aus den gerenderten Seitenbildern gelesen:

- `freie-pronomen-nasb-status` (H-16, Abbildung 9, S. 28): die Akkusativ-
  Betonungsform der freien Pronomen (Träger إِيَّا + gebundene Endungen),
  z. B. إِيَّاكَ نَعْبُدُ. Gleiches 5×3-Raster (Plural/Dual/Singular ×
  3-m/3-f/2-m/2-f/1) wie die sechs Verb-Personenmatrizen, weil exakt so im
  Original abgedruckt; 1./Dual wieder null (keine Extraktionslücke, echte
  Grammatiklücke).
- `zeigewoerter-dual-status` (H-25, Abbildung 17, S. 40): die drei
  Statusformen (Raf'a/Nasb/Jarr) der Dual-Zeigewörter — ergänzt die
  bestehende Tabelle `hinweiswoerter`, die im Dual nur die Raf'a-Form
  abgedruckt hat. Nasb und Jarr sind bei Zoom 22 als zeichengleich
  bestätigt (هَذَيْنِ/هَتَيْنِ/ذَيْنِكَ/تَيْنِكَ) — der Dual kennt
  grammatisch nur zwei Statusformen. Dokumentierter Drucksatz-Unterschied
  zu `hinweiswoerter`: dessen Raf'a-Dual-Formen (aus tabellen-sprache.pdf)
  tragen einen Dagger-Alif, diese Tabelle (aus handout.pdf) an derselben
  Stelle nicht — kein Lesefehler, zeichengenau wie im jeweiligen Bild
  übernommen.

Beide Tabellen sind Funktionswort-Paradigmen (Pronomen/Demonstrativa) ohne
dreiradikalige Wurzel und werden — wie bereits `pronomen-frei`,
`pronomen-gebunden` und `hinweiswoerter` in `paradigmen.test.ts` — bewusst
NICHT gegen das Qur'an-Korpus geprüft.

### Die ca. 19 Reintext-Fragmente: Entscheidung je Eintrag

Jedes der in der vorherigen Sitzung ungeprüft gelassenen Fragmente wurde in
dieser Sitzung einzeln als gerendertes Seitenbild geöffnet (nicht nur der
PyMuPDF-Textlayer, der für Tabellen laut den "Erkannten Fallstricken" oben
unbrauchbar ist) und begründet entschieden:

- **H-1** (S. 9), **H-12** (S. 24), **H-13** (S. 25), **H-27** (S. 43),
  **H-37** (S. 54), **H-38** (S. 55): Raster "Arabisch | Deutsch | Arabisch
  | Deutsch" (19-21 Zeilen × 4 Spalten) — reine zweispaltige
  Vokabellisten, strukturell identisch mit den bereits als solche
  eingestuften H-58/H-59/H-164. Bewusst ausgelassen, keine Flexionsparadigmen.
- **H-2** (S. 12), **H-4** (S. 13, erste Tabelle), **H-5** (S. 13, zweite
  Tabelle): Bildbeleg geprüft (siehe Seiten 12-13 im Original) — das sind
  die pädagogischen "Endung"-Zwischentabellen (Status/Endung/Beispiel bzw.
  Plural/Dual/Singular/Status), die die Muslimun-Deklination Schritt für
  Schritt (erst Singular, dann Plural, dann Dual) aufbauen, BEVOR die volle
  Tabelle `nomen-muslim`/H-3 "Abbildung 1: Muslimun-Tabelle" direkt im
  Anschluss gedruckt wird. Alle Formen darin (مُسْلِمٌ/مُسْلِمًا/مُسْلِمٍ,
  مُسْلِمُونَ/مُسْلِمِينَ, مُسْلِمَانِ/مُسْلِمَيْنِ) sind eine ECHTE
  Teilmenge der bereits vorhandenen `nomen-muslim`-Tabelle — bewusst
  ausgelassen als redundante Zwischenstufe, keine neue Information.
- **H-14** (S. 26): kein Tabellenraster, sondern ein vom automatischen
  Tabellenfinder fehlerkanntes Flussdiagramm/Kästchen-Schema ("Sprache" →
  Sätze/Fragmente/Wörter, mit Idaafah/Harf Jarr/Harf Nasb/Mowsoof
  Sifah/Ism Ishaarah als Beispielkästchen). Bildbeleg (Struktur analog zu
  H-39, siehe dort) bestätigt: keine Person/Numerus/Kasus-Flexion. Bewusst
  ausgelassen.
- **H-21** (S. 33): "Harf | Bedeutung | Harf | Bedeutung", 7×4 — Partikel-
  Vokabelliste (Harf-Jarr-Bedeutungen), strukturell identisch mit der
  bereits eingestuften H-22. Bewusst ausgelassen.
- **H-39** (S. 58): bei Bildprüfung als Fehlfund des automatischen
  Tabellenfinders identifiziert — tatsächlich ein Flussdiagramm
  (Mubtada-Kästchen → "Was ist mit dem Mubtada?" → Chabar-Kästchen, mit
  Beispiel اللَّهُ الصَّمَدُ) im Layout des Kapitels 4 "Sätze", kein
  Tabellenraster. Bewusst ausgelassen.
- **H-51** (S. 72, erste Tabelle) und **H-52** (S. 72, zweite Tabelle): bei
  Bildprüfung als ECHTE Bab-Tabellen der Kleinen Familie (Kapitel 5.3)
  erkannt — anders als die ursprüngliche Einstufung als "ungeprüftes
  Fragment" vermuten ließ. Deshalb ÜBERNOMMEN als `kleine-familie-nasara`
  und `kleine-familie-karama` in `paradigmen-nachtrag.json` (siehe oben).
- **H-53** (S. 73), **H-54** (S. 75): dieselbe "Arabisch | Deutsch ×2"-
  bzw. Partikel-Vokabelliste wie H-1/H-12/H-13/H-27/H-37/H-38. Bewusst
  ausgelassen.
- **H-55** (S. 77, "Liste der Verbindungsbuchstaben"): Raster "فرْ َح |
  Beschreibung | Beispiel und Übersetzung" — eine Bedeutungs- und
  Beispielsatz-Liste der Harf-al-'Atf-Verbindungsbuchstaben (mit
  Qur'an-Zitaten als Beleg je Partikel), kein Flexionsparadigma. Strukturell
  vergleichbar mit den bereits als Beispiel-Analysen eingestuften
  Balagah-Tabellen aus Kapitel 9. Bewusst ausgelassen.

**Ergebnis:** von den ca. 19 Reintext-Fragmenten sind 17 Vokabel-/Partikel-
listen bzw. Diagramm-Fehlfunde (bewusst ausgelassen, mit Begründung oben)
und genau 2 (H-51, H-52) echte, bisher übersehene Bab-Tabellen, die jetzt
übernommen wurden. Keines der 19 Fragmente bleibt als ungeprüfte Lücke
zurück — jedes hat jetzt eine begründete Entscheidung.

### Anschluss an Loader/Kategorisierung

- `paradigmenLoader.ts`: `paradigmen-nachtrag.json` als neue Zeile in
  `PARADIGM_SOURCES` ergänzt (per `paradigmenLoader.test.ts` erzwungen).
- `paradigmenKategorien.ts`: `kleine-familie-nasara`/`kleine-familie-karama`
  zur bestehenden `SAHIH_KURZTABELLEN_IDS`-Liste ergänzt (dieselbe Achse —
  Wurzelgesundheit von Form I — wie die drei bestehenden Sahih-Kurztabellen
  und die Bab-Familien aus Kapitel 8; NICHT die "Verbstamm-Ableitungen"-
  Achse der acht Sarf-Großfamilien, die eine andere Form-Achse [II-X]
  zeigen). `freie-pronomen-nasb-status`/`zeigewoerter-dual-status` fallen
  ohne Codeänderung automatisch in "Nomen & Pronomen" (kind
  `pronoun`/`demonstrative`, kein Bab-Präfix, kein Sarf-Familie-Präfix).
- `paradigmenKategorien.test.ts`: Bestandszahlen aktualisiert (150 Tabellen
  insgesamt, 14 Nomen/Pronomen, 107 Verbstamm-Familien, davon 5 sahih) plus
  zwei neue Tests, die die korrekte Einordnung der vier neuen Tabellen
  hart gegen den echten Bestand prüfen.
- Zusätzlich (außerhalb der für diesen Auftrag benannten Dateiliste, aber
  eine direkte Folge der Kategorie-Verschiebung sahih 3→5): der einzige
  Ort im Repo, der die Bab-Familien-Anzahl hartcodiert
  (`src/__tests__/lexikon-grammatik-tabellen.test.tsx`, Regex
  `Verbstamm-Familien \(Bab\).*\(105\)`), auf `(107)` nachgezogen — sonst
  wäre dieser UI-Test nach dieser Änderung stumm rot geblieben, ohne dass
  an der Kategorisierung selbst etwas falsch gewesen wäre.

### Korpus-Gegenprobe (Priorität 4 des Auftrags)

`kleine-familie-nasara`/`kleine-familie-karama` (Wurzeln نصر/كرم) sind über
`orthografieSkelett.ts` gegen den lokalen Morphologie-Cache (Pfad über
`morphologieCachePfad.ts`, aktuelle Schemaversion siehe
`MORPHOLOGIE_SCHEMA_VERSION`) geprüft
(siehe `paradigmen-nachtrag.test.ts`): für نصر ist nur die verneinte
Nahy-Form und die zusammengesetzte Drei-Wort-Ism-Ableitung nicht belegt
(Madhi/Mudari/Masdar/Ism sowohl aktiv als auch passiv sowie der Amr schon);
für كرم sind zusätzlich Mudari und Masdar der Aktiv-Zeile nicht belegt — das
Qur'an-Korpus bezeugt die Wurzel ك-ر-م fast ausschließlich in Form II/IV
(كَرَّمْنَا/أَكْرَمَكُمْ) sowie als Adjektiv كَرِيم, nicht als einfaches
Form-I-Mudari. Beide Ausnahmelisten sind empirisch per Testlauf ermittelt,
nicht geraten. `freie-pronomen-nasb-status`/`zeigewoerter-dual-status` sind
wie oben begründet von der Korpus-Gegenprobe ausgenommen (Funktionswörter
ohne Wurzel).

## Vollständigkeitsbilanz — Abschluss

Mit dieser Sitzung sind **beide** zuvor konkret offenen Lücken (H-16, H-25)
sowie **alle** ca. 19 ungeprüften Reintext-Fragmente bearbeitet. Der
gesamte Bestand aus `TABELLEN-INVENTAR.md` (206 Einträge: 21 Abschnitt A +
13 Verweis-Zeilen Abschnitt B, deckungsgleich mit A + 185 Abschnitt C
H-1...H-185) ist damit einmal vollständig durchgegangen:

- **Übernommen** (146 + 4 = **150 Tabellen** in sieben Dateien): 21
  Wortarten-/Wortschatz-Tabellen aus Abschnitt A/tabellen-sprache.pdf, 102
  Bab-Tabellen aus Kapitel 8 (Mahmooz/Mithal/Ajwaf/Naqis/Lafif/Muda"af/
  Murakkab), 6 vollständige Verb-Personenmatrizen (نصر), 17 weitere
  Paradigmen aus `paradigmen-weitere.json` (Kaana, Mudari Mansub/Majzum,
  Nun-at-Tawkid, 8 Sarf-Großfamilien, leichte Muslimun-Deklination ×2,
  Ism-Mawsul-Raster, Flexibilitätsarten, Plural-Muster) sowie jetzt 4
  weitere aus `paradigmen-nachtrag.json` (freie Pronomen Nasb-Status,
  Zeigewörter im Dual, Kleine-Familie-Referenztabellen نصر/كرم).
- **Bewusst ausgelassen** (keine Paradigmentabellen, mit Bildbeleg
  begründet): ca. 24 Vokabel-/Partikellisten (H-1, H-12, H-13, H-20, H-21,
  H-22, H-27, H-37, H-38, H-53, H-54, H-55, H-56, H-58, H-59, H-164), ca. 20
  Balagah-Beispiel-/Analysetabellen aus Kapitel 9 (H-165...H-184), 3
  pädagogische Zwischen-/Redundanztabellen (H-2, H-4, H-5 — Teilmenge von
  `nomen-muslim`; H-18 — Zusammenfassung von H-15/16/17; H-23/H-24 —
  Teilmenge von `hinweiswoerter`), 2 vom automatischen Tabellenfinder
  fehlerkannte Flussdiagramme (H-14, H-39), 1 Einzelbeispiel ohne
  Formenraster (H-26), 1 deutsche Referenztabelle ohne arabisches Paradigma
  (H-19), 2 reine Ableitungs-Anleitungen/Klassifikationen (H-30, H-32,
  H-35 teilweise redundant mit den bereits erfassten Partikellisten).
- **Nicht lesbar/nicht sicher belegbar:** keine verbleibenden Einträge —
  jede in den vorherigen Sitzungen als "ungeprüft" geführte Tabelle wurde in
  dieser Sitzung geöffnet und entschieden. Es gab keinen Fall, in dem ein
  gerendertes Bild bei verfügbarem Zoom (bis 200-fach in den Vorsitzungen,
  bis 45-fach in dieser Sitzung) unlesbar blieb; die beiden in Priorität 3c
  bereits dokumentierten Grenzfälle (Hamza-Sitz bei
  `bab-daraba-murakkab-lafif-mahmuz-waaa`, Original-Fehler bei
  `bab-tafaul6-naqis-talaqa`) bleiben als dokumentierte, nicht stillschweigend
  geglättete Befunde bestehen.

**Ehrliches Fazit (beantwortet die Ausgangsfrage):** Ist alles aus der
Vorlage abgedeckt? Ja, im Sinne von "jeder Eintrag des Inventars wurde
geprüft und trägt eine begründete Entscheidung" — Kapitel 8 (Sarf) zu
100 % als Paradigmentabellen erfasst, Abschnitt A/B vollständig, und von den
zuvor offenen ca. 19+2 Lücken außerhalb Kapitel 8 ist keine mehr unbearbeitet:
17 Fragmente sind begründet keine Paradigmentabellen, 2 Fragmente (H-51/
H-52) plus die beiden vormals konkret benannten Lücken (H-16/H-25) sind
jetzt als echte Tabellen übernommen. Was bewusst draußen bleibt (Vokabel-
listen, Beispielsätze, Redundanzen, Diagramme), ist kein Paradigma im Sinne
dieses Bestands und wurde nicht durch eine erfundene Form ersetzt.

## Priorität 7 — wortlisten.json (Wortlisten-Auftrag, diese Sitzung)

**Auftrag:** "nichts aus der Vorlage fehlt" — bisher wurden nur Paradigmentabellen
übernommen. Bewusst ausgelassene Einträge, die keine Konjugations-/
Deklinationstabellen sind, aber sehr wohl Inhalt der Vorlage sind, sollten in
anderer Form in die App. Dateien: `data/wortlisten.json` (schema 1, drei
Arrays: `wortlisten`, `beispielsatzlisten`, `ablaufschemata`),
`wortlistenTypes.ts`, `wortlistenLoader.ts`, `wortlistenLoader.test.ts`,
`WortlisteView.tsx` (Renderer), `WortlistenKatalogView.tsx` (Katalog,
dritter Unterreiter "Wortlisten" in `GrammatikListView.tsx`, neben
"Begriffe"/"Formentabellen") — NICHT `paradigmen*.json` angefasst, wie im
Auftrag gefordert.

### Acht Vokabellisten + Partikelliste (Kern des Auftrags) — ÜBERNOMMEN

Alle acht benannten Vokabellisten und die Partikelliste sind zeichengenau
aus den gerenderten Seitenbildern gelesen (die vorher im Inventar notierten
TSV-Rohdaten aus `find_tables()`/Textlayer waren für diese zweispaltigen
Listen ebenso unbrauchbar — verstellte Zeichenreihenfolge — wie bei den
Bab-Tabellen; nur das Bild ist verlässlich):

- `wortliste-h1-ism-grundvokabular` (H-1, S. 9, 35 Einträge)
- `wortliste-h12-fragmente-teil1` (H-12, S. 24, 39 Einträge)
- `wortliste-h13-fragmente-teil2` (H-13, S. 25, 38 Einträge)
- `wortliste-h27-verben-grundvokabular` (H-27, S. 43, 35 Einträge)
- `wortliste-h37-saetze-teil1` (H-37, S. 54, 35 Einträge)
- `wortliste-h38-saetze-teil2` (H-38, S. 55, 35 Einträge)
- `wortliste-h53-sarf-grundvokabular` (H-53, S. 73, 35 Einträge)
- `wortliste-h54-verschiedene-ausdruecke` (H-54, S. 75, 26 Einträge)
- `wortliste-h21-harf-jarr` (H-21, S. 33, 11 Einträge — die "Liste der Harf
  Jarr" aus Abschnitt 2.2, inkl. der im Original vermerkten festen
  Vokalzeichen der einbuchstabigen Präpositionen)

Jede Datenzeile trägt `ar`/`umschrift`/`de` statt eines erzwungenen
1-Spalten-Rasters (siehe `wortlistenTypes.ts`, Kopf-Kommentar) — eine
Vokabelliste hat keine Person-/Numerus-/Kasus-Achse.

### Beispielsatzliste H-55 — ÜBERNOMMEN als eigener Datentyp

`beispielsatzliste-h55-verbindungsbuchstaben` (S. 77, "6.1.3 Liste der
Verbindungsbuchstaben"): 6 Harf-al-'Atf-Partikel, je mit einem ganzen,
gedruckten Qur'an-Beispielsatz samt Übersetzung. Kein Sure-/Vers-Beleg im
Original abgedruckt — deshalb keiner erfunden (siehe `notes`). Bonus über
den Auftragskern hinaus: `beispielsatzliste-h166-istifham-partikel` (S. 144,
Kapitel 9 Balagah, "Table 3") mit 12 echten Qur'an-Beispielsätzen zu den
Fragepartikeln — ergänzt `wortliste-h56-fragewoerter-uebersicht` um reale
Anwendungsbeispiele.

### Zwei Flussdiagramme (H-14, H-39) — ALS ABLAUFSCHEMA ÜBERNOMMEN

Entscheidung laut Auftrag ("Entscheidungsfolge in Textform oder einfache
Grafik, statt auszulassen"): als Kästchen-Entscheidungsfolge in Textform
(`Ablaufschema`, Feld `schritte`), nicht als Grafik — eine echte Grafik
hätte hier keinen Mehrwert gegenüber der bereits im Original linearen
Kästchenfolge gebracht, und Textform lässt sich in jeder der 14
UI-Sprachen gleich rendern.

- `ablaufschema-h14-gliederung-der-sprache` (S. 26): "Sprache" → Sätze/
  Fragmente/Wörter, mit Idaafah/Harf Jarr/Harf Nasb/Mausuf-Sifah/Ism
  Ishaarah als Beispielkästchen unter "Fragmente". **Wichtiger Vorbehalt:**
  für S. 26 stand in dieser Sitzung KEIN gerendertes Seitenbild zur
  Verfügung (fehlt in der lokalen Bildersammlung) — die Struktur ist
  unverändert aus der bereits in einer früheren Sitzung dokumentierten
  Bildprüfung übernommen (siehe die ursprüngliche Beschreibung von H-14
  weiter oben in dieser Datei), bewusst OHNE arabische Schrift wiedergegeben.
- `ablaufschema-h39-mubtada-chabar` (S. 58): Mubtada-Kästchen → Zwischenfrage
  "Was ist mit dem Mubtada?" → Chabar-Kästchen, Beispiel اللَّهُ الصَّمَدُ
  (Sure Al-Ikhlas 112:2). Ebenfalls ohne eigenes Seitenbild dieser Sitzung;
  die Kästchenstruktur stammt aus der früheren Bildprüfung. Die
  Vokalisierung des Beispiels wurde NICHT aus dem Handout-Bild geraten,
  sondern gegen `.daten-cache/out/morphologie/v2/112.json` (Qur'an-
  Morphologiedatenbank dieses Repos, Vers 2: ٱللَّهُ ٱلصَّمَدُ) geprüft und
  in die im Druck übliche Naskh-Form ohne Wasla-Zeichen übertragen — siehe
  "Oberste Regel". Die arabischen Begriffe مُبْتَدَأ/خَبَر für die Kästchen
  selbst sind NICHT neu gelesen, sondern bereits als verifizierte Einträge
  in `data/erklaerungen/de-partikel-syntax.json` ("mubtada"/"khabar")
  vorhanden — keine neue, ungeprüfte Vokalisierung eingeführt.

### Drei pädagogische Zwischentabellen (H-2, H-4, H-5) — BEGRÜNDET NICHT ÜBERNOMMEN

Bildbeleg bestätigt (bereits in der früheren Sitzung geprüft, siehe oben):
Status/Endung/Beispiel- bzw. Plural/Dual/Singular/Status-Zwischenschritte,
die die Muslimun-Deklination schrittweise aufbauen, BEVOR die volle Tabelle
`nomen-muslim` gedruckt wird. Prüfung laut Auftrag ("vereinfachte Ansicht"):
alle Formen darin (مُسْلِمٌ/مُسْلِمًا/مُسْلِمٍ, مُسْلِمُونَ/مُسْلِمِينَ,
مُسْلِمَانِ/مُسْلِمَيْنِ) sind eine ECHTE, vollständige Teilmenge der bereits
vorhandenen `nomen-muslim`-Tabelle — kein einziges Zeichen darin kommt in
`nomen-muslim` nicht bereits vor. Eine eigene "vereinfachte Ansicht"
(Progressive-Disclosure-Modus für `ParadigmTable`) wurde erwogen und bewusst
NICHT gebaut: sie würde UI-/Datenmodell-Komplexität hinzufügen (neuer
Anzeigemodus, neue Interaktion), ohne einen einzigen neuen Lerninhalt zu
liefern — die didaktische Reihenfolge (erst Singular, dann Plural, dann
Dual) lässt sich am bestehenden `nomen-muslim`-Bildschirm bereits ablesen
(die Zeilen sind in genau dieser Reihenfolge beschriftet). Die Begründung
ist damit inhaltlich ("keine Information, die nicht bereits vollständiger
an anderer Stelle der App steht"), nicht mehr "keine Paradigmentabelle".

### ~24 Vokabel-/Rhetorik-Beispieltabellen aus Abschnitt C — TEILWEISE ÜBERNOMMEN

Von den in der früheren Bilanz aufgezählten ca. 24 Einträgen
(H-20, H-22, H-56, H-58, H-59, H-164, H-165...H-184) wurden in dieser
Sitzung 7 zeichengenau aus gerenderten Seitenbildern übernommen (Bilder
waren bereits im Scratchpad vorhanden):

- `wortliste-h20-besondere-mudhaafs` (Abb. 13, S. 32, Partikelliste + 3
  gedruckte Anwendungsbeispiele)
- `wortliste-h22-harf-nasb` (Abb. 14, S. 35, Partikelliste)
- `wortliste-h56-fragewoerter-uebersicht` (Abb. 39, S. 81, Partikelliste + 8
  gedruckte Beispielsätze)
- `wortliste-h58-komplexe-saetze-teil1` (S. 91, Vokabelliste)
- `wortliste-h59-komplexe-saetze-teil2` (S. 92, Vokabelliste)
- `wortliste-h164-sarf-fortgeschritten` (S. 133, Vokabelliste)
- `wortliste-h185-balagah-vokabular` (S. 171, Vokabelliste)
- zusätzlich `beispielsatzliste-h166-istifham-partikel` (S. 144, aus
  demselben Kapitel-9-Bildbestand, siehe oben) als Bonus.

**Bewusst NICHT übernommen, mit echter (nicht "keine Paradigmentabelle")
Begründung:** H-165 (S. 138, "Table 2: Beispiele für die Klassifikation von
Sätzen in Balagha") und H-170/H-171 (S. 160/161, "Zusammenfassung der
Tashbih-Arten" bzw. "'Alaqa"-Tabelle) wurden in dieser Sitzung geöffnet und
geprüft: es sind kleine, feste Vergleichs-/Klassifikationstabellen mit
eigenen Spalten (z. B. Mushabbah | Adat | Mushabbah bihi | Wajh ash-Shabah),
die weder in das Vokabelliste-Schema (Wort/Umschrift/Bedeutung) noch in das
Beispielsatzliste-Schema (Partikel + ganzer Beispielsatz) passen — sie
bräuchten einen VIERTEN, eigenen Datentyp ("Vergleichstabelle") mit eigener
Spaltenstruktur je Balagah-Figur (Tashbih, Majaz, Isti'ara, ...). Das ist eine
inhaltliche, nicht triviale Erweiterung über den in diesem Auftrag konkret
benannten Rahmen (Vokabellisten/Partikelliste/Beispielsatzliste/
Flussdiagramme/drei Zwischentabellen) hinaus und wird hier bewusst als
eigener Folgeauftrag ausgewiesen statt unter Zeitdruck grob in ein
falsches Schema gepresst zu werden.

H-167-H-169, H-172, H-173-H-184 (weitere Balagah-Beispiel-/Analysetabellen
aus Kapitel 9, S. 138-171, mit Ausnahme des oben übernommenen H-166): für
die meisten dieser Seiten (u. a. S. 139-143, 145-159, 163-169) stand in
dieser Sitzung KEIN gerendertes Seitenbild zur Verfügung (nicht in der
lokalen Bildersammlung unter `scratchpad/handout`). Diese Tabellen enthalten
jeweils eigene Qur'an-Zitate als Belege — ein Nachbau ohne Bildbeleg hieße,
Qur'an-Text zu raten, was die "Oberste Regel" ausdrücklich verbietet.
**Das ist eine echte, konkrete Lücke** (kein Vorwand "keine
Paradigmentabelle") — für eine Fortsetzung: alle Seiten 138-171 rendern
(Zoom >=12, Zweifelsfälle >=40), dieselbe Vergleichstabellen-Struktur wie bei
H-170/H-171 identifizieren, als neuen vierten Datentyp modellieren.

## Vollständigkeitsbilanz — Wortlisten-Auftrag (diese Sitzung)

| Bucket | Anzahl | Status |
|---|---|---|
| Acht benannte Vokabellisten + Partikelliste H-21 | 9 | übernommen (`wortliste-h1/h12/h13/h27/h37/h38/h53/h54/h21`) |
| Beispielsatzliste H-55 | 1 | übernommen (+ Bonus H-166) |
| Flussdiagramme H-14, H-39 | 2 | übernommen als Ablaufschema (Textform, ohne eigenes Seitenbild dieser Sitzung — Vorbehalt dokumentiert) |
| Pädagogische Zwischentabellen H-2, H-4, H-5 | 3 | begründet NICHT übernommen (echte Teilmenge von `nomen-muslim`, kein neuer Lerninhalt) |
| Abschnitt-C-Extras (H-20, H-22, H-56, H-58, H-59, H-164, H-185) | 7 | übernommen |
| Abschnitt-C-Extra H-166 | 1 | übernommen (Bonus, Beispielsatzliste) |
| Balagah-Vergleichstabellen H-165, H-170, H-171 | 3 | begründet NICHT übernommen (eigener vierter Datentyp nötig, außerhalb des Auftragsrahmens) |
| Balagah-Beispieltabellen H-167-H-169, H-172-H-184 | 16 | NICHT übernommen — echte Lücke, kein Bildbeleg in dieser Sitzung verfügbar |

**Ehrliches Fazit:** Jeder der im Auftrag ausdrücklich benannten Einträge
(acht Vokabellisten, Partikelliste H-21, Beispielsatzliste H-55, zwei
Flussdiagramme, drei Zwischentabellen) ist bearbeitet — übernommen oder mit
einer inhaltlichen Begründung ausgelassen, die NICHT mehr "keine
Paradigmentabelle" lautet. Von der zusätzlich genannten "rund 24"-Zahl aus
Abschnitt C sind 8 übernommen (7 plus Bonus H-166); für die restlichen 16
Balagah-Tabellen (H-167-169, H-172-184) plus die drei Vergleichstabellen
(H-165, H-170, H-171) fehlt entweder das Bildmaterial dieser Sitzung oder ein
passender vierter Datentyp — beides real und für eine Fortsetzung mit
exakter Fundstelle dokumentiert, nicht stillschweigend unter "kein
Paradigma" verbucht. Die Bedeutungen aller neuen Wortlisten sind wie die
übrige Lehrtext-Basis der App vorerst NUR auf Deutsch vorhanden (sichtbar im
UI-Hinweis `lexikon.grammar.wortlisten.germanOnlyMeaningNote`, in allen 14
Sprachen übersetzt) — Übersetzung der Bedeutungen selbst ist eine
Folgeaufgabe.

## Priorität 8 — Vergleichstabellen (Balagah-Auftrag, diese Sitzung)

**Auftrag:** die beiden letzten offenen Posten aus Priorität 7 schließen —
(1) H-165/H-170/H-171 (Balagah-Vergleichstabellen, vorher zurückgestellt,
weil sie weder ins Wortliste- noch ins Beispielsatzliste-Schema passen) und
(2) H-167-169/H-172-184 (fehlendes Seitenbild). Zuerst per PyMuPDF
(`<scratchpad>\pdfenv\Scripts\python.exe`) die Seiten 138, 159, 160, 161,
162, 163, 164, 165 und 170 aus `handout.pdf` bei Zoom 3 gerendert (ganze
Seite, für diesen Fließtext-lastigen Tabellentyp bereits ausreichend
scharf) und jede der 19 betroffenen Tabellen einzeln am Bild gelesen.

### Strukturentscheidung: neuer Datentyp `Vergleichstabelle`, sehr nah an `ParadigmTabelle`

Alle 19 Tabellen (H-165, H-167-171 Tashbih-Raster; H-172-183 'Alaqa/Majaz-
Raster) haben dieselbe Grundform wie die bereits bekannten Bab-/
Personenmatrizen: ein festes Raster aus Spalten × Zeilen mit einem Wert pro
Zelle. Der entscheidende Unterschied zu `ParadigmTabelle`
(`erklaerungenTypes.ts`): dort ist eine Zelle IMMER ein Arabisch+Deutsch-
Paar (`{ar, de}`), hier druckt das Original pro Zelle oft nur EINEN Wert —
entweder ein einzelnes arabisches Wort/eine Phrase (z. B. `الْقُرْآنُ` unter
"Mushabbah") ODER einen deutschen/transliterierten Fachbegriff ohne eigene
Arabisch-Gegenprobe (z. B. "Sababiyya", "erwähnt", "-"). Deshalb wurde
`Vergleichstabelle` als neuer, eigener Typ in `wortlistenTypes.ts` angelegt,
der `columns`/`rows` UNVERÄNDERT von `ParadigmSpalte`/`ParadigmZeile`
übernimmt (Wiederverwendung statt Neuerfindung) und nur `cells` auf
`VergleichsZelle = {ar?: string; de?: string} | null` lockert. Damit ist der
neue Typ so nah wie im Auftrag gefordert am bestehenden Formentabellen-Raster
gehalten, ohne echte Ein-Wert-Zellen künstlich in ein erzwungenes Paar zu
pressen.

### Alle 18 Vergleichstabellen — ÜBERNOMMEN

In `data/wortlisten.json`, neues Array `vergleichstabellen`:

- `vergleichstabelle-h165-satzklassifikation` (S. 138, Table 2): Satz |
  Klassifikation — Ismiyya-vs.-Fi'liyya-Beispiele.
- `vergleichstabelle-h167-tashbih-quran-licht` (S. 159): Qur'an-Beispiel
  الْقُرْآنُ كَالنُّوْرِ فِي الْهِدَايَةِ.
- `vergleichstabelle-h168-tashbih-mufassal-wasser` (S. 159): Sure-18:29-
  Beispiel (Wasser wie geschmolzenes Metall).
- `vergleichstabelle-h169-tashbih-maqlub` (S. 160): Original/Umgekehrt-
  Raster zu Sure 2:275 (Handel/Wucher).
- `vergleichstabelle-h170-tashbih-dimni` (S. 160): Moschus-Beispiel, Wajh
  ash-Shabah als `de: "(implizit)"` (im Original nicht als eigenes Wort
  gedruckt).
- `vergleichstabelle-h171-tashbih-arten-zusammenfassung` (S. 161): die vier
  Tashbih-Arten (Mufassal/Mujmal × Mursal/Mu'akkad, Baligh) im Überblick.
- `vergleichstabelle-h172-alaqa-licht-prophet` bis
  `vergleichstabelle-h183-alaqa-muqaraba` (S. 161-165, 12 Tabellen): je ein
  'Alaqa-Beispiel (Sababiyya, Musabbabiyya, Kulliyya, Juz'iyya, I'tibar ma
  kana, I'tibar ma yakun, Muqaraba) plus die Isti'ara-Beispiele
  (Musarraha/Asliyya-Taba'iyya/Mula'im, S. 162-163).

Jede Tabelle trägt in `notes` den Beleg-Vers/Hadith (soweit im Original
zitiert) und eine kurze linguistische Einordnung. Kein Cell-Wert wurde
geraten: wo das Original "-" druckt (z. B. Wajh ash-Shabah bei mehreren
Isti'ara-Beispielen), steht `de: "-"` statt einer erfundenen Form.

### H-184 — als 17. Wortliste ÜBERNOMMEN (kein neuer Typ nötig)

`wortliste-h184-balagah-vokabular-teil1` (S. 170, "Vokabelliste", 35
Einträge, existierender `vokabelliste`-Typ): eine reine
Arabisch/Deutsch-Wortliste, die in der vorherigen Sitzung übersehen wurde
(H-164 [S. 133] und H-185 [S. 171] wurden bereits übernommen, die
dazwischenliegende S. 170 nicht). Zeichengenau gegen das gerenderte Bild
gelesen und mit der TSV-Rohextraktion aus `TABELLEN-INVENTAR.md`
kreuzgeprüft (identische Reihenfolge/Wortpaare).

### Angeschlossen an Loader/Kategorisierung/Anzeige

- `wortlistenTypes.ts`: neuer Typ `Vergleichstabelle` (siehe oben),
  `WortlistenDatei` um `vergleichstabellen` erweitert.
- `wortlistenLoader.ts`: lädt und reicht `vergleichstabellen` durch.
- `WortlisteView.tsx`: neue `VergleichstabelleCard` — rendert die
  tabelleneigenen `columns` als Kopfzeile, je Zeile eine optionale
  Zeilenbeschriftung (z. B. "Original"/"Umgekehrt"), pro Zelle `ar`
  (RTL-Schrift) und/oder `de`.
- `WortlistenKatalogView.tsx`: `vergleichstabellen` in die
  Kapitel-Gliederung und die Gesamtzahl-Anzeige aufgenommen (Kapitel 9
  zeigt jetzt Vokabelliste + Beispielsatzliste + 18 Vergleichstabellen).
- `wortlistenLoader.test.ts`: neue Testgruppe "vergleichstabellen —
  Struktur und Vollständigkeit" (18 erwartete IDs, Spalten-/Zeilen-
  Mindestzahl, jede belegte Zelle hat ar ODER de, jede Zellreferenz
  existiert in rows/columns) plus nachgezogene Bestandszahlen (17
  Wortlisten/13 Vokabellisten/494 Einträge statt vorher 16/12/459).

### Vollständigkeitsbilanz — Vergleichstabellen-Auftrag

| Bucket | Anzahl | Status |
|---|---|---|
| Balagah-Vergleichstabellen H-165, H-170, H-171 | 3 | übernommen als neuer Typ `Vergleichstabelle` |
| Balagah-'Alaqa/Isti'ara-Tabellen H-172-183 | 12 | übernommen (`Vergleichstabelle`) |
| Balagah-Tashbih-Beispieltabellen H-167-169 | 3 | übernommen (`Vergleichstabelle`) |
| Vokabelliste H-184 | 1 | übernommen (bestehender `vokabelliste`-Typ) |

**Ehrliches Fazit:** Mit dieser Sitzung sind ALLE 19 zuvor offenen
Balagah-Einträge (H-165, H-167-184) bearbeitet — 18 als neuer Datentyp
`Vergleichstabelle` (bewusst nah an `ParadigmTabelle` gehalten, siehe oben),
1 (H-184) als gewöhnliche Vokabelliste. Damit ist laut
`TABELLEN-INVENTAR.md` (206 Einträge: 21 Abschnitt A, 13 Verweis-Zeilen
Abschnitt B, 185 Abschnitt C H-1...H-185) JEDER Eintrag des gesamten
Inventars entweder als Datenartefakt in der App sichtbar oder mit einer
geprüften inhaltlichen Begründung ausgelassen — "kein gerendertes
Seitenbild vorhanden" ist als Begründung nicht mehr offen, weil alle
benötigten Seiten in dieser Sitzung gerendert und gelesen wurden. Die
einzigen weiterhin bewusst ausgelassenen Einträge sind die bereits mehrfach
dokumentierten Vokabel-/Partikellisten-Dubletten, die drei pädagogischen
Zwischentabellen (echte Teilmenge von `nomen-muslim`) und die zwei
Diagramm-Fehlfunde (H-14/H-39, als Ablaufschema übernommen) — jeweils mit
inhaltlicher, nicht bildbezogener Begründung weiter oben in dieser Datei.

## Priorität 9 — Wortlisten-Übersetzung in die 13 Nicht-Deutsch-Sprachen (Folgesitzung)

**Auftrag:** die in Priorität 7/8 offen dokumentierte Folgeaufgabe schließen
— die Bedeutungs-/Beschriftungsfelder der 17 Wort-/Partikellisten (494
Einträge), der 2 Beispielsatzlisten, der 2 Ablaufschemata und der 18
Vergleichstabellen aus `wortlisten.json` liegen jetzt zusätzlich zum
Deutschen in allen 13 übrigen App-Sprachen vor (en, tr, ar, es, fr, id, bn,
fa, ms, ur, ru, sw, ps). NICHT betroffen: die arabischen Formen, Umschriften,
Eintrags-Schlüssel und Koranfundstellen (unverändert) sowie die editorischen
Herkunfts-Notizen (`notes`, z. B. "Zeichengenau aus dem gerenderten
Seitenbild ... gelesen") — die sind Sourcing-Metadaten für Bearbeiter, keine
Vokabelbedeutung, und bleiben bewusst Deutsch.

### Ablage: eigenes Bündel je Sprache statt Mischung in `wortlisten.json`

`wortlisten.json` selbst bleibt unverändert (einsprachig Deutsch) — analog
zum bereits bestehenden Muster `data/erklaerungen/<lang>-<bereich>.json` legt
jede Sprache ihr eigenes Bündel unter `data/wortlisten-i18n/<lang>.json` ab,
an denselben IDs/Indizes wie das deutsche Original aufgehängt (siehe
`wortlistenI18nTypes.ts`). Grund: 13 × ~710 zusätzliche Felder direkt in
`wortlisten.json` hätten die Datei versechzehnfacht und jede künftige
inhaltliche Korrektur der deutschen Referenz (Sourcing-Notizen inklusive)
mit 13 Sprachfeldern verkoppelt, die nichts mit der Korrektur zu tun haben.

- `wortlistenI18nTypes.ts` / `wortlistenI18nLoader.ts`: Typen + literale
  dynamic-import-Map je Sprache (eigenes Metro-/Web-Chunk, analog
  `erklaerungenLoader.ts`).
- `WortlisteView.tsx` / `WortlistenKatalogView.tsx`: rendern jetzt das
  Übersetzungsbündel der aktiven Sprache mit Fallback auf die deutschen
  Felder aus `wortlisten.json` (für `de` selbst und für eine — aktuell
  keine mehr — unübersetzte Sprache).
- `lexikon.grammar.wortlisten.germanOnlyMeaningNote`: erscheint nur noch,
  wenn für die aktive Sprache kein Bündel geladen werden konnte (aktuell nur
  noch bei `de` selbst der Fall, weil dort die deutschen Felder schon die
  Zielsprache sind).
- `data/wortlisten-i18n/wortlisten-sprachparitaet.test.ts`: neuer
  Paritätstest (analog `data/erklaerungen/sprachparitaet.test.ts`, inkl. der
  dort bereits geschärften Deutsch-Resterkennung — zwei verschiedene
  Funktionswörter statt einzelner Buchstaben wie ö/ü/"des") — gleiche
  Schlüssel, gleiche Längen, kein leeres/unübersetztes Feld, pro
  Sprachdatei automatisch gefunden.

### Fachterminologie

Arabische Fachbegriffe (Ism, Fiil, Harf, Idaafah, Mudhaaf, Mubtada, Chabar,
Tashbih, Isti'ara, Majaz, 'Alaqa usw.) wurden gegen die bereits vorhandenen,
professionell übersetzten Lehrtexte `data/erklaerungen/<lang>-{nomen,verb,
partikel-syntax}.json` abgeglichen und deren Schreibweise übernommen statt
neu zu übersetzen. Für Balagah-Rhetorikbegriffe, die in diesen drei Dateien
nicht vorkommen (sie decken nur Nomen/Verb/Partikel-Syntax ab, keine
Rhetorik), blieb die deutsche Handout-Transliteration unverändert (z. B.
"Mufassal Mu'akkad", "Isti'ara Asliyya") — für Arabisch, Persisch, Urdu und
Paschtu wurden diese Begriffe dagegen in die jeweils eigene Schrift
übertragen (arabische bzw. arabisch-basierte Schrift kann Fachbegriffe wie
"Tashbih"/"Isti'ara" nativ darstellen statt sie zu transliterieren).

### Vollständigkeitsbilanz

| Sprache | Wortlisten | Beispielsatzlisten | Ablaufschemata | Vergleichstabellen | Paritätstest |
|---|---|---|---|---|---|
| en/tr/ar/es/fr/id/bn/fa/ms/ur/ru/sw/ps | je 17/17 | je 2/2 | je 2/2 | je 18/18 | grün |

Alle 13 Sprachdateien bestehen `wortlisten-sprachparitaet.test.ts`
(10.562 Einzelprüfungen) ohne Fehler; `npx tsc --noEmit` und `npm run lint`
sind sauber, die volle Jest-Suite (35.265 Tests) bleibt grün.
