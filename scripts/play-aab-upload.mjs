// AAB der Handy-App auf den Play-Produktions-Track (Play Developer API).
//
// Warum neben `play-release-production.mjs`: das nimmt die Release-Notizen als
// EINEN Kommandozeilen-Text, also genau eine Sprache. Der Eintrag hat 13.
// Ausserdem schreibt die Windows-Shell Umlaute in Argumenten um („noerdlichen"
// statt „nördlichen") — genau so standen sie schon einmal bei den Nutzern.
// Deshalb hier eine UTF-8-DATEI als Quelle, wie beim Fernseher
// (apps/tv/scripts/play-aab-upload.mjs).
//
//   node scripts/play-aab-upload.mjs <pfad/app.aab> store/play-notes-1.48.0.json
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.de';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

const AAB = process.argv[2];
const NOTES_PATH = process.argv[3];
if (!AAB || !fs.existsSync(AAB)) {
  console.error('Aufruf: node scripts/play-aab-upload.mjs <pfad/app.aab> [notes.json]');
  process.exit(1);
}

let releaseNotes;
if (NOTES_PATH) {
  if (!fs.existsSync(NOTES_PATH)) {
    console.error(`Notizen-Datei nicht gefunden: ${NOTES_PATH}`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
  // 500 Zeichen ist Plays Grenze; abschneiden statt ablehnen waere ein halber
  // Satz im Store.
  for (const [lang, text] of Object.entries(map)) {
    if (String(text).length > 500) {
      console.error(`Notiz fuer ${lang} ist ${String(text).length} Zeichen lang, Play erlaubt 500.`);
      process.exit(1);
    }
  }
  releaseNotes = Object.entries(map).map(([language, text]) => ({ language, text: String(text) }));
  console.log('Release-Notizen fuer:', releaseNotes.map((r) => r.language).join(', '));
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
async function token() {
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
  const r = await (
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
  ).json();
  if (!r.access_token) throw new Error('token failed: ' + JSON.stringify(r));
  return r.access_token;
}

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UP = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
let TOK;
async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${TOK}`, ...(opts.headers || {}) } });
  const t = await r.text();
  let j = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    j = { raw: t };
  }
  return { ok: r.ok, status: r.status, j };
}

TOK = await token();
console.log('auth ok');

const edit = await api(`${BASE}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
if (!edit.ok) throw new Error('edit: ' + edit.status + ' ' + JSON.stringify(edit.j));
const id = edit.j.id;
console.log('edit', id);

const bytes = fs.readFileSync(AAB);
console.log(`Bundle-Upload ${(bytes.length / 1e6).toFixed(1)} MB ...`);
const up = await api(`${UP}/edits/${id}/bundles?uploadType=media`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: bytes,
});
if (!up.ok) throw new Error('bundle: ' + up.status + ' ' + JSON.stringify(up.j).slice(0, 400));
const versionCode = up.j.versionCode;
console.log('Bundle OK, versionCode', versionCode);

const track = await api(`${BASE}/edits/${id}/tracks/production`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    track: 'production',
    releases: [
      { versionCodes: [String(versionCode)], status: 'completed', ...(releaseNotes ? { releaseNotes } : {}) },
    ],
  }),
});
console.log('Track production:', track.ok ? 'OK' : 'FEHLER ' + track.status + ' ' + JSON.stringify(track.j).slice(0, 400));
if (!track.ok) process.exit(1);

const commit = await api(`${BASE}/edits/${id}:commit`, { method: 'POST' });
console.log('COMMIT:', commit.ok ? `OK — vc ${versionCode} im Produktions-Track` : 'FEHLER ' + commit.status + ' ' + JSON.stringify(commit.j).slice(0, 400));
if (!commit.ok) process.exit(1);
