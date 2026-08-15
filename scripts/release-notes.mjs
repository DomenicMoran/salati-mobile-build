#!/usr/bin/env node
// Erzeugt die Store-Release-Notes aus EINER Quelle: src/features/changelog/changelog.ts.
//
// Bis 27.07.2026 gab es drei Pflegeorte fuer denselben Text (Changelog-Screen
// in der App, store/release-notes-<version>.json fuer Play, store/whatsnew-
// <version>.json fuer App Store Connect) - siehe
// docs/audit-2026-07-27/AUSLIEFERUNG.md. Ab jetzt ist changelog.ts die Quelle,
// die beiden JSON-Dateien sind generierte Artefakte.
//
// Usage:
//   node scripts/release-notes.mjs                 # neueste Version im Changelog
//   node scripts/release-notes.mjs 1.31.0          # bestimmte Version
//   node scripts/release-notes.mjs --check         # nur pruefen, nichts schreiben
//   node scripts/release-notes.mjs --overwrite     # auch handuebersetzte Sprachen neu erzeugen
//
// Sprachpolitik (identisch zu changelog.ts und getChangelogText()): eigene
// Texte gibt es nur auf Deutsch und Englisch, alle anderen Store-Sprachen
// bekommen den englischen Text. Bereits vorhandene HANDuebersetzungen einer
// Sprache bleiben erhalten (sonst gingen sie bei jedem Lauf verloren) - mit
// --overwrite werden auch sie durch die Changelog-Fassung ersetzt.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(HIER, '..');
const CHANGELOG_TS = path.join(APP_ROOT, 'src/features/changelog/changelog.ts');
const STORE_DIR = path.join(APP_ROOT, 'store');

/** Google Play: harte Grenze 500 Zeichen pro Sprache. */
const PLAY_MAX = 500;
/** App Store Connect "Was ist neu": 4000 Zeichen. */
const ASC_MAX = 4000;

// Store-Sprachen, in denen Salati gelistet ist. Der Wert sagt, welcher
// Changelog-Text verwendet wird ('de' oder 'en').
const PLAY_LOCALES = { 'de-DE': 'de', 'en-US': 'en', 'tr-TR': 'en', ar: 'en', 'es-ES': 'en', 'fr-FR': 'en' };
const ASC_LOCALES = {
  'de-DE': 'de',
  de: 'de',
  'en-US': 'en',
  'en-GB': 'en',
  tr: 'en',
  ar: 'en',
  'es-ES': 'en',
  'es-MX': 'en',
  'fr-FR': 'en',
};

// Reihenfolge im Store-Text: erst was neu ist, dann Verbesserungen, dann
// Fehlerbehebungen. Passt zu dem, was Nutzer im Store-Eintrag zuerst sehen
// wollen, und bestimmt gleichzeitig, was bei Platzmangel zuerst wegfaellt.
const TYP_REIHENFOLGE = ['feature', 'improvement', 'fix'];

/**
 * Importiert changelog.ts direkt. Node >= 22.18 entfernt die Typannotationen
 * selbst (Type-Stripping), die Datei enthaelt ausser Interfaces/Typen nur
 * gewoehnliches JS - es braucht also weder einen Build-Schritt noch ein
 * eigenes Parsen der Datei.
 */
async function ladeChangelog() {
  const modul = await import(pathToFileURL(CHANGELOG_TS).href);
  if (!Array.isArray(modul.CHANGELOG)) throw new Error(`Kein CHANGELOG-Array in ${CHANGELOG_TS}`);
  return modul.CHANGELOG;
}

/** Kuerzt auf `max` Zeichen an einer Wortgrenze und haengt ein Auslassungszeichen an. */
function kuerze(text, max) {
  if (text.length <= max) return text;
  const roh = text.slice(0, max - 1);
  const luecke = roh.lastIndexOf(' ');
  return `${(luecke > max * 0.6 ? roh.slice(0, luecke) : roh).trimEnd()}…`;
}

/**
 * Baut den Store-Text einer Sprache: Eintraege nach Typ sortiert, durch eine
 * Leerzeile getrennt. Passt nicht alles in `max`, fallen die hinteren
 * (unwichtigeren) Eintraege komplett weg statt mitten im Satz abzuschneiden.
 */
function baueText(eintraege, sprache, max) {
  const sortiert = [...eintraege].sort(
    (a, b) => TYP_REIHENFOLGE.indexOf(a.type) - TYP_REIHENFOLGE.indexOf(b.type),
  );
  const saetze = sortiert.map((e) => (sprache === 'de' ? e.de : e.en).trim());
  let genutzt = [];
  for (const satz of saetze) {
    const kandidat = [...genutzt, satz];
    if (kandidat.join('\n\n').length <= max) genutzt = kandidat;
  }
  // Passt nicht einmal der erste Eintrag, wird er als Einziger hart gekuerzt.
  if (genutzt.length === 0) return kuerze(saetze[0] ?? '', max);
  return genutzt.join('\n\n');
}

function schreibeDatei(datei, inhalt, { check }) {
  const neu = `${JSON.stringify(inhalt, null, 2)}\n`;
  const alt = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : null;
  const relativ = path.relative(APP_ROOT, datei).replace(/\\/g, '/');
  if (alt === neu) {
    console.log(`  = ${relativ} (unveraendert)`);
    return true;
  }
  if (check) {
    console.log(`  ! ${relativ} weicht vom Changelog ab`);
    return false;
  }
  fs.writeFileSync(datei, neu, 'utf8');
  console.log(`  ${alt === null ? '+' : '~'} ${relativ}`);
  return true;
}

const argumente = process.argv.slice(2);
const check = argumente.includes('--check');
const overwrite = argumente.includes('--overwrite');
const versionArg = argumente.find((a) => !a.startsWith('--'));

const changelog = await ladeChangelog();
const version = versionArg ?? changelog[changelog.length - 1].version;
const eintrag = changelog.find((v) => v.version === version);
if (!eintrag) {
  console.error(`Version ${version} steht nicht in changelog.ts. Vorhanden: ${changelog.map((v) => v.version).join(', ')}`);
  process.exit(1);
}

console.log(`Release-Notes fuer ${version} (${eintrag.date}, ${eintrag.entries.length} Eintraege)`);
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });

let okay = true;
for (const [ziel, locales, max] of [
  ['release-notes', PLAY_LOCALES, PLAY_MAX],
  ['whatsnew', ASC_LOCALES, ASC_MAX],
]) {
  const datei = path.join(STORE_DIR, `${ziel}-${version}.json`);
  const vorhanden = fs.existsSync(datei) ? JSON.parse(fs.readFileSync(datei, 'utf8')) : {};
  const inhalt = {};
  const uebernommen = [];
  for (const [storeLocale, sprache] of Object.entries(locales)) {
    const generiert = baueText(eintrag.entries, sprache, max);
    // Handuebersetzungen (alles ausser de/en) nicht stillschweigend durch den
    // englischen Text ersetzen - der Store-Eintrag waere sonst nach jedem Lauf
    // schlechter als vorher.
    const istHanduebersetzung =
      sprache === 'en' && !storeLocale.startsWith('en') && typeof vorhanden[storeLocale] === 'string';
    if (istHanduebersetzung && !overwrite) {
      inhalt[storeLocale] = kuerze(vorhanden[storeLocale], max);
      uebernommen.push(storeLocale);
    } else {
      inhalt[storeLocale] = generiert;
    }
  }
  const laengen = Object.entries(inhalt).map(([l, t]) => `${l}:${t.length}`);
  console.log(`\n${ziel} (max ${max}) — ${laengen.join('  ')}`);
  if (uebernommen.length) console.log(`  bestehende Uebersetzung behalten: ${uebernommen.join(', ')} (--overwrite ersetzt sie)`);
  okay = schreibeDatei(datei, inhalt, { check }) && okay;
}

if (!okay) {
  console.error('\n--check: Store-Dateien sind nicht auf dem Stand von changelog.ts (ohne --check neu erzeugen).');
  process.exit(1);
}
