# Sprung zu einem weit entfernten Vers — Befund und Rückbau, 2026-09-12

Die Sprung-Mechanik für Fassung 1.54.0 (drei Bauten, drei Geräteabnahmen) wurde
zurückgebaut: `src/features/quran/sprung.ts`, `src/features/quran/sprung.test.ts`
und alle Anbindungen in `src/app/(tabs)/quran/[surah].tsx` sind entfernt, der
Koran-Leser springt wieder genau wie in 1.53.1 (Offset-Schätzung +
250-ms-Nachversuch in `onScrollToIndexFailed`). Dieses Dokument hält fest,
warum das Problem schwer ist, was versucht wurde und woran es scheiterte —
damit der nächste Anlauf nicht wieder bei null anfängt.

## Warum ein Sprung auf Vers 282 überhaupt so lange dauert

Eine FlatList ohne `getItemLayout` kennt die Lage einer Zelle erst, wenn diese
einmal gemessen wurde. VirtualizedList begrenzt den Abstandhalter am
Listenende deshalb ausdrücklich auf die höchste GEMESSENE Zelle ("Without
getItemLayout, we limit our tail spacer to the _highestMeasuredFrameIndex …
to prevent the user for hyperscrolling into un-measured area",
VirtualizedList.js). Weiter als bis dorthin lässt sich nicht scrollen, und
`scrollToIndex` meldet für alles dahinter `onScrollToIndexFailed`.

Ein Sprung auf Vers 282 der Baqara musste die 281 Verse davor also erst
einmal RENDERN. Genau das kostete die Sekunden — nicht der Sprung selbst: am
Release-Bau gemessen 9,9 s ohne und 23,4 s mit Wort-für-Wort, den Großteil
davon als leere Seite. Die 1.53.1-Behandlung schätzte dazu einen Offset und
versuchte es nach einem FESTEN Zeitgeber von 250 ms erneut, was pro Etappe
kaum eine Charge Zellen weiterbrachte.

## Messtabelle (drei Geräteabnahmen, drei Bauten)

| Fall | 1.53.1 (alt) | Bau 81 | Bau 82 | Bau 83 |
|---|---|---|---|---|
| Deep-Link-Kaltstart auf 2:282 | 11,4–13,7 s, kommt an und bleibt | Drift 4/4 | Drift 4/4 | Drift 3/4 |
| Verssuche ohne Wort-für-Wort | 9,7–10,4 s, 3/3 richtig | 3/3 richtig | 2/3 richtig | 3/4 richtig |
| Verssuche MIT Wort-für-Wort | 22–31 s, kommt an | 0/4 kommen an | 4/4 richtig | nur 1/3 richtig |

„Drift" heißt: der Leser landet richtig und die Ansicht springt danach
ungefragt auf einen falschen Vers zurück und bleibt dort. Langsam-aber-richtig
ist besser als schnell-aber-falsch — und die letzte Runde (Bau 83) hat sogar
den einzigen Fall verloren, der in Bau 82 schon sauber war (Deep-Link driftete
in Bau 82 zwar auch schon, aber die einfache Verssuche ohne Wort-für-Wort war
in Bau 82 bei 2/3 — in Bau 83 bei 3/4, während Wort-für-Wort von 4/4 auf 1/3
zurückfiel).

## Was versucht wurde und woran es jeweils scheiterte

**Grundidee (Bau 81, Commit `2ea68433`):** Für die Dauer des Sprungs bekommen
die übersprungenen Verse einen leeren Platzhalter in der Höhe, die die Liste
selbst als Durchschnitt gemessen hat (statt eines festen Schätzwerts). Die
Liste kann sie dann in einem Durchgang messen, ohne arabischen Satz,
Übersetzung, Tajwid-Farben und Wort-für-Wort-Zeilen aufzubauen. Nur ein
schmales Band um den Zielvers wird echt gerendert. Zwei Phasen: `grob`
(Platzhalter überall außer Band, bis `scrollToIndex` das Ziel erreicht) und
`fein` (Ziel + Band + alles darunter wird echt).

- **Platzhalter in gemessener Durchschnittshöhe während des Sprungs** — die
  Grundidee selbst. Funktionierte für den Fall, der vorher schon am
  schlechtesten war (Wort-für-Wort: kam in Bau 81 in 0/4 Läufen überhaupt an),
  aber die erste Fassung von `fein` ließ beim Umschalten ALLE Platzhalter
  gleichzeitig fallen, auch die oberhalb des Ziels. Die dort neu gerenderten
  echten Karten sind höher als ihr Platzhalter und schieben den Zielvers nach
  unten — bei Wort-für-Wort (zwei- bis dreimal so hohe Zellen) so stark und
  über so viele Layout-Wellen verteilt, dass ein fester Nachzieh-Zeitraum von
  1,5 s nicht reichte: die letzte Welle kam später, der Sprung löste sich VOR
  ihr auf, niemand zog danach noch nach. Ergebnis Bau 81: Deep-Link driftete
  in 4/4 Läufen auf Vers 260–266, Wort-für-Wort kam in 4/4 Läufen über 150 s
  hinweg GAR NICHT an.

- **Frist statt festem Zeitraum, Platzhalter oberhalb stehen lassen (Bau 82,
  Commit `ab8ef0a7`):** Zwei Korrekturen gegen den Bau-81-Befund. Erstens
  bleiben die Platzhalter OBERHALB des Ziels stehen, bis auch dort Ruhe
  eingekehrt ist (Ziel/Band/unterhalb werden beim Eintritt in `fein` sofort
  echt, das schiebt den Zielvers nicht nach unten). Zweitens endet das
  Nachziehen nicht mehr nach fester Zeit, sondern 600 ms nach der letzten
  Höhenänderung ("Ruhe"). Ergebnis: der Wort-für-Wort-Fall (der schwerste)
  kam jetzt in 4/4 Läufen an, in 5,9–7,9 s statt vorher gar nicht — aber der
  Deep-Link driftete weiterhin auf Vers 261–266 (4/4), und die einfache Suche
  landete in 1 von 3 Läufen acht Verse zu früh.

- **Aufdecken statt Abbrechen beim sichtbaren Platzhalter (Bau 83, Commit
  `f7139dd3`):** Ursache des verbliebenen Bau-82-Befunds: wurde in der Phase
  `fein` eine Zelle sichtbar, die noch Platzhalter ist (Leser gerät dorthin
  auch PROGRAMMATISCH — Mitlesen, Suche, Mini-Player, ohne eigenen Wisch),
  löste `onViewableItemsChanged` den GANZEN Sprung auf statt nur den Bereich
  aufzudecken. Damit fielen wieder alle Platzhalter oberhalb auf einen
  Schlag weg, und derselbe Aufruf hatte gerade den Nachzieh-Takt beendet, der
  das hätte auffangen sollen — der Leser blieb so weit oberhalb des Ziels
  stehen, wie der Inhalt gewachsen war. Die Korrektur: dieser Fall deckt nur
  noch den Bereich oberhalb auf und spannt dieselbe Ruhefrist neu, das
  Festhalten am Ziel läuft weiter. Ergebnis laut Auftragstabelle: der
  Deep-Link verbesserte sich nur auf 3/4 Drift (vorher 4/4), und
  ausgerechnet der in Bau 82 sauber gelöste Wort-für-Wort-Fall fiel auf nur
  noch 1/3 richtig zurück — die dritte Runde hat also nicht monoton
  verbessert, sondern an anderer Stelle wieder verschlechtert. Genau das war
  der Anlass für den Rückbau: drei Bauten, drei Abnahmen, und es trägt nicht.

## Verworfener Weg: `initialScrollIndex`

Am Release-Bau gemessen (nicht vermutet): die Liste mit `initialScrollIndex`
neu aufzusetzen, damit ihr Renderfenster direkt am Ziel beginnt. Das landet
in 0,6 s, ist aber nicht stabil — der Abstandhalter vor dem Fenster ist
Ziel-Index × laufende Durchschnittshöhe, und sobald VirtualizedList sein
Fenster nach dem ersten Scroll-Ereignis neu berechnet, bildet es den Offset 0
wieder auf Index 0 ab. In zwei von vier Läufen stand danach der Anfang der
Sure statt des gesuchten Verses, in einem weiteren eine leere Seite. React
Native nennt `getItemLayout` nicht umsonst als Voraussetzung für
`initialScrollIndex`.

## Wohin der nächste Anlauf ansetzen müsste

Die naheliegende Richtung ist `getItemLayout` mit geschätzten Höhen — React
Native nennt das selbst als Voraussetzung für zuverlässiges `scrollToIndex`
(auch für `initialScrollIndex`, s. oben). Der Preis: JEDE Zelle braucht dafür
eine im Voraus bekannte Höhe, aber die Vers-Karten sind 150–900 Punkte hoch,
je nachdem welche Zusatzansichten eingeschaltet sind (Wort-für-Wort, Tafsir,
Umschrift, Tajwid-Farben) und welche Schriftgröße eingestellt ist — eine
Zelle ist also nicht einmal für denselben Vers immer gleich hoch. Eine
Schätzfunktion (Zeichenzahl der Übersetzung, Anzahl arabischer Wörter,
eingeschaltete Zusatzansichten als Multiplikator) wäre nötig, und
`getItemLayout` verträgt Ungenauigkeit besser als der jetzige Ansatz: eine
falsch geschätzte Höhe verschiebt beim ersten Rendern nur die Scrollposition
um die Differenz, sie lässt aber keinen Sprung sich auflösen, bevor er
angekommen ist, und sie braucht keine Platzhalter-Zellen, keine
Sprung-Phasen und keine Ruhe-Fristen. Das ist der eigentliche Vorteil
gegenüber allen drei Bauten hier: die Komplexität wandert aus dem
Screen (Zustandsautomat, drei Zeitgeber-Arten, Sichtbarkeits-Abfangen) in
eine einzige, reine Höhenschätzfunktion, die sich isoliert testen lässt.
Trotzdem keine Garantie: eine schlecht kalibrierte Schätzung könnte bei sehr
langen Suren wieder spürbare Sprünge beim Ankommen verursachen. Das
müsste am Gerät gemessen werden, nicht vermutet.

## Was über alle drei Bauten hielt

Eine einzelne Verbesserung aus dieser Runde hat sich in allen drei Abnahmen
bewährt: dass beim Hochscrollen keine leeren Flächen mehr auftraten (das
automatische Aufdecken von Platzhaltern, sobald sie ins Bild gerieten). Diese
Verbesserung ist mit dem Rückbau der gesamten Mechanik gegenstandslos
geworden — es gibt ohne Platzhalter auch keine leeren Flächen mehr
abzufangen —, ist hier aber der Vollständigkeit halber festgehalten: der
nächste Anlauf sollte, welchen Weg er auch nimmt, densel­ben Anspruch
mitbringen, dass ein Leser beim Hochscrollen nie eine leere Fläche sieht.
