#!/usr/bin/env node
// Legt eine bearbeitbare App-Store-Version an bzw. benennt die vorhandene um.
//
// Hintergrund: App Store Connect laesst Metadaten (also auch Screenshots) NUR
// an einer bearbeitbaren Version aendern. Steht die letzte Version auf
// READY_FOR_SALE, gibt es keine — dann muss die naechste Version angelegt
// werden. Apple erlaubt genau EINE bearbeitbare Version; existiert bereits
// eine, wird sie hier nur umbenannt statt eine zweite anzulegen.
//
// Es wird NICHTS eingereicht und nichts veroeffentlicht.
//
// Usage:
//   node scripts/asc-version.mjs                 nur auflisten
//   node scripts/asc-version.mjs --setze 1.40.0  anlegen/umbenennen
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';

const ZIEL = process.argv.includes('--setze') ? process.argv[process.argv.indexOf('--setze') + 1] : null;

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

async function api(pfad, init = {}) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${pfad} -> HTTP ${r.status}\n${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}

const EDITIERBAR = new Set([
  'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED',
  'INVALID_BINARY', 'WAITING_FOR_REVIEW', 'DEVELOPER_REMOVED_FROM_SALE',
]);

const versionen = await api(`/apps/${APP_ID}/appStoreVersions?limit=20`);
for (const v of versionen.data) {
  console.log(`${v.attributes.versionString.padEnd(9)} ${v.attributes.appStoreState.padEnd(24)} ${v.id}`);
}
const offen = versionen.data.find((v) => EDITIERBAR.has(v.attributes.appStoreState));
console.log(offen ? `\nBearbeitbar: ${offen.attributes.versionString}` : '\nKeine bearbeitbare Version vorhanden.');

if (!ZIEL) process.exit(0);

if (offen) {
  if (offen.attributes.versionString === ZIEL) { console.log('Bereits die gewuenschte Version.'); process.exit(0); }
  await api(`/appStoreVersions/${offen.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'appStoreVersions', id: offen.id, attributes: { versionString: ZIEL } } }),
  });
  console.log(`Umbenannt: ${offen.attributes.versionString} -> ${ZIEL}`);
} else {
  const neu = await api('/appStoreVersions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: ZIEL, releaseType: 'MANUAL' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    }),
  });
  console.log(`Angelegt: ${ZIEL} (${neu.data.id}, ${neu.data.attributes.appStoreState})`);
}
