#!/usr/bin/env node
// Legt einen bereits hochgeladenen versionCode auf den Production-Track
// (ohne erneuten AAB-Upload). Nutzen, wenn das Bundle schon in der Console
// liegt (z. B. internal draft) und nur noch promoted werden muss.
//
//   node scripts/play-promote-production.mjs <versionCode> store/play-notes-1.55.0.json
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/Projekte/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = process.env.PLAY_PACKAGE || 'de.salatibox.de';
const SA_PATH = 'C:/Users/domen/Documents/Projektordner/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

const VC = process.argv[2];
const NOTES_PATH = process.argv[3];
if (!VC || !/^\d+$/.test(VC)) {
  console.error('Aufruf: node scripts/play-promote-production.mjs <versionCode> [notes.json]');
  process.exit(1);
}

let releaseNotes;
if (NOTES_PATH) {
  if (!fs.existsSync(NOTES_PATH)) {
    console.error(`Notizen-Datei nicht gefunden: ${NOTES_PATH}`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
  for (const [lang, text] of Object.entries(map)) {
    if (String(text).length > 500) {
      console.error(`Notiz fuer ${lang} ist ${String(text).length} Zeichen, Play erlaubt 500.`);
      process.exit(1);
    }
  }
  releaseNotes = Object.entries(map).map(([language, text]) => ({ language, text: String(text) }));
  console.log('Release-Notizen fuer:', releaseNotes.map((r) => r.language).join(', '));
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const assertion = jwt.sign(
  {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  },
  sa.private_key,
  { algorithm: 'RS256' },
);
const tok = await (
  await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
).json();
if (!tok.access_token) {
  console.error('Token fehlgeschlagen', tok);
  process.exit(1);
}

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
async function api(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const t = await r.text();
  let j = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    j = { raw: t };
  }
  return { ok: r.ok, status: r.status, j };
}

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) {
  console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.j).slice(0, 300));
  process.exit(1);
}
const editId = edit.j.id;
console.log('Edit:', editId, '— promote vc', VC, '→ production');

const tr = await api(`/edits/${editId}/tracks/production`, {
  method: 'PUT',
  body: JSON.stringify({
    track: 'production',
    releases: [{ status: 'completed', versionCodes: [String(VC)], ...(releaseNotes ? { releaseNotes } : {}) }],
  }),
});
console.log('Track production:', tr.ok ? 'OK' : `FEHLER ${tr.status} ${JSON.stringify(tr.j).slice(0, 400)}`);
if (!tr.ok) process.exit(1);

const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? `OK — vc ${VC} auf Production` : `FEHLER ${commit.status} ${JSON.stringify(commit.j).slice(0, 400)}`);
if (!commit.ok) process.exit(1);
