#!/usr/bin/env node
// Prueft Vokabel- und Wortdatensaetze maschinell auf innere Widersprueche.
//
// Anlass (USER-TODO, 2026-07-28): In einer Vokabelliste stand als Stichwort
// „Reihe/Schlange" das Wort سَيْرٌ (sayrun, „Gehen"), waehrend die arabische
// Erklaerung im selben Datensatz صف من الناس lautete. Arabisch und Umschrift
// passten zueinander, nur die Bedeutung nicht — deshalb fiel es keiner
// Pruefung auf. Korrigiert wurde zu صَفٌّ / ṣaffun; offen blieb die Frage,
// ob es weitere solche Faelle gibt.
//
// Diese Pruefung deckt die maschinell entscheidbaren Faelle ab:
//
//   1. Umschrift gegen arabisches Konsonantengeruest. Findet Eintraege, bei
//      denen eines von beiden geaendert und das andere vergessen wurde —
//      genau die Haelfte des Fehlers oben, die nach einer Korrektur uebrig
//      bleiben kann.
//   2. Dasselbe arabische Wort mit widerspruechlicher deutscher Bedeutung.
//   3. Dieselbe deutsche Bedeutung mit verschiedenen arabischen Woertern.
//   4. Fehlende Sprachen in `meaning`.
//
// Was sie NICHT kann: beurteilen, ob eine Bedeutung inhaltlich richtig ist.
// Das bleibt Gegenlesen durch einen Menschen.
//
//   node scripts/vokabel-pruefung.mjs            nur Zusammenfassung
//   node scripts/vokabel-pruefung.mjs --alle     jeden Befund einzeln
import fs from 'fs';
import path from 'path';

const WURZEL = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ALLE = process.argv.includes('--alle');

const DATEIEN = [
  'src/features/study/data/madinah.json',
  'src/features/study/data/amau.json',
  'src/features/study/data/dialects.json',
  'src/features/learn/data/vocab.json',
  'src/features/learn/data/salah-words.json',
  'src/features/learn/data/fatiha-deep.json',
  'src/features/learn/data/letter-examples.json',
  'src/features/guides/guides.json',
];

// Dialekt-Eintraege weichen bewusst vom Hocharabischen ab (Aussprache statt
// Schriftbild), deshalb wird ihr Geruest-Befund nur nachrichtlich gezeigt.
const NUR_NACHRICHTLICH = new Set(['src/features/study/data/dialects.json']);

const SPRACHEN = ['de', 'en', 'tr', 'ar', 'es', 'fr', 'id', 'bn', 'fa', 'ms', 'ur', 'ru', 'sw', 'ps'];

// ------------------------------------------------------------ Normalisierung
// Arabischer Konsonant -> kanonisches Zeichen. Alif/Waw/Ya sind ausgelassen:
// sie stehen ebenso oft fuer einen Langvokal wie fuer einen Konsonanten, und
// eine Unterscheidung braeuchte Morphologie. Sie werden auf beiden Seiten
// verworfen, damit der Vergleich nicht an ihnen scheitert.
const AR = {
  ب: 'b', ت: 't', ث: 'T', ج: 'j', ح: 'H', خ: 'X', د: 'd', ذ: 'D', ر: 'r', ز: 'z',
  س: 's', ش: 'S', ص: 'c', ض: 'C', ط: 'y', ظ: 'Y', ع: 'A', غ: 'G', ف: 'f', ق: 'q',
  ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ة: 't', پ: 'b', چ: 'j', گ: 'k', ژ: 'z', ڤ: 'f',
};

function arGeruest(wort) {
  // Bestimmter Artikel weg: er steht im Arabischen als ال, in der Umschrift je
  // nach Folgekonsonant als al-/as-/ar-/aṭ- (Sonnenbuchstaben). Beide Seiten
  // ohne Artikel zu vergleichen ist einfacher als die Assimilation nachzubauen.
  let s = String(wort ?? '').replace(/[ً-ْٰـ]/g, '');
  s = s.replace(/^(وَ|فَ|بِ|لِ|ب|ل|و|ف)?ال/, '');
  return [...s]
    .map((z) => AR[z] ?? '')
    .join('')
    .replace(/(.)\1+/g, '$1'); // Verdopplung (Schadda) zusammenziehen
}

// Umschrift -> dieselben kanonischen Zeichen. Reihenfolge zaehlt: die
// Zweibuchstaben-Folgen muessen vor den Einzelbuchstaben ersetzt werden.
const LAT = [
  ['th', 'T'], ['dh', 'D'], ['kh', 'X'], ['sh', 'S'], ['gh', 'G'], ['ch', 'S'],
  ['ṯ', 'T'], ['ḏ', 'D'], ['ḫ', 'X'], ['š', 'S'], ['ġ', 'G'], ['ǧ', 'j'], ['ž', 'z'],
  ['ḥ', 'H'], ['ṣ', 'c'], ['ḍ', 'C'], ['ṭ', 'y'], ['ẓ', 'Y'], ['ʿ', 'A'], ['ʕ', 'A'],
  ['b', 'b'], ['t', 't'], ['j', 'j'], ['d', 'd'], ['r', 'r'], ['z', 'z'], ['s', 's'],
  ['f', 'f'], ['q', 'q'], ['k', 'k'], ['l', 'l'], ['m', 'm'], ['n', 'n'], ['h', 'h'],
  ['g', 'G'], ['p', 'b'], ['v', 'f'], ['c', 's'], ['x', 'X'],
];

function latGeruest(wort, arabischEndetAufNun = false) {
  let s = String(wort ?? '').toLowerCase();
  // Artikel zuerst, solange der Bindestrich noch da ist — inklusive der an den
  // Sonnenbuchstaben assimilierten Formen (as-, ar-, aṭ-, ash-, …).
  s = s.replace(/^(wa|fa|bi|li)?a(l|[a-zʾṣḍṭẓṯḏšḥġ]{1,2})[-‐]/, '');
  s = s.replace(/[ʾʼ'’`\-–—.,!?()[\]"«»]/g, ' ');
  // Tanwin bzw. Kasusendung: im Arabischen ein Vokalzeichen, im Schriftbild
  // also unsichtbar. Nur streichen, wenn das arabische Wort nicht selbst auf
  // Nun endet — sonst wuerde aus مَنْ / "man" faelschlich [mn] vs [m].
  if (!arabischEndetAufNun) s = s.replace(/(un|an|in)\b/g, ' ');
  s = s.replace(/(u|a|i)\b/g, ' ');
  let out = '';
  for (let i = 0; i < s.length; ) {
    const zwei = s.slice(i, i + 2);
    const treffer2 = LAT.find(([k]) => k.length === 2 && k === zwei);
    if (treffer2) { out += treffer2[1]; i += 2; continue; }
    const eins = s[i];
    const treffer1 = LAT.find(([k]) => k.length === 1 && k === eins);
    if (treffer1) out += treffer1[1];
    i += 1;
  }
  return out.replace(/(.)\1+/g, '$1');
}

/** Levenshtein-Abstand zweier Geruest-Zeichenketten. */
function abstand(a, b) {
  const zeile = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let vorher = zeile[0];
    zeile[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = zeile[j];
      zeile[j] = Math.min(zeile[j] + 1, zeile[j - 1] + 1, vorher + (a[i - 1] === b[j - 1] ? 0 : 1));
      vorher = tmp;
    }
  }
  return zeile[b.length];
}

// ---------------------------------------------------------------- Einsammeln
const eintraege = [];
function sammle(knoten, datei, pfad = '') {
  if (Array.isArray(knoten)) {
    knoten.forEach((k, i) => sammle(k, datei, `${pfad}[${i}]`));
    return;
  }
  if (!knoten || typeof knoten !== 'object') return;
  if (typeof knoten.arabic === 'string' && typeof knoten.translit === 'string') {
    eintraege.push({ datei, pfad, arabic: knoten.arabic, translit: knoten.translit, meaning: knoten.meaning });
  }
  for (const [k, v] of Object.entries(knoten)) sammle(v, datei, `${pfad}.${k}`);
}

for (const rel of DATEIEN) {
  const voll = path.join(WURZEL, rel);
  if (!fs.existsSync(voll)) { console.log(`FEHLT: ${rel}`); continue; }
  sammle(JSON.parse(fs.readFileSync(voll, 'utf8')), rel);
}

console.log(`Geprueft: ${eintraege.length} Eintraege aus ${DATEIEN.length} Dateien\n`);

// ------------------------------------------------------- 1. Geruest-Vergleich
const geruestAbweichung = [];
for (const e of eintraege) {
  // Mehrwortiges (Saetze, Wendungen) hat zu viele Freiheitsgrade fuer diesen
  // Vergleich — dort meldet er nur Rauschen.
  if (/\s/.test(e.arabic.trim()) || /\s/.test(e.translit.trim())) continue;
  const endetAufNun = /ن$/.test(e.arabic.replace(/[ً-ْٰـ]/g, ''));
  const a = arGeruest(e.arabic);
  const l = latGeruest(e.translit, endetAufNun);
  if (!a || !l) continue;
  // Ein Zeichen Unterschied ist Umschriftkonvention (Hamza, ta marbuta,
  // Nunation), nicht Verwechslung. Erst ab zwei lohnt das Hinsehen.
  if (abstand(a, l) >= 2) geruestAbweichung.push({ ...e, a, l });
}

const echt = geruestAbweichung.filter((e) => !NUR_NACHRICHTLICH.has(e.datei));
const nachrichtlich = geruestAbweichung.filter((e) => NUR_NACHRICHTLICH.has(e.datei));

console.log(`1. Umschrift passt nicht zum arabischen Konsonantengeruest: ${echt.length} Verdachtsfaelle`);
for (const e of ALLE ? echt : echt.slice(0, 25)) {
  console.log(`   ${e.arabic}  "${e.translit}"  [${e.a} vs ${e.l}]  ${e.datei}${e.pfad}`);
}
if (!ALLE && echt.length > 25) console.log(`   … ${echt.length - 25} weitere (--alle)`);
console.log(`   (Dialekte, nur nachrichtlich: ${nachrichtlich.length})\n`);

// ------------------------------------------- 2./3. Widerspruechliche Paarungen
const nachArabisch = new Map();
const nachDeutsch = new Map();
const ohneDiakritika = (s) => String(s).replace(/[ً-ْـۖ-ۭ]/g, '').trim();
// „ein Haus" und „Haus" sind dieselbe Angabe, ebenso „dieser" und „dieser
// (nah, maennlich)". Ohne diese Normalisierung besteht der Befund fast nur
// aus solchen Paaren und die echten Widersprueche gehen darin unter.
const deNorm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(ein|eine|einen|einem|einer|der|die|das|den|dem|zu|the|a|an)\b/g, '')
    .replace(/[^\p{L}\p{N}\/]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
for (const e of eintraege) {
  if (!e.meaning?.de) continue;
  const ar = ohneDiakritika(e.arabic);
  const de = deNorm(e.meaning.de);
  if (!de) continue;
  if (!nachArabisch.has(ar)) nachArabisch.set(ar, new Map());
  nachArabisch.get(ar).set(de, e);
  if (!nachDeutsch.has(de)) nachDeutsch.set(de, new Map());
  nachDeutsch.get(de).set(ar, e);
}

const mehrdeutig = [...nachArabisch.entries()].filter(([, m]) => m.size > 1);
console.log(`2. Gleiches arabisches Wort, verschiedene deutsche Bedeutung: ${mehrdeutig.length}`);
for (const [ar, m] of ALLE ? mehrdeutig : mehrdeutig.slice(0, 15)) {
  console.log(`   ${ar}: ${[...m.keys()].map((d) => `„${d}"`).join(' / ')}`);
}
if (!ALLE && mehrdeutig.length > 15) console.log(`   … ${mehrdeutig.length - 15} weitere (--alle)`);

const mehrfach = [...nachDeutsch.entries()].filter(([, m]) => m.size > 1);
console.log(`\n3. Gleiche deutsche Bedeutung, verschiedene arabische Woerter: ${mehrfach.length}`);
for (const [de, m] of ALLE ? mehrfach : mehrfach.slice(0, 15)) {
  console.log(`   „${de}": ${[...m.keys()].join(' / ')}`);
}
if (!ALLE && mehrfach.length > 15) console.log(`   … ${mehrfach.length - 15} weitere (--alle)`);

// --------------------------------------------------------- 4. Sprachdeckung
const luecken = new Map();
for (const e of eintraege) {
  if (!e.meaning || typeof e.meaning !== 'object') continue;
  for (const s of SPRACHEN) {
    if (!e.meaning[s] || !String(e.meaning[s]).trim()) luecken.set(s, (luecken.get(s) ?? 0) + 1);
  }
}
const mitMeaning = eintraege.filter((e) => e.meaning && typeof e.meaning === 'object').length;
console.log(`\n4. Fehlende Sprachen (von ${mitMeaning} Eintraegen mit Bedeutungsfeld):`);
if (!luecken.size) console.log('   keine');
for (const [s, n] of [...luecken.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${s}: ${n} fehlen`);

const summe = echt.length + mehrdeutig.length;
console.log(`\nZu pruefende Verdachtsfaelle gesamt: ${summe}`);
