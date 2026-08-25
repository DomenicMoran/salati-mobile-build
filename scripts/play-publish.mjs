#!/usr/bin/env node
// Play-Store-Publish für Salati (de.salatibox.app) über die Play Developer API.
// Voraussetzung: App-Eintrag existiert in der Play Console (USER-TODO S1).
//
// Macht in EINEM Edit: Listings (6 Sprachen aus store/listing/*.md),
// Grafiken (Icon, Feature-Grafik, Phone-/Tablet-Screenshots), optional
// AAB-Upload auf den internal-Track, Commit.
//
// Usage:
//   node scripts/play-publish.mjs                 # nur Listings + Grafiken
//   node scripts/play-publish.mjs --nur-texte     # Listings ohne Grafik-Upload
//   node scripts/play-publish.mjs <pfad/app.aab>  # zusätzlich AAB → internal
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.de';
const NUR_TEXTE = process.argv.includes('--nur-texte');
const AAB_PATH = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? null;
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';
// Play-BCP47 je Listing-Datei. Die App spricht 14 Sprachen; Play kennt 13
// davon — Paschtu (ps) steht nicht auf Googles Sprachliste und kann deshalb
// keinen eigenen Store-Eintrag bekommen (Stand 2026-07). Jede hier fehlende
// Sprache ist verlorene Sichtbarkeit in genau dem Markt, für den die App
// bereits übersetzt ist, deshalb sind alle unterstützten aufgeführt.
const LOCALES = {
  de: 'de-DE', en: 'en-US', tr: 'tr-TR', ar: 'ar', es: 'es-ES', fr: 'fr-FR',
  bn: 'bn-BD', fa: 'fa', id: 'id', ms: 'ms', ru: 'ru-RU', sw: 'sw', ur: 'ur',
};

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
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

async function api(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}
async function upload(p, buf, contentType) {
  const r = await fetch(UPLOAD + p, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': contentType }, body: buf });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}

/** Parst title/short/full aus einer store/listing/*.md. */
function parseListing(rohMd) {
  // CRLF vereinheitlichen, BEVOR gezaehlt wird. Die .md-Dateien liegen mit
  // Windows-Zeilenenden im Repo; jedes \r zaehlt gegen Googles 4000-Zeichen-
  // Grenze. Dadurch lagen neun der 14 Vollbeschreibungen knapp darueber und
  // wurden von `full.slice(0, 4000)` unten still gekappt — ausgerechnet am
  // Textende, wo die Datenschutz-Adresse steht (gemessen 2026-07-27).
  const md = rohMd.replace(/\r\n/g, '\n');
  const title = /^#\s+(.+)$/m.exec(md)?.[1]?.trim();
  const sections = md.split(/^##\s+/m);
  let short = null, full = null;
  for (const sec of sections) {
    const [head, ...rest] = sec.split('\n');
    const body = rest.join('\n').replace(/\(\d+\/\d+ Zeichen\)/g, '').replace(/^\([^)]*\)$/gm, '').trim();
    const h = head.trim().toLowerCase();
    if (/kurz|short|kısa|القصير|corta|courte/.test(h)) short = body.split('\n\n')[0].trim();
    if (/vollständige|full description|tam açıklama|الوصف الكامل|completa|complète/.test(h)) full = body.trim();
  }
  return { title, short, full };
}

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 200)); process.exit(1); }
const editId = edit.json.id;
console.log('Edit:', editId);

// 1) Listings
for (const [lang, locale] of Object.entries(LOCALES)) {
  const md = fs.readFileSync(path.join('store/listing', `${lang}.md`), 'utf8');
  const { title, short, full } = parseListing(md);
  if (!title || !short || !full) { console.error(`Listing ${lang}: parse-Fehler`); process.exit(1); }
  // ABBRECHEN statt kappen. `slice()` allein schnitt still am Textende ab —
  // dort steht die Datenschutz-Adresse. Beim Einfügen der Moschee-Zeile
  // (2026-08-07) liefen neun der 14 Beschreibungen über die Grenze; ohne
  // diesen Halt wäre das erst im veröffentlichten Store aufgefallen.
  for (const [feld, wert, max] of [['Titel', title, 30], ['Kurzbeschreibung', short, 80], ['Vollbeschreibung', full, 4000]]) {
    if (wert.length > max) {
      console.error(`Listing ${lang}: ${feld} ${wert.length} Zeichen > ${max} — gekürzt würde das Textende verloren gehen.`);
      process.exit(1);
    }
  }
  const r = await api(`/edits/${editId}/listings/${locale}`, {
    method: 'PUT',
    body: JSON.stringify({ language: locale, title, shortDescription: short, fullDescription: full }),
  });
  console.log(`Listing ${locale}:`, r.ok ? 'OK' : `${r.status} ${JSON.stringify(r.json?.error?.message ?? '').slice(0, 120)}`);
}

// 2) Grafiken (nur de+en Screenshots vorhanden; Play nutzt de-DE als Default)
async function uploadImage(locale, type, file) {
  const buf = fs.readFileSync(file);
  const r = await upload(`/edits/${editId}/listings/${locale}/${type}`, buf, 'image/png');
  console.log(`${locale}/${type} ${path.basename(file)}:`, r.ok ? 'OK' : r.status);
}
for (const [lang, locale] of NUR_TEXTE ? [] : [['de', 'de-DE'], ['en', 'en-US']]) {
  // Alte Bilder je Typ löschen (idempotent bei erneutem Lauf)
  for (const type of ['icon', 'featureGraphic', 'phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots']) {
    await api(`/edits/${editId}/listings/${locale}/${type}`, { method: 'DELETE' }).catch(() => {});
  }
  await uploadImage(locale, 'icon', 'store/graphics/play-icon-512.png');
  await uploadImage(locale, 'featureGraphic', 'store/graphics/feature-graphic-1024x500.png');
  for (const f of fs.readdirSync(`store/screenshots/${lang}/phone`).sort()) {
    await uploadImage(locale, 'phoneScreenshots', `store/screenshots/${lang}/phone/${f}`);
  }
  for (const f of fs.readdirSync(`store/screenshots/${lang}/tablet`).sort()) {
    await uploadImage(locale, 'tenInchScreenshots', `store/screenshots/${lang}/tablet/${f}`);
  }
}

// 3) Optional: AAB → internal track
if (AAB_PATH) {
  const aab = fs.readFileSync(AAB_PATH);
  console.log('AAB-Upload:', (aab.length / 1e6).toFixed(1), 'MB ...');
  const up = await upload(`/edits/${editId}/bundles`, aab, 'application/octet-stream');
  if (!up.ok) { console.error('AAB fehlgeschlagen:', up.status, JSON.stringify(up.json).slice(0, 300)); process.exit(1); }
  const vc = up.json.versionCode;
  console.log('AAB OK, versionCode', vc);
  const tr = await api(`/edits/${editId}/tracks/internal`, {
    method: 'PUT',
    body: JSON.stringify({ track: 'internal', releases: [{ status: 'completed', versionCodes: [String(vc)] }] }),
  });
  console.log('Track internal:', tr.ok ? 'OK' : `${tr.status} ${JSON.stringify(tr.json).slice(0, 200)}`);
}

// 4) Commit
const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK — Änderungen sind in der Play Console' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 300)}`);
