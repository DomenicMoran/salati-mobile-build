#!/usr/bin/env node
// Reine Leseabfrage: dumpt Listings (alle Sprachen), Grafiken-Typen, Tracks und
// Release-Notes einer Play-App als JSON nach stdout.
// Usage: node scripts/play-dump.mjs <packageName>
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = process.argv[2] ?? 'de.salatibox.de';
const SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';

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
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 400)); process.exit(1); }
const id = edit.json.id;

const out = { package: PACKAGE, listings: {}, images: {}, tracks: {}, details: null };

const det = await api(`/edits/${id}/details`);
out.details = det.json;

const ls = await api(`/edits/${id}/listings`);
for (const l of ls.json?.listings ?? []) {
  out.listings[l.language] = { title: l.title, short: l.shortDescription, full: l.fullDescription, video: l.video };
  out.images[l.language] = {};
  for (const type of ['icon', 'featureGraphic', 'tvBanner', 'phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots', 'tvScreenshots', 'wearScreenshots']) {
    const im = await api(`/edits/${id}/listings/${l.language}/${type}`);
    out.images[l.language][type] = (im.json?.images ?? []).length;
  }
}

for (const track of ['production', 'beta', 'alpha', 'internal']) {
  const t = await api(`/edits/${id}/tracks/${track}`);
  if (t.ok) out.tracks[track] = t.json.releases;
}

await api(`/edits/${id}`, { method: 'DELETE' }).catch(() => {});
console.log(JSON.stringify(out, null, 2));
