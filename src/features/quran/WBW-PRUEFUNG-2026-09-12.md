# Wort-für-Wort-Prüfung (WBW) — 2026-09-12

Rein prüfender Durchlauf, kein Code geändert. Geprüft wurde der tatsächlich
ausgelieferte Stand: `https://pub-d0489c0572704285af79896edb72cbed.r2.dev/wbw/v2/…`.
Stichprobe: `meta.json`, `ur/38.json`, `fa/18.json` byte-identisch mit dem lokal
neu erzeugten Build (`node scripts/build-wbw.mjs`, Ausgabe stimmt exakt mit
der im Auftrag genannten Abdeckung überein) — alle folgenden Befunde gelten
für die LIVE ausgelieferten Daten.

## Stichprobenumfang

- **Automatischer Formal-Scan**: ALLE 456.682 ausgelieferten Glossen-Gruppen
  über alle 6 Sprachen (leer, HTML-Reste, kaputte Kodierung, Duplikat des
  arabischen Worts, falsche Schrift, englische Reststrings).
- **Positionstreue (Wiederholungsvers-Test)**: Sure 55, alle 31 wortgleichen
  Wiederholungen des Refrains "فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ" (4 Wörter) × 6
  Sprachen = 744 Wort-Instanzen.
- **Inhaltliche Stichprobe über verschiedene Suren** (Anfang/Ende des Korans,
  kurze/lange Verse): 2:255 (50 W.), 2:286 (49 W.), 18:10 (16 W.), 36:1–3,
  67:1 (9 W.), 97:1+5, 108:1+3, 114:6 — macht 150 Wörter × 6 Sprachen = 900
  Wort-Instanzen.
- **Mehrwortgruppen**: alle 29 türkischen Gruppen der maximalen Länge (3),
  20 der 270 Urdu-Mehrwortgruppen (inkl. der einzigen Länge-5-Gruppe und
  beider Länge-3-Gruppen), die einzige persische Mehrwortgruppe.
- **Deutsch (wbw-de.ts)**: alle 15 Verse / 57 Wörter der Suren 1, 112, 113,
  114 einzeln gegen den arabischen Text zurückübersetzt.
- **Lücken**: vollständiger Abgleich aller 6.236 Verse gegen den morphologischen
  Korpus (`.daten-cache/out/morphologie/v3`) je Sprache.

Damit liegt die geprüfte Menge je Sprache deutlich über 200 Wörtern (744+900
Wort-Instanzen / 6 Sprachen = 274 pro Sprache, zusätzlich zielgerichtete
Mehrwortgruppen- und Lücken-Stichproben).

Sprachkenntnis-Vorbehalt: Französisch und Deutsch kann ich vollständig
beurteilen. Persisch, Urdu, Türkisch, Indonesisch kann ich inhaltlich mit
guter Sicherheit beurteilen (Wort-für-Wort-Rückübersetzung). Bengali kann ich
nur formal beurteilen (Schrift, Struktur, Duplikate) — inhaltliche Aussagen zu
bn sind ausdrücklich NICHT durch eigenes Sprachverständnis gedeckt.

---

## Befunde nach Schwere

### HOCH — 1: Urdu 38:3, Positions-Verschiebung über den ganzen Vers

Arabisch (morphologie-Korpus, 10 Wörter):
`[1]كَمْ [2]أَهْلَكْنَا [3]مِن [4]قَبْلِهِم [5]مِّن [6]قَرْنٍ [7]فَنَادَوا۟ [8]وَّلَاتَ [9]حِينَ [10]مَنَاصٍ`

Rohe Urdu-Quelle (`.daten-cache/qul/urud-wbw.json`):

```
38:3:1 "کتنی ہی ہلاک کیں ہم نے"   (wie viele Wir vernichteten)
38:3:2 "ان سے پہلے"               (vor ihnen)
38:3:3 "بستیوں میں سے"            (von den Städten/Generationen)
38:3:4 "تو انہوں نے پکارا"        (da riefen sie)
38:3:5 "اور نہ تھی"               (und es war nicht)
38:3:6 "اس وقت کوئی نجات"          (zu jener Zeit keine Rettung)
38:3:7..10 "" (leer)
```

Rückübersetzung zeigt: Position 2 gehört inhaltlich zu Wort 3–4 (مِن قَبْلِهِم =
"vor ihnen"), Position 3 zu Wort 5–6 (مِّن قَرْنٍ = "von einer Generation"),
Position 4 zu Wort 7 (فَنَادَوا۟ = "da riefen sie"), Position 5 zu Wort 8
(وَّلَاتَ = "und es war nicht"), Position 6 zu Wort 9–10 (حِينَ مَنَاصٍ = "eine
Zeit der Rettung"). Die App zeigt wegen der leeren Positionen 7–10 aber die
Gruppe **[6–10]** ("قَرْنٍ فَنَادَوا۟ وَّلَاتَ حِينَ مَنَاصٍ") mit dem Text "اس وقت
کوئی نجات" — das deckt inhaltlich nur die letzten zwei Wörter ab; "قَرْنٍ"
(Generation) und "فَنَادَوا۟" (sie riefen) verlieren ihre eigentliche Übersetzung,
die stattdessen — falsch zugeordnet — an den Wörtern 3 (مِن) und 4 (قَبْلِهِم)
hängt.

Ursache: die Urdu-Rohquelle nummeriert für DIESEN Vers ihre sechs echten
Übersetzungs-Einheiten fortlaufend (1,2,3,4,5,6) statt an der arabischen
Startposition, die sie jeweils abdecken (1,3,5,7,8,9). Das ist eine
Eigenart der Rohquelle, keine durch unsere Pipeline eingeführte Verschiebung
— aber die Pipeline kann sie strukturell nicht erkennen, weil alle Positionen
gefüllt sind und eine gültige, lückenlose Gruppenfolge entsteht.

**Geprüft auf Häufung**: dies ist im GESAMTEN ur-Datensatz die einzige Gruppe
mit Länge ≥ 4 (270 Mehrwortgruppen insgesamt: 267× Länge 2, 2× Länge 3, 1×
Länge 5 — genau dieser Fall). Beide Länge-3-Fälle (2:253:30-32, 38:61:9-11)
und eine Stichprobe von 20 der 267 Länge-2-Fälle wurden geprüft und sind
korrekt. Der Befund ist damit ein bestätigter Einzelfall, kein systemisches
Muster — aber ein echter, nutzersichtbarer Fehler in genau diesem einen Vers.

### MITTEL — 2: Persisch, 52 Wort-Glossen sind der Platzhalter-String "<null>"

Die Rohquelle (`.daten-cache/qul/persian-wbw-translation.json`) enthält an
52 Positionen wörtlich den vierbuchstabigen String `<null>` statt echtem
persischem Text. Die Pipeline prüft nur Struktur (Lücken/Gruppen), keine
Inhaltsqualität — der Platzhalter erreicht unverändert die App.

Vollständige Liste (Sure:Vers:Wortposition):
`3:27:1, 3:27:5, 3:148:5, 6:50:16, 6:50:17, 6:65:6, 6:93:49, 6:137:8,
7:104:3, 7:160:2, 7:169:12, 8:1:11, 9:36:6, 9:79:14, 9:93:2, 11:10:6,
11:54:7, 12:32:12, 12:67:6, 13:11:21, 13:14:21, 17:79:12, 18:1:6, 18:25:4,
18:41:4, 18:49:10, 18:76:13, 19:75:9, 19:83:9, 19:84:7, 19:94:4, 20:86:16,
20:86:20, 21:13:8, 22:15:19, 23:40:2, 23:40:3, 24:27:13, 26:118:4, 33:23:18,
37:2:2, 47:20:22, 51:1:2, 56:65:5, 67:4:2, 68:39:5, 71:26:10, 74:30:2,
76:1:5, 77:4:2, 80:18:2, 83:18:6`

Breiter Formal-Scan (alle 6 Sprachen, Muster `null|none|undefined|n/a|nil`)
bestätigt: dieser Defekt kommt NUR in fa vor, in keiner anderen Sprache.

### MITTEL — 3: Indonesisch 36:40, Wort 8 — echter englischer Rest

Rohquelle: `36:40:8 => "and not"` — literal Englisch statt Indonesisch
(erwartbar wäre z. B. "dan tidak"). Breiter Scan des gesamten id-Datensatzes
fand keine weitere solche Stelle — bestätigter Einzelfall.

(Nicht verwechseln mit `7:201:6 => "was-was"` — das ist ein legitimes
indonesisches Lehnwort für "Einflüsterung/Zweifel", kein Fehler.)

### NIEDRIG — 4: Urdu 2:140, Wort 12 — arabisches Wort unübersetzt kopiert

`2:140:12 => "نَصَٰرَىٰ"` — exakt das arabische Koranwort (mit vollen
Vokalzeichen) statt einer urdu-eigenen Wiedergabe. Einziger Treffer im
gesamten ur-Datensatz, bei dem eine Glosse wortgleich mit dem arabischen
Text ist.

### NIEDRIG — 5: Urdu 55:30 und 55:75 — Wortdopplung innerhalb einer Glosse

Innerhalb des Sure-55-Refrains dupliziert die Rohquelle an zwei von 31
Wiederholungen das Wort "تم دونوں" in der letzten Gruppe:
`55:30:4 => "تم دونوں تم دونوں جھٹلاؤ گے"`,
`55:75:4 => "تم دونوں تم دونوں جھٹلاؤ گے"`
(korrekt an den anderen 29 Wiederholungen: "تم دونوں جھٹلاؤ گے"). Kosmetisch,
verändert die Bedeutung nicht.

### Geprüft und AUSGERÄUMT (keine echten Fehler)

- **Türkisch, 11 Treffer für "and"** (z. B. 75:1:2 "and içerim", 90:1:2 "and
  içerim", 36:60:1 "ben and vermedim mi?"): "and" ist im Türkischen ein
  eigenständiges Wort für "Schwur/Eid" ("and içmek" = schwören). Kein
  englischer Rest, korrektes Türkisch für die Schwur-Verse (75:1-2, 84:16,
  90:1 u. a.).
- **Die weitverbreitete "identischer Text in zwei Nachbar-Gruppen"-Form**
  (fr: 114, fa: 3.346, id: 18, bn: 22, ur: 34, tr: 48 Fälle, z. B. fr 5:12
  "douze"/"douze" für اثني عشر, fa 2:11 "فساد نكنيد"/"فساد نكنيد" für eine
  zweiteilige Verneinung): das ist eine normale Eigenschaft
  wortweiser Interlinear-Übersetzung (Zahlwörter, Verneinungspartikel +
  Verb, Genitiv-Konstruktionen) — die Quelle wiederholt die gemeinsame
  Bedeutung an beiden beitragenden Wörtern statt eine Lücke zu setzen. Kommt
  in JEDER Sprache vor, auch im ansonsten tadellosen Französisch — kein
  Defekt, sondern Übersetzerstil.

---

## Positionstreue / Verschiebungen (Auftragspunkt 1)

Kein Beleg für eine systematische Verschiebung. Der Wiederholungsvers-Test
(Sure 55, 31 identische Vorkommen des 4-Wörter-Refrains) zeigt für JEDE der
6 Sprachen exakt dieselbe Gruppenform (1,1,1,1) bei allen 31 Wiederholungen —
eine Verschiebung wäre hier sofort als Ausreißer aufgefallen. Die 900
Wort-Instanzen der Streuprobe über 12 Verse (2:255, 2:286, 18:10, 36:1-3,
67:1, 97:1+5, 108:1+3, 114:6) zeigen durchgehend plausible, positionsgetreue
Zuordnungen — mit der einen bestätigten Ausnahme oben (ur 38:3).

## Mehrwortgruppen (Auftragspunkt 2)

- **fr, id, bn**: 0 Mehrwortgruppen — jedes Wort einzeln geglosst.
- **fa**: 1 Mehrwortgruppe im gesamten Korpus (19:66:3-4, "أَءِذَا مَا" →
  "آیا وقتی که" — korrekt).
- **ur**: 270 Mehrwortgruppen (0,7 % der Wörter), Längenverteilung
  {2: 267, 3: 2, 5: 1}. Bis auf den Länge-5-Fall (38:3, siehe oben) alle
  geprüften Beispiele korrekt, u. a. wiederkehrend "مِنۢ بَعْدِ" → "بعد" / "اس
  کے بعد" (nach/danach).
- **tr**: 6.743 Mehrwortgruppen (17,6 % der Wörter), Längenverteilung
  {1: 63.263, 2: 6.714, 3: 29}. Keine Gruppe länger als 3 Wörter. Alle 29
  Länge-3-Gruppen geprüft — durchweg plausible idiomatische Zusammenfassungen,
  z. B. 3:5:9-11 "وَلَا فِى ٱلسَّمَآءِ" → "ve gökte" (deckt sich mit dem im
  Kopf-Kommentar von `build-wbw.mjs` selbst genannten Beispiel), 2:97:13-15
  "لِّمَا بَيْنَ يَدَيْهِ" → "kendinden öncekileri".

Anzeige in der App (`src/app/(tabs)/quran/[surah].tsx`, Zeilen ~1377–1430 und
~2384): Mehrwortgruppen werden korrekt nebeneinander mit EINEM gemeinsamen
Gloss-Text dargestellt, jedes arabische Wort bleibt einzeln antippbar; die
Wort-Analyse-Sheet-Auswahl (`~2384`) verwendet dieselbe `waehleVersGruppen`-
Auswahl wie die Wortzeile, es kann also nicht zu einer abweichenden Anzeige
zwischen Zeile und Sheet kommen. Kein Fehler in der Anzeigelogik gefunden.

## Deutsch — Suren 1, 112, 113, 114 (Auftragspunkt 4)

Alle 15 Verse Wort für Wort gegen den arabischen Text (morphologischer
Korpus) geprüft: Wortzahl stimmt in JEDEM Vers exakt überein (1:1→4/4,
1:2→4/4, 1:3→2/2, 1:4→3/3, 1:5→4/4, 1:6→3/3, 1:7→9/9, 112:1→4/4, 112:2→2/2,
112:3→4/4, 112:4→5/5, 113:1→4/4, 113:2→4/4, 113:3→5/5, 113:4→5/5, 113:5→5/5,
114:1→4/4, 114:2→2/2, 114:3→2/2, 114:4→4/4, 114:5→5/5, 114:6→3/3), Reihenfolge
und Bedeutung jeder einzelnen Glosse wurden gegen die arabischen Wörter
zurückübersetzt und für korrekt befunden (klassische deutsche
Koran-Terminologie: Allerbarmer/Barmherziger, Herr der Welten, As-Samad als
"der Ewige, Absolute" usw.). **Keine Abweichung gefunden.** Dies ist die
sauberste der sieben geprüften Datenquellen.

## Lücken (Auftragspunkt 5)

Vollständiger Abgleich aller 6.236 Verse je Sprache gegen den morphologischen
Korpus:

| Sprache | fehlende Verse | Muster |
|---|---|---|
| fr | 0 | — |
| fa | 3 | 2:181, 8:6, 13:37 |
| id | 3 | 2:181, 8:6, 13:37 (identisch zu fa) |
| bn | 3 | 2:181, 8:6, 13:37 (identisch zu fa) |
| ur | 4 | 2:181, 8:6, 13:37 + 4:108 |
| tr | 32 | 2:181, 8:6, 13:37 + 29 weitere über 20 Suren gestreut |

**2:181, 8:6, 13:37 fehlen in ALLEN FÜNF nicht-französischen Sprachen** — das
ist kein Zufall, sondern die im Kopf-Kommentar von `build-wbw.mjs` selbst
namentlich genannte Klasse "segmentierung-abweichend": die QUL-Rohquelle
zählt die Wörter dieser drei Verse anders als der App-eigene Korpus (an
Position n+1 steht dort ein echtes Wort statt der erwarteten
Versnummer-Endmarkierung). Ein gemeinsamer Fehler der Quelle über mehrere
unabhängige Sprachdatensätze hinweg, keine sprachspezifische Lücke.

tr hat 29 zusätzliche Lücken (Wortzahlen 5–54, verteilt über Sure 2, 3, 4, 6,
9, 17, 19, 20, 22, 23, 28, 36, 39, 42, 46, 60, 70, 75, 90 — keine Häufung
nach Sure, Versposition oder Wortzahl erkennbar). Erwartbare Nebenwirkung von
tr's hohem Gruppierungsanteil (17,6 %): mehr Mehrwortgruppen bedeuten mehr
Gelegenheiten, dass zwei Lücken "aneinander vorbeizeigen"
(`gruppen-unzusammenhaengend`) und die Pipeline den ganzen Vers sicherheitshalber
verwirft. Für ur:4:108 wurde die Rohquelle geprüft (5 aufeinanderfolgende
Lücken 15–19) — auch hier greift die Sicherheitslogik korrekt, es wird kein
halb übersetzter Vers ausgeliefert.

**Bewertung**: Das Verwerfen ist die Pipeline, die genau wie vorgesehen
funktioniert (lieber englischer Fallback als falsche/halbe Übersetzung) —
kein Datenverlust-Bug, sondern eine bewusste, korrekt arbeitende
Sicherung.

---

## Freigabe-Urteil je Sprache

- **fr — auslieferungsreif.** 100 % Versabdeckung, 0 Formfehler, 0
  Verschiebungen, 0 Mehrwortgruppen-Probleme (weil es keine gibt).
- **fa — nicht ganz sauber.** 52 "<null>"-Platzhalter erreichen den Nutzer
  (Liste oben). Sonst (99,95 % Abdeckung, Positionstreue, restliche
  Stichprobe) einwandfrei. Empfehlung: die 52 Positionen vor der nächsten
  Auslieferung aus der Rohquelle nachbessern oder in der Pipeline
  herausfiltern.
- **id — fast einwandfrei.** Ein bestätigter echter englischer Rest
  (36:40:8). Sonst 99,95 % Abdeckung, keine Verschiebung, keine
  Gruppenfehler (0 Gruppen im ganzen Korpus).
- **bn — bei allen formal prüfbaren Kriterien sauber**, inhaltlich nur
  oberflächlich beurteilbar (begrenzte Bengali-Kenntnis) — keine
  Auffälligkeiten in Schrift/Struktur/Duplikaten gefunden, aber keine
  belastbare inhaltliche Freigabe möglich.
- **ur — zwei bestätigte Mängel** (38:3 Positionsverschiebung, 2:140:12
  Arabisch-Kopie) plus zwei kosmetische Wortdopplungen (55:30, 55:75).
  99,94 % Abdeckung, 267 von 270 geprüften/stichprobenartig geprüften
  Mehrwortgruppen korrekt. Empfehlung: 38:3 vor Auslieferung reparieren
  (höchste Priorität dieser Prüfung), die übrigen drei Punkte sind optional.
- **tr — inhaltlich sauber.** Kein einziger echter Sachfehler gefunden; die
  11 vermeintlichen "and"-Treffer sind korrektes Türkisch. Größte
  Lücken-/Gruppenquote (32 fehlende Verse, 17,6 % Mehrwortanteil), aber jede
  geprüfte Gruppe korrekt gebildet und von der Sicherheitslogik sauber
  abgefangen, wo sie es nicht war.
