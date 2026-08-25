#!/usr/bin/env node
// Ersetzt die "Was ist neu"-Texte des AKTUELLEN Releases eines Tracks, ohne ein
// neues AAB hochzuladen. Gedacht für Textkorrekturen an einer bereits
// veröffentlichten Version (Play zeigt nur die Notizen des jeweils aktuellen
// Releases je Track; ältere Releases sind über die API nicht mehr erreichbar).
//
// Usage: node scripts/play-release-notes.mjs <package> <track> <notes.json> [--dry]
//   notes.json: { "de-DE": "...", "en-US": "...", ... } — Play kappt bei 500 Zeichen.
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const [PACKAGE, TRACK, NOTES_PATH] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
if (!PACKAGE || !TRACK || !NOTES_PATH) {
  console.error('Usage: play-release-notes.mjs <package> <track> <notes.json> [--dry]');
  process.exit(1);
}
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

const notesMap = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
for (const [lang, text] of Object.entries(notesMap)) {
  if (text.length > 500) { console.error(`${lang}: ${text.length} Zeichen > 500`); process.exit(1); }
}

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
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 300)); process.exit(1); }
const editId = edit.json.id;

const cur = await api(`/edits/${editId}/tracks/${TRACK}`);
if (!cur.ok) { console.error('Track lesen fehlgeschlagen:', cur.status); process.exit(1); }
const releases = cur.json.releases ?? [];
if (releases.length !== 1) {
  console.error(`Track ${TRACK} hat ${releases.length} Releases — bitte manuell prüfen, dieses Skript erwartet genau eines.`);
  process.exit(1);
}
const rel = releases[0];
console.log(`Release ${rel.name} (vc ${(rel.versionCodes ?? []).join(',')}), Notizen bisher:`,
  (rel.releaseNotes ?? []).map((n) => n.language).join(', ') || '(keine)');

rel.releaseNotes = Object.entries(notesMap).map(([language, text]) => ({ language, text }));

if (DRY) {
  console.log('DRY — würde schreiben:', rel.releaseNotes.map((n) => n.language).join(', '));
  await api(`/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  process.exit(0);
}

const put = await api(`/edits/${editId}/tracks/${TRACK}`, { method: 'PUT', body: JSON.stringify({ track: TRACK, releases: [rel] }) });
if (!put.ok) { console.error('Track schreiben fehlgeschlagen:', put.status, JSON.stringify(put.json).slice(0, 400)); process.exit(1); }

const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 300)}`);
if (!commit.ok) process.exit(1);
