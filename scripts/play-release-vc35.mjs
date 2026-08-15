#!/usr/bin/env node
// Laedt das signierte vc35-AAB auf den Production-Track UND aktualisiert
// zugleich die Store-Listings (Titel/Kurz-/Vollbeschreibung) aus
// store/listing/<lang>.md fuer alle in der Play Console konfigurierten
// Sprachen. Ein Edit, ein Commit.
//
// Usage: node scripts/play-release-vc35.mjs <pfad/app.aab>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.de';
const AAB_PATH = process.argv[2];
const SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';
const LISTING_DIR = path.resolve(fileURLToPath(new URL('../store/listing', import.meta.url)));

if (!AAB_PATH) { console.error('Usage: play-release-vc35.mjs <aab>'); process.exit(1); }

// --- md-Datei -> {title, short, full} ---------------------------------------
function parseListing(md) {
  const lines = md.split(/\r?\n/);
  const title = (lines.find((l) => l.startsWith('# ')) || '').slice(2).trim();
  function block(header, stopHeaders) {
    const start = lines.findIndex((l) => l.trim() === header);
    if (start < 0) return '';
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('## ')) break;
      out.push(l);
    }
    // fuehrende/abschliessende Leerzeilen + "(x/y Zeichen)"-Hinweis entfernen
    return out
      .filter((l) => !/^\(\d+\/\d+\s+Zeichen\)/.test(l.trim()))
      .join('\n')
      .trim();
  }
  return {
    title: title.slice(0, 30),
    short: block('## Kurzbeschreibung').slice(0, 80),
    full: block('## Vollständige Beschreibung').slice(0, 4000),
  };
}

// md-Prefix -> Play-BCP47-Sprachcode
const LANG_MAP = {
  de: 'de-DE', en: 'en-US', tr: 'tr-TR', ar: 'ar', es: 'es-ES', fr: 'fr-FR',
  id: 'id', bn: 'bn-BD', fa: 'fa-IR', ms: 'ms', ur: 'ur', ru: 'ru-RU',
  sw: 'sw', ps: 'ps',
};

const RELEASE_NOTES = `Neu in 1.29.1:
• Das Gebetszeiten-Widget aktualisiert sich jetzt selbststaendig (auch zur Gebetszeit)
• Die fuenf Tageszeiten bleiben in jeder Widget-Groesse sichtbar
• Weitere Detailverbesserungen`;

// --- Auth -------------------------------------------------------------------
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const assertion = jwt.sign(
  { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
  sa.private_key, { algorithm: 'RS256' },
);
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
})).json();
const ACCESS = tok.access_token;
if (!ACCESS) { console.error('Token fehlgeschlagen', tok); process.exit(1); }

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
async function api(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}

// --- Edit -------------------------------------------------------------------
const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 300)); process.exit(1); }
const editId = edit.json.id;
console.log('Edit:', editId);

// --- Vorhandene Listings ermitteln (nur konfigurierte Sprachen anfassen) ----
const existing = await api(`/edits/${editId}/listings`);
const configured = new Set((existing.json?.listings || []).map((l) => l.language));
console.log('Konfigurierte Sprachen in Play:', [...configured].join(', ') || '(keine gelesen)');

// --- Listings aktualisieren -------------------------------------------------
let updated = 0;
for (const [prefix, lang] of Object.entries(LANG_MAP)) {
  const file = path.join(LISTING_DIR, `${prefix}.md`);
  if (!fs.existsSync(file)) continue;
  if (configured.size && !configured.has(lang)) continue; // nicht konfigurierte Sprache ueberspringen
  const { title, short, full } = parseListing(fs.readFileSync(file, 'utf8'));
  if (!title || !short || !full) { console.warn(`  ${lang}: unvollstaendig, uebersprungen`); continue; }
  const res = await api(`/edits/${editId}/listings/${lang}`, {
    method: 'PUT',
    body: JSON.stringify({ language: lang, title, shortDescription: short, fullDescription: full }),
  });
  console.log(`  Listing ${lang}: ${res.ok ? 'OK' : res.status + ' ' + JSON.stringify(res.json).slice(0, 200)}`);
  if (res.ok) updated++;
}
console.log(`Listings aktualisiert: ${updated}`);

// --- AAB hochladen ----------------------------------------------------------
const aab = fs.readFileSync(AAB_PATH);
console.log('AAB-Upload:', (aab.length / 1e6).toFixed(1), 'MB ...');
const up = await fetch(`${UPLOAD}/edits/${editId}/bundles`, {
  method: 'POST', headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/octet-stream' }, body: aab,
});
const upJson = await up.json().catch(() => null);
if (!up.ok) { console.error('AAB fehlgeschlagen:', up.status, JSON.stringify(upJson).slice(0, 400)); process.exit(1); }
const vc = upJson.versionCode;
console.log('AAB OK, versionCode', vc);

// --- Production-Track --------------------------------------------------------
const tr = await api(`/edits/${editId}/tracks/production`, {
  method: 'PUT',
  body: JSON.stringify({ track: 'production', releases: [{ status: 'completed', versionCodes: [String(vc)], releaseNotes: [{ language: 'de-DE', text: RELEASE_NOTES.slice(0, 500) }] }] }),
});
console.log('Track production:', tr.ok ? 'OK' : `${tr.status} ${JSON.stringify(tr.json).slice(0, 300)}`);
if (!tr.ok) process.exit(1);

// --- Commit -----------------------------------------------------------------
const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK — Release + Beschreibungen sind live in der Play Console' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 300)}`);
if (!commit.ok) process.exit(1);
