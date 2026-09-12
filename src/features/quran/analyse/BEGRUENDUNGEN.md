# Regelkatalog: Begründungen für die Wortanalyse

> Entwurfsdokument. Keine Code-Änderung — Grundlage für eine spätere Umsetzung
> in `wortAnalyseModel.ts`/`grammatik.ts`. Jede Regel unten ist gegen echte
> Korpusdaten geprüft (siehe Methodik), nicht nur aus der Grammatiktheorie
> abgeleitet.

## 0. Methodik und Stichprobe

**Datenquelle:** R2, `https://pub-d0489c0572704285af79896edb72cbed.r2.dev/morphologie/v3/<sure>.json`
(Schema 3, siehe `morphologieTypen.ts`), ohne Zugangsdaten lesbar, plus
`meta.json` (Gesamtstatistik über alle 114 Suren) und `scripts/build-morphologie.mjs`
(Herleitungslogik, insbesondere `parseFeatures()` und `bestimmtheitErgaenzen()`).

**Stichprobe für die Auszählungen in diesem Dokument:** 25 Suren —
1, 2, 3, 4, 6, 7, 9, 12, 16, 17, 18, 19, 20, 24, 27, 36, 41, 55, 56, 67, 76,
96, 112, 113, 114. Bewusst gemischt: sehr kurze frühmekkanische Suren (112–114,
96), lange medinensische Suren mit viel Rechts-/Vertragssprache (2, 9), eine
komplette Erzählsure mit vielen Dialogen und Pronomen-Ketten (12, Yūsuf), und
mehrere mittellange Suren unterschiedlicher Perioden. Insgesamt **36.715 Wörter
/ 60.938 Segmente** von gesamt 77.429 Wörtern / 128.219 Segmenten — **rund 47 %
des gesamten Korpus**, keine Hochrechnung aus wenigen Versen. Alle Zahlen unten
sind aus dieser Stichprobe gezählt (Python-Skript gegen die rohen JSON-Dateien,
kein Sampling innerhalb der Suren). Wo eine Aussage für den GESAMTEN Korpus
bereits anderswo verifiziert ist (v. a. `grammatik.ts`-Kommentare, die alle
128.219 Segmente geprüft haben), ist das ausdrücklich vermerkt und übernommen
statt neu gezählt.

**Wichtiger Fund vorab, der die gesamte Modus-Begründung betrifft:** Beim
Aufbau der Präpositions- und Modus-Tabellen unten wurde ein Bug in
`scripts/build-morphologie.mjs` (Funktion `parseFeatures`, Zeile ~303)
aufgedeckt: Der Code vergleicht den MOOD-Rohwert mit dem String `'SUB'`,
das QAC-Korpus liefert für den Subjunktiv aber `MOOD:SUBJ` (mit angehängtem
`J`). Der Vergleich `wert === 'SUB'` trifft nie zu, jedes subjunktivische Verb
bekommt daher `mood: null` statt `mood: "sub"`. Geprüft: **701 von 701** Fällen
mit `MOOD:SUBJ` im `raw`-Feld haben in der Stichprobe `features.mood === null`
(Beispiel: 12:5:8 `فَيَكِيدُوا۟`, `raw: "...MOOD:SUBJ"`, geparst `mood: null`).
Das ist kein Rand-Sonderfall, sondern trifft **jeden** Mansūb-Auslöser (أَنْ,
لَنْ, لِ, حَتَّى, فاء السببية) im gesamten Korpus. **Vor jeder Modus-Begründung
muss dieser Pipeline-Fehler behoben werden** — siehe Abschnitt „Modus" und
Umsetzungsreihenfolge, Punkt 0.

**Was „geprüft" hier bedeutet:** Für jede Regel wurde 1) die auslösende
Bedingung über alle Wörter/Segmente der Stichprobe ausgewertet, 2) die
Trefferquote (Regel sagt X voraus, Korpus zeigt X) gezählt, 3) mindestens ein
Gegenbeispiel gesucht und, wenn gefunden, mit Sure:Vers:Wort dokumentiert.
Wörter ohne die relevante Auslöse-Bedingung fließen nicht in die Trefferquote
ein (sie sind kein Gegenbeispiel, sondern schlicht nicht betroffen).

**Herkunft ≠ Begründung.** `Herkunft = 'beleg' | 'hergeleitet'` (bereits im
Code) sagt nur, ob ein Wert direkt im QAC-Feature-String stand oder von der
Pipeline per Konvention ergänzt wurde. Das ist eine reine Datenaussage. Eine
**Begründung** im Sinne dieses Katalogs ist immer eine GRAMMATISCHE Aussage
("weil die Präposition X den Dscharr verlangt") — sie kann für einen
`beleg`-Wert genauso nötig sein wie für einen `hergeleitet`-Wert. Beide Achsen
bleiben in der UI getrennt sichtbar.

---

## 1. Fragment/Segmentrolle

Grundlage: `fragmentRolle()` in `grammatik.ts` — bereits vollständig
regelbasiert und gegen den gesamten Korpus (nicht nur die Stichprobe) verifiziert
(NEG exakt 2688, DET exakt 8377, IMPV exakt 78, IMPN exakt 2 — siehe
Kopf-Kommentare in `grammatik.ts`). Hier nur die Übersetzung in
Begründungssätze; keine neue Ableitung nötig.

| Rolle | Auslöser | Begründungssatz | Belegbarkeit |
|---|---|---|---|
| Verneinung | `segment.pos === 'NEG'` | „{segment} ist die Verneinungspartikel {form} — sie macht aus der Aussage danach eine Verneinung." | Korpus (POS-Tag) |
| Konjunktion | `segment.pos === 'CONJ'` | „{segment} verbindet dieses Wort mit dem, was davor steht, und überträgt normalerweise dessen grammatischen Status." | Korpus (POS-Tag) + klassische Regel (Huruf al-ʿAtf) |
| Präposition | `segment.pos === 'P'` | „{segment} ist eine Präposition — das Wort direkt danach steht deshalb im Dscharr (siehe Kasus-Abschnitt)." | Korpus (POS-Tag) + klassische Regel |
| Artikel | `segment.pos === 'DET'` | „{segment} ist der bestimmte Artikel — er macht dieses Wort bestimmt (Maʿrifa)." | Korpus (POS-Tag, s. u. Bestimmtheit) |
| Pronomen-Suffix | `segment.kind === 'suffix' && segment.pos === 'PRON'` | „{segment} ist ein angehängtes Pronomen — je nachdem, an welche Wortart es angehängt ist, ist es entweder Objekt (an ein Verb) oder Besitzer (an ein Nomen)." | Korpus (Segmentart + POS-Tag) |
| Fragepartikel | `segment.pos === 'INTG'` | „{segment} leitet eine Frage ein." | Korpus (POS-Tag) |
| Stamm | `segment.kind === 'stem'` | „{segment} ist der Wortstamm — er trägt die Grundbedeutung." | Korpus (Segmentart) |
| Sonstiger Harf / sonstiges Affix | Fallback | „{segment} ist eine Partikel mit einer spezielleren Funktion — siehe {posTag}." | Korpus (POS-Tag), Fallback ehrlich als Sammelkategorie markiert |

**Trefferquote:** 100 % — dies ist keine Wahrscheinlichkeitsaussage, sondern
eine direkte, erschöpfende Fallunterscheidung über die 45 im Korpus
vorkommenden POS-Tags (bereits in `grammatik.ts` gegen alle 128.219 Segmente
geprüft, kein Tag liefert `null`). Ein „Gegenbeispiel" kann es hier per
Konstruktion nicht geben — nur die generischen Sammelkategorien
(`sonstigerHarf`/`sonstigesAffix`), die absichtlich nicht mehr behaupten, als
die Daten hergeben.

**Fallback:** Für `sonstigerHarf`/`sonstigesAffix` zeigt die App den rohen
POS-Tag-Namen (`grammatik.posTags.<TAG>`) statt einer erfundenen
Spezialrolle — genau das bestehende Verhalten in `wortAnalyseModel.ts`
(`ROLLE_HAT_EIGENEN_EINTRAG`).

---

## 2. Wortart (Ism / Fiʿl / Harf)

Grundlage: `wortart()` in `grammatik.ts`, ebenfalls bereits vollständig
regelbasiert (45/45 POS-Tags abgedeckt, siehe Kopf-Kommentar zu IMPN/IMPV
oben — inklusive der beiden dokumentierten Sonderfälle).

**Begründungssatz:** „{wort} ist ein {wortart}, weil das Korpus-Tag {pos}
dieser Wortart zugeordnet ist." — reicht bei den allermeisten Tags, weil die
Zuordnung selbst schon die Erklärung IST (z. B. `N` = Nomen). Bei den beiden
dokumentierten Grenzfällen lohnt sich ein ausführlicherer Satz, weil die
Zuordnung nicht selbsterklärend ist:

- **IMPN** (`مِسَاسَ` 20:97:10, `هَآؤُمُ` 69:19:7): „{wort} sieht aus wie ein
  Befehl, ist aber grammatisch ein Nomen (اسم فعل الأمر) — es trägt keine
  einzige Person-/Zeit-/Modus-Markierung, wie es ein echtes Verb hätte."
  Belegbarkeit: Korpus (Merkmalskombination) + klassische Grammatik (Ibn
  Mālik, Alfiyya). Trefferquote: 2/2 im GESAMTEN Korpus (bereits vollständig
  geprüft, kein Stichprobenrest offen).
- **IMPV** (78 Belege, z. B. 10:58:6): „{segment} ist NICHT das Verb selbst,
  sondern eine eigene Partikel (Lām al-Amr) davor, die aus einem Präsensverb
  einen indirekten Befehl macht." Trefferquote: 78/78 im gesamten Korpus,
  ausnahmslos als eigenes PREFIX-Segment (bereits verifiziert).

**Fallback:** `wortart()` liefert `null` nur für ein im Korpus nicht
vorkommendes POS-Tag — kann bei den aktuellen 45 Tags nicht auftreten, bleibt
aber als Schutz gegen zukünftige Schema-Änderungen bestehen. Fallback-Text:
„Wortart nicht bestimmbar (unbekanntes Korpus-Tag {pos})."

---

## 3. Kasus (Nominativ/Rafʿ, Akkusativ/Nasb, Genitiv/Dscharr)

### 3.1 Grundregel

**Auslöser:** `segment.features.case` (`'nom' | 'acc' | 'gen'`), IMMER ein
direkter Korpus-Beleg — im Gegensatz zu Bestimmtheit ist Kasus im QAC-Korpus
nie eine reine Konvention, sondern steht explizit im Feature-String
(`NOM`/`ACC`/`GEN`-Token).

**Begründungssatz (Grundform):** „{wort} steht im {Kasusname} ({arabischer
Name})." — das ist die einzige Aussage, die IMMER sicher ist. Alles Weitere
(„… weil Präposition X" / „… weil Objekt des Verbs Y" / „… erkennbar an der
Kasra-Endung") ist eine ZUSÄTZLICHE Begründung, die NUR unter den unten
geprüften Bedingungen sicher ist.

### 3.2 Kasus ↔ Satzrolle (`syntax.relation`) — wo es funktioniert und wo nicht

Zentrales Ergebnis dieser Prüfung: **`syntax.relation` allein sagt NICHT
zuverlässig den Kasus voraus.** Die App darf den Kasus AUSSCHLIESSLICH aus dem
`case`-Feld selbst lesen (das ist immer ein `beleg`) und `relation` nur als
ZUSÄTZLICHE, erläuternde Funktionsangabe verwenden — niemals umgekehrt aus der
Relation auf einen Kasus schließen. Trefferquoten aus der Stichprobe
(Wort → case-tragendes Stammsegment, sofern vorhanden):

| Relation | klass. Rolle | Gesamt | passender Kasus | Anteil | wichtigste Abweichung |
|---|---|---|---|---|---|
| `Subj` | Fāʿil (Subjekt) | 1172 | nom: 1012 | 86,4 % | 155× kein Kasus sichtbar (Pronomen/Mabni), 3× gen, 2× acc — z. B. 27:60:12 `حَدَآئِقَ` mit `acc` |
| `Obj` | Mafʿūl bihi (Objekt) | 3482 | acc: 2276 | 65,4 % | 1057× kein Kasus sichtbar (Pronomen-Objekt), 109× nom, 40× gen — z. B. 12:33:3 `ٱلسِّجْنُ` mit `nom` (im Kontext eindeutig Mubtadaʾ, keine Objekt-Deutung — vermutlich Abweichung der zugrunde liegenden NoorBayan-Dependenzsyntax von der klassischen Analyse) |
| `Poss` | Muḍāf Ilayh | 1996 | gen: 1572 | 78,8 % | 374× kein Kasus sichtbar (Pronomen als Muḍāf Ilayh), 35× nom, 15× acc — u. a. Diptot-Eigennamen wie `يُوسُفَ` |
| `Pred` | Ḫabar (Nominalsatz) | 1342 | nom: 825 | 61,5 % | 509× kein Kasus sichtbar (Ḫabar ist oft ein Satz oder eine Präpositionalphrase ohne eigenen Kasus-Kopf) |
| `Pass` | Nāʾib al-Fāʿil | 146 | nom: 114 | 78,1 % | 32× kein Kasus sichtbar |
| `cog` | Mafʿūl Muṭlaq | 151 | acc: 149 | 98,7 % | 2× nom (Randfälle) |
| `Spec` | Tamyīz | 147 | acc: 142 | 96,6 % | — |
| `Adj` | Sifa (Attribut) | 1311 | **kein Kasus dominiert** | nom 371 / acc 325 / gen 249 / keiner 366 | **Per Definition falsch, Kasus aus Relation zu erraten** — ein Adjektiv trägt IMMER denselben Kasus wie sein Bezugswort, welcher das auch sei |
| `App` | Badal (Apposition) | 285 | **kein Kasus dominiert** | gen 48 / acc 65 / nom 61 / keiner 111 | Gleicher Grund wie bei `Adj` — Badal übernimmt den Kasus des Ersetzten |

**Konsequenz für den Regelkatalog:** Nur bei `Subj`/`Poss`/`Pass`/`cog`/`Spec`
lohnt sich ein zweiter Begründungssatz „… weil es {Relation} ist" — UND NUR,
wenn `case` tatsächlich den erwarteten Wert trägt (die App muss die
Übereinstimmung bei jedem einzelnen Wort selbst prüfen, nicht pauschal aus der
Relation ableiten). Bei `Obj`/`Pred` ist die Mehrheit richtig, aber die
Fehlerquote (9–13 % bei vorhandenem Kasus, dazu 30–38 % ganz ohne Kasus) ist zu
hoch für eine unbedingte Aussage — die App muss auch hier live vergleichen.
Bei `Adj`/`App` ist eine Kasus-Begründung aus der Relation **grundsätzlich
falsch** und darf nicht gebaut werden; richtig ist stattdessen: „{wort} trägt
denselben Kasus wie {Bezugswort}, weil es dessen {Adj: Attribut / App:
Apposition} ist."

### 3.3 Präpositionen und ihre Rektion (Dscharr)

**Methodik:** Alle Wörter mit `syntax.relation === 'gen'` in der Stichprobe,
regierende Präposition aufgelöst über `syntax.head` (zeigt bei einer als
Präfix angehängten Präposition auf das Wort selbst, bei einer eigenständigen
Präposition auf deren Wortposition — beides gegen die Rohdaten verifiziert,
siehe `build-morphologie.mjs`, `bestimmtheitErgaenzen`-Nachbarcode und die
`Poss`-Kopf-Logik). Präpositionstext diakritikabereinigt. **19 verschiedene
Präpositions-Schreibungen** in der Stichprobe gefunden (Langformen mit/ohne
Maddah, z. B. `فِي`/`فِىٓ`, separat gezählt, unten zusammengeführt):

| Präposition | Bedeutung | Belege gesamt | davon `case:gen` | Trefferquote | Beispiel (Sure:Vers:Wort) |
|---|---|---|---|---|---|
| مِن (min) | von/aus | 1162 | 1141 | 98,2 % | 113:2:2 `شَرِّ` |
| بِ (bi) | mit/durch | 1278 | 820 | 64,2 %* | 1:1:1 `بِسْمِ` |
| لِ (li) | für | 1176 | 388 | 33,0 %* | 1:2:2 `لِلَّهِ` |
| فِي (fi) | in | 543 | 511 | 94,1 % | 113:4:5 `ٱلْعُقَدِ` |
| عَلَى (ʿalā) | auf | 353 | 298 | 84,4 % | 12:11:8 `يُوسُفَ` (Diptot, s. u.) |
| إِلَى (ʾilā) | zu | 186 | 172 | 92,5 % | 12:46:20 `ٱلنَّاسِ` |
| عَن (ʿan) | über/von | 102 | 95 | 93,1 % | 12:23:7 `نَّفْسِهِۦ` |
| كَ (ka) | wie | 142 | 30 | 21,1 %* | — |
| حَتَّى (ḥattā) | bis | 52 | 1 | **2,0 %** — siehe Warnung unten | 12:35:11 `حِينٍ` |
| مَعَ (maʿa) | mit (zusammen) | 1 | 1 | 100 % (zu kleine Stichprobe) | 2:43:7 `ٱلرَّٰكِعِينَ` |
| تَ / وَ (Schwur-Bi) | bei (Schwur) | 11 | 11 | 100 % | 12:73:2 `تَٱللَّهِ` |

`*` Bei بِ, لِ und كَ ist die „fehlende" Kasra-Kasus-Markierung in der
überwiegenden Mehrheit der Rest-Fälle **kein Regelbruch**, sondern folgt
daraus, dass das regierte Wort ein Pronomen, Relativ-, Interrogativ- oder
Demonstrativpronomen ist — also **Mabni** (siehe `de-nomen.json`-Eintrag
`mabni`): grammatisch steht es trotzdem im Dscharr, zeigt das aber nicht an
der Endung. Aufschlüsselung geprüft:
- بِ, 458 „kasuslose" Fälle: 261× Pronomen-Suffix (`بِهِۦ`), 158× Relativ
  (`بِمَا`), 20× die Konjunktion أَنَّ nach بِ (`بِأَنَّهُمُ` — dort ist gar
  kein Nomen im Dscharr, sondern ein Harf-Nasb-Satz), 12× Subordinator, 6×
  Demonstrativ, 1× Interrogativ.
- لِ, 788 „kasuslose" Fälle: 689× Pronomen-Suffix (`لَّهُۥ`), 78× Relativ
  (`لِلَّذِى`), 16× Interrogativ (`لِمَ`), 3× Demonstrativ, 2× Subordinator
  (`لِكَىْ`).
- كَ, 112 „kasuslose" Fälle: 63× Demonstrativ (`كَذَٰلِكَ`), 36×
  Subordinator (`كَمَآ`), 13× Relativ (`كَمَن`).

**Wichtige Warnung — حَتَّى ist NICHT zuverlässig eine Kasus-Rektion:** Von
52 Wörtern, die über `syntax.head` als „von ḥattā regiert" markiert sind,
tragen **48 ein Verb** (`pos: V`), kein Nomen — z. B. 12:66:6 `تُؤْتُونِ`,
17:34:10 `يَبْلُغَ`. ḥattā leitet hier einen Nebensatz mit einem
Mansūb-Verb ein (klassisch: ḥattā als Subordinator vor dem Muḍāriʿ, siehe
`mudariMansub` im Verb-Lexikon), NICHT eine Genitivverbindung. Die Relation
`gen`/„مجرور" im zugrunde liegenden NoorBayan-Datensatz ist hier ein
Sammelbegriff für „von diesem Wort abhängig", nicht spezifisch „im
Genitiv". **Regel: Bevor die App „Dscharr wegen Präposition X" begründet,
MUSS sie prüfen, dass das regierte Wort ein Ism ist (`wortart(pos) ===
'ism'`) — ist es ein Fiʿl, ist die Präpositions-Begründung für den Kasus
falsch und darf nicht gezeigt werden.** Bei ḥattā vor einem Verb ist die
richtige Begründung stattdessen (sobald der Mood-Bug aus Abschnitt 0 behoben
ist): „{wort} steht im Nasb (Mansūb), weil حَتَّى im Sinne von 'bis dass' ein
Verb im Muḍāriʿ regiert."

**Kasra-Endung vs. abstrakter Kasus (Diptot-Falle):** Der Korpus markiert bei
`case: gen` NUR den ABSTRAKTEN grammatischen Kasus, nicht, ob die Endung
tatsächlich als Kasra geschrieben ist. Beleg: 2:49:5 `فِرْعَوْنَ` trägt
`case: "gen"` (als Muḍāf Ilayh nach `آلِ`), endet aber sichtbar auf Fatha
(`raw: "...|M|GEN"`, Text `فِرْعَوْنَ`) — ein klassischer Diptot
(fremdsprachlicher Eigenname). Quantifiziert an allen singularischen
Ism-Stammsegmenten mit `case` gesetzt (N/ADJ/PN, `number: sg`) in der
Stichprobe: Die END-Vokal-Diakritik stimmt beim Dscharr nur in **91,3 %**
(4051/4435) mit der erwarteten Kasra/Kasratan überein; **8,7 % (384 Fälle)**
zeigen stattdessen Fatha — weit überwiegend Diptot-Eigennamen (`يَعْقُوبَ`,
`إِبْرَٰهِيمَ`, `يُوسُفَ`, `مِّصْرَ` — 12:6:13/20/21, 12:7:4). Beim Akkusativ
liegt die Übereinstimmung bei 98,3 % (3629/3692), beim Nominativ nur bei
89,5 % (2862/3197) — dort allerdings meist aus einem anderen, harmlosen
Grund: ein angehängtes Possessivpronomen der 1. Person (ي) verlangt IMMER
eine Kasra direkt davor, unabhängig vom Kasus des Nomens selbst (`رَبِّى`
19:4:2 im Akkusativ, `رَبِّ` 1:2:3 als Muḍāf — beide enden auf Kasra, obwohl
nicht beide im Dscharr stehen). **Konsequenz: Die App darf „… erkennbar an
der Kasra-Endung" NICHT pauschal zu jeder Dscharr-Begründung hinzufügen** —
der Korpus enthält kein Diptot-Flag, mit dem sich das vorab ausschließen
ließe. Sicher ist NUR die abstrakte Aussage „{wort} steht im Dscharr"; der
Zusatz zur sichtbaren Endung ist nur zulässig, wenn zusätzlich geprüft wurde,
dass das Wort kein bekannter Diptot-Typ ist (fremder Eigenname, Muster
مَفَاعِل/مَفَاعِيل, Farbadjektiv أَفْعَل) UND kein Possessivsuffix trägt.

### 3.4 Fallback

Wenn `case === null` (Pronomen, Mabni, Partikel-Rest ohne eigenen Kasus):
„Für {wort} liegt im Korpus kein Kasus-Merkmal vor — das ist normal bei
unveränderlichen Wortformen (Mabni, siehe eigener Lexikon-Eintrag) oder bei
Wörtern, die grammatisch keinen Kasus tragen." Niemals einen Kasus raten.

---

## 4. Modus (Indikativ/Marfūʿ, Subjunktiv/Mansūb, Jussiv/Majzūm)

**Blocker (siehe Abschnitt 0): Der MOOD:SUBJ-Parsing-Bug muss vor jeder
Modus-Begründung behoben sein**, sonst zeigt die App bei JEDEM subjunktivischen
Verb (Mansūb) fälschlich „Indikativ (Grundzustand)" an — eine erfundene,
grammatisch falsche Aussage, genau das, was die rote Linie ausschließt.

Nach der Reparatur gilt (Konvention bereits in `de-verb.json` beschrieben und
gegen die Stichprobe geprüft):

| Modus | Auslöser | Trefferquote (Stichprobe, nach Bugfix simuliert) | Begründungssatz |
|---|---|---|---|
| Marfūʿ (Grundzustand) | `raw` enthält kein `MOOD:`-Token | 8663/9446 V-Stämme (91,7 %) | „{wort} steht im Grundzustand (Marfūʿ) — kein vorangehendes Wort verlangt eine andere Endung." |
| Majzūm (Jussiv) | `MOOD:JUS` im Rohtag | 783/9446 (8,3 %), korrekt geparst als `mood: 'juss'` | „{wort} steht im Jussiv (Majzūm), weil {vorangehendes Wort, z. B. لَمْ/إِنْ/لَا النَّاهِية} das verlangt." — DAFÜR muss die App das VORANGEHENDE Wort im Vers prüfen (Text-Match auf لَمْ/إِنْ/لَا nach Diakritika-Entfernung, oder besser: `pos === 'NEG'` mit Form لم, `pos === 'COND'`, `pos === 'PRO'` — siehe Verneinungs-Abschnitt in `grammatik.ts`). Die reine Modus-Angabe selbst braucht dafür KEINEN Nachbarwort-Zugriff. |
| Mansūb (Subjunktiv) | `MOOD:SUBJ` im Rohtag (nach Bugfix: `mood: 'sub'`) | 701 Belege in der Stichprobe, aktuell 0/701 korrekt geparst (0 %) — **der zu behebende Fall** | „{wort} steht im Subjunktiv (Mansūb), weil {vorangehendes Wort, z. B. أَنْ/لَنْ/لِ/حَتَّى/فاء السببية} das verlangt." Gleiche Einschränkung: Auslöser-Wort muss zusätzlich identifiziert werden. |

**Belegbarkeit:** Korpus (`beleg`, sobald korrekt geparst) für den reinen
Modus-Wert; die Zuordnung „warum genau dieser Modus" (welche Partikel davor)
ist eine ZUSÄTZLICHE Aussage, die auf klassischer Grammatik beruht und einen
Blick auf das/die vorangehende(n) Wort(er) braucht — dafür existiert noch
keine fertige Funktion in `grammatik.ts`; sie müsste die Auslöser-Partikeln
(أَنْ, لَنْ, لِ, كَيْ, حَتَّى, لَمْ, لَمَّا, إِنْ + Schwestern, لَا
an-Nāhiya, Lām al-Amr) über deren `pos`-Tags identifizieren, NICHT über reinen
Text-Vergleich (siehe die dokumentierte لن/لينت-Falle in `grammatik.ts`,
Abschnitt Verneinung — derselbe Fallstrick gilt hier).

**Fallback:** Ist keine der drei Bedingungen erfüllt (z. B. Verb im Māḍī oder
Imperativ, wo Modus grammatisch nicht zutrifft), zeigt die App „Modus nicht
zutreffend" statt eines Wertes — `mood` ist dann bereits `null` im Korpus,
kein Sonderfall nötig.

---

## 5. Bestimmtheit (Maʿrifa/Nakira)

**Kernbefund der Stichprobe:** In den 25 Suren ist **jeder einzige**
`state: "definite"`-Wert als `hergeleitet` markiert (9510 von 9510) — **null**
sind direkte Korpus-Belege. Das bestätigt exakt den Kommentar in
`build-morphologie.mjs`: „Konvention: DEF kommt nie vor." Nur `indefinite`
(4136 Fälle) ist ein echter `beleg` (explizites `INDEF`-Token). Das ändert
nichts an der Verlässlichkeit der Begründung — die vier Herleitungswege sind
klassische Grammatik ohne dokumentierte Ausnahme — aber es bedeutet: **die
App darf bei Bestimmtheit niemals „weil das Korpus das explizit so
kennzeichnet" sagen**, sondern muss immer den konkreten Herleitungsgrund
nennen.

Vier Auslöser, in der Stichprobe gezählt (9510 hergeleitete `definite`-Fälle
insgesamt):

| Ursache | Auslöser (maschinennah) | Anteil | Begründungssatz |
|---|---|---|---|
| Artikel أَل | Wort hat ein PREFIX-Segment mit `pos === 'DET'` | 3572 (37,6 %) | „{wort} ist bestimmt, weil es den Artikel ال trägt." |
| Possessivsuffix | Wort hat ein SUFFIX-Segment mit `pos === 'PRON'`, UND das Stamm-Segment ist `N`/`ADJ`/`PN` | 2474 (26,0 %) | „{wort} ist bestimmt, weil es das angehängte Pronomen {suffix} trägt — ein Possessivpronomen macht ein Nomen automatisch bestimmt." |
| Eigenname (PN-Tag) | `segment.pos === 'PN'` | 1907 (20,1 %) | „{wort} ist bestimmt, weil es ein Eigenname ist — Eigennamen sind von sich aus bestimmt." |
| Muḍāf-Stellung (Iḍāfa) | ein ANDERES Wort im selben Vers hat `syntax.relation === 'Poss'` und `syntax.head` zeigt auf dieses Wort | 1557 (16,4 %) | „{wort} ist bestimmt, weil es Muḍāf vor dem bestimmten {headWort} steht — die Bestimmtheit wird vom zweiten Wort der Genitivverbindung übernommen." |

**Belegbarkeit:** Alle vier Regeln beruhen auf klassischer arabischer
Grammatik ohne Ausnahme (Artikel, Possessivpronomen, Eigenname, Iḍāfa-Kette)
UND sind über die Segment-/Syntaxstruktur direkt nachprüfbar — höchste
Belegbarkeitsstufe dieses Katalogs. Für die Muḍāf-Regel muss die App (wie
`build-morphologie.mjs` es bereits tut) ALLE Wörter des Verses kennen, nicht
nur das einzelne Wort — bei `wortAnalyseModel.ts` ist das bereits der Fall
(`relationAnzeige` bekommt `verseWords` übergeben).

**Trefferquote:** Da die Herleitung selbst schon die Definition der
Bestimmtheit im QAC-Modell IST (keine externe Wahrheit, an der man sie
prüfen könnte), gibt es hier keine „Fehlerquote" im selben Sinn wie bei
Kasus/Relation — wohl aber einen dokumentierten Widerspruchsfall: Wenn ein
Segment bereits explizit `INDEF` trägt UND gleichzeitig die Muḍāf- oder
Possessiv-Bedingung erfüllt, wird das in `build-morphologie.mjs` als
`stats.widersprueche` gezählt, NICHT überschrieben (Vorrang: expliziter
Korpus-Wert schlägt Herleitung). Für den gesamten Korpus liegt diese Zahl in
`meta.json` nicht separat ausgewiesen — **offener Punkt**: vor Auslieferung
sollte geprüft werden, ob `meta.json` diese Widerspruchszahl führt oder ob sie
nur beim Pipeline-Lauf geloggt wird; falls letzteres, sollte sie ergänzt
werden, damit die Reader-Begründung im Widerspruchsfall ehrlich „uneindeutig"
statt einer der beiden Werte zeigen kann.

**Fallback:** Keine der vier Bedingungen erfüllt und kein explizites `INDEF`
→ `state === null` (829 Fälle in der Stichprobe, meist Wörter ohne Kasus/
Numerus überhaupt, z. B. reine Harf-nahe Nomen). Anzeige: „Bestimmtheit für
{wort} nicht bestimmbar."

---

## 6. Genus (männlich/weiblich)

**Grundregel:** `features.gender` ist bei Nomen fast immer `beleg` (direkt
aus dem `M`/`F`-Token im Feature-String).

**Endungsregel Tāʾ marbūṭa (ة):** In der Stichprobe tragen 1016 singularische
N/ADJ-Stammsegmente die Endung ة (nach Diakritika-Entfernung). Davon sind
**1000 (98,4 %)** `gender: f`, **16 (1,6 %)** `gender: m`, 3 ohne Genus-Wert.
Die 16 männlichen Ausnahmen sind reale, benennbare Wörter — kein Rauschen:
`مَرَّةٍ`/`مَرَّةً` (Mal/Vorkommnis), `خَلِيفَةً` (Nachfolger/Statthalter,
2:30:9 — Adam als Referent), `بَسْطَةً` (Fülle), `ذُرِّيَّةٌ` (Nachkommenschaft),
`كَلِمَةٍ` (Wort), `أَمَنَةً` (Sicherheit, `gender: null` statt `m`). Das sind
Wörter, die klassisch als „لفظه مؤنث" (der FORM nach feminin) gelten, deren
Genus-Merkmal im QAC-Korpus aber nach dem inhaltlichen/männlichen Referenten
(bei `خَلِيفَةً`) oder abweichender lexikalischer Konvention gesetzt ist —
**bewusst als bekannte, kleine Ausnahmeklasse dokumentiert, nicht verschwiegen.**
Sichere Formulierung: „{wort} trägt die Endung ة, die üblicherweise weiblich
markiert — hier zeigt das Korpus jedoch {gender}. Bei Wörtern wie خَلِيفَة
weicht das Genus-Merkmal vom sichtbaren Formmerkmal ab (klassisch: `لفظه
مؤنث`، `معناه` richtet sich nach dem Gemeinten)."

**Umgekehrt (die für die App wichtigere Richtung):** Von 1744 `gender: f`
Singular-Wörtern in der Stichprobe tragen **744 (42,7 %) KEINE sichtbare
ة-Endung**. Zwei verschiedene, klar unterscheidbare Ursachen wurden gefunden:

1. **Orthographische Umwandlung ة → ت.** Sobald ein Nomen ein Possessivsuffix
   trägt ODER Muḍāf in einer Iḍāfa ist, wird ة im Korpustext als gewöhnliches
   ت geschrieben (kein Sonderzeichen mehr) — z. B. `نِعْمَتَهُۥ` (2:31:x,
   Possessivsuffix) und `غَيَٰبَتِ` in `غَيَٰبَتِ ٱلْجُبِّ` (12:10:9, Muḍāf ohne
   Suffix). Für die textbasierte Erkennung „endet auf ة" ist das ein blinder
   Fleck — die App darf aus dem BLOSSEN Fehlen der ة-Zeichenform NICHT
   schließen, dass das Wort nicht doch (mit ت-Endung) genau dasselbe
   Formmerkmal trägt.
2. **„Unsichtbar" weibliche Wörter ohne jede Endung**, z. B. `ٱلشَّمْسَ`
   (Sonne, 12:4:11), `ٱلْأَرْضِ` (Erde), `نَّفْسِ` (Seele/Selbst) — klassisch
   gelistete Ausnahmen (Sonne, Feuer, Erde, paarige Körperteile u. a.), bereits
   korrekt im `de-nomen.json`-Eintrag „genus" beschrieben.

**Begründungssatz (positiv, ة vorhanden):** „{wort} ist weiblich — erkennbar
an der Endung ة."
**Begründungssatz (ت nach Suffix/Muḍāf, KEIN neuer Fund nötig, nur ehrlicher
Hinweis):** „{wort} ist weiblich; die ursprüngliche Endung ة erscheint hier
als ت, weil {ein Possessivpronomen angehängt ist / das Wort Muḍāf ist}."
**Begründungssatz (Genus ohne sichtbare Endung):** „{wort} ist weiblich, ohne
dass sich das an der Form ablesen lässt — das gehört zu einer festen Gruppe
'von Natur aus' weiblicher Wörter (siehe Lexikon)." **Kein Versuch, hierfür
eine Herleitung zu erfinden** — die klassische Grammatik selbst nennt diese
Gruppe eine geschlossene Merkliste, kein Bildungsgesetz.

**Kongruenz-Sonderfall (gebrochener Plural):** Bereits in `de-nomen.json`
(„jam-taksir") korrekt beschrieben und mit Korpus-Beleg unterlegt
(`ٱلْعُقَدِ`, 113:4:5, `gender: m` bei grammatisch weiblichem Singular). Für
den Begründungssatz in der Wortanalyse reicht: „{wort} ist ein gebrochener
Plural; er wird bei Verb/Adjektiv wie ein weibliches Einzahlwort behandelt —
unabhängig vom Genus des Singulars."

**Belegbarkeit:** ة-Regel: Korpus (direkt nachprüfbar) + klassische Regel.
Ausnahmeklassen: klassische Grammatik (Merkliste), keine neue Ableitung
möglich — muss als Liste vorliegen, nicht als Algorithmus.

---

## 7. Numerus (Singular/Dual/Plural)

**Grundregel:** `features.number` ist zu >99 % `beleg`, außer der
dokumentierten Singular-Konvention (`number: null` + `gender`/`case` gesetzt
→ `sg` hergeleitet, siehe `parseFeatures`).

| Form | Erkennungszeichen am Wortlaut | Sicher ableitbar? |
|---|---|---|
| Dual | Endung ـَانِ (Rafʿ) / ـَيْنِ (Nasb/Dscharr) | **Ja** — Dual ist ein geschlossenes, produktives Muster ohne Ausnahme im Standardarabisch; `number: 'du'` im Korpus deckt sich damit |
| Gesunder m. Plural (Jamʿ Mudhakkar Sālim) | Endung ـُونَ (Rafʿ) / ـِينَ (Nasb/Dscharr) | **Ja**, bei Personenbezeichnungen/Partizipien |
| Gesunder f. Plural (Jamʿ Muʾannaṯ Sālim) | Endung ـَات | **Ja** |
| Gebrochener Plural (Jamʿ Taksīr) | Wortkern selbst ändert sich, keine feste Endung | **NEIN — nicht aus der Form ableitbar.** Nur der Vergleich mit dem (separat zu lernenden) Singular zeigt es. Die App kann `number: 'pl'` UND `derived`-Flag ausgeben, aber keine Endungs-Begründung liefern. |

**Begründungssatz (Dual/gesunder Plural):** „{wort} trägt die {Dual-/Plural}-
Endung {endung} — daran erkennt man {Numerus}." Belegbarkeit: Korpus + Endung
direkt im Text nachprüfbar.

**Begründungssatz (gebrochener Plural):** „{wort} ist Mehrzahl (das Korpus
zeigt `number: pl`), aber die Form allein verrät das nicht — der Wortstamm hat
sich gegenüber dem Singular verändert (gebrochener Plural), es gibt dafür
keine ableitbare Endungsregel." Ehrlicher Verzicht statt Muster-Rateversuch
(**die im Nomen-Lexikon genannten Muster wie فُعُول/أَفْعَال sind zu
zahlreich und zu ausnahmereich, um sie algorithmisch aus Wurzel+Text
zuverlässig zu erkennen — das wäre eine Wörterbuch-Aufgabe, keine
Grammatik-Ableitung**).

**Belegbarkeit:** Endungsfälle: Korpus + klassische Regel, beide vollständig
deckungsgleich (keine Gegenbeispiele in der Stichprobe gefunden — Dual-/
Sound-Plural-Endungen sind geschlossene Muster). Gebrochener Plural: bewusst
NICHT begründbar, siehe Abschnitt „Was bewusst nicht begründet wird".

---

## 8. Person

**Auslöser:** `features.person` (`'1' | '2' | '3'`), bei Verben in der
Stichprobe **immer** gesetzt (0 von 9446 V-Stämmen ohne Person — Trefferquote
100 %), abgeleitet aus der PGN-Tabelle (`PRON:3MS` etc.) direkt im
Feature-String.

**Begründungssatz:** „{wort} steht in der {Person}. Person — erkennbar an
{Vorsilbe/Endung, je nach Tempus}." Für den konkreten Erkennungshinweis
(welche Vorsilbe/Endung) liegt die Tabelle bereits vollständig in
`de-verb.json` (Eintrag „personenmatrix") vor — hier nur zu übernehmen,
NICHT neu herzuleiten. Beispiel bereits belegt: 1:5:2 `نَعْبُدُ` (Vorsilbe
نَ = 1. Person Plural), 3:123:2 `نَصَرَكُمُ` (nackter Stamm = 3. Person
Singular maskulin).

**Belegbarkeit:** Korpus (`beleg`, 100 % in der Stichprobe) + klassische
Personalendungstabelle (Musterverb نَصَرَ). Kein Gegenbeispiel gefunden.

**Fallback:** Bei Nomen ist `person` strukturell `null` (Ism trägt keine
Person) — kein Sonderfall nötig, `merkmal()` liefert bereits sauber `null`.

---

## 9. Tempus (Māḍī/Muḍāriʿ/Amr)

**Auslöser:** `features.tense`, bei Verben in der Stichprobe **immer**
gesetzt (0/9446 fehlend) — direkter Beleg aus `PERF`/`IMPF`/`IMPV`-Token.

**Begründungssatz:** „{wort} steht in der Vergangenheitsform/
Gegenwarts-Zukunftsform/Befehlsform, weil das Korpus das Tempus-Merkmal
{PERF/IMPF/IMPV} trägt." Zusätzlicher, für Lernende wichtiger Hinweis bei
IMPV: „{wort} ist eine direkte Befehlsform (2. Person) — zu unterscheiden von
Lām al-Amr, einer eigenen Partikel für indirekte Befehle an die 3. Person
(siehe Fragment-Rolle IMPV oben, das ist ein anderer Tatbestand mit
gleichlautendem Tag-Namen)."

**Belegbarkeit:** Korpus, 100 % Trefferquote in der Stichprobe, keine
Ausnahme gefunden. Die inhaltliche Feinheit „لَمْ + Muḍāriʿ bedeutet
Vergangenheit trotz Muḍāriʿ-Form" (bereits in `de-verb.json`, Eintrag
`mudariMajzum`, korrekt beschrieben) betrifft NICHT das Tempus-Merkmal selbst
(das bleibt `imperfect`), sondern eine zusätzliche Bedeutungsebene über die
Verneinungspartikel — sollte in der App als eigener Hinweis bei `NEG`-Form
لم erscheinen, nicht das Tempus-Merkmal verändern.

---

## 10. Genus verbi (Aktiv/Passiv)

**Auslöser:** `features.voice`. In der Stichprobe: 502/9446 V-Stämme (5,3 %)
`beleg` als `passive` (explizites `PASS`-Token), 8944 (94,7 %) `null` — davon
wird laut Konvention in `verbEigenschaften()`/`ismEigenschaften()`-Analogie
KEIN `active`-Wert hergeleitet (anders als bei Bestimmtheit/Verbform gibt es
in `morphologieTypen.ts` keinen dritten Wert „aktiv hergeleitet" — `voice`
bleibt bei Aktiv schlicht `null`). **Das ist ein Modellierungs-Unterschied
zur Verbform-Konvention, den die App-Begründung ausgleichen muss**: „kein
`PASS`-Tag" bedeutet inhaltlich Aktiv, aber `merkmal()` liefert dafür aktuell
`null` (= „Merkmal nicht vorhanden"), nicht `{ wert: 'active', herkunft:
'hergeleitet' }`. Für eine Begründung „ist Aktiv, weil kein PASS-Tag" muss
die UI-Schicht (nicht `grammatik.ts`) diesen Fall gesondert behandeln, sonst
zeigt sie bei jedem Aktiv-Verb schlicht keine Genus-verbi-Zeile.

**Begründungssatz (Passiv):** „{wort} steht im Passiv — erkennbar am
Vokalmuster (u-Vokal auf allen Stammbuchstaben außer dem letzten in der
Vergangenheit, u-Vokal auf dem ersten in der Gegenwart)." Bereits mit echten
Belegen in `de-verb.json` unterlegt (`أُنزِلَ` 2:4:4, `يُولَدْ` 112:3:4).

**Begründungssatz (Aktiv):** „{wort} steht im Aktiv — der Normalfall ohne
besondere Markierung."

**Belegbarkeit:** Korpus, 100 % (kein Gegenbeispiel möglich — binäre
Fallunterscheidung über ein einziges Tag).

---

## 11. Verbform (Bāb I–X)

**Auslöser:** `features.verbForm`. In der Stichprobe: 6054/9446 (64,1 %)
Form I `hergeleitet` (kein Klammerwert im Rohtag → Konvention), 3392
(35,9 %) `beleg` mit explizitem Klammerwert (II–X, auch XII 3× belegt — ein
im Kopf-Kommentar von `grammatik.ts` nicht erwähnter Wert, siehe „offener
Punkt" unten).

**Belegbarkeit der Form-I-Konvention:** Laut Kommentar in
`build-morphologie.mjs` „NUR für TAG=V dokumentiert/verifiziert (7.009/19.356
explizit)" — das heißt, die Konvention „keine Klammer = Form I" wurde beim
Bau der Pipeline stichprobenhaft, nicht für jeden einzelnen der damals
19.356 V-Segmente einzeln von Hand geprüft. Für den Regelkatalog reicht das:
Die Konvention selbst ist in der klassischen QAC-Dokumentation (Abschnitt 7)
festgehalten, keine Erfindung dieser Pipeline.

**Begründungssatz (Form I):** „{wort} ist Verbform I (Grundstamm) — im
Korpus steht dafür KEIN Klammerwert; das ist die Konvention für die
unerweiterte Grundform." Belegbarkeit: Korpus (Abwesenheit als Beleg) +
dokumentierte QAC-Konvention.

**Begründungssatz (Form II–X):** „{wort} ist Verbform {röm. Zahl} — im
Korpus explizit mit ({röm. Zahl}) markiert. Erkennbar an {Formmerkmal, siehe
Tabelle unten}." Die Formmerkmale selbst (Schadda bei II, langes Alif bei
III, Anfangs-Hamza bei IV, تَ-Vorsilbe bei V, و. a.) liegen bereits
VOLLSTÄNDIG und mit Korpus-Belegen in `de-verb.json` vor (Einträge
`form1`–mind. `form5`, laut Dateilänge auch bis `form10`) — hier nur zu
übernehmen.

**Offener Punkt (Gegenbeispiel gefunden):** Die Stichprobe enthält 3
Segmente mit `verbForm: 12` (Rohwert `(XII)`), z. B. root-unabhängig
auffindbar über `ROEMISCH_ZU_ZAHL` in `build-morphologie.mjs`. Weder
`de-verb.json` noch `grammatik.ts`-Kommentare erwähnen Form XII — sie ist in
der klassischen Zehnerliste (I–X) gar nicht vorgesehen. Das ist selten genug
(3 von 9446 V-Stämmen in der Stichprobe, 0,03 %), dass die App dafür einen
ehrlichen Fallback braucht: „Verbform {röm. Zahl} — für diese seltene
erweiterte Form liegt noch keine Beschreibung vor" statt eines Absturzes bei
`grammatik.verbEigenschaften.verbform.formen.12` (Übersetzungsschlüssel
existiert vermutlich nicht). **Muss vor Auslieferung geprüft werden, ob die
Locale-Dateien einen Eintrag für Form XI/XII führen.**

---

## 12. Wurzel und Wurzeltyp

Grundlage: `wurzelTyp()` in `grammatik.ts` — bereits vollständig
regelbasiert und mit realen Korpuszahlen belegt (135/1642 Wurzeln mahmūz,
40/1642 rubāʿī, 1 dokumentierter Sonderfall يوم ohne klassischen Namen). Die
Herleitung selbst ist das Vorbild, das der Auftrag als Maßstab nennt — hier
nur die fehlende Übersetzung in Begründungssätze:

| Kategorie | Auslöser | Begründungssatz |
|---|---|---|
| Ṣaḥīḥ (gesund) | keiner der Radikale ist و/ي, kein Hamza, 2.≠3. Radikal | „Die Wurzel {radikale} ist 'gesund' (ṣaḥīḥ) — keiner ihrer drei Buchstaben gehört zu den unregelmäßig wirkenden Buchstaben و/ي, kein Hamza, keine Verdopplung." |
| Mahmūz | ein Radikal ist bloßes Alif (normalisierter Hamza) | „Die Wurzel {radikale} enthält an Position {pos} ein Hamza (im Korpus als bloßes Alif notiert) — das beeinflusst die Schreibung mehrerer abgeleiteter Formen." |
| Miṯāl | 1. Radikal ist و/ي | „Die Wurzel {radikale} beginnt mit einem schwachen Buchstaben ({radikal}) — das nennt man miṯāl; es beeinflusst v. a. die Muḍāriʿ- und Imperativ-Bildung." |
| Aǧwaf | 2. Radikal ist و/ي | „Die Wurzel {radikale} hat in der Mitte einen schwachen Buchstaben ({radikal}) — aǧwaf, 'hohl'; typischerweise fällt dieser Buchstabe in bestimmten Formen aus (z. B. قَالَ von ق-و-ل)." |
| Nāqiṣ | 3. Radikal ist و/ي | „Die Wurzel {radikale} endet mit einem schwachen Buchstaben ({radikal}) — nāqiṣ, 'defekt'; das beeinflusst v. a. die Endform vieler Formen." |
| Lafīf mafrūq/maqrūn | zwei schwache Radikale (1.+3. bzw. 2.+3.) | „Die Wurzel {radikale} hat gleich zwei schwache Buchstaben — lafīf; entsprechend stärker weicht ihre Formenbildung vom Muster ab." |
| Muḍāʿaf | 2. = 3. Radikal | „Die Wurzel {radikale} hat einen verdoppelten letzten Radikal ({radikal}{radikal}) — muḍāʿaf; typischerweise verschmelzen diese beiden zu einem Schadda (z. B. مَدَّ von م-د-د)." |
| Rubāʿī | 4 Radikale | „Die Wurzel {radikale} hat vier statt drei Radikale (rubāʿī) — für diese Gruppe gibt es keine eigene Unterteilung in schwach/gesund, die hier nicht verifiziert wäre." |

**Belegbarkeit:** Vollständig regelbasiert aus den Radikalbuchstaben selbst,
klassische arabische Wurzellehre, KEINE Ausnahme möglich (die Funktion deckt
per Konstruktion jede 3- und 4-radikalige Wurzel ab). Die einzige
dokumentierte Grauzone (يوم, Positionen 1+2 schwach, kein klassischer Name)
ist bereits korrekt als zwei Einzelmeldungen statt eines erfundenen
Sammelnamens gelöst — für die Begründung reicht: „Diese Wurzel trägt
gleichzeitig die Merkmale {miṯāl} UND {aǧwaf}, weil zwei benachbarte
Radikale schwach sind — dafür gibt es keinen eigenen klassischen Namen (der
klassische Lafīf-Name gilt nur für die Kombination 1.+3. oder 2.+3.)."

**Trefferquote:** 100 % der 1642 Wurzeln im GESAMTEN Korpus (bereits
verifiziert, kein Stichprobenrest offen) — Position dieser Regel im Katalog
daher ganz oben in der Umsetzungsreihenfolge (siehe unten).

---

## 13. Satzrolle (Iʿrab / `syntax.relation`)

Ergänzt die bereits vorhandene `relationAnzeige()`-Logik (Name + Info je
Relation, kaana-/inna-Familie bereits mit `{wort}`-Platzhaltern gelöst) um
den fehlenden vierten Baustein — WARUM diese Relation an dieser Stelle
zutrifft:

- **Für alle Relationen** ist der Kopf (`syntax.head`) bereits vorhanden und
  im UI verfügbar (`relationAnzeige`, `headText`). Die naheliegendste,
  MASCHINENNAH einfachste Begründung ist rein strukturell: „{wort} ist
  {Relationsname} zu {headText}" — das ist immer korrekt, weil es nur die
  vorhandene Dependenzkante wiedergibt, keine neue Behauptung aufstellt.
- **Eine INHALTLICHE Begründung** („weil es nach dem Verb steht" / „weil es
  im Rafʿ steht") ist NUR für die Relationen aus Abschnitt 3.2 zulässig, bei
  denen Kasus und Relation tatsächlich überwiegend zusammenpassen
  (`Subj`→nom, `Poss`→gen, `Pass`→nom, `cog`/`Spec`→acc) — UND NUR, wenn der
  Kasus des konkreten Wortes das im Einzelfall bestätigt (siehe 3.2). Bei
  `Obj`/`Pred` ist die Mehrheit richtig, aber die App muss den Kasus trotzdem
  live prüfen, nicht pauschal annehmen. Bei `Adj`/`App` ist „weil Adjektiv"
  keine Kasus-Begründung, sondern eine Kongruenz-Begründung (siehe 3.2).
- **`root`/`link`/`sub`/`cond`/`circ`/`conj`** sind in der Stichprobe
  überwiegend kasuslos (5328/5890, 3616/4106, 1949/1959, 764/771, 231/552,
  1385/2454) — das sind strukturelle Relationen (Satzverknüpfung,
  Bedingungssatz-Einleitung, Relativsatzanschluss), bei denen eine
  Kasus-Begründung von vornherein nicht zu erwarten ist; hier bleibt die
  Begründung rein strukturell („{wort} leitet den Antwortsatz/Bedingungssatz
  ein" usw., bereits in `de-partikel-syntax.json` mit echten Belegen
  vorhanden).

**Fallback:** `word.syntax === undefined` (Basmala-Bestandteile,
kopfGetilgtesWort/kopfAndererVers-Fälle mit `head: null`) → bereits ehrlich
im bestehenden Code gelöst („keine Syntaxdaten" bzw. `headText: null`, KEIN
Raten). Für die reinen `head: null`-Fälle (3556+1066 = 4622 Segmente im
GESAMTEN Korpus, exakt wie im Auftrag benannt) muss die Begründung zusätzlich
sagen, WARUM kein Kopf da ist — die Pipeline unterscheidet bereits
`kopfGetilgtesWort` (elidiertes Bezugswort) von `kopfAndererVers`
(Bezug außerhalb des Verses), diese Unterscheidung geht aber beim Schreiben
von `morphologieTypen.ts` (`head: number | null`) verloren — **die App kennt
den Unterschied zwischen beiden Ursachen aktuell nicht**, weil nur `head` und
nicht der Grund gespeichert wird. Offener Punkt für eine spätere
Schema-Erweiterung (nicht Teil dieses Entwurfs, nur hier dokumentiert, weil
er die ehrliche Fallback-Formulierung einschränkt: aktuell kann die App nur
sagen „kein Bezugswort im Vers auflösbar", nicht ob das am getilgten Wort
oder am Versübergriff liegt).

---

## 14. Was bewusst NICHT begründet wird — und warum

1. **Gebrochener Plural (Jamʿ Taksīr) — welches Muster, welcher Singular.**
   Es gibt kein Bildungsgesetz, aus dem sich das algorithmisch ableiten
   ließe; jedes Wortpaar muss lexikalisch (Wörterbuch/Lexikon-Eintrag)
   hinterlegt sein. Fallback: „Mehrzahl laut Korpus, Form nicht ableitbar."
2. **Ob eine Kasra-Endung wirklich als Kasra geschrieben ist (statt Fatha bei
   Diptoten).** Der Korpus liefert nur den abstrakten Kasus, kein
   Diptot-Flag. Ohne eine zusätzliche, hier nicht vorhandene Diptot-Erkennung
   (fremde Eigennamen, Muster مَفَاعِل/مَفَاعِيل, أَفْعَل-Adjektive) wäre die
   Behauptung „erkennbar an der Kasra" in 8,7 % der Fälle (Stichprobenwert)
   schlicht falsch.
3. **Bedeutung, Absicht oder Auslegung eines Verses.** Ausdrücklich nicht
   Gegenstand dieses Katalogs (Auftrag) — jede Begründung bleibt auf Form
   und Grammatik beschränkt, auch wenn die zitierten Beispielverse
   inhaltlich sprechend sind.
4. **Warum ausgerechnet DIESE Relation (`Poss`/`Obj`/…) zutrifft**, wenn das
   der eigentlichen syntaktischen Analyse (NoorBayan-Dependenzparse)
   entstammt. Die App kann die vorhandene Kante NENNEN und ihre TYPISCHEN
   Kasus-Konsequenzen einordnen (Abschnitt 3.2/13), aber nicht selbst
   herleiten, warum der Parser genau dieses Wort als Kopf gewählt hat — das
   wäre eine Behauptung über eine fremde, hier nicht integrierte
   Analyse-Engine, keine ableitbare Grammatikregel. Bei den gefundenen
   Abweichlern (z. B. 12:33:3 `ٱلسِّجْنُ` als `Obj` trotz `case: nom`) zeigt
   die App im Zweifel den WIDERSPRUCH ehrlich („Korpus markiert dieses Wort
   als {Relation}, der Kasus {case} passt aber nicht zum erwarteten Muster")
   statt ihn stillschweigend zu glätten.
5. **Modus-Begründung, solange der MOOD:SUBJ-Bug nicht behoben ist** (siehe
   Abschnitt 0/4) — eine Auslieferung mit diesem Fehler würde bei jedem
   Mansūb-Verb eine falsche grammatische Aussage zeigen. Das ist genau der
   Fall, den die rote Linie des Auftrags ausschließt.
6. **Welche Präposition „eigentlich gemeint" ist, wenn ein Wort mehrere
   mögliche Lesarten hat** (z. B. `مَا` als Verneinung vs. Relativpronomen,
   bereits in `de-partikel-syntax.json` exemplarisch mit Gegenbeispiel-Paar
   2:9/2:29 gelöst) — hier reicht es, dem bestehenden Muster zu folgen
   (Funktion über `pos`-Tag lesen, NIE über Text-Vergleich, siehe die
   dokumentierte lan/lam-Falle in `grammatik.ts`).
7. **Verbform XI und höhere Klammerwerte**, für die weder Lexikon-Eintrag
   noch Formmerkmal-Beschreibung vorliegen (siehe Abschnitt 11, 3 Belege in
   der Stichprobe) — ehrlicher Fallback statt erfundener Formbeschreibung.

---

## 15. Umsetzungsreihenfolge

Kriterium: Wortabdeckung in der Stichprobe (je höher, desto mehr Nutzer
sehen die neue Begründung) gegen Risiko einer falschen Aussage (je niedriger,
desto sicherer sofort auslieferbar).

0. **Blocker zuerst, vor jeder neuen Begründung:** MOOD:SUBJ-Parsing-Bug in
   `build-morphologie.mjs` beheben und die Morphologie-Daten neu bauen
   (Schema-Version hochzählen, R2 neu befüllen) — sonst führt Punkt 4
   (Modus) zu falschen Aussagen bei ~7 % aller Verbsegmente (701/9446 in der
   Stichprobe).
1. **Fragment-/Segmentrolle und Wortart** (Abschnitte 1–2): 100 %
   Abdeckung, 100 % Trefferquote, bereits vollständig regelbasiert in
   `grammatik.ts` — nur noch die Begründungssätze in die Locale-Dateien
   eintragen, kein neues Risiko.
2. **Wurzeltyp** (Abschnitt 12): ebenfalls 100 % Trefferquote über den
   gesamten Korpus, betrifft aber nur Wörter mit `root !== null`
   (überwiegend Verben und viele Nomen) — zweite Priorität, weil die Logik
   schon steht und nur sichtbar gemacht werden muss.
3. **Bestimmtheit** (Abschnitt 5): hohe Abdeckung (9510 von 36.715 Wörtern
   in der Stichprobe = 25,9 % aller Wörter sind `definite`), vier klar
   getrennte, ausnahmefreie Ursachen — geringes Risiko, sobald die
   Widerspruchsfälle (offener Punkt in Abschnitt 5) sauber ausgeschlossen
   sind.
4. **Person/Tempus/Genus verbi/Verbform I** (Abschnitte 8–11, Grundfälle):
   100 % bzw. sehr hohe Trefferquote, decken zusammen praktisch jedes Verb
   ab. Verbform-Fallback für seltene Klammerwerte (XI/XII) vorher klären.
5. **Genus/Numerus mit sichtbarer Endung** (Dual, gesunder Plural,
   ة-Endung im Grundzustand): hohe Trefferquote, aber die drei
   dokumentierten Nebenbedingungen (ة→ت-Umwandlung bei Suffix/Muḍāf,
   1.-Person-Suffix neutralisiert Endung, لفظه-مؤنث-Ausnahmeliste) MÜSSEN
   mitgeliefert werden, sonst entstehen in ca. 40 % der `f`-Fälle irritierend
   „fehlende" Begründungen.
6. **Kasus, Grundform ohne Zusatz** („{wort} steht im Dscharr"): sofort
   auslieferbar (reiner Korpus-Wert), aber OHNE den Kasra-Endungs-Zusatz
   (Diptot-Risiko) und OHNE Präpositions-/Relations-Zusatz, bis Punkt 7
   steht.
7. **Präpositionstabelle + Kasus↔Relation-Verknüpfung** (Abschnitt 3.2/3.3):
   höchster Erklärwert für Lernende, aber auch höchstes Restrisiko dieses
   Katalogs — braucht zwingend die Wortart-Prüfung vor der
   Präpositions-Begründung (ḥattā-Falle) und den Live-Abgleich Kasus↔Relation
   statt einer festen Tabelle. Zuletzt umsetzen, dafür mit den meisten Tests.
8. **Modus mit Auslöser-Partikel-Benennung** (Abschnitt 4, zweiter Teil):
   erst nach Punkt 0 UND nach einer eigenen, über `pos`-Tags (nicht Text)
   arbeitenden Auslöser-Erkennungsfunktion, die es heute noch nicht gibt.
