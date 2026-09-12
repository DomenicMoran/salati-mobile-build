// Baut die Wort-für-Wort-Bedeutungen (WBW) in sechs Sprachen zu je einer
// JSON-Datei pro Sprache und Sure unter
// apps/mobile/.daten-cache/out/wbw/v2/<sprache>/<sure>.json.
//
// Quelle: die Wort-für-Wort-Datensätze des Quranic Universal Library (QUL)
// Projekts (qul.tarteel.ai, Glossen von QuranWBW), je Sprache ein flaches
// JSON-Objekt "sure:vers:wortposition" -> String. Erwartet werden sie unter
// .daten-cache/qul/ (Dateinamen siehe SPRACHEN unten); heruntergeladen wird
// hier nichts.
//
// WORTGRUPPEN — der Kern dieses Skripts. Eine Glosse deckt nicht immer genau
// ein arabisches Wort: wo mehrere Wörter zu EINER Bedeutung verschmelzen,
// markiert die Quelle die mitgemeinten Positionen als Lücke — in der
// JSON-Fassung entweder durch Fehlen des Schlüssels (tr) oder durch einen
// leeren String (ur). Beispiel 2:4: مِن trägt "senden önce" (vor dir), das
// folgende قَبْلِكَ ist die Lücke; die Glosse deckt beide Wörter. Eine Lücke
// ist also KEIN fehlendes Datum, sondern die Fortsetzung einer Nachbarzelle.
//
// Richtung der Zugehörigkeit: über die Wortart des Lücken-Wortes im eigenen
// Korpus, gemessen am STAMM-Segment. Vorwärts bindende Wortarten
// (Präpositionen, Konjunktionen, Partikeln — siehe VORWAERTS_BINDEND) gehören
// zur Zelle RECHTS, alles andere zur Zelle LINKS. An den harten Randfällen
// nachgemessen (681 Fälle, null Verletzungen): tr hat 0 Lücken an Position 1
// und 665 an letzter Position, davon 0 vorwärts bindend; ur hat 6 an
// Position 1 (alle 6 vorwärts bindend) und 10 an letzter Position (alle 10
// rückwärts bindend). Ketten werden aufgelöst: zeigt das Ziel selbst auf eine
// Lücke, läuft die Suche in derselben Richtung weiter bis zu einer beglossten
// Zelle. Findet die Wortart-Richtung bis zum Versrand gar keine beglosste
// Zelle, wird in der GEGENRICHTUNG weitergesucht. Das ist keine zweitbeste
// Vermutung, sondern die einzig verbleibende Möglichkeit: die Gruppen decken
// 1..n lückenlos ab, das Wort gehört also zu irgendeiner Gruppe, und in seiner
// Richtung gibt es keine. Belegt an tr 3:5 — nach "ve gökte" an Position 9
// folgen die Lücken 10 (P, bindet rechts) und 11 (N); daraus wird [9,11] =
// وَلَا فِى ٱلسَّمَآءِ.
//
// Ausrichtung am eigenen Korpus: maßgeblich ist IMMER die Wortzahl n eines
// Verses laut .daten-cache/out/morphologie/v3/<sure>.json (6.236 Verse,
// 77.429 Wörter), nie das Positionsmaximum in der QUL-Datei. Vier der sechs
// Dateien (fa, id, bn, ur) hängen an jeden Vers ein Zusatz-Token an Position
// n+1 an — die Versnummer als Endmarkierung, z. B. 1:1:5 = "(1)". Das ist kein
// Wort und wird verworfen (siehe istEndmarkierung).
//
// Wann ein Vers trotzdem ganz WEGFÄLLT (statt Lücken zu raten oder halb
// beglosste Verse auszuliefern):
//   - luecke-ohne-anker: WEDER in Bindungsrichtung NOCH in der Gegenrichtung
//     liegt eine beglosste Zelle — dann ist der Vers gar nicht beglosst.
//   - gruppen-unzusammenhaengend: die Zugehörigkeiten ergeben keine lückenlose
//     Folge von Bereichen (zwei Lücken zeigen aneinander vorbei).
//   - segmentierung-abweichend: an n+1 steht ein echtes Wort statt der
//     Endmarkierung, die Quelle zählt den Vers also anders als der Korpus
//     (2:181, 8:6, 13:37). Das ist etwas anderes als eine Verschmelzung: dort
//     stimmt die Positionszuordnung ab dem Versatz nicht mehr, und geraten
//     wird hier nichts.
//   - gruppe-zu-lang: eine gebildete Gruppe überspannt mehr als
//     MAX_GRUPPENLAENGE Wörter (siehe dort). Fund der Prüfung vom 2026-09-12
//     (WBW-PRUEFUNG-2026-09-12.md, ur 38:3): die Urdu-Rohquelle nummeriert dort
//     ihre sechs echten Übersetzungseinheiten fortlaufend 1..6, statt an der
//     arabischen Startposition, die sie tatsächlich abdecken (1,3,5,7,8,9) —
//     die Positionen 7..10 bleiben deshalb leer und werden von der
//     Lücken-Logik (die das nicht von einer echten Verschmelzung unterscheiden
//     kann) fälschlich alle der letzten Zelle zugeschlagen: eine Gruppe der
//     Länge 5 entsteht, in der zwei arabische Wörter (قَرْنٍ, فَنَادَوا۟) ihre
//     eigentliche Übersetzung verlieren. Über den GESAMTEN Bestand aller 6
//     Sprachen (456.682 gebildete Gruppen) ist 3 Wörter die größte Länge, die
//     inhaltlich geprüft und bestätigt korrekt ist (tr: 29 Fälle, ur: 2 Fälle
//     — siehe Prüfbericht); eine Gruppe der Länge ≥ 4 ist im gesamten Bestand
//     bislang genau einmal aufgetreten, und das ist der oben beschriebene
//     Fehler. Der Schwellwert wirft deshalb nachweislich nur diesen einen Vers
//     hinaus (siehe build-wbw.test.ts).
//   - arabisch-unuebersetzt: der Text einer Gruppe ist zeichengleich mit dem
//     arabischen Wort/den arabischen Wörtern, die sie abdeckt (Korpus-`text`
//     inkl. Vokalzeichen) — die Übersetzung wurde nicht übersetzt, sondern das
//     arabische Original unverändert kopiert (Fund: ur 2:140:12 „نَصَٰرَىٰ").
//     Ein reiner Schriftvergleich (Alphabet = arabisch) würde in ur/fa nichts
//     taugen, weil beide dieselbe Schrift wie der Koran-Text selbst benutzen
//     und dort auch echte, legitime arabische Lehnwörter stehen dürfen — erst
//     der Abgleich GENAU gegen das arabische Wort an GENAU dieser Position
//     unterscheidet eine unübersetzte Kopie von einem eigenständigen Wort, das
//     zufällig identisch aussieht. Über den gesamten Bestand aller 6 Sprachen
//     ist das genau einmal der Fall.
// Dadurch ist alles, was ausgeliefert wird, vollständig — die App braucht
// keine eigene Vollständigkeitsprüfung und kann nie ein halb übersetztes
// Versbild zeigen.
//
// PLATZHALTER statt echtem Text — die Rohquellen markieren "keine eigene
// Übersetzung" nicht einheitlich mit einem fehlenden/leeren Wert. Gefunden
// (WBW-PRUEFUNG-2026-09-12.md, Formal-Scan über alle 6 Sprachen):
//   - fa: 52× der wörtliche String "<null>" statt persischem Text.
//   - fr: 136× das literale "[]" — IMMER unmittelbar neben "après" (die
//     Verschmelzung مِنۢ بَعْدِ = "danach", das französische Pendant zu ur/tr's
//     leerem String für dieselbe Konstruktion). Ohne Erkennung bekäme dieses
//     eine arabische Wort seine eigene, falsche Glosse "[]" statt in der
//     Gruppe mit "après" aufzugehen — deshalb 0 Mehrwortgruppen in fr vor
//     dieser Prüfung, obwohl die Quelle das Muster klar kennzeichnet.
//   - fa/bn: vereinzelt (3 bzw. 9×) eine Zelle aus reiner Satzzeichen-Interpunktion
//     (".", "(", '"') ohne Wortinhalt.
// istPlatzhalter() behandelt jede dieser Formen wie eine Lücke (siehe oben) —
// sie wird der Nachbarzelle zugeschlagen statt als eigene, falsche Glosse
// ausgeliefert zu werden.
//
// Ausführen: cd apps/mobile && node scripts/build-wbw.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const QUELL_DIR = path.join(MOBILE, '.daten-cache', 'qul');
const KORPUS_DIR = path.join(MOBILE, '.daten-cache', 'out', 'morphologie', 'v3');

// Schema- UND Pfadversion. Beides dieselbe Zahl, aus demselben Grund wie bei
// der Morphologie: upload-wbw-r2.mjs liefert mit
// "Cache-Control: public, max-age=31536000, immutable" aus — eine inhaltlich
// geänderte Datei unter derselben URL käme bei Clients und CDN nie an. Jede
// Schema- oder Inhaltsänderung bekommt deshalb ein neues Präfix.
// v1: ein Eintrag je Wort; Verse mit Lücken fielen ganz weg (tr nur 41,9 %).
// v2: [von, bis, Text] je Glosse — Lücken sind Wortgruppen, keine Fehlstellen.
const WBW_VERSION = 2;
const AUSGABE_DIR = path.join(MOBILE, '.daten-cache', 'out', 'wbw', `v${WBW_VERSION}`);

const SUREN = 114;

/** Sprachschlüssel -> Dateiname unter .daten-cache/qul/. */
const SPRACHEN = {
  fr: 'french-wbw-translation.json',
  fa: 'persian-wbw-translation.json',
  id: 'indonesian-word-by-word-translation.json',
  bn: 'bangali-word-by-word-translation.json',
  ur: 'urud-wbw.json',
  tr: 'turkish-wbw-translation.json',
};

/** Wortarten (POS des Stamm-Segments), die sich nach RECHTS binden:
 * Präpositionen, Konjunktionen und Partikeln stehen vor dem Wort, das sie
 * regieren — eine Lücke mit dieser Wortart gehört zur folgenden Glosse.
 * Alles andere (Nomen, Verben, Pronomen, …) bindet nach links. */
const VORWAERTS_BINDEND = new Set([
  'P', 'CONJ', 'SUB', 'NEG', 'INTG', 'COND', 'EMPH', 'REM', 'CERT', 'AMD',
  'ACC', 'PRP', 'SUP', 'EXP', 'INC', 'RES', 'AVR', 'CAUS', 'EQ', 'RET',
]);

/** Ziffern aller vorkommenden Schriften auf ASCII abbilden — die
 * Endmarkierung steht je nach Sprache in arabisch-indischen, erweitert
 * arabisch-indischen (Persisch/Urdu) oder bengalischen Ziffern. */
const ZIFFERN = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/**
 * Ist `wert` die Endmarkierung des Verses `vers` — also nur dessen Nummer,
 * ggf. in Klammern und in fremder Ziffernschrift? Nur dann darf Position n+1
 * verworfen werden. Ein echtes Zusatzwort an n+1 bedeutet dagegen eine
 * abweichende Segmentierung: dann stimmt die Positionszuordnung nicht mehr
 * und der Vers muss ganz raus.
 */
function istEndmarkierung(wert, vers) {
  const nurZiffern = [...String(wert)]
    .map((z) => ZIFFERN[z] ?? z)
    .join('')
    .replace(/[()[\]{}\s.،,-]/g, '');
  return /^\d+$/.test(nurZiffern) && Number(nurZiffern) === vers;
}

/**
 * Ist `wert` (bereits getrimmt) ein Platzhalter statt echter Übersetzung? Zwei
 * Formen, siehe Kopf-Kommentar: der wörtliche String "null"/"<null>" (und
 * verwandte Marker wie "none"/"undefined"/"nil"/"n/a") sowie eine Zelle, die
 * nach dem Trimmen NUR aus Satz-/Sonderzeichen besteht (".", "(", '"', "[]",
 * "-", …). Ein leerer String ist bereits vor dem Aufruf eine Lücke — hier
 * separat gehalten, weil der Aufrufer beide Fälle gleich behandelt.
 */
function istPlatzhalter(wert) {
  if (/^<?(null|none|undefined|nil|n\/a)>?$/i.test(wert)) return true;
  if (/^[\p{P}\p{S}]+$/u.test(wert)) return true;
  return false;
}

/**
 * Größte Länge einer Wortgruppe, die die Pipeline noch ausliefert. Über den
 * gesamten Bestand aller 6 Sprachen (456.682 gebildete Gruppen) ist 3 Wörter
 * die größte Länge, die inhaltlich geprüft und bestätigt korrekt ist — jede
 * Gruppe der Länge ≥ 4 ist bislang genau einmal aufgetreten und ein
 * bestätigter Fehler (ur 38:3, siehe grund 'gruppe-zu-lang' oben). Der Wert
 * ist deshalb kein geratener Sicherheitsabstand, sondern die empirisch
 * belegte Obergrenze des gesunden Bestands.
 */
const MAX_GRUPPENLAENGE = 3;

/**
 * Richtet EINEN Vers aus und bildet die Wortgruppen.
 *
 * @param {Record<string, string>} quelle flaches QUL-Objekt
 * @param {number} sure
 * @param {number} vers
 * @param {string[]} wortarten POS des Stamm-Segments je Wort (Länge n)
 * @param {string[]} arabischeWoerter arabischer Wortlaut je Wort, inkl.
 *   Vokalzeichen (Korpus-`text`, Länge n) — nur für den
 *   arabisch-unuebersetzt-Abgleich gebraucht.
 * @returns {{ gruppen: [number, number, string][], gegenrichtung: number }
 *   | { gruppen: null, grund: string }}
 */
function richteVersAus(quelle, sure, vers, wortarten, arabischeWoerter) {
  const n = wortarten.length;

  // 1. Zellen einlesen; leer/fehlend/Platzhalter = Lücke (mitgemeinte Position).
  const werte = new Array(n + 1).fill('');
  for (let pos = 1; pos <= n; pos++) {
    const roh = quelle[`${sure}:${vers}:${pos}`];
    const wert = typeof roh === 'string' ? roh.replace(/\s+/g, ' ').trim() : '';
    werte[pos] = istPlatzhalter(wert) ? '' : wert;
  }

  // 2. Alles jenseits von n prüfen: genau eine Endmarkierung an n+1 ist
  //    erlaubt (und wird verworfen), alles andere heißt abweichende
  //    Segmentierung.
  const ueberzaehlig = quelle[`${sure}:${vers}:${n + 1}`];
  if (typeof ueberzaehlig === 'string' && ueberzaehlig.trim() && !istEndmarkierung(ueberzaehlig, vers)) {
    return { gruppen: null, grund: 'segmentierung-abweichend' };
  }
  if (typeof quelle[`${sure}:${vers}:${n + 2}`] === 'string') {
    return { gruppen: null, grund: 'segmentierung-abweichend' };
  }

  // 3. Zugehörigkeit je Position bestimmen: eine beglosste Zelle gehört sich
  //    selbst, eine Lücke der nächsten beglossten Zelle in Bindungsrichtung
  //    (Kette wird durchlaufen).
  const naechsteBeglosste = (pos, richtung) => {
    let ziel = pos + richtung;
    while (ziel >= 1 && ziel <= n && !werte[ziel]) ziel += richtung;
    return ziel >= 1 && ziel <= n ? ziel : 0;
  };

  const gehoertZu = new Array(n + 1).fill(0);
  let gegenrichtung = 0;
  for (let pos = 1; pos <= n; pos++) {
    if (werte[pos]) {
      gehoertZu[pos] = pos;
      continue;
    }
    const richtung = VORWAERTS_BINDEND.has(wortarten[pos - 1]) ? 1 : -1;
    let ziel = naechsteBeglosste(pos, richtung);
    if (!ziel) {
      // Gegenrichtung — siehe Kopf: keine Heuristik, sondern die einzige
      // verbleibende Möglichkeit, wenn die Wortart-Richtung ins Leere läuft.
      ziel = naechsteBeglosste(pos, -richtung);
      if (ziel) gegenrichtung++;
    }
    if (!ziel) return { gruppen: null, grund: 'luecke-ohne-anker' };
    gehoertZu[pos] = ziel;
  }

  // 4. Gruppen bilden: aufeinanderfolgende Positionen mit derselben
  //    Zugehörigkeit. Zeigen zwei Lücken aneinander vorbei, entstünde ein
  //    zerrissener Bereich (Anker außerhalb der eigenen Gruppe oder zweimal
  //    derselbe Anker) — dann lieber den Vers verwerfen als eine falsche
  //    Zuordnung ausliefern.
  const gruppen = [];
  const gesehen = new Set();
  let von = 1;
  while (von <= n) {
    const anker = gehoertZu[von];
    let bis = von;
    while (bis + 1 <= n && gehoertZu[bis + 1] === anker) bis++;
    if (anker < von || anker > bis || gesehen.has(anker)) {
      return { gruppen: null, grund: 'gruppen-unzusammenhaengend' };
    }
    if (bis - von + 1 > MAX_GRUPPENLAENGE) {
      return { gruppen: null, grund: 'gruppe-zu-lang' };
    }
    const text = werte[anker];
    // Kein Übersetzungsfehler-Raten, nur der eine belegte Fall: Text = exakt
    // das arabische Original an genau dieser Stelle (siehe grund oben).
    if (text === arabischeWoerter.slice(von - 1, bis).join(' ')) {
      return { gruppen: null, grund: 'arabisch-unuebersetzt' };
    }
    gesehen.add(anker);
    gruppen.push([von, bis, text]);
    von = bis + 1;
  }

  return { gruppen, gegenrichtung };
}

function ladeKorpus() {
  /** @type {Map<number, Map<number, { wortarten: string[], texte: string[] }>>}
   *  sure -> vers -> POS und arabischer Wortlaut je Wort. */
  const korpus = new Map();
  let verse = 0;
  let woerter = 0;
  for (let sure = 1; sure <= SUREN; sure++) {
    const datei = path.join(KORPUS_DIR, `${sure}.json`);
    if (!existsSync(datei)) {
      throw new Error(`Korpus fehlt: ${path.relative(MOBILE, datei)} — erst "node scripts/build-morphologie.mjs" laufen lassen.`);
    }
    const daten = JSON.parse(readFileSync(datei, 'utf8'));
    const proSure = new Map();
    for (const [vers, wortListe] of Object.entries(daten.verses)) {
      proSure.set(Number(vers), {
        wortarten: wortListe.map((w) => {
          const stamm = w.segments.find((s) => s.kind === 'stem');
          return stamm ? stamm.pos : (w.segments[0]?.pos ?? null);
        }),
        texte: wortListe.map((w) => w.text),
      });
      verse++;
      woerter += wortListe.length;
    }
    korpus.set(sure, proSure);
  }
  return { korpus, verse, woerter };
}

const { korpus, verse: korpusVerse, woerter: korpusWoerter } = ladeKorpus();
console.log(`Korpus: ${korpusVerse} Verse, ${korpusWoerter} Wörter (${path.relative(MOBILE, KORPUS_DIR)})`);

const meta = {
  schema: WBW_VERSION,
  korpus: { verse: korpusVerse, woerter: korpusWoerter },
  sprachen: {},
};
const uebersicht = [];
const fehler = [];
let gesamtBytes = 0;

for (const [sprache, dateiname] of Object.entries(SPRACHEN)) {
  const quelldatei = path.join(QUELL_DIR, dateiname);
  if (!existsSync(quelldatei)) {
    fehler.push(`${sprache}: Quelldatei fehlt (${path.relative(MOBILE, quelldatei)})`);
    continue;
  }
  const quelle = JSON.parse(readFileSync(quelldatei, 'utf8'));

  const zielDir = path.join(AUSGABE_DIR, sprache);
  if (existsSync(zielDir)) rmSync(zielDir, { recursive: true });
  mkdirSync(zielDir, { recursive: true });

  let geschrieben = 0;
  let ausgelassen = 0;
  let woerter = 0;
  let gruppenZahl = 0;
  let inMehrwortgruppe = 0;
  let gegenrichtung = 0;
  let bytes = 0;
  const gruende = {};

  for (let sure = 1; sure <= SUREN; sure++) {
    const proSure = korpus.get(sure);
    const verses = {};
    for (const [vers, wortDaten] of proSure) {
      const { wortarten, texte } = wortDaten;
      const ergebnis = richteVersAus(quelle, sure, vers, wortarten, texte);
      if (!ergebnis.gruppen) {
        ausgelassen++;
        gruende[ergebnis.grund] = (gruende[ergebnis.grund] ?? 0) + 1;
        continue;
      }
      verses[String(vers)] = ergebnis.gruppen;
      geschrieben++;
      woerter += wortarten.length;
      gruppenZahl += ergebnis.gruppen.length;
      gegenrichtung += ergebnis.gegenrichtung;
      for (const [von, bis] of ergebnis.gruppen) if (bis > von) inMehrwortgruppe += bis - von + 1;
    }
    const inhalt = JSON.stringify({ schema: WBW_VERSION, lang: sprache, surah: sure, verses });
    const ziel = path.join(zielDir, `${sure}.json`);
    writeFileSync(ziel, inhalt);
    bytes += statSync(ziel).size;
  }

  gesamtBytes += bytes;
  meta.sprachen[sprache] = {
    verse: geschrieben,
    woerter,
    gruppen: gruppenZahl,
    anteilVerse: Number((geschrieben / korpusVerse).toFixed(4)),
    anteilWoerter: Number((woerter / korpusWoerter).toFixed(4)),
    anteilInMehrwortgruppe: Number((woerter ? inMehrwortgruppe / woerter : 0).toFixed(4)),
  };
  uebersicht.push({ sprache, geschrieben, ausgelassen, woerter, gruppenZahl, inMehrwortgruppe, gegenrichtung, bytes, gruende });
}

mkdirSync(AUSGABE_DIR, { recursive: true });
const metaPfad = path.join(AUSGABE_DIR, 'meta.json');
writeFileSync(metaPfad, JSON.stringify(meta, null, 2));
gesamtBytes += statSync(metaPfad).size;

console.log(`\nSprache | Verse geschrieben | ausgelassen | Wörter | Gruppen | in Mehrwortgruppe | Anteil Verse | Größe`);
console.log('--------+-------------------+-------------+--------+---------+-------------------+--------------+--------');
for (const z of uebersicht) {
  const anteil = `${((z.geschrieben / korpusVerse) * 100).toFixed(1)} %`;
  const mehrwort = `${z.inMehrwortgruppe} (${z.woerter ? ((z.inMehrwortgruppe / z.woerter) * 100).toFixed(1) : '0.0'} %)`;
  console.log(
    `${z.sprache.padEnd(7)} | ${String(z.geschrieben).padStart(17)} | ${String(z.ausgelassen).padStart(11)} | ${String(z.woerter).padStart(6)} | ${String(z.gruppenZahl).padStart(7)} | ${mehrwort.padStart(17)} | ${anteil.padStart(12)} | ${`${(z.bytes / 1024).toFixed(0)} KB`.padStart(7)}`,
  );
}
for (const z of uebersicht) {
  if (z.gegenrichtung > 0) {
    console.log(`  ${z.sprache}: ${z.gegenrichtung} Lücke(n) über die Gegenrichtung angebunden (Wortart-Richtung lief zum Versrand)`);
  }
}
for (const z of uebersicht) {
  if (z.ausgelassen > 0) {
    const g = Object.entries(z.gruende)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    console.log(`  ${z.sprache}: ausgelassen wegen ${g}`);
  }
}
console.log(
  `\nGesamt: ${uebersicht.reduce((s, z) => s + z.geschrieben, 0)} Vers-Einträge, ` +
    `${uebersicht.reduce((s, z) => s + z.gruppenZahl, 0)} Gruppen über ` +
    `${uebersicht.reduce((s, z) => s + z.woerter, 0)} Wortpositionen, ` +
    `${(gesamtBytes / 1024 / 1024).toFixed(1)} MB in ${path.relative(MOBILE, AUSGABE_DIR)}`,
);

if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:`);
  for (const f of fehler) console.log(`  - ${f}`);
  // Kein process.exit(): das reißt unter Windows offene Handles mit und endet
  // mit Rückgabewert 127 — ein Lauf, den man am Rückgabewert prüft, gälte dann
  // fälschlich als gescheitert. exitCode setzen und regulär auslaufen.
  process.exitCode = 1;
}
