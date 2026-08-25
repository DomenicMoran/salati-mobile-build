#!/usr/bin/env node
// Probe: nimmt Apples Screenshot-Verarbeitung ueberhaupt noch Bilder an?
//
// Warum das ein eigenes Skript ist: asc-screenshots.mjs LOESCHT einen Satz,
// bevor es ihn neu befuellt. Haengt Apples Verarbeitung (Zustand bleibt auf
// UPLOAD_COMPLETE, sourceFileChecksum liest sich als null zurueck), zerstoert
// ein Lauf also einen intakten Satz, ohne ihn ersetzen zu koennen — genau so
// ist im 1.41.0-Durchgang der en-US-iPad-Satz auf 1 Bild geschrumpft.
//
// Diese Probe laedt EIN Bild in den ohnehin unvollstaendigen en-US-iPad-Satz
// und meldet per Exit-Code, ob es COMPLETE wird. Wird es das, bleibt es liegen
// (asc-screenshots.mjs erkennt es an der Pruefsumme wieder) — die Probe wirft
// also keine Arbeit weg.
//
//   node scripts/asc-probe.mjs [datei.png]   Exit 0 = Verarbeitung laeuft
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';
const KLASSE = 'APP_IPAD_PRO_3GEN_129';
const LOCALE = 'en-US';

const WURZEL = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const STANDARD = path.join(WURZEL, 'store-assets', 'out', 'appstoreIpad', 'en', '08-08-kalender.png');
const DATEI = process.argv[2] ? path.resolve(process.argv[2]) : STANDARD;

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

// Apples API antwortet beim Lesen frisch hochgeladener Objekte zeitweise mit
// 500 UNEXPECTED_ERROR. Lesende Aufrufe werden deshalb wiederholt; schreibende
// NICHT — ein wiederholtes POST legt ein zweites Objekt an.
async function api(pfad, init = {}, versuche = 6) {
  const methode = init.method ?? 'GET';
  for (let i = 0; ; i++) {
    const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await r.text();
    if (r.ok) return text ? JSON.parse(text) : null;
    if (methode === 'GET' && r.status >= 500 && i < versuche) {
      console.log(`  (Apple ${r.status} bei GET ${pfad} — Wiederholung ${i + 1}/${versuche})`);
      await new Promise((res) => setTimeout(res, 5000 * (i + 1)));
      continue;
    }
    throw new Error(`${methode} ${pfad} -> HTTP ${r.status}\n${text.slice(0, 500)}`);
  }
}

const EDITIERBAR = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'WAITING_FOR_REVIEW']);
const versionen = await api(`/apps/${APP_ID}/appStoreVersions?limit=20`);
const version = versionen.data.find((v) => EDITIERBAR.has(v.attributes.appStoreState));
if (!version) throw new Error('Keine editierbare Version gefunden');

const locs = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
const loc = locs.data.find((l) => l.attributes.locale === LOCALE);
if (!loc) throw new Error(`${LOCALE} nicht vorhanden`);

const saetze = (await api(`/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data;
let satzId = saetze.find((s) => s.attributes.screenshotDisplayType === KLASSE)?.id;
if (!satzId) {
  satzId = (
    await api('/appScreenshotSets', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: KLASSE },
          relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
        },
      }),
    })
  ).data.id;
}

const daten = fs.readFileSync(DATEI);
const name = path.basename(DATEI);
const md5 = crypto.createHash('md5').update(daten).digest('hex');
console.log(`Probe: ${name} (${daten.length} Bytes) -> ${LOCALE}/${KLASSE}, Version ${version.attributes.versionString}`);

// Gleichnamiges Altobjekt weg, sonst haengen zwei Eintraege mit demselben Namen im Satz.
for (const alt of (await api(`/appScreenshotSets/${satzId}/appScreenshots?limit=50`)).data) {
  if (alt.attributes.fileName === name) {
    await api(`/appScreenshots/${alt.id}`, { method: 'DELETE' });
    console.log(`  Altobjekt geloescht (${alt.id}, ${alt.attributes.assetDeliveryState?.state})`);
  }
}

const reserviert = (
  await api('/appScreenshots', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appScreenshots',
        attributes: { fileName: name, fileSize: daten.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: satzId } } },
      },
    }),
  })
).data;

for (const [i, op] of (reserviert.attributes.uploadOperations ?? []).entries()) {
  const r = await fetch(op.url, {
    method: op.method,
    headers: Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])),
    body: daten.subarray(op.offset, op.offset + op.length),
  });
  console.log(`  PUT Teil ${i + 1}: ${op.length} Bytes -> ${r.status}`);
  if (!r.ok) process.exit(2);
}

await api(`/appScreenshots/${reserviert.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ data: { type: 'appScreenshots', id: reserviert.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } }),
});
console.log(`  PATCH uploaded=true, md5 ${md5.slice(0, 8)}…`);

const BIS = Date.now() + 6 * 60 * 1000;
let nachgereicht = 0;
for (let versuch = 0; Date.now() < BIS; versuch++) {
  await new Promise((r) => setTimeout(r, 5000));
  let attr;
  try {
    attr = (await api(`/appScreenshots/${reserviert.id}`)).data.attributes;
  } catch (e) {
    console.log(`  Lesen fehlgeschlagen, weiter warten: ${String(e.message).split('\n')[0]}`);
    continue;
  }
  const s = attr.assetDeliveryState?.state;
  if (s === 'COMPLETE') {
    console.log(`  COMPLETE nach ${(versuch + 1) * 5}s — Apples Verarbeitung laeuft.`);
    process.exit(0);
  }
  if (s === 'FAILED') {
    console.log(`  FAILED: ${JSON.stringify(attr.assetDeliveryState)}`);
    process.exit(3);
  }
  if (!attr.sourceFileChecksum && versuch >= 3 && nachgereicht < 3) {
    nachgereicht += 1;
    console.log(`  Pruefsumme null — Abschluss wiederholen (${nachgereicht}/3)`);
    await api(`/appScreenshots/${reserviert.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'appScreenshots', id: reserviert.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } }),
    });
    continue;
  }
  if (versuch % 6 === 5) console.log(`  … ${s} md5=${attr.sourceFileChecksum ?? 'null'} (${Math.round((BIS - Date.now()) / 1000)}s Rest)`);
}
console.log('  Timeout — Apples Verarbeitung nimmt weiterhin nichts an.');
process.exit(4);
