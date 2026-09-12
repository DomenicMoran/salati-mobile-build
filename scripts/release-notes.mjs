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
//
// Sprachpolitik (identisch zu changelog.ts und getChangelogText()): eigene
// Texte gibt es nur auf Deutsch und Englisch. Store-Sprachen OHNE eigenen
// Changelog-Text bekommen HIER KEINEN EINTRAG - Apple/Google zeigen dem
// Nutzer dann automatisch den Text der Standardsprache des Eintrags an. Bis
// 05.09.2026 stand hier stattdessen fuer jede fehlende Sprache eine Kopie des
// ENGLISCHEN Texts unter dem fremden Sprachcode (z. B. "tr-TR": "<englischer
// Text>") - das faellt nicht auf, solange der Store-Eintrag diese Sprachen
// gar nicht listet (Play/ASC ueberspringen unbekannte Locales beim
// Einreichen), ist aber eine Falle: sobald jemand die Sprache im Store-Eintrag
// anlegt, bekommen z. B. tuerkische oder arabische Nutzer englische
// Versionshinweise unter ihrer eigenen Sprachkennung angezeigt. Siehe
// src/lib/store-sprachkennung.test.ts, der genau das erkennt.
//
// Echte Uebersetzungen fuer weitere Sprachen gibt es (fuer Play) bereits
// handkuratiert in store/play-notes-<version>.json - dieses Skript fasst
// jene Datei nicht an, sie wird unabhaengig von changelog.ts gepflegt.
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

// Store-Sprachen, fuer die changelog.ts einen EIGENEN Text fuehrt. Der Wert
// sagt, welcher Changelog-Text verwendet wird ('de' oder 'en'). Nur diese
// Locales landen in den generierten JSON-Dateien - jede weitere Store-Sprache
// bekommt bewusst KEINEN Eintrag (siehe Kommentar oben).
const PLAY_LOCALES = { 'de-DE': 'de', 'en-US': 'en' };
const ASC_LOCALES = { 'de-DE': 'de', de: 'de', 'en-US': 'en', 'en-GB': 'en' };

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

/**
 * Liest die vorhandene Datei und behaelt alle Sprachkennungen, die dieses
 * Skript NICHT erzeugt.
 *
 * Hintergrund (07.09.2026): Fuer die Ausweitung des App-Store-Eintrags auf 13
 * Sprachen wurden neun weitere Kennungen (ar-SA, bn-BD, es-ES, fr-FR, id, ms,
 * ru, tr, ur-PK) von Hand uebersetzt in whatsnew-<version>.json eingetragen.
 * Dieses Skript kennt nur de/en aus changelog.ts — ohne Zusammenfuehrung
 * haette der naechste Lauf die neun Handuebersetzungen kommentarlos
 * ueberschrieben, OHNE Fehlermeldung. Ein Verlust, den niemand bemerkt haette,
 * bis ein tuerkischer Nutzer im Laden englische Versionshinweise sieht.
 */
function fuehreZusammen(datei, erzeugt) {
  if (!fs.existsSync(datei)) return { inhalt: erzeugt, behalten: [] };
  let vorhanden;
  try {
    vorhanden = JSON.parse(fs.readFileSync(datei, 'utf8'));
  } catch {
    return { inhalt: erzeugt, behalten: [] };
  }
  const behalten = Object.keys(vorhanden).filter((k) => !(k in erzeugt));
  const inhalt = {};
  for (const k of Object.keys(vorhanden)) inhalt[k] = k in erzeugt ? erzeugt[k] : vorhanden[k];
  for (const k of Object.keys(erzeugt)) if (!(k in inhalt)) inhalt[k] = erzeugt[k];
  return { inhalt, behalten };
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
  const inhalt = {};
  for (const [storeLocale, sprache] of Object.entries(locales)) {
    inhalt[storeLocale] = baueText(eintrag.entries, sprache, max);
  }
  const { inhalt: zusammen, behalten } = fuehreZusammen(datei, inhalt);
  const laengen = Object.entries(zusammen).map(([l, t]) => `${l}:${t.length}`);
  console.log(`\n${ziel} (max ${max}) — ${laengen.join('  ')}`);
  if (behalten.length) console.log(`  handgepflegt uebernommen: ${behalten.join(', ')}`);
  okay = schreibeDatei(datei, zusammen, { check }) && okay;
}

if (!okay) {
  console.error('\n--check: Store-Dateien sind nicht auf dem Stand von changelog.ts (ohne --check neu erzeugen).');
  process.exit(1);
}
