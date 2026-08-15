#!/usr/bin/env node
// Legt bei App Store Connect eine neue Version an, traegt "Neu in dieser
// Version" in allen gepflegten Sprachen ein, haengt den Build an und reicht
// zur Review ein — alles ueber die API.
//
// Warum per API: die ASC-Weboberflaeche hat in frueheren Releases den Build
// nicht zuverlaessig an die Einreichung gehaengt (es entstanden nur leere
// Uebermittlungsentwuerfe, siehe USER-TODO-Historie). Ueber die API ist der
// Ablauf reproduzierbar.
//
// Usage: node scripts/asc-release.mjs <version> <buildNumber> <notes.json>
//   notes.json: { "de-DE": "...", "en-US": "..." }  (Schluessel = ASC-Locale)
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const [VERSION, BUILD_NR, NOTES_PATH] = process.argv.slice(2);
if (!VERSION || !BUILD_NR) {
  console.error('Usage: asc-release.mjs <version> <buildNumber> [notes.json]');
  process.exit(1);
}

const APP_ID = '6791867298';
const KEY_ID = 'H73GL4Q2AQ';
const ISSUER = 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

async function api(pfad, init = {}) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${pfad} -> ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

// ---------- 1. Build finden ----------
const builds = await api(`/builds?filter[app]=${APP_ID}&filter[version]=${BUILD_NR}&limit=5&sort=-uploadedDate`);
const build = builds.data[0];
if (!build) throw new Error(`Build ${BUILD_NR} nicht bei App Store Connect gefunden`);
console.log(`Build ${BUILD_NR}: ${build.attributes.processingState} (${build.id})`);
if (build.attributes.processingState !== 'VALID') {
  throw new Error(`Build ${BUILD_NR} ist noch nicht VALID — Apple verarbeitet ihn noch.`);
}

// ---------- 2. Version anlegen oder wiederverwenden ----------
const versions = await api(`/apps/${APP_ID}/appStoreVersions?limit=10`);
let version = versions.data.find((v) => v.attributes.versionString === VERSION);
if (version) {
  console.log(`Version ${VERSION} existiert bereits: ${version.attributes.appStoreState}`);
  // Schon eingereicht? Dann hier aufhoeren statt in einen 409 zu laufen, dessen
  // Meldung ("appStoreVersions … is not in valid state") wie ein Defekt aussieht,
  // obwohl alles in Ordnung ist. Ein zweiter Aufruf soll nichts kaputtmachen.
  const FERTIG = ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_DEVELOPER_RELEASE', 'READY_FOR_SALE', 'PROCESSING_FOR_APP_STORE'];
  if (FERTIG.includes(version.attributes.appStoreState)) {
    console.log(`\nNichts zu tun — ${VERSION} ist bereits eingereicht (${version.attributes.appStoreState}).`);
    process.exit(0);
  }
  // `appStoreState` hinkt der Wirklichkeit hinterher: nach einer erfolgreichen
  // Einreichung stand die Version noch minutenlang auf PREPARE_FOR_SUBMISSION,
  // waehrend die Einreichung schon bei Apple lag (2026-08-07). Wer sich darauf
  // verlaesst, reicht ein zweites Mal ein und bekommt einen 409, der wie ein
  // Defekt aussieht. Massgeblich ist die Einreichung selbst.
  const abgeschickt = await api(
    `/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW&limit=10`,
  ).catch(() => ({ data: [] }));
  for (const s of abgeschickt.data ?? []) {
    // include=appStoreVersion ist noetig: ohne das liefert Apple die Elemente
    // ohne ihre Beziehungen, und der Vergleich liefe immer ins Leere.
    const inhalt = await api(`/reviewSubmissions/${s.id}/items?limit=10&include=appStoreVersion`).catch(() => ({ included: [] }));
    const drin = (inhalt.included ?? []).some((i) => i.type === 'appStoreVersions' && i.id === version.id);
    if (drin) {
      console.log(`\nNichts zu tun — ${VERSION} liegt bereits bei Apple (Einreichung ${s.id}, ${s.attributes.state}).`);
      process.exit(0);
    }
  }
} else {
  version = (
    await api('/appStoreVersions', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersions',
          attributes: { platform: 'IOS', versionString: VERSION },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      }),
    })
  ).data;
  console.log(`Version ${VERSION} angelegt (${version.id})`);
}

// ---------- 3. "Neu in dieser Version" je Sprache ----------
if (NOTES_PATH && fs.existsSync(NOTES_PATH)) {
  const notes = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
  const locs = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
  for (const loc of locs.data) {
    const locale = loc.attributes.locale;
    // ASC nutzt teils andere Locale-Codes als Play (de-DE vs de, en-US vs en-GB).
    const text = notes[locale] ?? notes[locale.split('-')[0]] ?? notes[`${locale.split('-')[0]}-${locale.split('-')[0].toUpperCase()}`];
    if (!text) {
      console.log(`  ${locale}: keine Notes hinterlegt — uebersprungen`);
      continue;
    }
    await api(`/appStoreVersionLocalizations/${loc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew: text.slice(0, 4000) } },
      }),
    });
    console.log(`  ${locale}: "Neu in dieser Version" gesetzt`);
  }
}

// ---------- 3b. Veroeffentlichung nach Freigabe ----------
// Eine per Umbenennung wiederverwendete Version kann auf MANUAL stehen — dann
// bleibt sie nach Apples Freigabe liegen, bis jemand in ASC klickt. Genau das
// war bei 1.41.0 der Fall (alle zuvor veroeffentlichten Versionen: AFTER_APPROVAL).
// Deshalb hier explizit setzen statt den geerbten Wert zu uebernehmen.
if (version.attributes.releaseType !== 'AFTER_APPROVAL') {
  await api(`/appStoreVersions/${version.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'appStoreVersions', id: version.id, attributes: { releaseType: 'AFTER_APPROVAL' } },
    }),
  });
  console.log(`Veroeffentlichung: ${version.attributes.releaseType ?? '?'} -> AFTER_APPROVAL`);
} else {
  console.log('Veroeffentlichung: AFTER_APPROVAL (unveraendert)');
}

// ---------- 4. Build an die Version haengen ----------
await api(`/appStoreVersions/${version.id}/relationships/build`, {
  method: 'PATCH',
  body: JSON.stringify({ data: { type: 'builds', id: build.id } }),
});
console.log(`Build ${BUILD_NR} an Version ${VERSION} gehaengt`);

// ---------- 5. Review-Einreichung ----------
//
// NUR eine WIRKLICH leere, noch nicht abgeschickte Einreichung darf
// wiederverwendet werden.
//
// Grund (2026-08-07): Apple hatte eine frühere Einreichung abgelehnt — sie
// stand auf `UNRESOLVED_ISSUES`, ihr Element auf `REJECTED`, und die Version
// hing weiter daran. Das Skript griff sie hier auf, wollte die Version erneut
// anhängen und bekam `STATE_ERROR.ITEM_PART_OF_ANOTHER_SUBMISSION`. Von außen
// sah es aus, als sei der Build kaputt; tatsächlich war nur die Einreichung
// verklemmt. Eine frische Einreichung ging anstandslos durch.
//
// `submittedDate` ist das verlässliche Merkmal: eine abgeschickte Einreichung
// nimmt nichts mehr auf, egal was ihr Status gerade sagt.
const offen = await api(`/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW&limit=10`).catch(
  () => ({ data: [] }),
);
let submission = null;
for (const kandidat of offen.data ?? []) {
  if (kandidat.attributes.submittedDate) continue;
  const inhalt = await api(`/reviewSubmissions/${kandidat.id}/items?limit=10`).catch(() => ({ data: [] }));
  if ((inhalt.data ?? []).length === 0) { submission = kandidat; break; }
}
if (!submission) {
  submission = (
    await api('/reviewSubmissions', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'IOS' },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      }),
    })
  ).data;
  console.log(`Review-Einreichung angelegt (${submission.id})`);
} else {
  console.log(`Bestehende Einreichung wiederverwendet (${submission.id})`);
}

const items = await api(`/reviewSubmissions/${submission.id}/items?limit=10`).catch(() => ({ data: [] }));
const schonDrin = (items.data ?? []).some((i) => i.relationships?.appStoreVersion?.data?.id === version.id);
if (!schonDrin) {
  await api('/reviewSubmissionItems', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
        },
      },
    }),
  });
  console.log('Version an die Einreichung gehaengt');
}

await api(`/reviewSubmissions/${submission.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } } }),
});

// NACHPRUEFEN, ob die Version wirklich mitgegangen ist.
//
// Am 2026-08-07 meldete die Einreichung WAITING_FOR_REVIEW, ihr Element
// READY_FOR_REVIEW — und die Version stand trotzdem weiter auf
// PREPARE_FOR_SUBMISSION. In App Store Connect erschien sie als leerer
// "Uebermittlungsentwurf", die Version war nicht in Pruefung, und der Knopf
// "Zur Pruefung hinzufuegen" war gesperrt, weil die Version an dieser
// Einreichung hing. Erst nach dem Zuruecknehmen der Einreichung und dem
// Anhaengen ueber die Oberflaeche sprang die Version auf WAITING_FOR_REVIEW.
//
// Ein "Eingereicht." ohne diese Pruefung waere also eine Falschmeldung
// gewesen. Apple braucht ein paar Sekunden fuer den Uebergang, deshalb mit
// kurzem Nachfassen.
let zustand = null;
for (let versuch = 0; versuch < 6; versuch++) {
  await new Promise((r) => setTimeout(r, 5000));
  zustand = (await api(`/appStoreVersions/${version.id}`)).data.attributes.appStoreState;
  if (zustand !== 'PREPARE_FOR_SUBMISSION') break;
}
if (zustand === 'PREPARE_FOR_SUBMISSION') {
  console.error(`\nFEHLGESCHLAGEN: Die Einreichung wurde abgeschickt, aber ${VERSION} steht weiter auf`);
  console.error('PREPARE_FOR_SUBMISSION — die Version ist NICHT in Pruefung.');
  console.error('Das ist der bekannte Fall "leerer Uebermittlungsentwurf". So kommt man raus:');
  console.error('  1. Die eben erzeugte Einreichung zuruecknehmen (canceled: true).');
  console.error('  2. In App Store Connect auf der Version "Zur Pruefung hinzufuegen" -> Entwurf waehlen.');
  console.error('  3. Im Entwurfs-Fenster uebermitteln.');
  process.exit(1);
}
console.log(`\nEingereicht. Version ${VERSION}: ${zustand}`);
