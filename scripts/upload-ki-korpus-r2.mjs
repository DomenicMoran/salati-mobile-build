// Lädt die 13 nicht-deutschen KI-Korpora nach Cloudflare R2 (Präfix rag/).
//
// Warum nicht ins App-Bundle: 14 Korpora sind zusammen rund 30 MB — das wäre
// eine Verdopplung der Download-Größe der App, obwohl jeder Nutzer immer nur
// EINEN davon braucht. Die KI setzt ohnehin einen einmaligen Modell-Download
// von 1,1 GB voraus (src/features/ki/model.ts); die 1,6-3,3 MB des Korpus
// fallen daneben nicht ins Gewicht. Deutsch bleibt gebündelt, damit die KI
// ohne jeden Netzzugriff sofort antwortfähig ist und jede andere Sprache einen
// sofort verfügbaren Rückfall hat.
//
// Zugangsdaten kommen aus der .env im Repo-Root (cloudflare_id / cloudflare_sec
// / cloudflare_s3_api / cloudflare_bucket). Sie werden NIE ausgegeben — auch
// nicht gekürzt. Signiert wird mit AWS SigV4 direkt über node:crypto, damit das
// Skript ohne zusätzliche Abhängigkeit läuft (R2 ist S3-kompatibel, path-style).
//
// Ausführen: cd apps/mobile && node scripts/upload-ki-korpus-r2.mjs
//            node scripts/upload-ki-korpus-r2.mjs --pruefen   (nur nachsehen)
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPRACHEN } from './lib/quran-editions.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const AUSGABE_DIR = path.join(MOBILE, 'build', 'ki-korpus');
const PRAEFIX = 'rag';

function ladeEnv() {
  const datei = path.join(MOBILE, '..', '..', '.env');
  if (!existsSync(datei)) throw new Error(`.env nicht gefunden: ${datei}`);
  const env = {};
  for (const zeile of readFileSync(datei, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z_0-9]+)=(.*)$/.exec(zeile.trim());
    if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  const noetig = ['cloudflare_id', 'cloudflare_sec', 'cloudflare_s3_api', 'cloudflare_bucket', 'cloudflare_public_url'];
  const fehlt = noetig.filter((k) => !env[k]);
  if (fehlt.length) throw new Error(`.env unvollständig, fehlende Schlüssel: ${fehlt.join(', ')}`);
  return env;
}

const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (key, d) => createHmac('sha256', key).update(d).digest();

/** Minimales AWS-SigV4-PUT gegen einen S3-kompatiblen Endpunkt (path-style). */
async function putObjekt(env, key, body, contentType) {
  const endpoint = new URL(env.cloudflare_s3_api);
  const pfad = `/${env.cloudflare_bucket}/${key}`;
  const jetzt = new Date();
  const amzDatum = jetzt.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const datum = amzDatum.slice(0, 8);
  const region = 'auto';
  const dienst = 's3';
  const nutzlastHash = sha256(body);

  const headers = {
    host: endpoint.host,
    'content-type': contentType,
    'x-amz-content-sha256': nutzlastHash,
    'x-amz-date': amzDatum,
  };
  const signierte = Object.keys(headers).sort();
  const kanonischeHeader = signierte.map((h) => `${h}:${headers[h]}\n`).join('');
  const signedHeaders = signierte.join(';');
  const kanonisch = ['PUT', pfad, '', kanonischeHeader, signedHeaders, nutzlastHash].join('\n');
  const bereich = `${datum}/${region}/${dienst}/aws4_request`;
  const zuSignieren = ['AWS4-HMAC-SHA256', amzDatum, bereich, sha256(kanonisch)].join('\n');
  let schluessel = hmac(`AWS4${env.cloudflare_sec}`, datum);
  schluessel = hmac(schluessel, region);
  schluessel = hmac(schluessel, dienst);
  schluessel = hmac(schluessel, 'aws4_request');
  const signatur = createHmac('sha256', schluessel).update(zuSignieren).digest('hex');

  const r = await fetch(`${endpoint.origin}${pfad}`, {
    method: 'PUT',
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${env.cloudflare_id}/${bereich}, SignedHeaders=${signedHeaders}, Signature=${signatur}`,
    },
    body,
  });
  if (!r.ok) {
    // Fehlertext von R2 durchreichen, aber niemals die Header/Signatur.
    throw new Error(`PUT ${key} fehlgeschlagen: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  }
}

const env = ladeEnv();
const oeffentlich = env.cloudflare_public_url.replace(/\/+$/, '');
const nurPruefen = process.argv.includes('--pruefen');
const ziele = SPRACHEN.filter((l) => l !== 'de');

let hochgeladen = 0;
for (const lang of ziele) {
  const datei = path.join(AUSGABE_DIR, `korpus-${lang}.json`);
  if (!existsSync(datei)) {
    console.log(`${lang}: FEHLT (${path.relative(MOBILE, datei)}) — erst node scripts/build-ki-korpus.mjs`);
    continue;
  }
  const key = `${PRAEFIX}/korpus-${lang}.json`;
  const url = `${oeffentlich}/${key}`;
  if (nurPruefen) {
    const r = await fetch(url, { method: 'HEAD' });
    const laenge = Number(r.headers.get('content-length') ?? 0);
    const lokal = statSync(datei).size;
    console.log(`${lang}: ${r.status} · online ${Math.round(laenge / 1024)} KB · lokal ${Math.round(lokal / 1024)} KB${laenge === lokal ? ' · gleich' : ''}`);
    continue;
  }
  const body = readFileSync(datei);
  await putObjekt(env, key, body, 'application/json; charset=utf-8');
  // Sofort gegen die öffentliche URL prüfen: ein erfolgreiches PUT bedeutet
  // nicht, dass die Datei über r2.dev auch ausgeliefert wird (eigener Pfad).
  const r = await fetch(url, { method: 'HEAD' });
  const online = Number(r.headers.get('content-length') ?? 0);
  const ok = r.ok && online === body.length;
  console.log(`${lang}: ${ok ? 'ok' : 'PRUEFEN'} · ${Math.round(body.length / 1024)} KB · HTTP ${r.status} · online ${Math.round(online / 1024)} KB · ${url}`);
  if (ok) hochgeladen++;
}

if (!nurPruefen) console.log(`\n${hochgeladen}/${ziele.length} Korpora bestätigt unter ${oeffentlich}/${PRAEFIX}/`);
