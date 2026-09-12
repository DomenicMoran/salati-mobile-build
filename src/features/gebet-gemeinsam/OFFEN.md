# Offene Punkte — "Gemeinsam beten" (Dschamāʿa)

Bewusst weggelassenes bzw. nur unvollständig belegtes Material. Grundsatz war:
lieber eine Lücke als eine unbelegte oder erfundene Rechtsaussage. Vor dem
Store-Launch mit demselben Verfahren wie bei `pray-along/prayers.ts`,
`guides.json` und `duas.json` religiös gegenprüfen — das gilt für ALLE Inhalte
dieses Features, nicht nur die unten gelisteten.

## Recherche-Einschränkung

Direkter Abruf von sunnah.com (per WebFetch) lieferte durchgehend HTTP 403 —
alle Hadith-Belege stammen aus sunnah.com-Titel-Treffern in der Websuche
(URL + Seitentitel als starkes Signal) bzw. aus mehrfach unabhängig
übereinstimmenden Sekundärquellen (hadithunlocked.com, hadeethenc.com,
Islam-Q&A). Für die meisten verwendeten Nummern war das Signal eindeutig
(direkter Titel-Match). Zwei Nummern stützen sich NUR auf Sekundärquellen und
sollten vor Store-Launch nochmal direkt auf sunnah.com nachgeschlagen werden:

- **Sahih Muslim 3006** (Regel `abDreiPersonen`, Jabir b. Abdullah/Jabbar
  b. Sakhr werden vom Propheten ﷺ hinter ihn gestellt, als eine dritte Person
  zur Gebetsreihe hinzukommt). Drei unabhängige Sekundärquellen nennen genau
  diese Nummer für genau diesen Wortlaut; ein direkter sunnah.com-Abruf war in
  dieser Session nicht möglich.
- **Sahih al-Bukhari 780** (Regel `amin`, "Sagt der Imam Amin, sagt Amin").
  Direkter Titel-Treffer auf sunnah.com in der Suche, aber kein Volltext-Abruf
  möglich, um den genauen Wortlaut gegenzulesen.

## Bewusst ausgelassen

- **Basmala-Lautstärke im Gemeinschaftsgebet je Rechtsschule.** Die
  Klassifizierung (hanafitisch: leise, auch wenn der Imam sonst laut
  rezitiert; schafiitisch: Bestandteil der Fatiha, daher laut, wenn die Fatiha
  laut ist; malikitisch/hanbalitisch: in der Fatiha nicht rezitiert) ist in
  der Fiqh-Literatur gut dokumentiert, ließ sich aber nicht mit einer
  einzelnen, sicher nachprüfbaren Hadith-Nummer belegen — die zugrunde
  liegenden Überlieferungen widersprechen sich in Sekundärquellen genau in dem
  Punkt, der hier zählen würde (laut/leise/gar nicht). Deshalb nicht als
  eigene Regel aufgenommen, obwohl im Auftrag als Lückenfüller genannt.
- **Genaue Hadith-Nummer für "Dhuhr und Asr werden leise rezitiert".** Regel
  `lauteUndLeiseGebete` ist inhaltlich unstrittig (durchgehende, nie
  bestrittene Sunna-Praxis, an keiner Stelle der App bisher abweichend
  dargestellt) und mit Quran 17:110 als allgemeinem Beleg zur Tonlage im
  Gebet unterlegt. Ein spezifischerer Hadith-Beleg (z. B. zur Rezitationslänge
  bei Abu Qatada) konnte in der verfügbaren Zeit nicht zuverlässig verifiziert
  werden (Recherche durch ein Sitzungslimit unterbrochen) und wurde deshalb
  nicht ergänzt.
- **Frau als Vorbeterin einer gemischten Gruppe (Mann + Frau).** Nicht Teil
  des Auftrags und unter den Rechtsschulen grundsätzlich strittig auf einer
  anderen Ebene (nicht nur Aufstellung) — bewusst ausgelassen, um das Thema
  nicht in einer Zeile falsch zu verkürzen.
- **Genaue Alters-/Positionsregeln für Kinder in der Reihe** (z. B. ab wann
  ein Junge in der Männerreihe statt bei der Mutter steht). Uneinheitlich in
  den verfügbaren Quellen, deshalb ausgelassen.
- **Masbuq-Verhalten (zu spät zum Gemeinschaftsgebet).** Bereits vollständig
  und belegt in `src/features/ki/wissen-gebet-praxis.json`
  (`masbuq-zu-spaet-zum-gebet`) vorhanden — hier bewusst nicht dupliziert,
  nur in der Aufgabenstellung erwähnt, nicht erneut aufgenommen.

## Kein neuer Fund, nur Cross-Check

- Freitagsgebet, Moschee-Etikette, getrennte Bereiche, Frauenreihen hinter
  Männerreihen, Vorbeterin unter Frauen mittig, Frau zu Hause hinter dem
  Vorbeter: vollständig in `study/data/fiqh-ibadat.json` (`fiqh-13`) —
  im Screen nur verlinkt.
- Sutra des Imams gilt für die ganze Reihe hinter ihm: vollständig in
  `study/data/fiqh-ibadat.json` (`fiqh-11`) — im Screen nur verlinkt.
