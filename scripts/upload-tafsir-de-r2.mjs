// Lädt den deutschen Tafsir (114 Suren-Dateien) nach Cloudflare R2 (Präfix
// tafsir/de-rassoul/).
//
// Warum nicht ins App-Bundle: der Datensatz ist rund 2 MB und betrifft nur
// eine der 14 App-Sprachen — gleiche Abwägung wie beim KI-Korpus
// (scripts/upload-ki-korpus-r2.mjs). Warum überhaupt eigene Auslieferung: die
// Quelle ist ein PDF ohne Schnittstelle, und kein öffentlicher Tafsir-Anbieter
// führt Deutsch (Protokoll: docs/audit-2026-07-27/TAFSIR-DEUTSCH-SUCHE.md).
//
// Rechtsgrundlage der Weitergabe: der Autor hat das Werk ausdrücklich frei von
// Copyright und Verlagsrechten gestellt, einzige Auflage ist die
// Quellennennung — sie steht auf der Lizenzseite und im Tafsir-Picker
// (TAFSIR_DE_ATTRIBUTION in src/features/quran/api.ts) und liegt als
// Volltext unter public/licenses/ib-rassoul-tafsir.txt bei.
//
// Zugangsdaten kommen aus der .env im Repo-Root. Sie werden NIE ausgegeben.
//
// Ausführen: cd apps/mobile && python scripts/build-tafsir-de.py
//            node scripts/upload-tafsir-de-r2.mjs
//            node scripts/upload-tafsir-de-r2.mjs --pruefen   (nur nachsehen)
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const AUSGABE_DIR = path.join(MOBILE, 'build', 'tafsir-de');
const PRAEFIX = 'tafsir/de-rassoul';
const SUREN = 114;

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

let bestaetigt = 0;
let bytes = 0;
for (let sure = 1; sure <= SUREN; sure++) {
  const datei = path.join(AUSGABE_DIR, `${sure}.json`);
  if (!existsSync(datei)) {
    console.log(`Sure ${sure}: FEHLT — erst python scripts/build-tafsir-de.py`);
    continue;
  }
  const key = `${PRAEFIX}/${sure}.json`;
  const url = `${oeffentlich}/${key}`;
  if (nurPruefen) {
    const r = await fetch(url, { method: 'HEAD' });
    const laenge = Number(r.headers.get('content-length') ?? 0);
    const lokal = statSync(datei).size;
    if (r.ok && laenge === lokal) bestaetigt++;
    else console.log(`Sure ${sure}: HTTP ${r.status} · online ${laenge} · lokal ${lokal}`);
    continue;
  }
  const body = readFileSync(datei);
  await putObjekt(env, key, body, 'application/json; charset=utf-8');
  // Sofort gegen die öffentliche URL prüfen: ein erfolgreiches PUT bedeutet
  // nicht, dass die Datei über r2.dev auch ausgeliefert wird (eigener Pfad).
  const r = await fetch(url, { method: 'HEAD' });
  const online = Number(r.headers.get('content-length') ?? 0);
  if (r.ok && online === body.length) {
    bestaetigt++;
    bytes += body.length;
  } else {
    console.log(`Sure ${sure}: PRUEFEN · HTTP ${r.status} · online ${online} · lokal ${body.length} · ${url}`);
  }
}

console.log(
  `${bestaetigt}/${SUREN} Suren bestätigt unter ${oeffentlich}/${PRAEFIX}/` +
    (nurPruefen ? '' : ` · ${Math.round(bytes / 1024)} KB`),
);
