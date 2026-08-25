#!/usr/bin/env node
// Zeigt den kompletten Store-Auftritt bei Apple: Name, Untertitel, Keywords,
// Beschreibung, Werbetext und Screenshots — je Sprache, mit Laengen gegen
// Apples Grenzen.
//
// Warum als eigenes Skript: asc-status.mjs sagt nur, WELCHE Version wo steht.
// Ob der Eintrag selbst gut ist (Untertitel gefuellt? Keywords ausgereizt?
// Screenshots in allen Groessen?), sieht man dort nicht — und in der
// Weboberflaeche muss man dafuer durch jede Sprache klicken.
//
// Reine Leseabfrage. Aufruf: node scripts/asc-auftritt.mjs
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';

/** Apples harte Grenzen — laengere Felder weist die API zurueck. */
const GRENZEN = { name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000 };

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

async function api(pfad) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${pfad} -> ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

const anteil = (wert, grenze) => `${String(wert ?? 0).padStart(4)}/${grenze}`;

// ---- App-weite Angaben (Name/Untertitel/Keywords haengen an der Version) ----
const versionen = await api(`/apps/${APP_ID}/appStoreVersions?limit=3`);
const aktuell = versionen.data[0];
console.log(`Version ${aktuell.attributes.versionString} — ${aktuell.attributes.appStoreState}\n`);

const locs = await api(`/appStoreVersions/${aktuell.id}/appStoreVersionLocalizations?limit=50`);
console.log(`Sprachen im Store-Eintrag: ${locs.data.length}\n`);

let befunde = 0;
for (const l of locs.data) {
  const a = l.attributes;
  console.log(`── ${a.locale} ─────────────────────────────`);
  console.log(`   Beschreibung  ${anteil(a.description?.length, GRENZEN.description)}`);
  console.log(`   Keywords      ${anteil(a.keywords?.length, GRENZEN.keywords)}  ${a.keywords ?? '(leer)'}`);
  console.log(`   Werbetext     ${anteil(a.promotionalText?.length, GRENZEN.promotionalText)}`);
  console.log(`   Neu i. Vers.  ${a.whatsNew ? `${a.whatsNew.length} Zeichen` : 'LEER'}`);
  if (!a.keywords) { console.log('   ! keine Keywords — verschenkte Sichtbarkeit'); befunde++; }
  if (!a.promotionalText) { console.log('   ! kein Werbetext — die einzige Zeile, die ohne neue Version aenderbar ist'); befunde++; }
  if (!a.whatsNew) { console.log('   ! "Neu in dieser Version" leer'); befunde++; }

  // Screenshots je Geraeteklasse
  const sets = await api(`/appStoreVersionLocalizations/${l.id}/appScreenshotSets?limit=20`).catch(() => ({ data: [] }));
  const proTyp = [];
  for (const s of sets.data) {
    const shots = await api(`/appScreenshotSets/${s.id}/appScreenshots?limit=20`).catch(() => ({ data: [] }));
    proTyp.push(`${s.attributes.screenshotDisplayType}:${shots.data.length}`);
  }
  console.log(`   Screenshots   ${proTyp.length ? proTyp.join('  ') : 'KEINE'}`);
  if (proTyp.length === 0) { console.log('   ! keine Screenshots hinterlegt'); befunde++; }
}

// ---- Name/Untertitel liegen an der App-Info, nicht an der Version ----
const infos = await api(`/apps/${APP_ID}/appInfos?limit=5`);
for (const info of infos.data.slice(0, 1)) {
  const il = await api(`/appInfos/${info.id}/appInfoLocalizations?limit=50`);
  console.log('\n── Name & Untertitel ─────────────────────');
  for (const l of il.data) {
    const a = l.attributes;
    console.log(`   ${a.locale.padEnd(6)} Name "${a.name ?? ''}" ${anteil(a.name?.length, GRENZEN.name)} | Untertitel "${a.subtitle ?? ''}" ${anteil(a.subtitle?.length, GRENZEN.subtitle)}`);
    if (!a.subtitle) { console.log('          ! kein Untertitel — steht direkt unter dem Namen in der Suche'); befunde++; }
  }
}

console.log(`\n${befunde === 0 ? 'Auftritt vollstaendig.' : `${befunde} Stelle(n) unausgefuellt.`}`);
