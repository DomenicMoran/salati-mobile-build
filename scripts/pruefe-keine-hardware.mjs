#!/usr/bin/env node
// Stellt sicher, dass NIRGENDS Hardware angeboten wird.
//
// Hintergrund: Salatibox war urspruenglich als HDMI-Stick mit eigenem ROM
// geplant. Das Geschaeft ist zurueckgestellt (Entscheidung 2026-07-31) — es gibt
// keine Domain, keine Zahlungsabwicklung und keine Geraete. Ausgeliefert werden
// nur die Apps und die Webseite.
//
// Bliebe irgendwo ein Satz stehen, der einen Stick verspricht, waere das ein
// Versprechen ohne Lieferung: gegenueber Nutzern irrefuehrend, im Store ein
// Ablehnungsgrund und wettbewerbsrechtlich angreifbar. Deshalb wird es geprueft
// statt erinnert.
//
// Geprueft wird, was den Nutzer erreicht: die Store-Texte aller Sprachen, die
// sichtbaren App-Texte und die Inhalte der Webseite. NICHT geprueft wird
// `apps/web` — das IST die zurueckgestellte Verkaufsseite; dass sie nirgends
// ausgeliefert wird, sichert `.github/workflows/release-web.yml`.
//
// Aufruf: node scripts/pruefe-keine-hardware.mjs   (Exit 1 bei Fund)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Begriffe, die ein Hardware-Angebot verraten. Bewusst eng gefasst: „Geraet"
 * oder „Produkt" allein sind in einer App voellig normal („dein Geraet",
 * „Produktdaten") und wuerden nur Rauschen erzeugen.
 */
const VERDAECHTIG = [
  /\bhdmi\b/i,
  /\ballwinner\b/i,
  /\bamlogic\b/i,
  /\btv[- ]?stick\b/i,
  /\bgebetsuhr[- ]?stick\b/i,
  /\bvorbestell/i,
  /\bin den warenkorb\b/i,
  /\bjetzt bestellen\b/i,
  /\bstick kaufen\b/i,
  /\bcustom[- ]rom\b/i,
];

/**
 * Echte Fundstellen, die harmlos sind — mit Begruendung, damit niemand sie
 * spaeter fuer einen Fehler haelt.
 */
const ERLAUBT = [
  /tooth-?stick/i, // Siwak, in den Fiqh-Texten
  /sticks? (far )?better/i, // englische Redewendung in den Lerntexten
  /yardstick/i,
];

/**
 * Verzeichnisse, die kein Text sind, den jemand liest. `public/models` enthaelt
 * die Spracherkennungsmodelle — deren `tokenizer.json` listet das GESAMTE
 * Vokabular, also zwangslaeufig auch „HDMI". Das als Hardware-Angebot zu
 * melden waere Rauschen.
 */
const UEBERSPRINGEN = [/[\\/]models[\\/]/i, /[\\/]node_modules[\\/]/];

function dateien(wurzel, endungen) {
  if (!existsSync(wurzel)) return [];
  const raus = [];
  for (const eintrag of readdirSync(wurzel)) {
    const p = path.join(wurzel, eintrag);
    if (UEBERSPRINGEN.some((m) => m.test(p))) continue;
    const s = statSync(p);
    if (s.isDirectory()) raus.push(...dateien(p, endungen));
    else if (endungen.some((e) => eintrag.endsWith(e))) raus.push(p);
  }
  return raus;
}

const ZIELE = [
  ['Store-Texte', dateien(path.join(MOBILE, 'store', 'listing'), ['.md'])],
  ['App-Texte', dateien(path.join(MOBILE, 'src', 'locales'), ['.json'])],
  ['Webseite', dateien(path.join(MOBILE, 'public'), ['.html', '.txt', '.json'])],
];

let funde = 0;
for (const [bereich, liste] of ZIELE) {
  let getroffen = 0;
  for (const datei of liste) {
    const text = readFileSync(datei, 'utf8');
    for (const muster of VERDAECHTIG) {
      for (const treffer of text.matchAll(new RegExp(muster.source, muster.flags.includes('g') ? muster.flags : muster.flags + 'g'))) {
        const um = text.slice(Math.max(0, treffer.index - 60), treffer.index + 60).replace(/\s+/g, ' ');
        if (ERLAUBT.some((e) => e.test(um))) continue;
        console.error(`FUND  ${path.relative(MOBILE, datei)}: …${um}…`);
        getroffen++;
        funde++;
      }
    }
  }
  console.log(`${getroffen === 0 ? 'OK   ' : 'FEHLER'} ${bereich.padEnd(12)} ${liste.length} Dateien${getroffen ? ` — ${getroffen} Fund(e)` : ''}`);
}

if (funde > 0) {
  console.error(`\n${funde} Stelle(n) bieten Hardware an. Das Geschaeft ist zurueckgestellt — bitte entfernen.`);
  process.exit(1);
}
console.log('\nKein Hardware-Angebot in Store-Texten, App-Texten oder Webseite.');
