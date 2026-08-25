#!/usr/bin/env node
// Setzt den Werbetext ("Promotional Text") der aktuellen App-Store-Version.
//
// Warum ausgerechnet dieses Feld: Es steht ganz oben ueber der Beschreibung und
// ist das EINZIGE, das sich ohne neue Version und ohne neue Pruefung aendern
// laesst. Es war in beiden Sprachen leer — 170 Zeichen Platz an der
// sichtbarsten Stelle, ungenutzt.
//
// Aufruf:  node scripts/asc-werbetext.mjs            (nur anzeigen)
//          node scripts/asc-werbetext.mjs --setzen   (schreiben)
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';
const SETZEN = process.argv.includes('--setzen');
const GRENZE = 170;

/**
 * Bewusst nur Aussagen, die die App auch einloest — jede ist im Produkt
 * nachpruefbar (kein Konto, keine Werbung, kein Tracking; Wort-fuer-Wort-
 * Rezitation; 14 Sprachen). Keine Hardware, kein Zubehoer, kein Kauf.
 */
const TEXTE = {
  // Seit 1.47.0: der Moschee-Abgleich ist das, was Salati von anderen
  // Gebetszeiten-Apps unterscheidet — also gehoert er an die sichtbarste
  // Stelle. Die Zusagen dahinter bleiben stehen.
  'de-DE':
    'Neu: Zeiten vom Aushang deiner Moschee abtippen — Salati findet die passende Berechnung aus 23 Behörden. Dazu Koran, Qibla, Hifz. Ohne Konto, Werbung und Tracking.',
  'en-US':
    'New: type in your mosque’s timetable — Salati finds the matching calculation out of 23 authorities. Plus Quran, qibla and hifz. No account, no ads, no tracking.',
};

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
  const t = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${pfad} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

for (const [locale, text] of Object.entries(TEXTE)) {
  if (text.length > GRENZE) {
    console.error(`FEHLER ${locale}: ${text.length} Zeichen, erlaubt sind ${GRENZE}`);
    process.exit(1);
  }
}

const versionen = await api(`/apps/${APP_ID}/appStoreVersions?limit=1`);
const version = versionen.data[0];
console.log(`Version ${version.attributes.versionString} (${version.attributes.appStoreState})`);

const locs = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
for (const l of locs.data) {
  const locale = l.attributes.locale;
  const neu = TEXTE[locale];
  if (!neu) {
    console.log(`  ${locale}: kein Text hinterlegt — uebersprungen`);
    continue;
  }
  console.log(`  ${locale}: ${neu.length}/${GRENZE} Zeichen`);
  if (!SETZEN) {
    console.log(`     wuerde gesetzt: "${neu}"`);
    continue;
  }
  await api(`/appStoreVersionLocalizations/${l.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { promotionalText: neu } },
    }),
  });
  console.log('     gesetzt');
}

if (SETZEN) {
  // Zuruecklesen statt dem PATCH glauben.
  const nach = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
  console.log('\nZurueckgelesen:');
  for (const l of nach.data) {
    console.log(`  ${l.attributes.locale}: ${l.attributes.promotionalText ? `${l.attributes.promotionalText.length} Zeichen` : 'LEER'}`);
  }
} else {
  console.log('\nNichts geschrieben. Mit --setzen ausfuehren.');
}
