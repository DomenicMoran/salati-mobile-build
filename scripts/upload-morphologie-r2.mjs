// Lädt die Wort-Morphologie-Daten (114 Suren-Dateien + roots.json, lemmas.json,
// meta.json) nach Cloudflare R2 (Präfix morphologie/).
//
// Warum gzip-komprimiert statt roh: die Rohdaten sind zusammen 45 MB (größte
// Einzeldatei 2.json: 3,4 MB), gzip-komprimiert nur 3,3 MB (2.json: 229 KB).
// Da die Laufzeitschicht (src/features/quran/morphologie.ts) ohnehin per
// fetch() lädt und React Native/Browser transparent entgzippen, sobald
// Content-Encoding: gzip gesetzt ist, spart das Netzvolumen ohne jede
// Client-Änderung. Deshalb wird hier abweichend von den beiden Vorlagen
// (upload-ki-korpus-r2.mjs, upload-tafsir-de-r2.mjs, die unkomprimiert mit
// application/json ausliefern) Content-Encoding: gzip gesetzt.
//
// Cache-Control: die Vorlagen setzen keine — hier abweichend bewusst
// `public, max-age=31536000, immutable`, weil die Morphologie-Daten
// (QAC-Segmentierung) sich praktisch nie ändern und pro Sure einzeln
// nachgeladen werden (features/quran/morphologie.ts); ohne langes Caching
// würde jeder Sure-Aufruf erneut über CF/R2 laufen statt aus dem
// Browser-/CDN-Cache bedient zu werden.
//
// Idempotent/wiederaufnehmbar: vor jedem Upload wird per HEAD verglichen, ob
// Größe UND ETag (MD5 des gzip-Bodys, wie R2 es bei einem einzelnen PUT
// vergibt) bereits übereinstimmen — dann wird übersprungen. Einzelfehler
// brechen den Lauf nicht ab, sondern werden gesammelt und am Ende gezeigt.
//
// Zugangsdaten kommen aus der .env im Repo-Root. Sie werden NIE ausgegeben.
//
// Ausführen: cd apps/mobile && node scripts/upload-morphologie-r2.mjs
//            node scripts/upload-morphologie-r2.mjs --pruefen   (nur nachsehen)
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
// Version im Ordner- UND R2-Präfix: dieselbe wie MORPHOLOGIE_VERSION in
// build-morphologie.mjs bzw. MORPHOLOGIE_SCHEMA_VERSION in morphologieTypen.ts
// (schema: 3). Grund siehe Kommentar dort — Cache-Control unten ist
// "immutable", eine neue Fassung unter derselben URL käme nie an.
const VERSION = 'v3';
const AUSGABE_DIR = path.join(MOBILE, '.daten-cache', 'out', 'morphologie', VERSION);
const PRAEFIX = `morphologie/${VERSION}`;
const SUREN = 114;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DATEINAMEN = [
  ...Array.from({ length: SUREN }, (_, i) => `${i + 1}.json`),
  'roots.json',
  'lemmas.json',
  'meta.json',
];

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
const md5 = (d) => createHash('md5').update(d).digest('hex');
const hmac = (key, d) => createHmac('sha256', key).update(d).digest();

/** Minimales AWS-SigV4-PUT gegen einen S3-kompatiblen Endpunkt (path-style). */
async function putObjekt(env, key, body, headerZusatz) {
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
    'x-amz-content-sha256': nutzlastHash,
    'x-amz-date': amzDatum,
    ...headerZusatz,
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
let uebersprungen = 0;
let bytesRoh = 0;
let bytesGzip = 0;
const fehler = [];

for (const name of DATEINAMEN) {
  const datei = path.join(AUSGABE_DIR, name);
  if (!existsSync(datei)) {
    fehler.push(`${name}: FEHLT (${path.relative(MOBILE, datei)})`);
    console.log(`${name}: FEHLT — erst die Morphologie-Pipeline laufen lassen`);
    continue;
  }
  const key = `${PRAEFIX}/${name}`;
  const url = `${oeffentlich}/${key}`;

  if (nurPruefen) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      const laenge = Number(r.headers.get('content-length') ?? 0);
      const kodierung = r.headers.get('content-encoding') ?? '(keine)';
      console.log(`${name}: HTTP ${r.status} · online ${Math.round(laenge / 1024)} KB · content-encoding ${kodierung}`);
      if (r.ok) bestaetigt++;
    } catch (err) {
      fehler.push(`${name}: HEAD fehlgeschlagen — ${err.message}`);
      console.log(`${name}: FEHLER bei HEAD — ${err.message}`);
    }
    continue;
  }

  try {
    const roh = readFileSync(datei);
    const gz = gzipSync(roh, { level: 9 });
    const gzMd5 = md5(gz);

    // Bereits identisch hochgeladen? Größe + ETag (MD5 des gzip-Bodys bei
    // einem einzelnen PUT) vergleichen, dann überspringen — macht das
    // Skript wiederaufnehmbar ohne unnötige erneute Uploads.
    const vorherR = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (vorherR && vorherR.ok) {
      const vorherLaenge = Number(vorherR.headers.get('content-length') ?? -1);
      const vorherEtag = (vorherR.headers.get('etag') ?? '').replace(/"/g, '');
      if (vorherLaenge === gz.length && vorherEtag === gzMd5) {
        uebersprungen++;
        bytesRoh += roh.length;
        bytesGzip += gz.length;
        console.log(`${name}: übersprungen (unverändert) · ${Math.round(gz.length / 1024)} KB gzip`);
        continue;
      }
    }

    await putObjekt(env, key, gz, {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'cache-control': CACHE_CONTROL,
    });

    // Sofort gegen die öffentliche URL prüfen: ein erfolgreiches PUT bedeutet
    // nicht, dass die Datei über r2.dev auch ausgeliefert wird (eigener Pfad).
    const r = await fetch(url, { method: 'HEAD' });
    const online = Number(r.headers.get('content-length') ?? 0);
    const ok = r.ok && online === gz.length;
    console.log(
      `${name}: ${ok ? 'ok' : 'PRUEFEN'} · roh ${Math.round(roh.length / 1024)} KB → gzip ${Math.round(gz.length / 1024)} KB · HTTP ${r.status}`,
    );
    if (ok) {
      bestaetigt++;
      bytesRoh += roh.length;
      bytesGzip += gz.length;
    } else {
      fehler.push(`${name}: online ${online} Bytes ≠ gzip ${gz.length} Bytes (HTTP ${r.status})`);
    }
  } catch (err) {
    fehler.push(`${name}: ${err.message}`);
    console.log(`${name}: FEHLER — ${err.message}`);
  }
}

if (nurPruefen) {
  console.log(`\n${bestaetigt}/${DATEINAMEN.length} Dateien erreichbar unter ${oeffentlich}/${PRAEFIX}/`);
} else {
  console.log(
    `\n${bestaetigt + uebersprungen}/${DATEINAMEN.length} Dateien bestätigt unter ${oeffentlich}/${PRAEFIX}/` +
      ` (${bestaetigt} neu hochgeladen, ${uebersprungen} unverändert übersprungen)` +
      ` · roh ${Math.round(bytesRoh / 1024 / 1024)} MB → gzip ${Math.round(bytesGzip / 1024)} KB`,
  );
}

if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:`);
  for (const f of fehler) console.log(`  - ${f}`);
  process.exitCode = 1;
}
