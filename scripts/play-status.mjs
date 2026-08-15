#!/usr/bin/env node
// Zeigt den aktuellen Play-Console-Stand von Salati: welche versionCodes auf
// welchem Track liegen und welche Version zuletzt hochgeladen wurde.
// Reine Leseabfrage (kein Edit-Commit), damit vor einem Release klar ist,
// welcher versionCode als nächster frei ist.
//
// Usage: node scripts/play-status.mjs
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.de';
const SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';

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
const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
});
const { access_token: token } = await tokRes.json();
const api = async (pfad, init = {}) => {
  const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r.json();
};

const edit = await api('/edits', { method: 'POST', body: '{}' });
const bundles = await api(`/edits/${edit.id}/bundles`);
const codes = (bundles.bundles ?? []).map((b) => b.versionCode).sort((a, z) => a - z);
console.log('Hochgeladene versionCodes:', codes.join(', ') || '(keine)');
console.log('Naechster freier versionCode:', (codes[codes.length - 1] ?? 0) + 1);

for (const track of ['production', 'beta', 'alpha', 'internal']) {
  try {
    const t = await api(`/edits/${edit.id}/tracks/${track}`);
    for (const r of t.releases ?? []) {
      console.log(
        `  ${track.padEnd(10)} ${String(r.status).padEnd(12)} vc ${(r.versionCodes ?? []).join(',') || '-'}` +
          `  ${r.name ?? ''}`,
      );
    }
  } catch {
    console.log(`  ${track.padEnd(10)} (kein Track)`);
  }
}
await api(`/edits/${edit.id}`, { method: 'DELETE' }).catch(() => {});
