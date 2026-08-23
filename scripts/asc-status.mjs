#!/usr/bin/env node
// Zeigt den App-Store-Connect-Stand von Salati: die letzten Builds und den
// Status der aktuellen App-Store-Version. Reine Leseabfrage.
//
// Usage: node scripts/asc-status.mjs
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '15m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

const api = async (pfad) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

const builds = await api(`/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`);
console.log('Letzte Builds:');
for (const b of builds.data) {
  const a = b.attributes;
  console.log(`  Build ${a.version.padEnd(4)} ${String(a.processingState).padEnd(12)} ${a.uploadedDate?.slice(0, 19) ?? ''}`);
}

const versions = await api(`/apps/${APP_ID}/appStoreVersions?limit=3`);
console.log('App-Store-Versionen:');
for (const v of versions.data) {
  console.log(`  ${v.attributes.versionString.padEnd(8)} ${v.attributes.appStoreState}  (${v.id})`);
}
