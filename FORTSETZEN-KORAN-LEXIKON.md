# Koran-Reader Morphologie + Lexikon — Arbeitsstand

## Auftrag (Nutzer, 2026-09-05)
- Beim Antippen eines Koranworts soll JEDES Fragment analysierbar sein, bis ins kleinste Detail (auch harf ʿatf, badal).
- Farbliche Markierung im Reader, einstellbar: Fragmente erkennen, die vier Eigenschaften eines Ism, warum ein Verb Vergangenheit ist, ob Verneinung vorliegt usw. Übersichtlich, Erklärung beim Antippen, sehr genau.
- Layout ALLER Tabellen aus dem Handout übernehmen (Nomen-/Verbtabellen usw.) — für Lexikon UND Reader-Detailansicht.
- Erklärungstexte des Handouts inhaltlich vollständig übernehmen, aber NEU FORMULIERT (keine wörtliche Übernahme).
- Quellen Enes Arpaci / Vaseelah dürfen NICHT als Quelle genannt werden.
- Lexikon mit universeller Suche + 4 Reitern: Wurzeln & Vokabeln, Grammatik & Sarf, Tajwīd, Konkordanz.
- Alle 14 App-Sprachen, arabische Fachbegriffe verwenden.
- Abschluss zwingend: Verifikation im Emulator (Screenshots), Übersichtlichkeit und Vollständigkeit belegen.

## Entscheidungen mit Begründung
1. Umsetzung in TypeScript/React Native in `apps/mobile` (Expo SDK 57) — die App ist kein Flutter-Projekt, auch wenn der Auftrag Dart erwähnte.
2. Datenquelle Morphologie: Quranic Arabic Corpus v0.4 (corpus.quran.com), verbatim übernommen — sha256 `a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46`, 6.309.503 Byte, 128.219 Datenzeilen, 77.429 Wörter; zwei byte-identische Spiegel gefunden. Lizenz erlaubt wörtlich verbatim-Kopien und Nutzung „in any website or application, provided its source (the Quranic Arabic Corpus) is clearly indicated, and a link is made to http://corpus.quran.com". Namensnennung + Backlink sind daher PFLICHT und gehören in die bestehende Lizenzseite (`apps/mobile/public/licenses/`, Build-Skript `scripts/build-license-texts.mjs`) — STAND: vor der Auslieferung 1.52.0 eingetragen, ebenso die MIT-Nennung für NoorBayan/Quranic. Das ist unabhängig davon, dass Enes/Vaseelah nicht genannt werden.
3. NICHT verwendet: GitHub-Fork `mustafa0x/quran-morphology` (6.322.866 Byte, 130.030 Segmente, 77.429 Wörter, bereits arabische Schrift) — kein LICENSE-File und Verstoß gegen die „changing is not allowed"-Klausel des Originals. Nur als QA-Referenz zulässig, nicht zum Ausliefern.
4. api.quran.com liefert KEINE Morphologie — live geprüft 2026-09-05: `word_fields=root,lemma,verb_form` wird ignoriert, HTTP 200, Felder fehlen. Bestätigt den Altkommentar in `src/features/quran/WordInfoSheet.tsx`.
5. Syntax/Iʿrab: KORRIGIERT gegenüber dem ursprünglichen Stand. Nicht der Treebank von corpus.quran.com (nur pro Vers im Web einsehbar, kein Download) ist die Quelle, sondern `github.com/NoorBayan/Quranic` unter MIT-Lizenz („Copyright (c) 2025 NoorBayan"), mit vollständiger Abdeckung: 114/114 Suren, 6.236/6.236 Verse, 112 Relationslabels, darunter `App`/بدل (635 Belege) und `conj`/معطوف (5.143). Die frühere Annahme „nur 64 von 114 Suren" stammte aus der Web-Ansicht von corpus.quran.com (dort fehlen 9–58) und ist überholt — Iʿrab liegt jetzt für den gesamten Koran vor. Wo dennoch keine Daten vorliegen, wird NICHTS angezeigt — kein Raten an religiösem Text.
6. Auslieferung der Daten: NICHT ins JS-Bundle importieren, sondern R2-Bucket `pub-d0489c0572704285af79896edb72cbed.r2.dev` unter neuem Präfix `/morphologie/<sure>.json`, pro Sure per fetch nachladen, mit `expo-file-system` in `documentDirectory` cachen. Begründung: Die App löst dasselbe Problem bereits zweimal so (KI-Korpus `src/features/ki/korpus.ts`, Whisper-Modell `src/features/hifz/whisperModel.ts`), und der Performance-Audit vom 2026-07-27 (dokumentiert in `src/lib/translate.ts`) verbietet große Always-Loaded-Chunks (14 Locales statisch = 3.091.110 Byte im __common-Chunk).
7. Kein 6. Tab: Die native Tab-Leiste (`src/components/app-tabs.tsx`, `expo-router/unstable-native-tabs`) hat 5 Slots. Das Lexikon kommt als Eintrag in `src/lib/lernenNav.ts` und erscheint dadurch automatisch im Lernen-Tab UND unter „Mehr".
8. Handout-Quellen im Repo (nur als Inhaltsvorlage, nicht als zitierte Quelle): `podcast/handouts/tabellen-sprache.pdf` (21 S., reine Tabellen), `podcast/handouts/grammatik.pdf` (84 S., Badal/Harf al-Atf/Verbstamm-Familien II–X), `podcast/handouts/madinah-arabisch.pdf` (156 S.), `handout.pdf` im Repo-Root = `apps/dropbox-extract/handout.pdf` (178 S.).
9. Fehler in der recherchierten Buckwalter-Transliterationstabelle gefunden und in der Pipeline korrigiert: `s`→س und `$`→ش fehlten. Ohne Korrektur wäre بِسْمِ mit lateinischem `s` statt س gerendert worden.

## Bestandsaufnahme Code (Belege)
- `src/features/quran/api.ts:386` — `QuranWord` hat nur arabic/translation/transliteration/audioUrl/tajweedRules, KEIN root/lemma/POS.
- Wort-Tap an drei Stellen: `src/app/(tabs)/quran/[surah].tsx:935`, `src/app/(tabs)/quran/mushaf.tsx:377` und `:424` (Mushaf ohne Audio/Gloss-Override, Sheet-Aufruf dort Zeile 692–698).
- Vorbild für Farb-Runs: `TajweedSegmentText` (`[surah].tsx:122`) + `TAJWEED_COLORS` (`api.ts:1087`).
- Vorbild für kombinierten Modus-Schalter: `beginnerModeActive`/`toggleBeginnerMode` (`[surah].tsx:276–282`).
- Sheet: `src/features/quran/WordInfoSheet.tsx` (Modal-basiert, kein @gorhom/bottom-sheet im Projekt).
- Caching: React Query, `STATIC_STALE_TIME` 7 Tage (`hooks.ts:24`), AsyncStorage-Persistenz (`src/lib/queryClient.ts:75–79`).
- i18n: `src/lib/translate.ts` (de/en statisch, 12 Sprachen lazy), Key-Parität testgeprüft in `src/lib/locales.test.ts`, Qualität in `src/lib/locales-quality.test.ts`.
- RTL: `src/hooks/use-rtl.ts`, bewusst OHNE `I18nManager.forceRTL`.
- Farben: `src/constants/theme.ts` — `Colors.dark.background = #0b0b0d`, `accent = #d4af37`.
- Kurs-Daten-Muster: `src/features/study/courses.ts` lädt JSONs per literalem `import()` (eigenes Chunk je Kurs).
- Pipeline `apps/mobile/scripts/build-morphologie.mjs`: erzeugt 128.219 Segmente, 77.429 Wörter, 6.236 Verse, 114 Suren, 1.642 Wurzeln, 4.816 Lemmata; Ausgabe roh 45 MB, gzip 3,3 MB. Wortzahl je Vers gegen quran.com gegengeprüft (exakte Übereinstimmung — größtes Risiko, da der Reader Grammatik über die Wortposition zuordnet). Restfälle in `meta.json`: 6 Segmente mit ungeklärten Sonderzeichen, 3.556 Fälle mit elidiertem Bezugswort, 1.066 versübergreifende Bezüge (`head: null`).
- Upload `apps/mobile/scripts/upload-morphologie-r2.mjs`: 117/117 Dateien live unter `https://pub-d0489c0572704285af79896edb72cbed.r2.dev/morphologie/`, gzip mit `Content-Encoding: gzip`, `Cache-Control: public, max-age=31536000, immutable`, CORS `*`. Live nachgeprüft: 1.json 1980 B, 2.json 234300 B, 114.json 1314 B, meta.json 2707 B, alle HTTP 200.
- Grammatiklogik gegen Echtdaten korrigiert: `DET` ist eigenes Segment-Tag (8.377 Vorkommen), nicht per Text „ال" erkennbar; alle 45 real vorkommenden Wortart-Tags zugeordnet. Textbasierte Verneinungserkennung entfernt (Fehltreffer bei Verbstämmen ohne Vokalzeichen, z. B. لِنتَ 3:159, لُمْتُنَّنِى 12:32; ما ist ~1800× Relativ-/Frage-/Bedingungspartikel) — stattdessen `pos === 'NEG'` (trifft exakt 2.688 Fälle). `relationBasis()` fasst die 112 NoorBayan-Labels auf 46 zusammen. Merke: Arabische Literale in Testdateien normalisieren anders als die Korpusdaten (Shadda/Fatha-Reihenfolge) — beidseitig `.normalize('NFC')` nötig.
- `src/features/lexikon/data/paradigmen.json`: 21 Tabellen aus `podcast/handouts/tabellen-sprache.pdf` zeichengenau übernommen, 73 Tests. Unabhängige blinde Zweitablesung verglich 183 Zellen, fand 2 Abweichungen (Dagger-Alif fälschlich ergänzt bei هَؤُلَاءِ und أُولَئِكَ in der Hinweiswörter-Tabelle) — Korrektur läuft. Die 14 im Koran unbelegten Formen stimmen in beiden Ablesungen überein.
- Fachbegriffe: 439 Schlüssel je Sprache in allen 14 Locale-Dateien, Teilbaum `grammatik` mit den Bereichen wortarten, ismEigenschaften, verbEigenschaften, fragmentrollen, posTags, relationen, herkunft, nomenFlexibilitaet, schwacheVerben; Eintragsstruktur `{name, ar, info}`.
- Emulator: AVD `salati_lexikon` (Android 36, Pixel 7) läuft als `emulator-5554`. Befund: alle bestehenden `salati_*`-AVDs zeigen auf `android-35`, im SDK ist aber nur `android-36` installiert — die im Juli-Audit dokumentierte Emulator-Prüfung läuft auf keinem Gerät mehr. App `de.salatibox.de` ist auf dem neuen AVD noch nicht installiert.
- KRITISCH, aber vorbestehend und eigener Vorgang: Der Android-Debug-Build stürzt beim Start ab (`jsi.h:1987: assertion "isString()" failed`, SIGABRT, `mqt_v_js`, Stack über `libworklets.so` → Hermes → React Native), rund 380 ms nach `Running "main"`. Nachgewiesen vorbestehend: `c372a81c` (letzter Commit vor dieser Arbeitslinie) zeigt denselben Absturz; `pnpm-lock.yaml`, `apps/mobile/android`, `apps/mobile/package.json` sind zwischen `c372a81c` und `08c6a3d4` byte-identisch. FOLGE: Die native Emulator-Prüfung war deshalb zunächst nicht möglich, stattdessen wurde über die Web-Fassung geprüft (siehe P6 unten).
- KORRIGIERT gegenüber dem ursprünglichen Stand: nicht react-native-reanimated#9786 ist die passende Ursache, sondern Issue #9906 (Fix in PR #9920) — Worklets 0.10.x enthält den Fix nicht, ab 0.11.2 ja. Der Release-Build ist von diesem Absturz NICHT betroffen (Gerätefreigabe am frischen Release-Build lief ohne diesen Fehler); der Upgrade auf Reanimated 4.5.2 + Worklets 0.11.x ist bewusst NACH der Auslieferung 1.52.0 eingeplant, weil er von den durch Expo SDK 57 gemeinsam getesteten Fassungen abweicht.
- Wort-Analyse-Sheet (`src/features/quran/WordInfoSheet.tsx`, Commit 20ad6121/f1720a59) ersetzt das frühere WordInfoSheet vollständig — nur noch ein Sheet statt zwei. Aufbau: oben Wort/Aussprache/Bedeutung/Fundstelle, darunter aufklappbar Fragmente und Wortart (Standard offen), Satzrolle, Buchstaben, Aussprache (Standard zu). Buchstaben/Tajwīd sind bewusst nicht an die Morphologiedaten gekoppelt, damit das Sheet offline nicht leer erscheint.
- Fünf Farb-Markierungsmodi im Reader (Commit 312b67bf): Wortart, Fragmente, Bestimmtheit, Zeitform, Verneinung — einzeln zuschaltbar, Standard aus, mit Legende, WCAG-AA-geprüft und gegen Rot-Grün-Sehschwäche abgestimmt. Markierung liegt wortweise über dem unveränderten Korantext.
- Lexikon (Commit 1dc74421): 1.642 Wurzeln virtualisiert, Wurzel-Detailansicht mit Belegstellen, Konkordanz, universelle Suche mit beidseitiger Diakritika-Normalisierung, Reiter Grammatik mit Lehrtexten und Paradigmen-Tabellen im Handout-Raster.
- Neuer Bereich „Gemeinsam beten" (`src/features/gebet-gemeinsam/`, Commit e590d917): 5 Aufstellungs-Diagramme als SVG (Personen über Form UND Beschriftung unterscheidbar, nicht nur Farbe), 13 Regeln mit Sicherheitsgrad (11 anerkannt, 1 strittig, 1 Empfehlung), Rechtsschule und Quelle je Regel; hanafitische Position steht voran, abweichende Positionen daneben. Ein Test erzwingt Quelle und Sicherheitsgrad je Regel. Recherche-Einschränkung (sunnah.com liefert per WebFetch durchgehend HTTP 403, Belege daher über Titel-Treffer/Sekundärquellen) und offene Einzelpunkte in `src/features/gebet-gemeinsam/OFFEN.md`.
- 82 Lehrtexte (Commit 16da880e: 17 Nomen, 38 Verb, 27 Partikeln/Syntax) mit 178 gegen den Korpus verifizierten Koranbelegen, `src/features/lexikon/data/erklaerungen/{de,en,tr,ar}-{nomen,verb,partikel-syntax}.json`. Paritätstest `sprachparitaet.test.ts` hält die vier fertigen Sprachfassungen zusammen.
- Reiterleiste (Commit f5c72ee9): fehlendes `flexWrap` in `src/components/ui/segmented-tabs.tsx` führte zu horizontalem statt umbrechendem Überlauf; behoben, geprüft bei 430 und 360 Punkten Breite in beiden Leserichtungen.
- Sachfehler im deutschen Lehrtext zu `mudaaf`-Verben korrigiert: im Apokopat (Jussiv) erscheinen die gleichen Radikale getrennt statt assimiliert, belegt an 2:217 (`STEM|POS:V|IMPF|(VIII)|LEM:{rotad~a|ROOT:rdd|3MS|MOOD:JUS`).
- Paritätstest erkannte deutsche Resttexte zunächst an Umlauten und schlug bei türkischen Wörtern mit ö/ü falsch an; Erkennung stützt sich jetzt auf deutsche Funktionswörter, eigener Gegentest belegt weiterhin Ansprechen bei echtem deutschem Text.
- `expo lint` cacht unter `.expo/cache/eslint` und zeigt bereits behobene Fehler erneut an — bei unplausiblen Lint-Ergebnissen zuerst den Cache löschen.
- Nutzeraufgabe „Religiöse Inhalte gegenlesen" (Commit 08c6a3d4) ist jetzt in `USER-TODO.md` (Repo-Root, Abschnitt 2) als verfolgter Punkt erfasst, nicht mehr nur als Code-Kommentar — siehe Abschnitt „Nutzeraufgaben" unten.
- Web-Verifikation (da nativer Emulator durch den vorbestehenden Absturz blockiert war): `npm run build` + `serve dist`, Playwright, Viewports 430×932 und 360×800, deutsch und arabisch (RTL). Alle zwölf Prüfwege erreicht: badal bei 1:2 رَبِّ, Wurzel ربب mit 980 Vorkommen, Personenmatrix im Handout-Raster mit Personenspalte rechts, Konkordanz رحمن mit 57 Fundstellen, RTL auf Arabisch sauber, keine rohen i18n-Schlüssel, keine fehlenden Glyphen. Screenshots und `BERICHT.md` im Scratchpad (`<scratchpad>\pruefung\`, 33 PNGs). Offene Kleinbefunde: Farbmodus „Fragmente" färbt das ganze Wort statt zeichengenau Präfix/Suffix (Designentscheidung, kein Fehler); Suren-Untertitel bleiben in RTL englisch (vorbestehend, nicht Teil dieser Arbeitslinie).
- Commits dieser Arbeitslinie (alle auf `main`, NICHT gepusht): ee91da3a (Lexikon-Grundgerüst), 9c4a1b26 (Laufzeitschicht), c0faf747 (Pipeline + Upload), 85d1339d (Grammatik-Korrektur), f0c4f735 (Fachbegriffe 14 Sprachen), a6ef09f7 (21 Paradigmen-Tabellen), 0cf32b26 (Verbmatrizen im Handout-Raster), 20ad6121 (Wort-Analyse-Sheet), 40849a0b (Bestimmtheit/schwache Verben), 312b67bf (Farbmodi im Reader), 1dc74421 (Lexikon Wurzeln/Konkordanz/Lehrtexte angebunden), e590d917 (Gemeinsam beten), f1720a59 (ein Sheet statt zwei), 08c6a3d4 (USER-TODO religiöse Prüfung), f5c72ee9 (Reiterleiste bricht um), 16da880e (82 Lehrtexte plus en/tr/ar).
- Gerätefreigabe, erste Runde: lief auf einem Build, der während laufender Änderungen entstand — zwei der drei gemeldeten Fehler waren Artefakte dieses veralteten Builds, kein echter Fehler in Reiterleiste/Restzeit auf Arabisch oder Lizenzüberschrift.
- Gerätefreigabe, frischer Release-Build: Reiterleiste und Restzeit auf Arabisch korrekt, auch beim Sprachwechsel ohne Neustart; Lizenzüberschrift korrekt; kein Hänger im Lexikon — Wurzel اله lädt in 1,8 s (nur 3 Lemmata, nicht 114 Dateien), die zuvor gemeldeten 35 s waren eine Fehlmessung; alle fünf Tabellenkategorien bestätigt, 146 Tabellen.
- Echte Fehler, die die Geräteprüfung fand und die behoben wurden: fehlender Übersetzungsschlüssel `lizenzen.categories.adhan` in allen 14 Sprachen (roher Schlüssel auf dem Bildschirm); die Tabellenanzeige gab nur die erste Anmerkung aus, wodurch der Hinweis auf die fehlerhafte Abbildung 92 unsichtbar blieb; fehlender Spinner und nicht ausgewerteter Fehlerzustand beim Laden der Wortformen.
- Neu abgesicherte Prüfungen, damit dieselben Fehler nicht zurückkehren: jede Lizenzkategorie muss in allen 14 Sprachen übersetzt sein; jede Tabellendatei muss im Loader eingetragen sein; jede Tabelle muss einer Kategorie zugeordnet sein; Sprachfassungen der Lehrtexte müssen strukturgleich sein; in nicht-deutschen Fassungen darf kein Verweis auf die deutsche Sprache stehen.

## Auslieferung 1.52.0 (2026-09-06)
Beide Stores bedient, unabhängig verifiziert über `npm run release-check`: Google Play `production completed`, versionCode 78, 1.52.0; App Store Connect 1.52.0 Build 78, `WAITING_FOR_REVIEW`.

Apple-Ablauf (auf ausdrückliche Anweisung des Nutzers): Build 78 gebaut (EAS, `d50a5bbb-bfa6-47ed-b329-cb466fb99f1c`, FINISHED), per `eas submit` hochgeladen, als VALID bestätigt. Danach Ist-Zustand belegt (Build 77 / 1.51.0 `WAITING_FOR_REVIEW`, wie erwartet), die laufende Prüfung zurückgezogen (1.51.0 steht jetzt `DEVELOPER_REJECTED`), dann 1.52.0 mit Build 78 eingereicht. Versionshinweise für en-US und de-DE gesetzt; weitere Sprachen sind für dieses App-Store-Listing nicht angelegt.

Play-Ablauf: AAB lokal gebaut (`gradlew bundleRelease`, 117,9 MB), Version und Signatur belegt (`bundletool dump manifest`: versionCode 78, versionName 1.52.0; Zertifikats-Fingerabdruck identisch mit dem Upload-Schlüssel, kein Debug-Schlüssel), über `scripts/play-aab-upload.mjs` hochgeladen, Versionshinweise in 13 Sprachen. Am Store-Eintrag wurde nichts geändert.

Zwei Hindernisse beim iOS-Bau, behoben: vier `.mobileprovision`-Dateien fehlten und wurden aus den eingebetteten Profilen von Build 77 rekonstruiert (Bundle-IDs `de.salatibox.de` und die drei Erweiterungen, Ablauf 2027-07-17). Das EAS-Archiv lag mit 3,3 GB über der 2-GB-Grenze — Ursache waren `/output_videos` (3,1 GB) und `/output_podcasts` (248 MB), jetzt in `.easignore`.

## Was seit dem letzten Stand geschlossen wurde
- Surennamen in allen 14 Sprachen übersetzt (vorher nur Deutsch, `surahNames.ts`). Suaheli: 88 von 114 mit Bedeutung übersetzt, Rest als Umschrift; die Einteilung lexikalisch / theologisch aufgeladen / Buchstabensuren steht als nachvollziehbare Konstante im Code.
- Tabellensammlung abgeschlossen: 150 Tabellen in fünf Kategorien, Kapitel Ṣarf zu 100 %. Alle 206 Inventareinträge sind jetzt entweder Datenartefakt oder mit inhaltlicher Begründung ausgelassen — „keine Paradigmentabelle" und „kein Seitenbild vorhanden" zählen nicht mehr als Grund.
- Wortlisten aufgenommen: 17 Wort- und Partikellisten mit 494 Einträgen, zwei Beispielsatzlisten, zwei Ablaufschemata, 18 Rhetorik-Vergleichstabellen — in allen 14 Sprachen, mit eigenem Paritätstest (10.562 Prüfungen).
- Reanimated 4.5.2 / Worklets 0.11.4 eingespielt: der Debug-Absturz (Entscheidung/Befund zu #9906 im vorigen Stand) ist behoben. Merke für Nachfolger: Nach dem Wechsel bleiben Gradles Codegen-Schritte fälschlich als aktuell stehen — `android/app/.cxx` und `android/app/build` müssen gelöscht werden, ein inkrementeller Bau reicht nicht.
- Sechs ungeklärte Sonderzeichen im Korantext gelöst (Uthmani-Rezitationsmarken, am echten Vers Codepoint für Codepoint verifiziert). Daten jetzt als Schema 3 unter `morphologie/v3/`, `bekannteLuecken` leer.
- Wort-für-Wort-Bedeutungen: entschieden und als Nutzeraufgabe eingetragen (`USER-TODO.md` Abschnitt 3), nicht technisch lösbar — sechs Sprachen wären bei QUL verfügbar, aber ohne Lizenzzusage; Deutsch und Russisch sind dort ausdrücklich geschützt. Maschinelle Übersetzung ausdrücklich abgelehnt.

## Echte Fehler, die erst die Geräteprüfung fand
- Aufstellungs-Diagramme (`gebet-gemeinsam`): auf dem Fernseher waren Titel und letzte Reihe abgeschnitten, arabische Beschriftungen zerfielen in Einzelzeichen. Beide Apps betroffen, behoben.
- Qibla-Kompass: derselbe Schriftfehler, seit Langem unbemerkt. Ursache: `SvgText` aus react-native-svg formt Verbundschrift nicht. Lösung: Beschriftungen als natives Text-Overlay über das SVG. Wichtig für Nachfolger: Im Browser rendert dasselbe korrekt — eine Prüfung über die Web-Fassung findet das nicht.
- Fehlender Übersetzungsschlüssel `lizenzen.categories.adhan` (roher Schlüssel auf dem Bildschirm).
- `lexikon.concordance.occurrencesHeading` war in allen 14 Sprachdateien ein Objekt statt einer Zeichenkette — auch im Deutschen, deshalb konnte keine Sprachvergleichsprüfung es finden.
- Die Tabellenanzeige gab nur die erste Anmerkung aus; der Hinweis auf eine fehlerhafte Stelle der Vorlage blieb unsichtbar.

## Prüfungen, die grün aussahen ohne zu prüfen
- `de-partikel-syntax.test.ts` hatte einen Verzeichnisschritt zu wenig im Pfad — der Korpus-Block wurde immer übersprungen. Die Belege zu badal, ʿaṭf, mubtadaʾ und Verneinung waren nie geprüft. Laufen jetzt, 1.145 Prüfungen grün.
- Mehrere Testdateien verdrahteten den Datenpfad fest; nach der Umstellung auf Schema v3 hätten sie stillschweigend nichts mehr geprüft. Ein Wächter-Test verhindert das jetzt, seine Wirksamkeit wurde mit einem eingeschleusten Verstoß nachgewiesen.
- Store-Texte trugen englischen Text unter türkischer und arabischer Sprachkennung. Ein zitiertes arabisches Wort im englischen Satz hätte eine reine Schrifterkennung getäuscht.

## Auslieferung 1.53.0 (2026-09-06)
Beide Stores bedient, unabhängig verifiziert über `npm run release-check`: Google Play `production completed`, versionCode 79, 1.53.0; App Store Connect 1.53.0 Build 79, `WAITING_FOR_REVIEW`.

Apple-Ablauf (auf ausdrückliche Anweisung des Nutzers): Build 79 über EAS erzeugt, per `eas submit` hochgeladen, als VALID bestätigt. Danach Ist-Zustand belegt (1.52.0 / Build 78 weiterhin `WAITING_FOR_REVIEW`), die laufende Prüfung zurückgezogen (1.52.0 steht jetzt `DEVELOPER_REJECTED`), dann 1.53.0 eingereicht. Derselbe Stolperstein wie beim vorigen Lauf: Apple erlaubt nur eine bearbeitbare Version gleichzeitig, die zurückgezogene 1.52.0 belegte den Platz — Lösung wie beim vorigen Lauf: die vorhandene Version über `asc-version.mjs --setze` umbenannt statt eine neue anzulegen.

Play-Ablauf: Abnahme am Gerät VOR dem Upload (Lehre aus 1.52.0, wo die Abnahme auf einem Build lief, der während laufender Änderungen entstand) — acht Prüfwege am Release-Build belegt und angesehen. Danach AAB gebaut, Version und Signatur belegt (`bundletool dump manifest`: versionCode 79, versionName 1.53.0; Zertifikats-Fingerabdruck identisch mit dem Upload-Schlüssel), hochgeladen, Zustand nachgeprüft.

## Stand der Arbeitspakete

| Paket | Status | Belege/Dateien | Offen |
|---|---|---|---|
| P0 Recherche Datenquelle | ERLEDIGT | siehe Entscheidungen 2–5 | — |
| P0 Recherche Reader-Code | ERLEDIGT | siehe Bestandsaufnahme oben | — |
| P0 Recherche i18n/Design | ERLEDIGT | `src/lib/translate.ts`, `src/hooks/use-rtl.ts`, `src/constants/theme.ts` | — |
| P0 Recherche Asset-Auslieferung | ERLEDIGT | `src/features/ki/korpus.ts`, `src/features/hifz/whisperModel.ts` | — |
| P1 Handout-Tabellen-Inventar (PDF-Extraktion) | ERLEDIGT | `podcast/handouts/tabellen-sprache.pdf`, `podcast/handouts/grammatik.pdf`, `podcast/handouts/madinah-arabisch.pdf`, `apps/dropbox-extract/handout.pdf` | — |
| P1 Korpus-Beschaffung + Format-Spezifikation | ERLEDIGT | Quranic Arabic Corpus v0.4 (Morphologie), NoorBayan/Quranic MIT (Syntax/Iʿrab, Entscheidung 5), Buckwalter-Fehler behoben (Entscheidung 9) | — |
| P1 Lexikon-Grundgerüst (Route, Nav, 4 Reiter, 14 Sprachen) | ERLEDIGT | `src/lib/lernenNav.ts`, Commit ee91da3a | — |
| P2 Datenmodell (Segmente, Merkmale, Iʿrab) | ERLEDIGT | Commit 9c4a1b26 (Laufzeitschicht), 85d1339d (Grammatik-Korrektur) | — |
| P2 Aufbereitungs-Pipeline Korpus → 114 JSON-Dateien → R2 | ERLEDIGT | `scripts/build-morphologie.mjs`, `scripts/upload-morphologie-r2.mjs`, Commit c0faf747, 117/117 Dateien live, QAC-/NoorBayan-Attribution in Lizenzseite eingetragen | — |
| P3 Wort-Analyse-Sheet mit Segment-Aufschlüsselung | ERLEDIGT | `src/features/quran/WordInfoSheet.tsx`, Commits 20ad6121/f1720a59, altes Sheet gelöscht | — |
| P3 Farb-Markierungsmodi im Reader (Wortart, Fragmente, Bestimmtheit, Verneinung, Tempus) | ERLEDIGT | Commit 312b67bf, 5 Modi, WCAG-AA-geprüft | — |
| P3 Lernmodus („Tap to reveal") | ERLEDIGT | Vorbild: `beginnerModeActive`/`toggleBeginnerMode` | — |
| P4 Sarf-Tabellen-Komponente / Verbmatrizen & Bab-Tabellen | ERLEDIGT | `src/features/lexikon/data/paradigmen*.json`, 150 Tabellen in 5 Kategorien, Kapitel Ṣarf zu 100 %, alle 206 Inventareinträge Datenartefakt oder inhaltlich begründet ausgelassen | — |
| P4 Lexikon-Inhalte (Wurzeln, Grammatik, Tajwīd, Konkordanz) | ERLEDIGT | Commit 1dc74421, 1.642 Wurzeln virtualisiert, Konkordanz, Suche mit Diakritika-Normalisierung; Konkordanz-Weg für arabische Eingabe ersatzweise über die Wurzelliste belegt | Konkordanz-Eingabe mit arabischer Tastatur auf echtem Gerät noch nicht geprüft (Emulator überträgt kein Arabisch) |
| P5 Fachbegriffe (14 Sprachen) | ERLEDIGT | 439 Schlüssel je Sprache, Teilbaum `grammatik`, Commit f0c4f735 | — |
| P5 Erklärtexte (82 Lehrtexte, neu formuliert) | ERLEDIGT (alle 14 Sprachen) | Commit 16da880e, 178 verifizierte Koranbelege, `sprachparitaet.test.ts` | — |
| P6 Web-Verifikation (Ersatz für Emulator) | ERLEDIGT | `<scratchpad>\pruefung\`, 33 Screenshots, `BERICHT.md`, alle 12 Prüfwege bestätigt | 2 Kleinbefunde (Farbmodus Fragmente, RTL-Untertitel), siehe Bestandsaufnahme |
| P6 Native Geräte-Verifikation | ERLEDIGT (am echten Gerät) | Gerätefreigabe am frischen Release-Build bestätigt (siehe Bestandsaufnahme), gefundene Fehler behoben, neue Prüfungen abgesichert | Emulator selbst weiterhin ohne Arabisch-Eingabe (siehe Konkordanz-Zeile) |
| P7 Bereich „Gemeinsam beten" | ERLEDIGT (Code), religiöse Prüfung offen | `src/features/gebet-gemeinsam/`, Commit e590d917 | OFFEN.md-Einzelpunkte, USER-TODO Abschnitt 2 |
| P8 TV-Darstellung visuell prüfen | ERLEDIGT | Geräteprüfung fand zwei Schriftfehler (Aufstellungs-Diagramme abgeschnitten, Qibla-Kompass-Beschriftung), beide behoben (siehe „Echte Fehler, die erst die Geräteprüfung fand") | — |
| P9 Auslieferung 1.53.0 (Play + App Store) | ERLEDIGT | `npm run release-check`: Play `production completed` versionCode 79, ASC `WAITING_FOR_REVIEW` Build 79 | — |

## Nächster Schritt zuerst
Ausgeliefert: Play `production completed` (versionCode 80, **1.53.1**), App Store Connect `1.53.0 WAITING_FOR_REVIEW` (Build 79) — **kein Gleichstand**: Build 79 entstand am 06.09. um 06:48 UTC, der Commit mit den klareren Gebetsrufen (`635c86ed`, 44,1 kHz statt 32 kHz) erst um 15:39 UTC. Die wartende Apple-Fassung enthält die Aufnahmen also NICHT. Deshalb wurde **iOS-Build 80 (1.53.1) bereits gebaut und hochgeladen** (Lauf `34053225581`, `UPLOAD SUCCEEDED`, bei ASC `VALID`, Zug 1.53.1). Die laufende Prüfung blieb bewusst unangetastet — ein Rückzug würde die Prüfuhr für die gesamte Koran-/Lexikon-Arbeit neu starten. Nächster inhaltlicher Schritt ist NICHT mehr die Auslieferung, sondern die fünf unten stehenden Restpunkte — allen voran die religiöse Prüfung (Nutzeraufgabe).

## Nächste Schritte
1. **Sobald Apple 1.53.0 freigegeben hat: Version 1.53.1 anlegen, Build 80 anhängen, einreichen.** Build 80 liegt seit 06.09. `VALID` bereit. Apple lässt neben einer laufenden Prüfung keinen zweiten Versionseintrag zu, deshalb erst danach. **Ein Aufruf:** `node scripts/asc-nachreichen.mjs` — prueft den Zustand und tut im Zweifel nichts (Fassung liegt schon an, vorige noch in Pruefung, Build nicht VALID, Notizen fehlen). Play braucht nichts mehr, dort ist 1.53.1 live.
2. Religiöse Prüfung der Fiqh-Inhalte abwarten (NUTZERAUFGABE, `USER-TODO.md` Abschnitt 2). Nicht technisch lösbar.
3. Freigabe für Wort-für-Wort-Bedeutungen in weiteren Sprachen bei QUL/Tarteel einholen (NUTZERAUFGABE, `USER-TODO.md` Abschnitt 3 — Konto anlegen, Lizenzbestätigung einholen; Anfrage liegt fertig formuliert bei).
4. App-Store-Eintrag auf weitere Sprachen erweitern, sobald die laufende 1.53.0-Prüfung abgeschlossen ist (NUTZERAUFGABE, `USER-TODO.md` Abschnitt 4 — aktuell 2 von 13 Sprachen, Texte liegen vor).
5. ~~Historische Store-Textarchive auf dieselbe Sprachkennungs-Falle prüfen~~ **erledigt 06.09.2026.** 15 der 51 Archivdateien trugen unter `tr-TR`/`tr`/`ar`/`es-ES`/`es-MX`/`fr-FR` eine wortgleiche Kopie des englischen Textes: `release-notes` und `whatsnew` der Fassungen 1.32.0–1.35.0, 1.44.0, 1.49.0, 1.50.0 sowie `release-notes-1.49.1`. Diese Schlüssel sind entfernt (Muster wie 1.52.0/1.53.0 — ohne Eintrag zeigt der Laden die Standardsprache). Unangetastet blieben die echten Handübersetzungen: alle `play-notes-*`, `release-notes-1.31.0/1.39.0/1.45.0/1.46.0/1.47.0`, `whatsnew-1.31.0/1.49.1`. Der Prüftest `store-sprachkennung.test.ts` deckt jetzt das ganze Archiv statt nur die laufende Fassung ab: 182 Prüfungen grün (Rückgabewert 0); mit der alten 1.32.0-Datei fiel er mit 4 Fehlern durch (Rückgabewert 1).
6. ~~Worktree entfernen~~ **erledigt 06.09.2026.** Blockiert hatte ihn ein verwaister `npx serve -l 4173 .` vom 05.09., den ein abgebrochener Agent zur Web-Pruefung gestartet hatte. Er war ueber die Kommandozeile nicht auffindbar, weil dort nur `.` steht — erst die vollstaendige Prozessliste nach Startzeit zeigte ihn. Nach dem Beenden liess sich der Ordner sofort loeschen, danach `git worktree prune`. Gleich mit aufgeraeumt: zwei haengende Jest-Laeufe vom 05.09., ein dritter vom 06.09. und zwei Metro-Server abgeschlossener Pruefungen. Die MCP-Server der Werkzeuge stehen in derselben Liste und wurden bewusst nicht angefasst.

## Offene Punkte
1. Religiöse Prüfung der Fiqh-Inhalte durch eine kundige Person — USER-TODO Abschnitt 2. NUTZERAUFGABE, nicht technisch lösbar.
2. Wort-für-Wort-Bedeutungen in weiteren Sprachen — USER-TODO, braucht Konto und Lizenzbestätigung bei QUL. Anfrage liegt fertig formuliert bei.
3. App-Store-Eintrag auf weitere Sprachen — **Werkzeug fertig, wartet auf die naechste Fassung.** `node scripts/asc-sprachen.mjs --notizen store/play-notes-<version>.json`, Trockenlauf ist die Voreinstellung. Gegen 1.53.1: 11 Sprachen sendefaehig, 0 mit Mangel. Farsi, Paschtu und Suaheli fuehrt der App Store nicht (bei Apple erfragt). Apple laesst neue Sprachen nur an einer Fassung in PREPARE_FOR_SUBMISSION anlegen, und sie kommen bewusst nicht an die 1.53.1-Einreichung — elf neue Metadaten-Saetze mit dem Gebetsruf-Fix waeren ein Sammelbrief. Siehe USER-TODO Abschnitt 4.
4. ~~Historische Store-Textarchive~~ erledigt 06.09.2026, siehe „Naechste Schritte" Punkt 5.
5. ~~Worktree~~ erledigt, siehe „Naechste Schritte" Punkt 6.

## Nutzeraufgaben
- Religiöse Inhalte durch eine kundige Person (Imam/Fiqh-kundig) gegenlesen lassen — Abschnitt 2 in `USER-TODO.md` (Repo-Root), mit Dateipfaden (`gebet-gemeinsam/daten.ts`, `pray-along/prayers.ts`, `study/data/fiqh-ibadat.json`, `ki/wissen-gebet-praxis.json`) und den zwei Hadith-Nummern, die nur über Sekundärquellen belegt sind (Sahih Muslim 3006, Sahih al-Bukhari 780).
- Wort-für-Wort-Bedeutungen in weiteren Sprachen freigeben lassen — Abschnitt 3 in `USER-TODO.md`: Konto bei QUL/Tarteel anlegen, sechs dort verfügbare Sprachen (Türkisch, Französisch, Persisch, Indonesisch, Bengali, Urdu) herunterladen, schriftliche Nutzungsanfrage stellen (Text liegt copy-paste-fertig bei). Deutsch und Russisch sind bei QUL ausdrücklich geschützt und daher ausgeschlossen.
- App-Store-Eintrag (App Store Connect) auf weitere Sprachen erweitern — Abschnitt 4 in `USER-TODO.md`: aktuell nur en-US/de-DE von 13 möglichen Sprachen, Texte unter `apps/mobile/store/listing/` liegen bereit; erst nach Abschluss der laufenden 1.53.0-Prüfung anlegen, da Metadaten-Änderungen während einer laufenden Prüfung riskant sind.

## ITMS-90863: Mac-Freigabe abgeschaltet (06.09.2026)

Apple meldete nach dem Hochladen von Build 80 per Mail: `ITMS-90863 — Macs with Apple silicon
support issue`, beanstandetes Symbol
`_$s14ExpoModulesJSI15JavaScriptActorC11runIsolatedyxxyYbACYcXERi_zlFZ` aus
`@rpath/ExpoModulesJSI.framework/ExpoModulesJSI`. Ausdrücklich eine WARNUNG: „Although delivery
was successful" — Build 80 blieb `VALID`, die Prüfung von 1.53.0 war nicht betroffen.

**Ursache:** Das Symbol ist `JavaScriptActor.runIsolated` aus Expos eigenem Framework
`expo-modules-jsi`, nicht aus unserem Code. In den lokal aufgelösten Fassungen (57.0.1 im
pnpm-Speicher, 57.0.3 im Agenten-Speicher) heißt die Funktion noch `assumeIsolated`; der CI-Bau
zieht eine neuere Patch-Fassung mit `runIsolated`. Apple prüft das Binary gegen macOS, weil die
App im App Store Connect für Apple-Silicon-Macs freigeschaltet war (Mindestversion „Automatisch
(macOS 12.0)"). Reparieren lässt sich das Symbol von uns nicht.

**Entscheidung des Nutzers (06.09.2026): Mac-Freigabe abschalten.** In „Preise und
Verfügbarkeit" das Markierungsfeld „Diese App verfügbar machen" unter „Verfügbarkeit auf Apple
Silicon Macs" entfernt und gesichert; nach erneutem Laden der Seite gegengeprüft: Häkchen aus,
macOS-Auswahl ausgegraut. Apple Vision Pro blieb bewusst freigeschaltet — dort läuft die
iOS-Laufzeitumgebung, die Warnung betraf nur macOS.

**Begründung:** App Store Connect wies selbst aus „Die Kompatibilität dieser App mit Apple
Silicon Macs wurde noch nicht bestätigt" — die App wurde nie auf einem Mac geprüft. Die Warnung
bedeutet praktisch, dass sie dort beim Start abstürzen kann. Ein Ladeneintrag ohne belegte
Funktion ist schlechter als kein Eintrag.

**Umkehrbar:** ein Häkchen. Sinnvoll, sobald Expo das Symbol behoben hat UND jemand die App auf
einem echten Apple-Silicon-Mac gestartet hat.

**Nicht geprüft:** Die übrigen Expo-Apps im selben Konto (Vesper, Vortex, Aether, Aegis,
Synapse, BitDojo, NOURI, Dartile, MFC Companion) benutzen dasselbe Framework und dürften
dieselbe Warnung bekommen. Das lag außerhalb des Auftrags.
