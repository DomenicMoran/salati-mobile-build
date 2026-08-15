#!/usr/bin/env node
// Laedt die Geraete-Screenshots (store-assets/device/<klasse>/<locale>/ und
// store-assets/wear/<locale>/) in den Play-Store-Eintrag.
//
// Sicherheitsregel: ein vorhandener Satz bei Play wird NUR geloescht, wenn
// lokal ein vollstaendiger Ersatz vorliegt (Mindestanzahl je Klasse erfuellt
// und jede Datei ein lesbares PNG innerhalb der Play-Grenzen). Fehlt lokal
// etwas, bleibt der bestehende Satz unangetastet und wird im Bericht als
// „uebersprungen" gemeldet.
//
// Usage:
//   node scripts/play-upload-screenshots.mjs --pruefen        nur auflisten
//   node scripts/play-upload-screenshots.mjs                  hochladen + commit
//   node scripts/play-upload-screenshots.mjs --klasse phone   nur eine Klasse
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = process.env.PLAY_PACKAGE ?? 'de.salatibox.de';
const SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';

const argv = process.argv.slice(2);
const NUR_PRUEFEN = argv.includes('--pruefen');
const NUR_KLASSE = argv.includes('--klasse') ? argv[argv.indexOf('--klasse') + 1] : null;

// Play-Bildtyp -> Quellverzeichnis + Mindestanzahl.
const KLASSEN = {
  phoneScreenshots: { dir: 'store-assets/device/phone', min: 2, max: 8 },
  sevenInchScreenshots: { dir: 'store-assets/device/sevenInch', min: 2, max: 8 },
  tenInchScreenshots: { dir: 'store-assets/device/tenInch', min: 2, max: 8 },
  wearScreenshots: { dir: 'store-assets/wear', min: 1, max: 8 },
};

// Play-Grenzen fuer Screenshots: kuerzeste Kante >= 320, laengste <= 3840,
// Seitenverhaeltnis hoechstens 2:1. Wear zusaetzlich: quadratisch (1:1).
function pngMasse(datei) {
  const fd = fs.openSync(datei, 'r');
  const kopf = Buffer.alloc(24);
  fs.readSync(fd, kopf, 0, 24, 0);
  fs.closeSync(fd);
  if (kopf.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`${datei}: kein PNG`);
  return [kopf.readUInt32BE(16), kopf.readUInt32BE(20)];
}

function pruefeBild(datei, typ) {
  const [w, h] = pngMasse(datei);
  const kurz = Math.min(w, h), lang = Math.max(w, h);
  if (kurz < 320) return `zu klein (${w}x${h})`;
  if (lang > 3840) return `zu gross (${w}x${h})`;
  // Play akzeptiert nachweislich moderne Telefon-Formate (die live liegenden
  // 1290x2796 = 2,17:1). Harte Grenze ist die Kantenlaenge; das
  // Seitenverhaeltnis wird nur grob gegen Ausreisser geprueft — den Rest
  // entscheidet die API, deren Fehler unten protokolliert wird.
  if (lang / kurz > 2.5) return `Seitenverhaeltnis ${(lang / kurz).toFixed(2)}:1 (${w}x${h})`;
  if (typ === 'wearScreenshots' && w !== h) return `Wear braucht 1:1, ist ${w}x${h}`;
  return null;
}

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
const api = async (p, opts = {}) => {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
};
const upload = async (p, buf) => {
  const r = await fetch(UPLOAD + p, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'image/png' }, body: buf });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
};

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 300)); process.exit(1); }
const editId = edit.json.id;

const ls = await api(`/edits/${editId}/listings`);
const locales = (ls.json?.listings ?? []).map((l) => l.language).sort();

const bericht = [];
for (const locale of locales) {
  for (const [typ, cfg] of Object.entries(KLASSEN)) {
    if (NUR_KLASSE && typ !== NUR_KLASSE) continue;
    const vorhanden = ((await api(`/edits/${editId}/listings/${locale}/${typ}`)).json?.images ?? []).length;
    const dir = path.join(cfg.dir, locale);
    const dateien = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort().slice(0, cfg.max)
      : [];

    if (dateien.length < cfg.min) {
      bericht.push({ locale, typ, vorher: vorhanden, nachher: vorhanden, status: `uebersprungen — lokal ${dateien.length} Bilder (< ${cfg.min})` });
      continue;
    }
    const fehler = dateien.map((f) => pruefeBild(path.join(dir, f), typ)).filter(Boolean);
    if (fehler.length) {
      bericht.push({ locale, typ, vorher: vorhanden, nachher: vorhanden, status: `uebersprungen — ${fehler[0]}` });
      continue;
    }
    if (NUR_PRUEFEN) {
      bericht.push({ locale, typ, vorher: vorhanden, nachher: dateien.length, status: 'wuerde ersetzt' });
      continue;
    }
    // Ersatz steht fest -> erst jetzt loeschen.
    await api(`/edits/${editId}/listings/${locale}/${typ}`, { method: 'DELETE' });
    let ok = 0;
    for (const f of dateien) {
      const r = await upload(`/edits/${editId}/listings/${locale}/${typ}`, fs.readFileSync(path.join(dir, f)));
      if (r.ok) ok++;
      else console.error(`  ! ${locale}/${typ}/${f}: ${r.status} ${JSON.stringify(r.json?.error?.message ?? '')}`);
    }
    bericht.push({ locale, typ, vorher: vorhanden, nachher: ok, status: ok === dateien.length ? 'ersetzt' : 'TEILWEISE' });
    console.log(`${locale.padEnd(6)} ${typ.padEnd(22)} ${vorhanden} -> ${ok}`);
  }
}

if (NUR_PRUEFEN) {
  await api(`/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
} else {
  const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
  console.log('\nCommit:', commit.ok ? 'OK' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 500)}`);
  if (!commit.ok) process.exitCode = 1;
}

console.log('\n| Sprache | Klasse | vorher | nachher | Status |');
console.log('|---|---|---|---|---|');
for (const b of bericht) console.log(`| ${b.locale} | ${b.typ} | ${b.vorher} | ${b.nachher} | ${b.status} |`);
