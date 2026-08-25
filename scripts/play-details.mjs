#!/usr/bin/env node
// Liest bzw. setzt die App-Kontaktdaten eines Play-Eintrags (Website, E-Mail,
// Telefon, Standardsprache). Ohne --set wird nur gelesen.
//
// Der Audit-Grundsatz aus src/app/impressum.tsx gilt auch hier: Firmierung,
// E-Mail und Website müssen in Impressum, App und Store-Eintrag identisch sein.
//
// Usage:
//   node scripts/play-details.mjs <package>
//   node scripts/play-details.mjs <package> --set contactWebsite=https://www.salati.pro
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = process.argv[2];
if (!PACKAGE) { console.error('Usage: play-details.mjs <package> [--set k=v ...]'); process.exit(1); }
const sets = {};
process.argv.forEach((a, i) => {
  if (a === '--set' && process.argv[i + 1]) {
    const kv = process.argv[i + 1];
    const idx = kv.indexOf('=');
    sets[kv.slice(0, idx)] = kv.slice(idx + 1);
  }
});
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const assertion = jwt.sign(
  { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
  sa.private_key,
  { algorithm: 'RS256' },
);
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
})).json();
const ACCESS = tok.access_token;
if (!ACCESS) { console.error('Token fehlgeschlagen', tok); process.exit(1); }

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
async function api(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status); process.exit(1); }
const editId = edit.json.id;

const before = await api(`/edits/${editId}/details`);
console.log('vorher: ', JSON.stringify(before.json));

if (!Object.keys(sets).length) {
  await api(`/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  process.exit(0);
}

const patch = await api(`/edits/${editId}/details`, { method: 'PATCH', body: JSON.stringify(sets) });
if (!patch.ok) { console.error('PATCH fehlgeschlagen:', patch.status, JSON.stringify(patch.json).slice(0, 300)); process.exit(1); }
console.log('nachher:', JSON.stringify(patch.json));

const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 300)}`);
if (!commit.ok) process.exit(1);
