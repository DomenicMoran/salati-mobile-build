// Baut die Wort-Morphologie- und Satzsyntax-Daten des Korans aus zwei
// öffentlichen Quellen zu je einer JSON-Datei pro Sure unter
// apps/mobile/.daten-cache/out/morphologie/v3/ (Pfad trägt die Schema-Version,
// siehe MORPHOLOGIE_VERSION unten und Kommentar dort — nötig, weil die
// Auslieferung per R2 mit "immutable"-Cache-Control läuft und eine neue
// Fassung unter derselben URL nie ankäme).
//
// Quelle 1: Quranic Arabic Corpus (QAC) 0.4 — Buckwalter-transliterierte
//   Segmentierung (Präfix/Stamm/Suffix) mit POS-Tag und Feature-String je
//   Segment. Format vollständig dokumentiert in
//   C:\Users\domen\AppData\Local\Temp\...\scratchpad\KORPUS-FORMAT.md
//   (Kopie der wichtigsten Regeln unten, wo sie den Code betreffen).
// Quelle 2: NoorBayan/Quranic (github.com/NoorBayan/Quranic, MIT) — dieselbe
//   Segmentierung (Location-Schlüssel sure:vers:wort:segment ist 1:1 deckungs-
//   gleich mit QAC, empirisch geprüft: 128.219/128.219 Segmente auf beiden
//   Seiten, 0 Differenz) plus Satzsyntax (`rel_label`/`rel_label_ar` je
//   Segment, `ref_token_id` als Verweis auf das regierende Segment innerhalb
//   derselben `sentence_id`).
//
// WARUM NUR Quranic_utf8.csv und NICHT zusätzlich RelLabels.csv/pos.csv
// gebraucht wird: rel_label/rel_label_ar stehen bereits ausgeschrieben (Klartext
// Englisch+Arabisch) in jeder Zeile von Quranic_utf8.csv — die Hilfstabellen
// wären nur nötig, um numerische rel_id/pid-Codes aufzulösen, die hier gar
// nicht vorkommen. Quran.csv (Volltext je Vers) wird ebenfalls nicht gebraucht:
// der Anzeigetext wird aus QAC (FORM-Spalte, Buckwalter) zusammengesetzt, NICHT
// aus NoorBayans `uthmani_token` — die ist ab Sure 9 überwiegend undiakriti-
// siert (Beleg: KORPUS-FORMAT.md Abschnitt 2, "Bekannte Einschränkung").
//
// Ehrlichkeits-Prinzip dieses Skripts (siehe Aufgabenstellung): jedes Merkmal,
// das nicht wörtlich im Feature-String steht, sondern per Konvention ergänzt
// wird (fehlende Verbform -> Form I, bloßes M/F -> Singular, Bestimmtheit aus
// Al+/PN/Mudaf/Possessivsuffix hergeleitet), wandert ins `derived`-Feld des
// betroffenen Segments. Nichts wird darüber hinaus geraten — wo keine
// Konvention dokumentiert ist (z. B. Standardmodus bei fehlendem MOOD,
// Standardgenus bei fehlendem ACT/PASS), bleibt der Wert null.
//
// Bestimmtheits-Herleitung (state): DEF kommt nie im Korpus vor. Bestimmtheit
// wird hergeleitet aus (1) Al+-Präfix am Wort, (2) PN-Tag, (3) Mudaf-Stellung
// (Wort ist Kopf einer Poss-Relation eines anderen Wortes im selben Vers —
// erstes Glied einer Genitivverbindung ist immer bestimmt) und (4) angehäng-
// tem Possessivpronomen (Suffix-Segment mit pos "PRON" an einem N/ADJ/PN-
// Stamm). Explizites INDEF im Korpus hat in jedem Fall Vorrang und wird nie
// überschrieben — Details siehe bestimmtheitErgaenzen() unten und
// PRUEFBERICHT-HERLEITUNG.md Abschnitt B.
//
// Ausführen: cd apps/mobile && node scripts/build-morphologie.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const CACHE_DIR = path.join(MOBILE, '.daten-cache');
// Ausgabe- UND Ausliefer-Pfad tragen die Schema-Version (schema: 3 unten —
// v2 hatte die erweiterte Bestimmtheits-Herleitung, Mudaf/Possessivsuffix,
// siehe bestimmtheitErgaenzen; v3 löst zusätzlich fünf der sechs bis dahin
// unbelegten Buckwalter-Sonderzeichen auf, siehe BUCKWALTER-Tabelle oben).
// Grund für den Versionsordner statt derselben Datei erneut hochzuladen: upload-morphologie-r2.mjs setzt
// "Cache-Control: public, max-age=31536000, immutable" — eine neue Fassung
// unter DERSELBEN URL käme bei Clients/CDN nie an (weder eine erneute
// Netzabfrage noch ein Cache-Bust ist für "immutable" vorgesehen). Ein neues
// URL-Präfix pro Schema-Version macht die neue Fassung sofort sichtbar, ohne
// die alte, bereits ausgelieferte Version zu brechen.
const MORPHOLOGIE_VERSION = 'v3';
const OUT_DIR = path.join(CACHE_DIR, 'out', 'morphologie', MORPHOLOGIE_VERSION);

const QAC_FILE = path.join(CACHE_DIR, 'qac-0.4.txt');
const QAC_URL = 'http://corpus.quran.com/download/quranic-corpus-morphology-0.4.txt';
const QAC_SHA256 = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

const NOOR_FILE = path.join(CACHE_DIR, 'Quranic_utf8.csv');
// NoorBayan liefert die Rohdatei UTF-16LE (mit BOM) im Repo. Wir cachen sie
// bewusst als UTF-8 (Dateiname trägt das schon), Konvertierung siehe unten.
const NOOR_URL = 'https://raw.githubusercontent.com/NoorBayan/Quranic/main/Quranic.csv';

// ---------------------------------------------------------------------------
// 1. Quellen beschaffen (Cache -> sonst Download) + Integritätsprüfung
// ---------------------------------------------------------------------------

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function ensureQac() {
  if (existsSync(QAC_FILE)) {
    const buf = readFileSync(QAC_FILE);
    const hash = sha256(buf);
    if (hash !== QAC_SHA256) {
      throw new Error(
        `QAC-Datei im Cache stimmt nicht mit der geprüften Fassung überein.\n` +
          `  erwartet: ${QAC_SHA256}\n  gefunden: ${hash}\n` +
          `  Datei: ${QAC_FILE}\n` +
          `Abbruch — nicht weiterrechnen mit unbekanntem Quelltext. Datei löschen, damit sie neu geladen wird, ` +
          `oder die richtige Fassung von ${QAC_URL} einspielen.`,
      );
    }
    return buf.toString('utf8');
  }
  console.log(`QAC-Datei fehlt im Cache, lade von ${QAC_URL} …`);
  const r = await fetch(QAC_URL);
  if (!r.ok) throw new Error(`Download der QAC-Datei fehlgeschlagen: HTTP ${r.status} (${QAC_URL})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const hash = sha256(buf);
  if (hash !== QAC_SHA256) {
    throw new Error(
      `Frisch heruntergeladene QAC-Datei hat eine ANDERE sha256 als erwartet.\n` +
        `  erwartet: ${QAC_SHA256}\n  gefunden: ${hash}\n` +
        `Abbruch — nicht weiterrechnen mit unverifiziertem Quelltext (${QAC_URL}).`,
    );
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(QAC_FILE, buf);
  return buf.toString('utf8');
}

/** Erkennt BOM/Encoding und liefert den Dateiinhalt als UTF-8-String. */
function decodeSmart(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  return buf.toString('utf8');
}

async function ensureNoorBayan() {
  if (existsSync(NOOR_FILE)) {
    return decodeSmart(readFileSync(NOOR_FILE));
  }
  console.log(`NoorBayan-Quelle fehlt im Cache, lade von ${NOOR_URL} …`);
  const r = await fetch(NOOR_URL);
  if (!r.ok) throw new Error(`Download der NoorBayan-Datei fehlgeschlagen: HTTP ${r.status} (${NOOR_URL})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const text = decodeSmart(buf);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(NOOR_FILE, text, 'utf8');
  return text;
}

// ---------------------------------------------------------------------------
// 2. Buckwalter -> arabisches Unicode (KORPUS-FORMAT.md Abschnitt 2)
// ---------------------------------------------------------------------------

const BUCKWALTER = {
  "'": '\u0621', '|': '\u0622', '>': '\u0623', '&': '\u0624', '<': '\u0625', '}': '\u0626',
  A: '\u0627', b: '\u0628', p: '\u0629', t: '\u062A', v: '\u062B', j: '\u062C', H: '\u062D',
  x: '\u062E', d: '\u062F', '*': '\u0630', r: '\u0631', z: '\u0632',
  // 's' (\u0633\u064A\u0646) und '$' (\u0634\u064A\u0646) fehlen in KORPUS-FORMAT.md Abschnitt 2 (Dokul\u00FCcke,
  // vermutlich beim Abtippen der Tabelle \u00FCbersprungen) \u2014 hier gegen den
  // Standard-Buckwalter-Standard erg\u00E4nzt und empirisch best\u00E4tigt: ohne sie
  // blieb z. B. "somi" (\u0633\u0652\u0645\u0650, das zweite Wortsegment von "\u0628\u0650\u0633\u0652\u0645\u0650") mit
  // w\u00F6rtlichem lateinischem "s" im Text stehen (erste Sure, erster Vers).
  s: '\u0633', '$': '\u0634',
  S: '\u0635', D: '\u0636',
  T: '\u0637', Z: '\u0638', E: '\u0639', g: '\u063A', _: '\u0640', f: '\u0641', q: '\u0642',
  k: '\u0643', l: '\u0644', m: '\u0645', n: '\u0646', h: '\u0647', w: '\u0648', Y: '\u0649',
  y: '\u064A', '{': '\u0671',
  F: '\u064B', N: '\u064C', K: '\u064D', a: '\u064E', u: '\u064F', i: '\u0650', '~': '\u0651',
  o: '\u0652', '`': '\u0670',
  '^': '\u0653', '@': '\u06DF', ',': '\u06E5', '.': '\u06E6', '#': '\u0654', '[': '\u06E2',
  ']': '\u06ED', '"': '\u06E0',
  // Echtes Leerzeichen innerhalb eines Wortes kommt genau einmal vor
  // (37:130:3, "<ilo yaAsiyna" = \u0625\u0644\u064A\u0627\u0633/\u0625\u0644 \u064A\u0627\u0633\u064A\u0646) \u2014 Teil der Uthmani-Schreibung
  // dieses Eigennamens, kein Encoding-Fehler. Bewusst durchgereicht.
  ' ': ' ',

  // Schema 3 \u2014 sechs zuvor ungekl\u00E4rte Segmente (siehe bekannteLuecken in
  // meta.json schema 2, GEGENPROBE-BERICHT.md): f\u00FCnf weitere Uthmani-
  // Sonderzeichen derselben Systematik wie oben (^ @ , . # [ ] "), jedes
  // einzeln gegen den ECHTEN Vers gepr\u00FCft (api.quran.com text_uthmani,
  // Codepoints per Hand ausgez\u00E4hlt), nicht geraten:
  //
  // ':' -> U+06DC ARABIC SMALL HIGH SEEN \u2014 markiert, dass ein als \u0635 (Sad)
  //   geschriebener Buchstabe wie \u0633 (Sin) gesprochen wird. Betrifft beide
  //   Fundstellen der Wurzel bsT ("basata"): 2:245:14:2 "yaboS:uTu" ->
  //   Beleg api.quran.com 2:245 Wort 14 "\u0648\u064E\u064A\u064E\u0628\u0652\u0635\u064F\u06DC\u0637\u064F" (Codepoints u.a.
  //   0635 064F 06DC 0637 = \u0635 + damma + SMALL HIGH SEEN + \u0637) und
  //   7:69:22:1 "baS:oTapF" -> Beleg 7:69 Wort 22 "\u0628\u064E\u0635\u0652\u06DC\u0637\u064E\u0629\u064B\u06ED" (0635 0652
  //   06DC 0637 = \u0635 + sukun + SMALL HIGH SEEN + \u0637).
  ':': '\u06DC',
  // ';' -> U+06E3 ARABIC SMALL LOW SEEN \u2014 dieselbe Sad-f\u00FCr-Sin-Markierung,
  //   aber UNTER dem Buchstaben (statt dar\u00FCber), weil die Fatha den Platz
  //   dar\u00FCber schon belegt. Einzige Fundstelle 52:37:7:2 "muS;ayoTiruwna"
  //   (Wurzel sTr, "al-musaytirun") -> Beleg 52:37 Wort 7 "\u0671\u0644\u0652\u0645\u064F\u0635\u064E\u06E3\u064A\u0652\u0637\u0650\u0631\u064F\u0648\u0646\u064E",
  //   Codepoints 0635 064E 06E3 064A = \u0635 + fatha + SMALL LOW SEEN + \u064A.
  ';': '\u06E3',
  // '-' -> U+06EA ARABIC EMPTY CENTRE LOW STOP \u2014 Imala-Markierung: zeigt an,
  //   dass die folgende Alif-Aussprache Richtung "ay/ey" verschoben wird
  //   (hier: "majreha" statt "majraha", die einzige Imala-Stelle im
  //   gesamten Koran nach Hafs-Lesart). Einzige Fundstelle 11:41:6:1
  //   "major-Y`" -> Beleg 11:41 Wort 6 "\u0645\u064E\u062C\u0652\u0631\u06EA\u0649\u0670\u0647\u064E\u0627", Codepoints 0631 06EA
  //   0649 = \u0631 + EMPTY CENTRE LOW STOP + \u0649 (voller exakter Codepoint-
  //   Abgleich inkl. Suffix "\u0647\u064E\u0627", keine Abweichung).
  '-': '\u06EA',
  // '!' -> U+0640 (Tatweel) + U+06E8 ARABIC SMALL HIGH NOON \u2014 markiert ein
  //   im Rasm getilgtes, aber mitgesprochenes Nun (Idgham-Rasm-Sonderfall
  //   bei doppeltem Nun). Einzige Fundstelle 21:88:7:1 "nu!jiY" (Wurzel njw,
  //   Form IV, 1. Pers. Pl., "nunj\u012B") -> Beleg 21:88 Wort 7 "\u0646\u064F\u0640\u06E8\u062C\u0650\u0649",
  //   Codepoints 0646 064F 0640 06E8 062C = \u0646 + damma + TATWEEL +
  //   SMALL HIGH NOON + \u062C. Zwei Zielzeichen f\u00FCr ein Quellzeichen, weil das
  //   getilgte Nun im Rasm keinen eigenen Tr\u00E4gerbuchstaben mehr hat und die
  //   offizielle Uthmani-Quelle daf\u00FCr einen Tatweel als Tr\u00E4ger einsetzt.
  '!': '\u0640\u06E8',
  // '%' -> U+06EC ARABIC ROUNDED HIGH STOP WITH FILLED CENTRE \u2014 markiert
  //   Tashil (Erleichterung) der zweiten von zwei aufeinandertreffenden
  //   Hamzas. Einzige Fundstelle 41:44:9:2 "A%EojamiY~N" (nach der
  //   PREFIX-Hamza "'a" desselben Wortes) -> Beleg 41:44 Wort 9
  //   "\u0621\u064E\u0627\u06EC\u0639\u0652\u062C\u064E\u0645\u0650\u0649\u064C\u0651\u06ED", Codepoints 0627 06EC 0639 = \u0627 + ROUNDED HIGH STOP WITH
  //   FILLED CENTRE + \u0639 (die zus\u00E4tzliche kleine Meem-Markierung ganz am
  //   Wortende in der von api.quran.com gelieferten Fassung, \u064C\u0651\u06ED statt \u064C\u0651,
  //   ist die bekannte KFGQPC-Platzhalter-Glyphe f\u00FCr Shadda+Tanwin-Endungen,
  //   kein Bestandteil des QAC-Quelltextes \u2014 siehe project_salati_kfgqpc_
  //   platzhalter_glyph in der pers\u00F6nlichen Projekt-Memory \u2014 und bleibt
  //   deshalb hier unber\u00FCcksichtigt).
  '%': '\u06EC',
};
// '+' markiert nur Morphemgrenzen und wird entfernt, nicht ersetzt.

// Bis Schema 2 blieben sechs Segmente im gesamten Korpus (0,005 %) mit einem
// Zeichen ohne Tabelleneintrag stehen (':','-','!','%',';' \u2014 je 1-2
// Fundstellen). Seit Schema 3 sind alle f\u00FCnf Zeichen oben aufgel\u00F6st (siehe
// Kommentare an der jeweiligen Tabellenzeile). `bekannteLuecken` bleibt als
// Pr\u00FCf-/Absicherungsmechanismus stehen: taucht k\u00FCnftig (neue QAC-Fassung,
// anderer Datensatz) wieder ein unbekanntes Zeichen auf, wird es weiterhin
// unver\u00E4ndert durchgereicht UND hier protokolliert statt geraten.
const bekannteLuecken = [];

// Werte in geschlossenen Merkmals-Wertelisten (MOOD, PRON-Kombitoken,
// Verbform-Klammern in parseFeatures unten), die die jeweilige Zuordnung
// NICHT kennt. Genau dieser Fall (MOOD:SUBJ vs. der früher erwartete String
// "MOOD:SUB") ließ bis Schema 3 jedes Subjunktiv-Verb im gesamten Korpus
// (1.330 Segmente, siehe main()) still mit features.mood = null enden —
// kein Fehler, keine Warnung, einfach eine fehlende Angabe, die wie "im
// Korpus nicht markiert" aussah. Anders als bekannteLuecken (dort bleibt das
// Roh-Zeichen wenigstens sichtbar im Text stehen) geht der Wert hier ganz
// verloren -> deshalb bricht main() den Bau ab, sobald dieses Array nicht
// leer ist, statt nur zu warnen wie bei bekannteLuecken.
const unbekannteMerkmalswerte = [];
function buckwalterToUnicode(bw, locationKey) {
  if (!bw) return bw;
  let out = '';
  for (const ch of bw) {
    if (ch === '+') continue;
    const u = BUCKWALTER[ch];
    if (u !== undefined) {
      out += u;
    } else {
      bekannteLuecken.push({ zeichen: ch, wert: bw, location: locationKey ?? null });
      out += ch;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. QAC parsen
// ---------------------------------------------------------------------------

const ROEMISCH_ZU_ZAHL = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

/** Person/Genus/Numerus-Kombitoken (Abschnitt 5 der Format-Spezifikation) —
 * jedes ist vollständig explizit im Korpus, keine Ableitung nötig. */
const PGN_TABELLE = {
  M: { gender: 'm' }, F: { gender: 'f' },
  MS: { gender: 'm', number: 'sg' }, FS: { gender: 'f', number: 'sg' },
  MP: { gender: 'm', number: 'pl' }, FP: { gender: 'f', number: 'pl' },
  MD: { gender: 'm', number: 'du' }, FD: { gender: 'f', number: 'du' },
  P: { number: 'pl' },
  '1S': { person: '1', number: 'sg' }, '1P': { person: '1', number: 'pl' },
  '2D': { person: '2', number: 'du' }, '3D': { person: '3', number: 'du' },
  '3MS': { person: '3', gender: 'm', number: 'sg' }, '3MP': { person: '3', gender: 'm', number: 'pl' },
  '3MD': { person: '3', gender: 'm', number: 'du' }, '3FS': { person: '3', gender: 'f', number: 'sg' },
  '3FP': { person: '3', gender: 'f', number: 'pl' }, '3FD': { person: '3', gender: 'f', number: 'du' },
  '2MS': { person: '2', gender: 'm', number: 'sg' }, '2MP': { person: '2', gender: 'm', number: 'pl' },
  '2MD': { person: '2', gender: 'm', number: 'du' }, '2FS': { person: '2', gender: 'f', number: 'sg' },
  '2FP': { person: '2', gender: 'f', number: 'pl' }, '2FD': { person: '2', gender: 'f', number: 'du' },
};

const LEER_FEATURES = () => ({
  person: null, gender: null, number: null, case: null, state: null,
  mood: null, tense: null, voice: null, verbForm: null, derivation: null,
});

/**
 * Zerlegt den FEATURES-String eines QAC-Segments in das verbindliche
 * `features`-Objekt + die Liste der per Konvention ergänzten Felder
 * (`derived`). `tag` ist die TAG-Spalte (Haupt-POS), `hatAlPraefix` sagt, ob
 * dasselbe Wort ein PREFIX-Segment mit `Al+` trägt (für die Bestimmtheits-
 * Herleitung).
 */
function parseFeatures(featureTokens, tag, hatAlPraefix, locationKey) {
  const features = LEER_FEATURES();
  const derived = [];
  let indefExplizit = false;
  let pgnGefunden = false;

  for (const tok of featureTokens) {
    if (tok === 'STEM' || tok === 'PREFIX' || tok === 'SUFFIX') continue; // Segmenttyp, separat behandelt
    if (tok.startsWith('POS:')) continue; // redundant zur TAG-Spalte
    if (tok.startsWith('LEM:') || tok.startsWith('ROOT:')) continue; // Wort-Ebene, separat behandelt
    if (tok.startsWith('SP:')) continue; // Sondergruppe (kAna u.ä.) — kein Feld im Zielschema

    if (tok.startsWith('PRON:')) {
      const wert = tok.slice('PRON:'.length);
      const pgn = PGN_TABELLE[wert];
      if (pgn) {
        Object.assign(features, pgn);
        pgnGefunden = true;
      } else {
        unbekannteMerkmalswerte.push({ feld: 'PRON', wert, location: locationKey });
      }
      continue;
    }
    if (tok.startsWith('MOOD:')) {
      const wert = tok.slice('MOOD:'.length);
      // Korpus schreibt den Subjunktiv als "MOOD:SUBJ", NICHT "MOOD:SUB" (empirisch
      // über den gesamten Korpus gezählt: 1.330× SUBJ, 0× SUB — siehe main()/meta.json
      // moodHaeufigkeit). MOOD:IND kommt im gesamten Korpus kein einziges Mal vor: der
      // Indikativ bleibt im QAC-Feature-String grundsätzlich unmarkiert (grammatischer
      // Normalfall, keine Datenlücke) — features.mood ist für jedes indikativische Verb
      // deshalb null, genau wie für ein Verb ganz ohne Modus-Angabe; unterscheidbar sind
      // beide Fälle über tense/PCPL (Indikativ kommt nur bei IMPF-Verben ohne SUBJ/JUS vor).
      const MOOD_TABELLE = { IND: 'ind', SUBJ: 'sub', JUS: 'juss' };
      if (Object.prototype.hasOwnProperty.call(MOOD_TABELLE, wert)) {
        features.mood = MOOD_TABELLE[wert];
      } else {
        unbekannteMerkmalswerte.push({ feld: 'MOOD', wert, location: locationKey });
      }
      continue;
    }
    if (/^\([IVX]+\)$/.test(tok)) {
      const roemisch = tok.slice(1, -1);
      if (Object.prototype.hasOwnProperty.call(ROEMISCH_ZU_ZAHL, roemisch)) {
        features.verbForm = ROEMISCH_ZU_ZAHL[roemisch];
      } else {
        unbekannteMerkmalswerte.push({ feld: 'verbForm', wert: tok, location: locationKey });
      }
      continue;
    }
    if (tok === 'PERF') { features.tense = 'perfect'; continue; }
    if (tok === 'IMPF') { features.tense = 'imperfect'; continue; }
    if (tok === 'IMPV') { features.tense = 'imperative'; continue; }
    if (tok === 'ACT') { features.voice = 'active'; continue; }
    if (tok === 'PASS') { features.voice = 'passive'; continue; }
    if (tok === 'NOM') { features.case = 'nom'; continue; }
    if (tok === 'ACC') { features.case = 'acc'; continue; }
    if (tok === 'GEN') { features.case = 'gen'; continue; }
    if (tok === 'INDEF') { features.state = 'indefinite'; indefExplizit = true; continue; }
    if (tok === 'PCPL') continue; // erst nach der Schleife kombiniert mit ACT/PASS ausgewertet
    if (tok === 'VN') { features.derivation = 'verbalNoun'; continue; }

    if (Object.prototype.hasOwnProperty.call(PGN_TABELLE, tok)) {
      Object.assign(features, PGN_TABELLE[tok]);
      pgnGefunden = true;
      continue;
    }
    // Alles Übrige sind reine Präfix-/Suffix-Marker ohne Entsprechung im
    // Zielschema (Al+, bi+, ka+, ya+, ha+, sa+, ta+, w:CONJ+, f:REM+, l:P+,
    // A:EQ+, A:INTG+, +n:*, +VOC) — der Buchstabe steckt schon im Segmenttext,
    // keine weitere Ableitung nötig.
  }

  // PCPL kombiniert mit ACT/PASS -> Partizip. Kein PCPL ohne ACT/PASS im
  // gesamten Korpus (empirisch geprüft), daher keine Rateklausel nötig.
  if (featureTokens.includes('PCPL')) {
    if (features.voice === 'active') features.derivation = 'activeParticiple';
    else if (features.voice === 'passive') features.derivation = 'passiveParticiple';
  }

  // Konvention (KORPUS-FORMAT.md Abschnitt 5): "M"/"F" bzw. jeder Kasus ohne
  // Zahl-Suffix bedeutet Singular. Gilt korpusweit, nicht nur für TAG=N.
  if (features.number === null && (features.gender !== null || features.case !== null)) {
    features.number = 'sg';
    derived.push('number');
  }

  // Konvention: DEF kommt nie vor. Bestimmtheit wird aus Al+-Präfix (gleiches
  // Wort) oder PN-Tag hergeleitet, sonst bleibt sie unbestimmbar -> null.
  if (!indefExplizit) {
    if (tag === 'PN') {
      features.state = 'definite';
      derived.push('state');
    } else if (hatAlPraefix) {
      features.state = 'definite';
      derived.push('state');
    }
  }

  // Konvention (Abschnitt 7): fehlt die Verbform-Klammer bei einem V-Segment,
  // ist es Form I. NUR für TAG=V dokumentiert/verifiziert (7.009/19.356
  // explizit) — bei Partizipien/Verbalnomen (ADJ/N mit PCPL/VN) bleibt eine
  // fehlende Klammer unbestimmt (null), das wäre eine ungeprüfte Annahme.
  if (tag === 'V' && features.verbForm === null) {
    features.verbForm = 1;
    derived.push('verbForm');
  }

  void pgnGefunden;
  return { features, derived };
}

function parseQacLine(line) {
  const cols = line.split('\t');
  if (cols.length < 4) return null;
  const m = /^\((\d+):(\d+):(\d+):(\d+)\)$/.exec(cols[0]);
  if (!m) return null;
  const featureTokens = cols[3].split('|');
  const kind = featureTokens[0] === 'PREFIX' ? 'prefix' : featureTokens[0] === 'SUFFIX' ? 'suffix' : 'stem';
  const locationKey = `${m[1]}:${m[2]}:${m[3]}:${m[4]}`;
  let lemma = null;
  let root = null;
  for (const tok of featureTokens) {
    if (tok.startsWith('LEM:')) {
      // QAC hängt an manche LEM-Werte eine "2" an, um zwei Lemmata mit sonst
      // identischer Schreibung zu unterscheiden (Homograph-Index, kein Laut —
      // 78 Fälle im ganzen Korpus, z. B. "maE2" für die Präposition "maEa").
      // corpus.quran.com dokumentiert diese Konvention auf der Lemma-Seite.
      lemma = buckwalterToUnicode(tok.slice(4).replace(/2$/, ''), locationKey);
    } else if (tok.startsWith('ROOT:')) {
      root = buckwalterToUnicode(tok.slice(5), locationKey);
    }
  }
  return {
    surah: Number(m[1]), verse: Number(m[2]), word: Number(m[3]), seg: Number(m[4]),
    locationKey,
    form: cols[1], tag: cols[2], featureTokens, featuresRaw: cols[3],
    kind, lemma, root,
  };
}

function parseQac(text) {
  const segmente = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('LOCATION')) continue;
    const seg = parseQacLine(line);
    if (seg) segmente.push(seg);
  }
  return segmente;
}

// ---------------------------------------------------------------------------
// 4. NoorBayan/Quranic.csv parsen — nur für Satzsyntax gebraucht
// ---------------------------------------------------------------------------

function parseNoorBayan(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split('\t');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  // rel je LOCATION-Schlüssel
  const relByLocation = new Map();
  // pro Satz (sentence_id) token_id -> Ziel-Location ("_" = getilgtes/implizites
  // Wort ohne QAC-Entsprechung, sonst "sure:vers:wort")
  const sentenceTokenLocation = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const loc = cols[idx.location];
    const m = /^\((\d+):(\d+):(\d+):(\d+)\)$/.exec(loc);
    const sentenceId = cols[idx.sentence_id];
    const tokenId = cols[idx.token_id];
    const key = `${sentenceId}:${tokenId}`;
    if (m) {
      sentenceTokenLocation.set(key, `${m[1]}:${m[2]}:${m[3]}`);
      relByLocation.set(`${m[1]}:${m[2]}:${m[3]}:${m[4]}`, {
        relation: cols[idx.rel_label],
        relationAr: cols[idx.rel_label_ar],
        refTokenId: cols[idx.ref_token_id],
        sentenceId,
      });
    } else {
      // getilgtes/implizites Wort (LOCATION "_") — hat keine QAC-Entsprechung,
      // wird aber als mögliches Kopf-Ziel für echte Wörter gebraucht.
      sentenceTokenLocation.set(key, null);
    }
  }
  return { relByLocation, sentenceTokenLocation };
}

// ---------------------------------------------------------------------------
// 5. Wörter zusammenbauen
// ---------------------------------------------------------------------------

/**
 * Ergänzt `state: "definite"` für einen Fall, in dem Bestimmtheit nicht im
 * Feature-String des Segments selbst steht, sondern aus einer ZWEITEN, bereits
 * vorhandenen Information zweifelsfrei folgt (Mudaf-Kopf einer Poss-Relation,
 * oder angehängtes Possessivpronomen — siehe PRUEFBERICHT-HERLEITUNG.md
 * Abschnitt B). Beide Konventionen sind klassische arabische Grammatik ohne
 * Ausnahme.
 *
 * Reihenfolge/Vorrang (WICHTIG):
 * - `state: "indefinite"` (explizites INDEF im Korpus) wird NIE überschrieben
 *   — eine explizite Korpus-Aussage geht vor jeder Herleitung. Erfüllt ein
 *   solches Segment zugleich die Mudaf-/Possessiv-Bedingung, ist das ein
 *   Widerspruch der Quelle, kein Bug dieser Funktion — wird gezählt, nicht
 *   verändert (siehe `stats.widersprueche`, landet in meta.json).
 * - Ein bereits über Al+/PN hergeleitetes (oder über die jeweils andere der
 *   beiden neuen Regeln bereits gesetztes) `definite` wird nicht erneut
 *   gezählt, damit die Statistik nicht doppelt zählt.
 */
function bestimmtheitErgaenzen(segment, grund, stats, ort) {
  if (segment.features.state === 'indefinite') {
    stats.widersprueche.push({ ort, grund });
    return;
  }
  if (segment.features.state === 'definite') return; // schon bestimmt — nicht doppelt zählen
  segment.features.state = 'definite';
  if (!segment.derived.includes('state')) segment.derived.push('state');
  stats[grund]++;
}

// Possessivsuffix-Regel nur für Stammsegmente dieser Tags anwenden (nominal —
// اسم). Ein Verbstamm mit angehängtem PRON-Suffix ist ein OBJEKT-Pronomen
// ("er sah IHN"), keine Possessiv-Konstruktion — daraus ließe sich keine
// Bestimmtheit des Verbs herleiten. QAC taggt beide Suffix-Arten identisch als
// SUFFIX|PRON:*, unterscheidbar nur über den Tag des STAMMS selbst.
const NOMEN_TAGS_FUER_POSSESSIV = new Set(['N', 'ADJ', 'PN']);

function buildWords(segmenteDerSure, noor, limitStats, bestimmtheitStats) {
  const sureNummer = segmenteDerSure[0]?.surah ?? null;
  // Gruppieren nach Wort
  const woerter = new Map(); // "vers:wort" -> segmente[]
  for (const seg of segmenteDerSure) {
    const key = `${seg.verse}:${seg.word}`;
    if (!woerter.has(key)) woerter.set(key, []);
    woerter.get(key).push(seg);
  }

  const verses = {};
  for (const [key, segRaw] of woerter) {
    const [verseStr, wordStr] = key.split(':');
    const verse = Number(verseStr);
    const word = Number(wordStr);
    const segs = [...segRaw].sort((a, b) => a.seg - b.seg);
    const hatAlPraefix = segs.some((s) => s.kind === 'prefix' && s.featureTokens.includes('Al+'));

    const segmentsOut = segs.map((s) => {
      const { features, derived } = parseFeatures(s.featureTokens, s.tag, hatAlPraefix, s.locationKey);
      return {
        text: buckwalterToUnicode(s.form, s.locationKey),
        kind: s.kind,
        pos: s.tag,
        features,
        derived,
        raw: s.featuresRaw,
        __seg: s, // intern, wird vor dem Schreiben entfernt
      };
    });

    // Bestimmtheits-Herleitung 1/2: angehängtes Possessivpronomen (Muster
    // كِتَابُهُ) — das Wort hat ein SUFFIX-Segment mit pos "PRON". Wirkt sofort
    // wortlokal, ohne Kenntnis anderer Wörter nötig.
    const hatPossessivSuffix = segs.some((s) => s.kind === 'suffix' && s.tag === 'PRON');
    if (hatPossessivSuffix) {
      const ort = `${sureNummer}:${verse}:${word}`;
      for (const seg of segmentsOut) {
        if (seg.kind === 'stem' && NOMEN_TAGS_FUER_POSSESSIV.has(seg.pos)) {
          bestimmtheitErgaenzen(seg, 'possessivsuffix', bestimmtheitStats, ort);
        }
      }
    }

    const text = segmentsOut.map((s) => s.text).join('');
    const stems = segs.filter((s) => s.kind === 'stem');
    // Konvention bei zusammengesetzten Partikelwörtern (486/77.429 Wörter mit
    // zwei STEM-Segmenten, z. B. "مِمَّا" = مِن+مَا): das LETZTE STEM-Segment
    // repräsentiert Wurzel/Lemma/Syntax des Gesamtworts.
    const repStem = stems[stems.length - 1] ?? segs[segs.length - 1];
    const root = repStem.root;
    const lemma = repStem.lemma;

    let syntax = null;
    const relInfo = noor.relByLocation.get(repStem.locationKey);
    if (relInfo) {
      let head = null;
      const zielKey = `${relInfo.sentenceId}:${relInfo.refTokenId}`;
      const zielLocation = noor.sentenceTokenLocation.get(zielKey);
      if (zielLocation === undefined) {
        limitStats.kopfUnbekannt++;
      } else if (zielLocation === null) {
        limitStats.kopfGetilgtesWort++; // Kopf ist ein implizites/getilgtes Wort ohne Position
      } else {
        const [zs, zv, zw] = zielLocation.split(':').map(Number);
        if (zv === verse && zs === segRaw[0].surah) {
          head = zw;
        } else {
          limitStats.kopfAndererVers++; // Schema erlaubt nur eine Wortposition IM VERS
        }
      }
      syntax = { relation: relInfo.relation, relationAr: relInfo.relationAr, head };
    } else {
      limitStats.keineRelation++;
    }

    for (const s of segmentsOut) delete s.__seg;

    if (!verses[verse]) verses[verse] = [];
    verses[verse].push({ position: word, text, root, lemma, segments: segmentsOut, syntax });
  }

  for (const verse of Object.keys(verses)) {
    const verseWords = verses[verse];
    verseWords.sort((a, b) => a.position - b.position);

    // Bestimmtheits-Herleitung 2/2: Mudaf (erstes Glied einer Genitiv-
    // verbindung). Indikator: ein ANDERES Wort im selben Vers trägt
    // syntax.relation === "Poss" (مضاف إليه) und zeigt per `head` auf dieses
    // Wort — das macht dieses Wort den Mudaf (مضاف), grammatisch immer
    // bestimmt. Braucht die syntax-Auflösung aller Wörter des Verses, daher
    // erst hier (nach dem Bau-Loop oben), nicht direkt beim einzelnen Wort.
    const mudafPositionen = new Set();
    for (const w of verseWords) {
      if (w.syntax && w.syntax.relation === 'Poss' && w.syntax.head !== null) {
        mudafPositionen.add(w.syntax.head);
      }
    }
    if (mudafPositionen.size > 0) {
      for (const w of verseWords) {
        if (!mudafPositionen.has(w.position)) continue;
        const ort = `${sureNummer}:${verse}:${w.position}`;
        for (const seg of w.segments) {
          if (seg.kind !== 'stem') continue;
          bestimmtheitErgaenzen(seg, 'mudaf', bestimmtheitStats, ort);
        }
      }
    }
  }
  return verses;
}

// ---------------------------------------------------------------------------
// 6. Hauptlauf
// ---------------------------------------------------------------------------

async function main() {
  const qacText = await ensureQac();
  const noorText = await ensureNoorBayan();

  console.log('QAC und NoorBayan-Quelle geladen, verifiziert (sha256 QAC ok). Parse …');

  const alleSegmente = parseQac(qacText);
  const noor = parseNoorBayan(noorText);

  mkdirSync(OUT_DIR, { recursive: true });

  const limitStats = { keineRelation: 0, kopfUnbekannt: 0, kopfGetilgtesWort: 0, kopfAndererVers: 0 };
  const bestimmtheitStats = { mudaf: 0, possessivsuffix: 0, widersprueche: [] };
  const posHaeufigkeit = new Map();
  const relHaeufigkeit = new Map();
  // Zur Nachprüfung, dass MOOD:SUBJ/JUS ankommen und MOOD:IND weiterhin (wie
  // seit Schema 1 empirisch belegt) nirgends im Korpus vorkommt — der
  // Indikativ bleibt im QAC-Feature-String grundsätzlich unmarkiert
  // (grammatischer Normalfall, keine Datenlücke). Zählt features.mood NACH
  // der Zuordnung, nicht die Rohwerte (die stehen in meta.json nicht, nur
  // hier zur Bau-Statistik).
  const moodHaeufigkeit = new Map();
  const rootMap = new Map();
  const lemmaMap = new Map();

  let gesamtSegmente = 0;
  let gesamtWoerter = 0;
  let gesamtVerse = 0;
  let groessteDatei = { sure: 0, bytes: 0 };
  let gesamtBytes = 0;

  // Segmente nach Sure gruppieren (Datei ist bereits sure-sortiert, aber wir
  // verlassen uns nicht darauf)
  const proSure = new Map();
  for (const seg of alleSegmente) {
    if (!proSure.has(seg.surah)) proSure.set(seg.surah, []);
    proSure.get(seg.surah).push(seg);
    gesamtSegmente++;
    posHaeufigkeit.set(seg.tag, (posHaeufigkeit.get(seg.tag) ?? 0) + 1);
  }

  for (let sure = 1; sure <= 114; sure++) {
    const segmenteDerSure = proSure.get(sure);
    if (!segmenteDerSure) throw new Error(`Sure ${sure} fehlt vollständig in der QAC-Quelle — Abbruch.`);
    const verses = buildWords(segmenteDerSure, noor, limitStats, bestimmtheitStats);

    // Fail-closed statt still zu null: genau dieses Fehlen einer solchen Prüfung
    // ließ MOOD:SUBJ (Vergleich gegen den falschen String "MOOD:SUB") bis Schema 3
    // unbemerkt jedes Subjunktiv-Verb im Korpus ohne Modus ausliefern. Bricht HIER
    // ab, bevor irgendeine Sure-Datei mit dem lückenhaften Wert geschrieben wird.
    if (unbekannteMerkmalswerte.length) {
      throw new Error(
        `Abbruch beim Bau von Sure ${sure}: ${unbekannteMerkmalswerte.length} Merkmalswert(e) ohne ` +
          `bekannte Zuordnung in parseFeatures() (MOOD/PRON/Verbform-Klammer) — würden sonst still zu ` +
          `null werden, siehe Kommentar bei unbekannteMerkmalswerte. Zuordnung ergänzen, dann neu bauen:\n` +
          unbekannteMerkmalswerte.map((u) => `  ${u.location ?? '?'}: ${u.feld}=${u.wert}`).join('\n'),
      );
    }

    for (const [verseStr, verseWords] of Object.entries(verses)) {
      gesamtVerse++;
      const vers = Number(verseStr);
      for (const w of verseWords) {
        gesamtWoerter++;
        if (w.root) {
          if (!rootMap.has(w.root)) rootMap.set(w.root, { count: 0, lemmas: new Set(), occurrences: [] });
          const e = rootMap.get(w.root);
          e.count++;
          if (w.lemma) e.lemmas.add(w.lemma);
          e.occurrences.push([sure, vers, w.position]);
        }
        if (w.lemma) {
          if (!lemmaMap.has(w.lemma)) lemmaMap.set(w.lemma, { count: 0, occurrences: [] });
          const e = lemmaMap.get(w.lemma);
          e.count++;
          e.occurrences.push([sure, vers, w.position]);
        }
        if (w.syntax) {
          relHaeufigkeit.set(w.syntax.relation, (relHaeufigkeit.get(w.syntax.relation) ?? 0) + 1);
        }
        for (const seg of w.segments) {
          const moodKey = seg.features.mood ?? 'null';
          moodHaeufigkeit.set(moodKey, (moodHaeufigkeit.get(moodKey) ?? 0) + 1);
        }
      }
    }

    const datei = { schema: 3, surah: sure, verses };
    const json = `${JSON.stringify(datei)}\n`;
    const zielPfad = path.join(OUT_DIR, `${sure}.json`);
    writeFileSync(zielPfad, json, 'utf8');
    const bytes = Buffer.byteLength(json, 'utf8');
    gesamtBytes += bytes;
    if (bytes > groessteDatei.bytes) groessteDatei = { sure, bytes };
  }

  // roots.json / lemmas.json
  const rootsOut = {};
  for (const [root, e] of rootMap) {
    rootsOut[root] = { count: e.count, lemmas: [...e.lemmas].sort(), occurrences: e.occurrences };
  }
  writeFileSync(path.join(OUT_DIR, 'roots.json'), `${JSON.stringify(rootsOut)}\n`, 'utf8');

  const lemmasOut = {};
  for (const [lemma, e] of lemmaMap) {
    lemmasOut[lemma] = { count: e.count, occurrences: e.occurrences };
  }
  writeFileSync(path.join(OUT_DIR, 'lemmas.json'), `${JSON.stringify(lemmasOut)}\n`, 'utf8');

  const meta = {
    schema: 3,
    gebaut: new Date().toISOString(),
    quellen: {
      qac: { datei: 'qac-0.4.txt', sha256: sha256(readFileSync(QAC_FILE)), url: QAC_URL },
      noorBayanQuranic: { datei: 'Quranic_utf8.csv', sha256: sha256(readFileSync(NOOR_FILE)), url: 'https://github.com/NoorBayan/Quranic' },
    },
    gesamt: {
      segmente: gesamtSegmente,
      woerter: gesamtWoerter,
      verse: gesamtVerse,
      suren: 114,
      wurzeln: rootMap.size,
      lemmata: lemmaMap.size,
    },
    posHaeufigkeit: Object.fromEntries([...posHaeufigkeit.entries()].sort((a, b) => b[1] - a[1])),
    relationHaeufigkeit: Object.fromEntries([...relHaeufigkeit.entries()].sort((a, b) => b[1] - a[1])),
    // "null" zählt jedes Segment ohne Modus (Nomen, Partikeln, Perfekt/
    // Imperativ-Verben UND Indikativ-Verben — der Indikativ bleibt im Korpus
    // grundsätzlich unmarkiert, siehe Kommentar bei moodHaeufigkeit oben).
    moodHaeufigkeit: Object.fromEntries([...moodHaeufigkeit.entries()].sort((a, b) => b[1] - a[1])),
    grenzfaelle: limitStats,
    // Bestimmtheits-Herleitung über Mudaf (Poss-Kopf) bzw. angehängtes
    // Possessivsuffix (siehe bestimmtheitErgaenzen) — Anzahl neu auf
    // "definite" gesetzter Segmente je Regel, plus Widersprüche: Segmente,
    // die die Regel-Bedingung erfüllen, aber bereits explizit INDEF im
    // Korpus tragen (dort bleibt INDEF unverändert stehen, siehe Funktion).
    bestimmtheitHerleitung: {
      mudaf: bestimmtheitStats.mudaf,
      possessivsuffix: bestimmtheitStats.possessivsuffix,
      widersprueche: bestimmtheitStats.widersprueche,
    },
    // Zeichen ohne verifizierte Buckwalter-Bedeutung (s. Kommentar bei
    // buckwalterToUnicode) — unverändert durchgereicht, hier zur Nachprüfung
    // aufgelistet statt geraten.
    bekannteLuecken,
    attribution: {
      qac: [
        'Quranic Arabic Corpus (morphology, version 0.4)',
        'Copyright (C) 2011 Kais Dukes',
        'License: GNU General Public License',
        '',
        'The Quranic Arabic Corpus includes syntactic and morphological annotation of the Quran, and builds on the verified Arabic text distributed by the Tanzil project.',
        '',
        'TERMS OF USE:',
        '- Permission is granted to copy and distribute verbatim copies of this file, but CHANGING IT IS NOT ALLOWED.',
        '- This annotation can be used in any website or application, provided its source (the Quranic Arabic Corpus) is clearly indicated, and a link is made to http://corpus.quran.com to enable users to keep track of changes.',
        '- This copyright notice shall be included in all verbatim copies of the text, and shall be reproduced appropriately in all works derived from or containing substantial portion of this file.',
        '',
        'Underlying Quran text: Tanzil Quran Text (Uthmani, version 1.0.2), Copyright (C) 2008-2009 Tanzil.info, License: Creative Commons BY-ND 3.0 Unported. Source (Tanzil.info) must be indicated, link to http://tanzil.info required, text must not be changed.',
      ].join('\n'),
      noorBayan: [
        'MIT License',
        '',
        'Copyright (c) 2025 NoorBayan',
        '',
        'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
        '',
        'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
        '',
        'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
        '',
        'Quelle: https://github.com/NoorBayan/Quranic',
      ].join('\n'),
    },
  };
  const metaJson = `${JSON.stringify(meta, null, 2)}\n`;
  writeFileSync(path.join(OUT_DIR, 'meta.json'), metaJson, 'utf8');
  gesamtBytes += Buffer.byteLength(metaJson, 'utf8') + statSync(path.join(OUT_DIR, 'roots.json')).size + statSync(path.join(OUT_DIR, 'lemmas.json')).size;

  if (bekannteLuecken.length) {
    console.log(`WARNUNG: ${bekannteLuecken.length} Zeichen ohne verifizierte Buckwalter-Bedeutung (Details in meta.json/bekannteLuecken):`);
    for (const l of bekannteLuecken) console.log(`  ${l.location}: "${l.zeichen}" in "${l.wert}"`);
  }

  console.log('--- Statistik ---');
  console.log(`Segmente verarbeitet: ${gesamtSegmente}`);
  console.log(`Wörter: ${gesamtWoerter}`);
  console.log(`Verse: ${gesamtVerse}`);
  console.log(`Suren: 114`);
  console.log(`Wurzeln: ${rootMap.size}, Lemmata: ${lemmaMap.size}`);
  console.log(`Gesamtgröße Ausgabe: ${(gesamtBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Größte Einzeldatei: Sure ${groessteDatei.sure}.json, ${(groessteDatei.bytes / 1024).toFixed(1)} KB`);
  console.log('Grenzfälle bei Kopf-Auflösung (syntax.head):', limitStats);
  console.log(
    `Bestimmtheits-Herleitung: +${bestimmtheitStats.mudaf} über Mudaf, ` +
      `+${bestimmtheitStats.possessivsuffix} über Possessivsuffix, ` +
      `${bestimmtheitStats.widersprueche.length} Widersprüche mit explizitem INDEF (unverändert gelassen).`,
  );
}

// Nur ausführen, wenn dieses Modul direkt gestartet wurde (node
// scripts/build-morphologie.mjs) — nicht, wenn build-morphologie.test.mjs
// parseFeatures() für einen Unit-Test importiert. Ohne diese Schranke würde
// jeder Import den kompletten Bau (Download/Parse aller 128.219 Segmente,
// Dateien schreiben) als Nebeneffekt auslösen.
const IST_DIREKT_GESTARTET = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IST_DIREKT_GESTARTET) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}

export { parseFeatures, unbekannteMerkmalswerte };
