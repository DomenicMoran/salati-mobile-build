#!/usr/bin/env node
// Liest bzw. korrigiert den "Neue Funktionen"-Text (whatsNew) der neuesten
// App-Store-Version. Apple erlaubt PATCH nur, solange die Version editierbar
// ist (PREPARE_FOR_SUBMISSION o. ä.) — bei READY_FOR_SALE antwortet die API mit
// 409/403. Genau das soll das Skript sichtbar machen statt still zu scheitern.
//
// Usage:
//   node scripts/asc-whatsnew.mjs                       # nur lesen
//   node scripts/asc-whatsnew.mjs store/whatsnew-X.json # schreiben versuchen
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = 'H73GL4Q2AQ';
const ISSUER = 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';
const NOTES_PATH = process.argv[2] ?? null;

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256', expiresIn: '15m', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});
const api = async (pfad, init = {}) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body };
};

const vers = await api(`/apps/${APP_ID}/appStoreVersions?limit=1`);
if (!vers.ok) { console.error('Versionen lesen fehlgeschlagen:', vers.status); process.exit(1); }
const v = vers.body.data[0];
console.log(`Version ${v.attributes.versionString} — Status ${v.attributes.appStoreState}`);

const locs = await api(`/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
const byLocale = Object.fromEntries(locs.body.data.map((l) => [l.attributes.locale, l]));

if (!NOTES_PATH) {
  for (const [locale, l] of Object.entries(byLocale)) {
    console.log(`\n### ${locale}\n${l.attributes.whatsNew ?? '(leer)'}`);
  }
  process.exit(0);
}

const notes = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
let fehler = 0;
for (const [locale, text] of Object.entries(notes)) {
  const l = byLocale[locale];
  if (!l) { console.log(`${locale}: keine Lokalisierung in dieser Version`); continue; }
  const r = await api(`/appStoreVersionLocalizations/${l.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { whatsNew: text } } }),
  });
  if (r.ok) {
    console.log(`${locale}: OK`);
  } else {
    fehler++;
    const grund = r.body?.errors?.[0]?.detail ?? JSON.stringify(r.body).slice(0, 200);
    console.log(`${locale}: ${r.status} — ${grund}`);
  }
}
process.exit(fehler ? 1 : 0);
