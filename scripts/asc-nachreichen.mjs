#!/usr/bin/env node
// Reicht eine vorbereitete Fassung nach, SOBALD die vorige Apple-Pruefung
// durch ist — und tut sonst nichts.
//
// Hintergrund (06.09.2026): Play hatte 1.53.1 bereits live, Apple aber noch
// 1.53.0 in Pruefung. Deren Build 79 entstand VOR dem Commit mit den klareren
// Gebetsruf-Aufnahmen, die Aufnahmen fehlen dort also. Ein Rueckzug haette die
// Pruefuhr fuer die gesamte Koran-/Lexikon-Arbeit neu gestartet, deshalb wurde
// iOS-Build 80 (1.53.1) nur vorgebaut und hochgeladen. Apple duldet neben einer
// laufenden Pruefung keinen zweiten Versionseintrag ("You cannot create a new
// version of the App in the current state"), das Nachreichen geht also erst
// danach.
//
// Das Skript ist absichtlich WIEDERHOLBAR und tut im Zweifel nichts:
//   - Fassung liegt schon an        -> nur berichten
//   - vorige noch in Pruefung       -> nur berichten, Rueckgabewert 0
//   - vorige durch                  -> asc-release.mjs anstossen
//
// Kein process.exit(): das reisst unter Windows die noch offenen
// fetch-Verbindungen mit und endet in einer libuv-Assertion mit Rueckgabewert
// 127 — ein Lauf, den man am Rueckgabewert prueft, gilt dann faelschlich als
// gescheitert. Stattdessen process.exitCode setzen und regulaer auslaufen.
//
// Usage: node scripts/asc-nachreichen.mjs [version] [buildNummer] [notes.json]
//   Voreinstellung: 1.53.1  80  store/whatsnew-1.53.1.json
import fs from 'fs';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const [ZIEL = '1.53.1', BUILD = '80', NOTIZEN = 'store/whatsnew-1.53.1.json'] = process.argv.slice(2);

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '15m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

const api = async (pfad) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
};

// Zustaende, in denen Apple die Fassung noch bearbeitet — dann entsteht daneben
// kein zweiter Versionseintrag. Bewusst als Positivliste: ein unbekannter neuer
// Zustand gilt als "noch nicht frei", damit im Zweifel nichts angestossen wird.
const IN_ARBEIT = new Set([
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_APP_STORE',
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

async function main() {
  const versionen = (await api(`/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=5`)).data;
  if (!versionen.length) {
    console.error('Keine App-Store-Versionen gefunden — Abbruch.');
    return 1;
  }

  console.log('App-Store-Versionen:');
  for (const v of versionen) {
    console.log(`  ${v.attributes.versionString.padEnd(8)} ${v.attributes.appStoreState}`);
  }

  const schonDa = versionen.find((v) => v.attributes.versionString === ZIEL);
  if (schonDa) {
    console.log(`\nNichts zu tun: ${ZIEL} liegt bereits an (${schonDa.attributes.appStoreState}).`);
    return 0;
  }

  const neueste = versionen[0].attributes;
  if (IN_ARBEIT.has(neueste.appStoreState)) {
    console.log(
      `\nNoch nicht frei: ${neueste.versionString} steht auf ${neueste.appStoreState}. ` +
        `Solange das so ist, laesst Apple ${ZIEL} nicht daneben anlegen. Spaeter erneut ausfuehren.`
    );
    return 0;
  }

  // Der Build muss verarbeitet und gueltig sein, sonst haengt asc-release.mjs ins Leere.
  const builds = (await api(`/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`)).data;
  const ziel = builds.find((b) => b.attributes.version === String(BUILD));
  if (!ziel) {
    console.error(`\nBuild ${BUILD} nicht gefunden — Abbruch, damit nichts Falsches eingereicht wird.`);
    return 1;
  }
  if (ziel.attributes.processingState !== 'VALID') {
    console.error(`\nBuild ${BUILD} steht auf ${ziel.attributes.processingState}, nicht VALID — Abbruch.`);
    return 1;
  }
  if (!fs.existsSync(NOTIZEN)) {
    console.error(`\nNotizen-Datei fehlt: ${NOTIZEN} — Abbruch.`);
    return 1;
  }

  console.log(`\n${neueste.versionString} ist durch (${neueste.appStoreState}). Reiche ${ZIEL} mit Build ${BUILD} nach.`);
  const lauf = spawnSync('node', ['scripts/asc-release.mjs', ZIEL, BUILD, NOTIZEN], { stdio: 'inherit' });
  return lauf.status ?? 1;
}

process.exitCode = await main();
