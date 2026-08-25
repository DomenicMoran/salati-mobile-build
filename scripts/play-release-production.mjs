#!/usr/bin/env node
// Lädt ein bereits lokal gebautes, signiertes AAB direkt auf den
// Production-Track hoch (Muster von vc8/vc9 aus dieser Session — Play
// Store bekommt hier volle Releases ohne Staged-Rollout).
//
// Usage: node scripts/play-release-production.mjs <pfad/app.aab> "<Release-Notes de>"
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

// Vorgabe bleibt die Handy-App; PLAY_PACKAGE zeigt auf eine andere App
// desselben Entwicklerkontos (z. B. de.salatibox.tv).
const PACKAGE = process.env.PLAY_PACKAGE || 'de.salatibox.de';
const AAB_PATH = process.argv[2];
const NOTES_DE = process.argv[3] ?? '';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

if (!AAB_PATH) { console.error('Usage: play-release-production.mjs <aab> "<notes>"'); process.exit(1); }

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
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

async function api(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 300)); process.exit(1); }
const editId = edit.json.id;
console.log('Edit:', editId);

const aab = fs.readFileSync(AAB_PATH);
console.log('AAB-Upload:', (aab.length / 1e6).toFixed(1), 'MB ...');
const up = await fetch(`${UPLOAD}/edits/${editId}/bundles`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/octet-stream' },
  body: aab,
});
const upJson = await up.json().catch(() => null);
if (!up.ok) { console.error('AAB fehlgeschlagen:', up.status, JSON.stringify(upJson).slice(0, 400)); process.exit(1); }
const vc = upJson.versionCode;
console.log('AAB OK, versionCode', vc);

// Release-Notes: entweder ein deutscher Text als 3. Argument ODER ein Pfad auf
// eine JSON-Datei { "de-DE": "...", "en-US": "...", ... } fuer alle Sprachen,
// in denen der Play-Eintrag gepflegt ist. Play kappt bei 500 Zeichen.
let releaseNotes;
if (NOTES_DE && NOTES_DE.endsWith('.json') && fs.existsSync(NOTES_DE)) {
  const map = JSON.parse(fs.readFileSync(NOTES_DE, 'utf8'));
  releaseNotes = Object.entries(map).map(([language, text]) => ({ language, text: String(text).slice(0, 500) }));
  console.log('Release-Notes fuer:', releaseNotes.map((r) => r.language).join(', '));
} else if (NOTES_DE) {
  releaseNotes = [{ language: 'de-DE', text: NOTES_DE.slice(0, 500) }];
}
const tr = await api('/edits/' + editId + '/tracks/production', {
  method: 'PUT',
  body: JSON.stringify({ track: 'production', releases: [{ status: 'completed', versionCodes: [String(vc)], releaseNotes }] }),
});
console.log('Track production:', tr.ok ? 'OK' : `${tr.status} ${JSON.stringify(tr.json).slice(0, 300)}`);
if (!tr.ok) process.exit(1);

const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK — Release ist in der Play Console' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 300)}`);
if (!commit.ok) process.exit(1);
