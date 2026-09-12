// Pflicht-Verifikation für scripts/build-morphologie.mjs — prüft die ERZEUGTEN
// Dateien unter .daten-cache/out/morphologie/, nicht den Bau-Code selbst.
//
// Läuft NICHT über Jest (das Projekt hat keine .mjs-Testdatei-Konvention, und
// jest-expos Standard-testMatch greift ohnehin nur bei .ts/.tsx/.js/.jsx —
// eine .test.mjs würde stillschweigend NIE ausgeführt). Stattdessen Nodes
// eingebauter Testrunner, verfügbar ohne neue Abhängigkeit:
//
//   cd apps/mobile && node --test scripts/build-morphologie.test.mjs
//
// Voraussetzung: scripts/build-morphologie.mjs wurde vorher einmal ausgeführt
// (erzeugt .daten-cache/out/morphologie/*.json).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeatures, unbekannteMerkmalswerte } from './build-morphologie.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
// v3: siehe MORPHOLOGIE_VERSION in build-morphologie.mjs (Versionspfad wegen
// immutable Cache-Control bei der Auslieferung).
const OUT_DIR = path.join(MOBILE, '.daten-cache', 'out', 'morphologie', 'v3');

// Verszahl je Sure in der Hafs-Zählung (Summe 6236) — wörtlich übernommen aus
// src/features/quran/korpus-koran.test.ts (dort am 2026-07-27 gegen
// api.alquran.cloud/v1/surah UND api.quran.com/api/v4/chapters geprüft), NICHT
// neu erfunden.
const AYAHS_PER_SURAH = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];
const TOTAL_AYAHS = 6236;
const TOTAL_WOERTER = 77429;
const TOTAL_SEGMENTE = 128219;

function ladeSure(sure) {
  const p = path.join(OUT_DIR, `${sure}.json`);
  if (!existsSync(p)) {
    throw new Error(`${p} fehlt — erst "node scripts/build-morphologie.mjs" ausführen.`);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

test('Selbstkontrolle: Referenztabelle kennt 114 Suren, Summe 6236', () => {
  assert.equal(AYAHS_PER_SURAH.length, 114);
  assert.equal(AYAHS_PER_SURAH.reduce((a, b) => a + b, 0), TOTAL_AYAHS);
});

test('alle 114 Suren vorhanden, Verszahl je Sure stimmt mit der Hafs-Zählung überein', () => {
  const fehlend = [];
  const falscheVerszahl = [];
  for (let sure = 1; sure <= 114; sure++) {
    const p = path.join(OUT_DIR, `${sure}.json`);
    if (!existsSync(p)) {
      fehlend.push(sure);
      continue;
    }
    const daten = ladeSure(sure);
    assert.equal(daten.schema, 3, `Sure ${sure}: schema muss 3 sein`);
    assert.equal(daten.surah, sure, `Sure ${sure}: surah-Feld muss ${sure} sein`);
    const anzahlVerse = Object.keys(daten.verses).length;
    const erwartet = AYAHS_PER_SURAH[sure - 1];
    if (anzahlVerse !== erwartet) falscheVerszahl.push({ sure, erwartet, gefunden: anzahlVerse });
    for (let vers = 1; vers <= erwartet; vers++) {
      assert.ok(daten.verses[String(vers)], `Sure ${sure} Vers ${vers} fehlt`);
    }
  }
  assert.deepEqual(fehlend, [], `fehlende Suren: ${fehlend.join(', ')}`);
  assert.deepEqual(falscheVerszahl, [], `falsche Verszahl: ${JSON.stringify(falscheVerszahl)}`);
});

test('Summe der Wörter = 77.429, Summe der Segmente = 128.219', () => {
  let woerter = 0;
  let segmente = 0;
  for (let sure = 1; sure <= 114; sure++) {
    const daten = ladeSure(sure);
    for (const verseWords of Object.values(daten.verses)) {
      woerter += verseWords.length;
      for (const w of verseWords) segmente += w.segments.length;
    }
  }
  assert.equal(woerter, TOTAL_WOERTER);
  assert.equal(segmente, TOTAL_SEGMENTE);
});

test('kein Wort ohne mindestens ein Segment, kein Segment ohne pos, jedes raw nicht leer', () => {
  const verstoesse = [];
  for (let sure = 1; sure <= 114; sure++) {
    const daten = ladeSure(sure);
    for (const [vers, verseWords] of Object.entries(daten.verses)) {
      for (const w of verseWords) {
        if (!Array.isArray(w.segments) || w.segments.length === 0) {
          verstoesse.push(`${sure}:${vers}:${w.position} ohne Segment`);
          continue;
        }
        for (const seg of w.segments) {
          if (!seg.pos) verstoesse.push(`${sure}:${vers}:${w.position} Segment ohne pos`);
          if (!seg.raw || !seg.raw.trim()) verstoesse.push(`${sure}:${vers}:${w.position} raw leer`);
        }
      }
    }
  }
  assert.deepEqual(verstoesse, []);
});

test('Wortpositionen je Vers sind lückenlos 1..n', () => {
  const verstoesse = [];
  for (let sure = 1; sure <= 114; sure++) {
    const daten = ladeSure(sure);
    for (const [vers, verseWords] of Object.entries(daten.verses)) {
      const positionen = verseWords.map((w) => w.position).sort((a, b) => a - b);
      const erwartet = verseWords.map((_, i) => i + 1);
      if (JSON.stringify(positionen) !== JSON.stringify(erwartet)) {
        verstoesse.push(`${sure}:${vers} hat Positionen ${JSON.stringify(positionen)}, erwartet ${JSON.stringify(erwartet)}`);
      }
    }
  }
  assert.deepEqual(verstoesse, []);
});

test('Stichprobe 1:2:3 (رَبِّ) trägt die Relation badal (App)', () => {
  const daten = ladeSure(1);
  const wort = daten.verses['2'].find((w) => w.position === 3);
  assert.ok(wort, '1:2:3 nicht gefunden');
  // .normalize('NFC'): Kombinationszeichen (Shadda/Kasra) können in
  // unterschiedlicher, visuell identischer Reihenfolge vorliegen — NFC
  // sortiert sie kanonisch nach Combining-Class, bevor verglichen wird.
  assert.equal(wort.text.normalize('NFC'), 'رَبِّ'.normalize('NFC'));
  assert.ok(wort.syntax, '1:2:3 hat keine syntax');
  assert.equal(wort.syntax.relation, 'App');
});

test('Stichprobe 1:5:4 (نَسْتَعِينُ) trägt die Relation conj', () => {
  const daten = ladeSure(1);
  const wort = daten.verses['5'].find((w) => w.position === 4);
  assert.ok(wort, '1:5:4 nicht gefunden');
  assert.ok(wort.syntax, '1:5:4 hat keine syntax');
  assert.equal(wort.syntax.relation, 'conj');
});

test('Stichprobe 1:1:1 ist ein Präfix "bi" mit POS P', () => {
  const daten = ladeSure(1);
  const wort = daten.verses['1'].find((w) => w.position === 1);
  assert.ok(wort, '1:1:1 nicht gefunden');
  const erstesSegment = wort.segments[0];
  assert.equal(erstesSegment.kind, 'prefix');
  assert.equal(erstesSegment.pos, 'P');
});

// ---------------------------------------------------------------------------
// MOOD-Zuordnung (parseFeatures in build-morphologie.mjs) — Regression: bis
// Schema 3 verglich der Code MOOD-Werte gegen den String "MOOD:SUB", das
// Korpus schreibt den Subjunktiv aber als "MOOD:SUBJ". Traf korpusweit 1.330
// Segmente (0 davon "MOOD:SUB") — jedes Subjunktiv-Verb hatte features.mood
// === null statt "sub", ohne jede Fehlermeldung.
// ---------------------------------------------------------------------------

test('Regression MOOD:SUBJ -> sub: 2:24:5 (تَفْعَلُوا۟, "MOOD:SUBJ" im Korpus) trägt features.mood "sub"', () => {
  const daten = ladeSure(2);
  const wort = daten.verses['24'].find((w) => w.position === 5);
  assert.ok(wort, '2:24:5 nicht gefunden');
  const stamm = wort.segments.find((s) => s.kind === 'stem');
  assert.equal(stamm.pos, 'V');
  assert.match(stamm.raw, /MOOD:SUBJ/, 'Testfall muss tatsächlich MOOD:SUBJ im Rohwert tragen');
  assert.equal(stamm.features.mood, 'sub');
});

test('unbekannter MOOD-Wert rutscht nicht mehr still zu null durch, sondern wird protokolliert', () => {
  const vorher = unbekannteMerkmalswerte.length;
  const { features } = parseFeatures(['STEM', 'POS:V', 'IMPF', 'MOOD:XYZ'], 'V', false, '99:9:9:9');
  // Ohne bekannte Zuordnung bleibt der Wert zwar (wie bei jedem echten Merkmal
  // ohne Angabe) null — aber NICHT mehr spurlos: unbekannteMerkmalswerte
  // (siehe build-morphologie.mjs, dort Abbruch-Prüfung in main()) muss den
  // Fall festhalten, statt ihn wie vor der Regression kommentarlos zu verwerfen.
  assert.equal(features.mood, null);
  assert.equal(unbekannteMerkmalswerte.length, vorher + 1);
  const eintrag = unbekannteMerkmalswerte[unbekannteMerkmalswerte.length - 1];
  assert.equal(eintrag.feld, 'MOOD');
  assert.equal(eintrag.wert, 'XYZ');
  assert.equal(eintrag.location, '99:9:9:9');
});

test('bekannte MOOD-Werte (IND/SUBJ/JUS) erzeugen KEINEN Eintrag in unbekannteMerkmalswerte', () => {
  const vorher = unbekannteMerkmalswerte.length;
  parseFeatures(['STEM', 'POS:V', 'IMPF', 'MOOD:IND'], 'V', false, '1:1:1:1');
  parseFeatures(['STEM', 'POS:V', 'IMPF', 'MOOD:SUBJ'], 'V', false, '1:1:1:1');
  parseFeatures(['STEM', 'POS:V', 'IMPF', 'MOOD:JUS'], 'V', false, '1:1:1:1');
  assert.equal(unbekannteMerkmalswerte.length, vorher);
});

// ---------------------------------------------------------------------------
// Bestimmtheits-Herleitung v2 (bestimmtheitErgaenzen in build-morphologie.mjs)
// — Mudaf und Possessivsuffix ergänzen `state: "definite"`, ein explizites
// INDEF im Korpus wird nie überschrieben. Siehe PRUEFBERICHT-HERLEITUNG.md
// Abschnitt B.
// ---------------------------------------------------------------------------

test('1:1:1 (بِسْمِ) ist als Mudaf hergeleitet bestimmt (Kopf der Poss-Relation von 1:1:2)', () => {
  const daten = ladeSure(1);
  const kopf = daten.verses['1'].find((w) => w.position === 2);
  assert.equal(kopf.syntax.relation, 'Poss');
  assert.equal(kopf.syntax.head, 1);
  const wort = daten.verses['1'].find((w) => w.position === 1);
  const stamm = wort.segments.find((s) => s.kind === 'stem');
  assert.equal(stamm.features.state, 'definite');
  assert.ok(stamm.derived.includes('state'), 'state muss in derived stehen (Herleitung, kein Korpusbeleg)');
});

test('2:4:9 (قَبْلِكَ) ist über das Possessivsuffix hergeleitet bestimmt', () => {
  const daten = ladeSure(2);
  const wort = daten.verses['4'].find((w) => w.position === 9);
  assert.ok(wort, '2:4:9 nicht gefunden');
  assert.ok(wort.segments.some((s) => s.kind === 'suffix' && s.pos === 'PRON'));
  const stamm = wort.segments.find((s) => s.kind === 'stem');
  assert.equal(stamm.pos, 'N');
  assert.equal(stamm.features.state, 'definite');
  assert.ok(stamm.derived.includes('state'));
});

test('2:2:6 (هُدًى) bleibt explizit indefinite — Korpus-Aussage (INDEF) wird nie überschrieben', () => {
  const daten = ladeSure(2);
  const wort = daten.verses['2'].find((w) => w.position === 6);
  assert.ok(wort, '2:2:6 nicht gefunden');
  const stamm = wort.segments.find((s) => s.kind === 'stem');
  assert.equal(stamm.features.state, 'indefinite');
  assert.ok(!stamm.derived.includes('state'), 'state ist hier Korpus-Beleg, keine Herleitung');
});

test('meta.json: bestimmtheitHerleitung hat plausible Werte (>4000 je Regel, keine Widersprüche negativ)', () => {
  const meta = JSON.parse(readFileSync(path.join(OUT_DIR, 'meta.json'), 'utf8'));
  assert.equal(meta.schema, 3);
  assert.ok(meta.bestimmtheitHerleitung, 'meta.json muss bestimmtheitHerleitung enthalten');
  assert.ok(meta.bestimmtheitHerleitung.mudaf > 4000);
  assert.ok(meta.bestimmtheitHerleitung.possessivsuffix > 4000);
  assert.ok(Array.isArray(meta.bestimmtheitHerleitung.widersprueche));
});

// ---------------------------------------------------------------------------
// Wortzahl je Vers gegen die tatsächliche Wort-für-Wort-Liste von quran.com
// prüfen — derselbe Endpunkt wie fetchSurahWordByWord in
// src/features/quran/api.ts (verses/by_chapter, words=true, char_type_name
// "word" zählt, "end"-Pseudowörter wie die Versnummer nicht). Entscheidend,
// weil der Reader Wörter über die POSITION zuordnet: ein Versatz zeigt sonst
// falsche Grammatik am falschen Wort an.
// ---------------------------------------------------------------------------

async function quranComWortzahlen(surahNumber) {
  const url = `https://api.quran.com/api/v4/verses/by_chapter/${surahNumber}?words=true&word_fields=text_uthmani&per_page=300`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`quran.com HTTP ${r.status} für Sure ${surahNumber}`);
  const j = await r.json();
  return j.verses.map((v) => v.words.filter((w) => w.char_type_name === 'word').length);
}

for (const surahNumber of [1, 112, 113, 114]) {
  test(`Wortzahl je Vers von Sure ${surahNumber} stimmt mit quran.com überein`, async () => {
    const erwartet = await quranComWortzahlen(surahNumber);
    const daten = ladeSure(surahNumber);
    const gefunden = [];
    for (let vers = 1; vers <= erwartet.length; vers++) {
      gefunden.push((daten.verses[String(vers)] ?? []).length);
    }
    assert.deepEqual(gefunden, erwartet, `Sure ${surahNumber}: eigene Wortzahlen ${JSON.stringify(gefunden)} vs. quran.com ${JSON.stringify(erwartet)}`);
  });
}

test('Wortzahl je Vers von Sure 2:1-10 stimmt mit quran.com überein', async () => {
  const erwartetGanzeSure = await quranComWortzahlen(2);
  const erwartet = erwartetGanzeSure.slice(0, 10);
  const daten = ladeSure(2);
  const gefunden = [];
  for (let vers = 1; vers <= 10; vers++) {
    gefunden.push((daten.verses[String(vers)] ?? []).length);
  }
  assert.deepEqual(gefunden, erwartet, `Sure 2 (1-10): eigene Wortzahlen ${JSON.stringify(gefunden)} vs. quran.com ${JSON.stringify(erwartet)}`);
});
