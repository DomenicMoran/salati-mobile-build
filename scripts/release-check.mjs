#!/usr/bin/env node
// Prueft nach einem Release ALLE Auslieferungskanaele in einem Lauf.
//
// Hintergrund (docs/audit-2026-07-27/AUSLIEFERUNG.md): Play-Status, App-Store-
// Status, das APK auf der Website und die Live-Indizes (Podcast, Handouts,
// KI-Korpus) mussten bisher einzeln von Hand nachgesehen werden - dabei ist
// leicht zu uebersehen, dass ein Kanal noch auf dem alten Stand haengt.
//
// Reine Leseabfragen, kein Schreibzugriff. Authentifizierung analog zu
// scripts/play-status.mjs (Service-Account-JWT) und scripts/asc-status.mjs
// (ES256-JWT). Fehlen die Schluesseldateien, wird der jeweilige Abschnitt
// uebersprungen statt abzubrechen - die oeffentlichen Checks laufen trotzdem.
//
// Usage: node scripts/release-check.mjs
// Exit-Code: 0 = alles wie erwartet, 1 = mindestens ein Befund (FEHLER).
import fs from 'fs';
import path from 'path';
import { createRequire as createNodeRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(HIER, '..');

const PLAY_PACKAGE = 'de.salatibox.de';
const PLAY_SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';

const ASC_APP_ID = '6791867298';
const ASC_KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ASC_ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const ASC_KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';

const R2_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev';
const APK_URL = `${R2_BASE}/app/salati.apk`; // src/app/(tabs)/index.web.tsx
const HANDOUT_INDEX_URL = `${R2_BASE}/handouts/index.json`; // src/features/handouts/data.ts
const PODCAST_INDEX_URL =
  'https://oulyzhselufekxekkqjp.supabase.co/storage/v1/object/public/podcasts/index.json'; // src/features/podcast/data.ts
const SITE = 'https://www.salati.pro'; // scripts/generate-sitemap.mjs
const KORPUS_META_PFAD = 'rag/embeddings-de.meta.json';

// jsonwebtoken liegt nicht in diesem Workspace, sondern im MenuCloud-Repo -
// gleiche Aufloesung wie play-status.mjs/asc-status.mjs.
const requireMenuCloud = createNodeRequire('C:/Users/domen/Documents/MenuCloud/scripts/');

let befunde = 0;
const zeile = (status, titel, text) => {
  if (status === 'FEHLER') befunde += 1;
  console.log(`${status.padEnd(7)} ${titel.padEnd(22)} ${text}`);
};

function mb(bytes) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

// ---------------------------------------------------------------- Repo-Stand
const appConfig = (await import(pathToFileURL(path.join(APP_ROOT, 'app.config.ts')).href)).default;
const repoVersion = appConfig.version;
const repoBuildNumber = appConfig.ios?.buildNumber;
const gradle = fs.readFileSync(path.join(APP_ROOT, 'android/app/build.gradle'), 'utf8');
const repoVersionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
console.log(`Repo: Version ${repoVersion}, Android versionCode ${repoVersionCode}, iOS build ${repoBuildNumber}\n`);

// ------------------------------------------------------------------ Play
async function pruefePlay() {
  if (!fs.existsSync(PLAY_SA_PATH)) {
    zeile('---', 'Google Play', `uebersprungen (kein Service-Account unter ${PLAY_SA_PATH})`);
    return;
  }
  const jwt = requireMenuCloud('jsonwebtoken');
  const sa = JSON.parse(fs.readFileSync(PLAY_SA_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' },
  );
  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const { access_token: token } = await tokRes.json();
  const api = async (pfad, init = {}) => {
    const r = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}${pfad}`,
      { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } },
    );
    if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
    return r.json();
  };

  const edit = await api('/edits', { method: 'POST', body: '{}' });
  try {
    const track = await api(`/edits/${edit.id}/tracks/production`);
    const release = (track.releases ?? [])[0];
    if (!release) {
      zeile('FEHLER', 'Google Play', 'kein Release im Production-Track');
      return;
    }
    const codes = release.versionCodes ?? [];
    const passt = codes.map(Number).includes(repoVersionCode) && release.status === 'completed';
    zeile(
      passt ? 'OK' : 'FEHLER',
      'Google Play',
      `production ${release.status}, versionCode ${codes.join(',') || '-'}, ${release.name ?? '?'}` +
        (passt ? '' : ` (erwartet vc ${repoVersionCode} + completed)`),
    );
  } finally {
    await api(`/edits/${edit.id}`, { method: 'DELETE' }).catch(() => {});
  }
}

// ------------------------------------------------------------------- ASC
async function pruefeAsc() {
  if (!fs.existsSync(ASC_KEY_PATH)) {
    zeile('---', 'App Store Connect', `uebersprungen (kein Schluessel unter ${ASC_KEY_PATH})`);
    return;
  }
  const jwt = requireMenuCloud('jsonwebtoken');
  const token = jwt.sign({ iss: ASC_ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(ASC_KEY_PATH, 'utf8'), {
    algorithm: 'ES256',
    expiresIn: '15m',
    header: { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' },
  });
  const api = async (pfad) => {
    const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
    return r.json();
  };

  const versionen = await api(`/apps/${ASC_APP_ID}/appStoreVersions?limit=1`);
  const version = versionen.data[0];
  if (!version) {
    zeile('FEHLER', 'App Store Connect', 'keine App-Store-Version gefunden');
    return;
  }
  const build = await api(`/appStoreVersions/${version.id}/build`).catch(() => null);
  const buildNr = build?.data?.attributes?.version ?? '-';
  const state = version.attributes.appStoreState;
  // READY_FOR_SALE ist der Zielzustand; alles davor ist normal, aber sichtbar.
  const fertig = state === 'READY_FOR_SALE';
  const versionPasst = version.attributes.versionString === repoVersion;
  zeile(
    versionPasst ? (fertig ? 'OK' : 'OFFEN') : 'FEHLER',
    'App Store Connect',
    `${version.attributes.versionString} Build ${buildNr}, ${state}` +
      (versionPasst ? '' : ` (Repo steht auf ${repoVersion})`),
  );
}

// ------------------------------------------------------------- Website-APK
async function pruefeApk() {
  const r = await fetch(APK_URL, { method: 'HEAD' });
  const laenge = Number(r.headers.get('content-length') ?? 0);
  const typ = r.headers.get('content-type') ?? '?';
  // Unter 50 MB kann es die App nicht sein (Release-APK liegt bei ~265 MB) -
  // dann liegt dort vermutlich eine Fehlerseite oder ein abgebrochener Upload.
  const plausibel = r.ok && laenge > 50_000_000;
  zeile(plausibel ? 'OK' : 'FEHLER', 'Website-APK (R2)', `HTTP ${r.status}, ${mb(laenge)}, ${typ}`);
}

// ------------------------------------------------------- Podcast + Handouts
async function pruefeIndizes() {
  const podcast = await fetch(PODCAST_INDEX_URL);
  if (!podcast.ok) {
    zeile('FEHLER', 'Podcast-Index', `HTTP ${podcast.status}`);
  } else {
    const j = await podcast.json();
    const folgen = j.episodes?.length ?? 0;
    zeile(folgen > 0 ? 'OK' : 'FEHLER', 'Podcast-Index', `${folgen} Folgen, Stand ${j.updated_at ?? '?'}`);
  }

  const handouts = await fetch(HANDOUT_INDEX_URL);
  if (!handouts.ok) {
    zeile('FEHLER', 'Handout-Index', `HTTP ${handouts.status}`);
  } else {
    const j = await handouts.json();
    const anzahl = j.handouts?.length ?? 0;
    zeile(anzahl > 0 ? 'OK' : 'FEHLER', 'Handout-Index', `${anzahl} Unterlagen`);
  }
}

// -------------------------------------------------------------- KI-Korpus
async function pruefeKorpus() {
  const lokal = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'public', KORPUS_META_PFAD), 'utf8'));
  const r = await fetch(`${SITE}/${KORPUS_META_PFAD}`, { cache: 'no-store' });
  if (!r.ok) {
    // Vercel schiebt vor /rag/* eine Bot-Abwehr (Attack Challenge Mode). Die
    // beantwortet nur ein Browser mit JavaScript, kein Skript — auch ein echter
    // Browser bekommt hier 403 (am 2026-07-31 mit Playwright gegengeprueft).
    //
    // Das ist KEIN Auslieferungsfehler: den deutschen Korpus holt zur Laufzeit
    // niemand von dieser URL. features/ki/korpus.ts importiert
    // `public/rag/korpus-de.json` beim Bauen, die Datei steckt also im Bundle.
    // Was wirklich zur Laufzeit geladen wird, sind die 13 anderen Sprachen von
    // R2 — die prueft `pruefeKorpusSprachen()` unten, und nur die zaehlt.
    const abgewehrt = r.headers.get('x-vercel-mitigated') === 'challenge' || r.status === 403;
    zeile(
      abgewehrt ? 'HINWEIS' : 'FEHLER',
      'KI-Korpus (Web)',
      abgewehrt
        ? `von Vercels Bot-Abwehr geblockt (HTTP ${r.status}) — nicht pruefbar und nicht noetig, der deutsche Korpus liegt im Bundle`
        : `HTTP ${r.status} fuer ${SITE}/${KORPUS_META_PFAD}`,
    );
    return;
  }
  const live = await r.json();
  // count + letzteId zusammen identifizieren den Korpus-Stand eindeutig:
  // scripts/build-ki-korpus.mjs schreibt beide beim Erzeugen.
  const gleich = live.count === lokal.count && live.letzteId === lokal.letzteId;
  zeile(
    gleich ? 'OK' : 'FEHLER',
    'KI-Korpus (Web)',
    gleich
      ? `${live.count} Eintraege, identisch mit dem Repo`
      : `live ${live.count}/${live.letzteId} vs. Repo ${lokal.count}/${lokal.letzteId} — Website neu deployen`,
  );
}

// --------------------------------------------- KI-Korpora der 13 Sprachen (R2)
// Die App laedt sie zur Laufzeit (src/features/ki/korpus.ts). Fehlt einer,
// merkt es kein Build und kein Test — nur der Nutzer, dessen KI dann still auf
// deutsche Quellen zurueckfaellt. Darum hier pruefen.
async function pruefeKorpusSprachen() {
  const basis = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/rag';
  const sprachen = ['en', 'tr', 'ar', 'es', 'fr', 'ru', 'id', 'ms', 'bn', 'ur', 'fa', 'ps', 'sw'];
  const fehlend = [];
  for (const lang of sprachen) {
    const r = await fetch(`${basis}/korpus-${lang}.json`, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (!r?.ok || Number(r.headers.get('content-length') ?? 0) < 100_000) fehlend.push(lang);
  }
  zeile(
    fehlend.length === 0 ? 'OK' : 'FEHLER',
    'KI-Korpora (R2)',
    fehlend.length === 0
      ? `alle ${sprachen.length} Sprachen erreichbar`
      : `nicht erreichbar oder zu klein: ${fehlend.join(', ')} — node scripts/upload-ki-korpus-r2.mjs`,
  );
}

for (const [name, pruefung] of [
  ['Google Play', pruefePlay],
  ['App Store Connect', pruefeAsc],
  ['Website-APK (R2)', pruefeApk],
  ['Indizes', pruefeIndizes],
  ['KI-Korpus (Web)', pruefeKorpus],
  ['KI-Korpora (R2)', pruefeKorpusSprachen],
]) {
  try {
    await pruefung();
  } catch (e) {
    zeile('FEHLER', name, `Pruefung fehlgeschlagen: ${e.message}`);
  }
}

console.log(befunde === 0 ? '\nAlle Kanaele wie erwartet.' : `\n${befunde} Befund(e) — siehe FEHLER-Zeilen.`);
process.exit(befunde === 0 ? 0 : 1);
