#!/usr/bin/env node
// Prueft fuer BEIDE Play-Apps, ob wirklich nur noch Googles Freigabe fehlt.
//
// Die Frage dahinter: "fehlt uns noch etwas, oder warten wir nur?" Die Play
// Console beantwortet das nur haeppchenweise ueber mehrere Tabs. Hier steht
// alles nebeneinander: Tracks, hochgeladene Versionen, Store-Eintraege,
// Pflichtgrafiken und die Freigabe-Einstellung.
//
// Aufruf: node scripts/play-freigabe-check.mjs
//
// WICHTIG zur Aussagekraft: Was diese API NICHT liefert, sind die Deklarationen
// unter "App-Inhalte" (Datensicherheit, Inhaltsbewertung, Zielgruppe) und der
// Pruefstatus selbst. Beides steht nur in der Console. Das Skript sagt also
// verlaesslich, ob die AUSLIEFERUNG vollstaendig ist — nicht, ob Google schon
// gepruft hat. Es sagt aber, wenn etwas fehlt, das wir liefern muessten.
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';
const APPS = [
  { paket: 'de.salatibox.de', name: 'Handy/Tablet' },
  { paket: 'de.salatibox.tv', name: 'Android TV' },
];

/** Grafiken, ohne die Google einen Eintrag nicht veroeffentlicht. */
const PFLICHT_BILDER = {
  icon: 'Icon',
  featureGraphic: 'Feature-Grafik',
};

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));

async function token() {
  const jetzt = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: jetzt,
      exp: jetzt + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' },
  );
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('kein Token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

const TOK = await token();
const api = async (pfad, init = {}) => {
  const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${pfad} -> ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

let befunde = 0;
const melde = (stufe, text) => {
  if (stufe === 'FEHLT') befunde++;
  console.log(`   ${stufe.padEnd(7)} ${text}`);
};

for (const app of APPS) {
  console.log(`\n═══ ${app.name} — ${app.paket} ═══`);
  let editId;
  try {
    editId = (await api(`/${app.paket}/edits`, { method: 'POST' })).id;
  } catch (e) {
    console.log(`   FEHLER  kein Zugriff: ${e.message.slice(0, 120)}`);
    befunde++;
    continue;
  }

  try {
    // ---- Tracks: liegt in der Produktion eine Version, und ist sie vollstaendig? ----
    const tracks = await api(`/${app.paket}/edits/${editId}/tracks`);
    const prod = (tracks.tracks ?? []).find((t) => t.track === 'production');
    const releases = prod?.releases ?? [];
    const fertig = releases.filter((r) => r.status === 'completed');
    if (fertig.length === 0) {
      melde('FEHLT', 'Produktions-Track hat keine abgeschlossene Version');
    } else {
      for (const r of fertig) {
        const vc = (r.versionCodes ?? []).join(', ');
        const anteil = r.userFraction != null ? ` (${Math.round(r.userFraction * 100)} % Rollout)` : '';
        melde('OK', `Produktion: ${r.name ?? '?'} · versionCode ${vc} · ${r.status}${anteil}`);
        if (!r.releaseNotes || r.releaseNotes.length === 0) {
          melde('FEHLT', 'Produktions-Version ohne Release-Notes');
        } else {
          melde('OK', `Release-Notes in ${r.releaseNotes.length} Sprache(n)`);
        }
      }
    }
    for (const t of tracks.tracks ?? []) {
      if (t.track === 'production') continue;
      const r = (t.releases ?? []).map((x) => `${x.status}${x.versionCodes ? ' vc ' + x.versionCodes.join('/') : ''}`).join(', ');
      if (r) melde('INFO', `Track ${t.track}: ${r}`);
    }

    // ---- Store-Eintraege ----
    const listings = await api(`/${app.paket}/edits/${editId}/listings`);
    const sprachen = listings.listings ?? [];
    melde(sprachen.length > 0 ? 'OK' : 'FEHLT', `Store-Eintraege in ${sprachen.length} Sprache(n)`);
    for (const l of sprachen) {
      const luecken = [];
      if (!l.title) luecken.push('Titel');
      if (!l.shortDescription) luecken.push('Kurzbeschreibung');
      if (!l.fullDescription) luecken.push('Vollbeschreibung');
      if (luecken.length) melde('FEHLT', `${l.language}: ${luecken.join(', ')}`);
    }

    // ---- Pflichtgrafiken + Screenshots ----
    //
    // NUR in der Standardsprache pruefen: Play zeigt einer Sprache ohne eigene
    // Grafiken die der Standardsprache. Ein leerer Bildersatz in `ar` ist also
    // kein Mangel, sondern der Normalfall. Die erste Fassung dieses Skripts
    // pruefte jede Sprache einzeln und meldete dadurch 34 Luecken, die keine
    // waren.
    const details = await api(`/${app.paket}/edits/${editId}/details`);
    const std = details.defaultLanguage;
    melde('INFO', `Standardsprache ${std} — Grafiken werden von dort vererbt`);

    for (const [art, label] of Object.entries(PFLICHT_BILDER)) {
      const bilder = await api(`/${app.paket}/edits/${editId}/listings/${std}/${art}`).catch(() => ({}));
      const n = (bilder.images ?? []).length;
      melde(n > 0 ? 'OK' : 'FEHLT', `${label}: ${n}`);
    }
    const hol = async (art) =>
      ((await api(`/${app.paket}/edits/${editId}/listings/${std}/${art}`).catch(() => ({}))).images ?? []).length;
    const nP = await hol('phoneScreenshots');
    // Google verlangt IMMER mindestens zwei Telefon-Screenshots — auch bei einer
    // reinen TV-App (Befund aus der TV-Erstpruefung, s. docs/).
    melde(nP >= 2 ? 'OK' : 'FEHLT', `Telefon-Screenshots: ${nP} (mindestens 2)`);
    if (app.paket.endsWith('.tv')) {
      const nT = await hol('tvScreenshots');
      const nB = await hol('tvBanner');
      melde(nT >= 1 ? 'OK' : 'FEHLT', `TV-Screenshots: ${nT}`);
      melde(nB >= 1 ? 'OK' : 'FEHLT', `TV-Banner: ${nB}`);
    } else {
      melde('INFO', `Tablet-Screenshots: 7" ${await hol('sevenInchScreenshots')} · 10" ${await hol('tenInchScreenshots')}`);
    }

  } finally {
    await api(`/${app.paket}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  }
}

console.log(
  befunde === 0
    ? '\nBeide Apps sind vollstaendig ausgeliefert — es fehlt nur noch Googles Freigabe.'
    : `\n${befunde} Punkt(e) fehlen noch von unserer Seite.`,
);
process.exit(befunde === 0 ? 0 : 1);
