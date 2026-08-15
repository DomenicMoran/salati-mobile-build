#!/usr/bin/env node
// Zieht eine laufende App-Store-Einreichung aus der Pruefung zurueck.
//
// Warum noetig: Apple laesst nur EINE Einreichung gleichzeitig zu. Steht noch
// eine aeltere Version auf WAITING_FOR_REVIEW, laeuft asc-release.mjs in einen
// Konflikt — die neue Version bekommt dann keinen Platz in der Warteschlange.
//
// WAITING_FOR_REVIEW / READY_FOR_REVIEW kosten nichts: die Einreichung stand
// noch in der Warteschlange. Bei IN_REVIEW prueft Apple bereits — ein Rueckzug
// wirft die App ans Ende der Schlange. Das passiert deshalb nur mit dem
// zusaetzlichen Schalter --auch-in-review, damit es nie beilaeufig geschieht.
//
// Usage: node scripts/asc-cancel-review.mjs [--wirklich] [--auch-in-review]
//   ohne --wirklich wird nur angezeigt, was passieren wuerde.
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = 'H73GL4Q2AQ';
const ISSUER = 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';
const WIRKLICH = process.argv.includes('--wirklich');
const AUCH_IN_REVIEW = process.argv.includes('--auch-in-review');

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

async function api(pfad, init = {}) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${pfad} -> ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const offen = await api(
  `/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&limit=10&include=items`,
);

if (!offen.data?.length) {
  console.log('Keine offene Einreichung — nichts zu tun.');
  process.exit(0);
}

for (const s of offen.data) {
  const zustand = s.attributes.state;
  const versionen = (offen.included ?? [])
    .filter((i) => i.type === 'reviewSubmissionItems')
    .map((i) => i.relationships?.appStoreVersion?.data?.id)
    .filter(Boolean);
  console.log(`Einreichung ${s.id}: ${zustand}${versionen.length ? ` (Versionen: ${versionen.join(', ')})` : ''}`);

  if (zustand === 'IN_REVIEW' && !AUCH_IN_REVIEW) {
    console.error('  IN_REVIEW — Apple prueft bereits. Rueckzug nur mit --auch-in-review.');
    process.exitCode = 1;
    continue;
  }
  if (zustand === 'IN_REVIEW') {
    console.log('  IN_REVIEW — wird auf ausdruecklichen Wunsch zurueckgezogen (Warteschlange beginnt neu)');
  }
  if (!WIRKLICH) {
    console.log('  wuerde zurueckgezogen (--wirklich zum Ausfuehren)');
    continue;
  }
  await api(`/reviewSubmissions/${s.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } }),
  });
  console.log('  zurueckgezogen');
}

// Nachsehen, was danach wirklich gilt — nicht auf den PATCH vertrauen.
if (WIRKLICH) {
  const danach = await api(`/apps/${APP_ID}/appStoreVersions?limit=5`);
  for (const v of danach.data) console.log(`  ${v.attributes.versionString}: ${v.attributes.appStoreState}`);
}
