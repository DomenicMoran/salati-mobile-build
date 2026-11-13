#!/usr/bin/env node
// Umbenennen einer App-Store-Version (z. B. 1.60.0 → 1.61.0), wenn Apple keinen zweiten Eintrag erlaubt.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('C:/Users/domen/Documents/Projekte/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');
const [id, versionString] = process.argv.slice(2);
if (!id || !versionString) {
  console.error('Usage: asc-rename-version.mjs <appStoreVersionId> <newVersionString>');
  process.exit(1);
}
const KEY = 'C:/Users/domen/Documents/Projektordner/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';
const token = jwt.sign(
  { iss: 'de348707-2ec6-4079-b3a4-74c17c31ba0c', aud: 'appstoreconnect-v1' },
  fs.readFileSync(KEY, 'utf8'),
  { algorithm: 'ES256', expiresIn: '15m', header: { alg: 'ES256', kid: 'H73GL4Q2AQ', typ: 'JWT' } },
);
const r = await fetch(`https://api.appstoreconnect.apple.com/v1/appStoreVersions/${id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: { type: 'appStoreVersions', id, attributes: { versionString } },
  }),
});
const text = await r.text();
console.log(r.status, text.slice(0, 800));
process.exit(r.ok ? 0 : 1);
