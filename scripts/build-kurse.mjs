// Baut die 2026-07-28 ergaenzten Studien-Lektionen aus kuratierten Specs.
//
// Warum ein Generator statt handgeschriebener Kurs-JSONs:
// Jede Lektion muss in ALLEN 14 App-Sprachen vorliegen (siehe
// src/features/content-i18n.test.ts). Der groesste Teil des Stoffes liegt
// bereits geprueft und 14-sprachig im Repo — naemlich als KI-Wissensschicht
// (src/features/ki/wissen-*.json: 192 Eintraege, jeder in de + 13 Sprachen,
// jeder mit Belegen). Ein Abschnitt, der auf einen dieser Eintraege verweist
// ({"ref": "<id>"}), wird hier woertlich in alle 14 Sprachen expandiert.
// Damit wird kuratiert und geordnet statt neu erfunden, und die Uebersetzung
// ist per Konstruktion so geprueft wie der Bestand.
//
// Abschnitte, fuer die es keinen Bestands-Eintrag gibt (die systematische
// Fiqh-Ebene: Arkan/Schurut/Wadschibat/Mubtilat, Biografien), stehen als
// literale 14-Sprachen-Objekte in den Specs.
//
// Ausfuehren: cd apps/mobile && node scripts/build-kurse.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const KI = path.join(MOBILE, 'src', 'features', 'ki');
const DATA = path.join(MOBILE, 'src', 'features', 'study', 'data');
const SPECS = path.join(HIER, 'data', 'kurse-2026-07-28');

const LOCALES = ['de', 'en', 'tr', 'ar', 'es', 'fr', 'id', 'bn', 'fa', 'ms', 'ur', 'sw', 'ru', 'ps'];
const SPRACH_DATEIEN = new Set(LOCALES.filter((l) => l !== 'de').map((l) => `wissen-${l}.json`));

/** id -> { locale -> { titel, text } } aus der geprueften Wissensschicht. */
const wissen = new Map();
for (const datei of readdirSync(KI)) {
  if (!datei.startsWith('wissen-') || !datei.endsWith('.json')) continue;
  const locale = SPRACH_DATEIEN.has(datei) ? datei.slice('wissen-'.length, -'.json'.length) : 'de';
  const json = JSON.parse(readFileSync(path.join(KI, datei), 'utf8'));
  for (const eintrag of json.eintraege ?? []) {
    if (!wissen.has(eintrag.id)) wissen.set(eintrag.id, {});
    wissen.get(eintrag.id)[locale] = { titel: eintrag.titel, text: eintrag.text };
  }
}

let fehler = 0;
const meld = (msg) => {
  console.log(`FEHLER  ${msg}`);
  fehler++;
};

function expandiere(abschnitt, lektionId) {
  if (!abschnitt.ref) {
    for (const feld of ['title', 'text']) {
      for (const locale of LOCALES) {
        if (!abschnitt[feld]?.[locale]?.trim()) meld(`${lektionId}: literaler Abschnitt ohne ${feld}.${locale}`);
      }
    }
    return { title: abschnitt.title, text: abschnitt.text };
  }
  const eintrag = wissen.get(abschnitt.ref);
  if (!eintrag) {
    meld(`${lektionId}: unbekannte Wissens-id "${abschnitt.ref}"`);
    return { title: {}, text: {} };
  }
  const title = {};
  const text = {};
  for (const locale of LOCALES) {
    if (!eintrag[locale]) {
      meld(`${lektionId}: Wissens-Eintrag "${abschnitt.ref}" fehlt in ${locale}`);
      continue;
    }
    title[locale] = abschnitt.title?.[locale] ?? eintrag[locale].titel;
    text[locale] = eintrag[locale].text;
  }
  return { title, text };
}

function baueLektion(spec) {
  for (const locale of LOCALES) {
    if (!spec.title?.[locale]?.trim()) meld(`${spec.id}: Lektionstitel fehlt in ${locale}`);
  }
  if (!spec.source?.trim()) meld(`${spec.id}: source fehlt`);
  const story = (spec.story ?? []).map((a) => expandiere(a, spec.id));
  if (story.length < 3) meld(`${spec.id}: weniger als 3 Abschnitte`);
  const storyQuiz = (spec.storyQuiz ?? []).map((frage) => {
    for (const locale of LOCALES) {
      if (!frage.q?.[locale]?.trim()) meld(`${spec.id}: Quizfrage ohne q.${locale}`);
    }
    if (frage.options?.length !== 4) meld(`${spec.id}: Quizfrage braucht genau 4 Optionen`);
    for (const option of frage.options ?? []) {
      for (const locale of LOCALES) {
        if (!option?.[locale]?.trim()) meld(`${spec.id}: Quiz-Option ohne ${locale}`);
      }
    }
    return { q: frage.q, options: frage.options };
  });
  if (storyQuiz.length < 3) meld(`${spec.id}: weniger als 3 Quizfragen`);
  return { id: spec.id, kind: 'story', title: spec.title, source: spec.source, story, storyQuiz };
}

/** Specs eines Kurses liegen als <kurs>.NN.json vor und werden der Reihe nach gelesen. */
function ladeSpecs(kurs) {
  const dateien = readdirSync(SPECS)
    .filter((d) => d.startsWith(`${kurs}.`) && d.endsWith('.json'))
    .sort();
  return dateien.flatMap((d) => JSON.parse(readFileSync(path.join(SPECS, d), 'utf8')).lessons ?? []);
}

const KURSE = ['fiqh-ibadat', 'akhlaq', 'nikah', 'sahaba'];

for (const kurs of KURSE) {
  const neue = ladeSpecs(kurs).map(baueLektion);
  if (neue.length === 0) {
    meld(`${kurs}: keine Spec gefunden`);
    continue;
  }
  const ziel = path.join(DATA, `${kurs}.json`);
  let bestand = { lessons: [] };
  try {
    bestand = JSON.parse(readFileSync(ziel, 'utf8'));
  } catch {
    /* neuer Kurs */
  }
  const neuIds = new Set(neue.map((l) => l.id));
  const lessons = [...bestand.lessons.filter((l) => !neuIds.has(l.id)), ...neue];
  writeFileSync(ziel, `${JSON.stringify({ lessons }, null, 2)}\n`, 'utf8');
  console.log(`${kurs}: ${neue.length} neue Lektionen, ${lessons.length} gesamt -> ${path.relative(MOBILE, ziel)}`);
}

console.log(`\n${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
