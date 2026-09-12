// Lädt die Wort-für-Wort-Bedeutungen (6 Sprachen × 114 Suren + meta.json)
// nach Cloudflare R2 (Präfix wbw/v1/).
//
// Gleicher Weg und gleiche Einstellungen wie upload-morphologie-r2.mjs — die
// Laufzeitschicht lädt beide Datensätze pro Sure per fetch() nach:
//   - gzip: Content-Encoding: gzip, React Native/Browser entpacken transparent.
//     Roh sind es 11,7 MB über alle Sprachen, gzip rund ein Viertel davon.
//   - Cache-Control: public, max-age=31536000, immutable. Deshalb trägt der
//     Pfad die Schema-Version (wbw/v2/…): eine inhaltlich geänderte Datei
//     unter derselben URL käme weder bei Clients noch beim CDN je an. Die
//     Wortgruppen-Fassung liegt deshalb unter v2 und überschreibt v1 NICHT.
//   - Idempotent/wiederaufnehmbar: vor jedem Upload per HEAD prüfen, ob Größe
//     UND ETag (MD5 des gzip-Bodys, wie R2 es bei einem einzelnen PUT vergibt)
//     schon stimmen — dann überspringen. Einzelfehler brechen den Lauf nicht
//     ab, sondern werden gesammelt und am Ende gezeigt.
//
// Abweichung zur Morphologie-Vorlage: 685 statt 117 Dateien, deshalb laufen
// PARALLELE Arbeiter (GLEICHZEITIG) statt streng nacheinander — sonst dauert
// ein Lauf über 2.000 HTTP-Anfragen unnötig lange. Die Ausgabe bleibt
// deterministisch, weil sie erst nach dem Lauf sortiert ausgegeben wird.
//
// Die öffentliche r2.dev-Adresse ist mengenbegrenzt und beantwortet einen
// Schwall von Hunderten HEAD-Anfragen mit HTTP 429 (im Lauf vom 2026-09-07
// ab etwa der 500. Anfrage). Ein 429 bei der Nachkontrolle sähe aus wie eine
// fehlgeschlagene Auslieferung, obwohl das PUT (das über den S3-Endpunkt
// läuft, nicht über r2.dev) längst durch ist. Deshalb: wenige Arbeiter und
// `hole()` mit Wiederholung samt wachsender Wartezeit bei 429/5xx.
//
// Zugangsdaten kommen aus der .env im Repo-Root. Sie werden NIE ausgegeben.
//
// Ausführen: cd apps/mobile && node scripts/upload-wbw-r2.mjs
//            node scripts/upload-wbw-r2.mjs --pruefen   (nur nachsehen)
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
// Version im Ordner- UND R2-Präfix: dieselbe wie WBW_VERSION in
// build-wbw.mjs. Grund siehe Kopf (Cache-Control immutable).
const VERSION = 'v2';
const AUSGABE_DIR = path.join(MOBILE, '.daten-cache', 'out', 'wbw', VERSION);
const PRAEFIX = `wbw/${VERSION}`;
const SPRACHEN = ['fr', 'fa', 'id', 'bn', 'ur', 'tr'];
const SUREN = 114;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ARBEITER = 4;

/** Relative Pfade unterhalb von AUSGABE_DIR bzw. Schlüssel unterhalb PRAEFIX. */
const DATEINAMEN = [
  ...SPRACHEN.flatMap((spr) => Array.from({ length: SUREN }, (_, i) => `${spr}/${i + 1}.json`)),
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

const schlafe = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

/** HEAD/GET gegen r2.dev mit Wiederholung bei Drosselung (429) und 5xx. */
async function hole(url, optionen, versuche = 5) {
  let wartezeit = 1000;
  for (let i = 1; ; i++) {
    const r = await fetch(url, optionen).catch(() => null);
    if (r && r.status !== 429 && r.status < 500) return r;
    if (i >= versuche) return r;
    await schlafe(wartezeit);
    wartezeit *= 2;
  }
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

/** @type {Map<string, { zustand: 'neu'|'unveraendert'|'fehlt'|'fehler', roh: number, gzip: number, text: string }>} */
const ergebnisse = new Map();
const fehler = [];

async function bearbeite(name) {
  const datei = path.join(AUSGABE_DIR, name);
  const key = `${PRAEFIX}/${name}`;
  const url = `${oeffentlich}/${key}`;

  if (!existsSync(datei)) {
    fehler.push(`${name}: FEHLT (${path.relative(MOBILE, datei)})`);
    ergebnisse.set(name, { zustand: 'fehlt', roh: 0, gzip: 0, text: 'FEHLT — erst build-wbw.mjs laufen lassen' });
    return;
  }

  if (nurPruefen) {
    try {
      const r = await hole(url, { method: 'HEAD' });
      const laenge = Number(r.headers.get('content-length') ?? 0);
      const kodierung = r.headers.get('content-encoding') ?? '(keine)';
      ergebnisse.set(name, {
        zustand: r.ok ? 'unveraendert' : 'fehler',
        roh: 0,
        gzip: laenge,
        text: `HTTP ${r.status} · online ${Math.round(laenge / 1024)} KB · content-encoding ${kodierung} · cache-control ${r.headers.get('cache-control') ?? '(keine)'}`,
      });
      if (!r.ok) fehler.push(`${name}: HTTP ${r.status}`);
    } catch (err) {
      fehler.push(`${name}: HEAD fehlgeschlagen — ${err.message}`);
      ergebnisse.set(name, { zustand: 'fehler', roh: 0, gzip: 0, text: `FEHLER bei HEAD — ${err.message}` });
    }
    return;
  }

  try {
    const roh = readFileSync(datei);
    const gz = gzipSync(roh, { level: 9 });
    const gzMd5 = md5(gz);

    const vorherR = await hole(url, { method: 'HEAD' });
    if (vorherR && vorherR.ok) {
      const vorherLaenge = Number(vorherR.headers.get('content-length') ?? -1);
      const vorherEtag = (vorherR.headers.get('etag') ?? '').replace(/"/g, '');
      if (vorherLaenge === gz.length && vorherEtag === gzMd5) {
        ergebnisse.set(name, {
          zustand: 'unveraendert',
          roh: roh.length,
          gzip: gz.length,
          text: `übersprungen (unverändert) · ${Math.round(gz.length / 1024)} KB gzip`,
        });
        return;
      }
    }

    await putObjekt(env, key, gz, {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'cache-control': CACHE_CONTROL,
    });

    // Sofort gegen die öffentliche URL prüfen: ein erfolgreiches PUT bedeutet
    // nicht, dass die Datei über r2.dev auch ausgeliefert wird (eigener Pfad).
    const r = await hole(url, { method: 'HEAD' });
    const online = Number(r?.headers.get('content-length') ?? 0);
    const ok = !!r?.ok && online === gz.length;
    ergebnisse.set(name, {
      zustand: ok ? 'neu' : 'fehler',
      roh: roh.length,
      gzip: gz.length,
      text: `${ok ? 'ok' : 'PRUEFEN'} · roh ${Math.round(roh.length / 1024)} KB → gzip ${Math.round(gz.length / 1024)} KB · HTTP ${r.status}`,
    });
    if (!ok) fehler.push(`${name}: online ${online} Bytes ≠ gzip ${gz.length} Bytes (HTTP ${r?.status ?? 'keine Antwort'})`);
  } catch (err) {
    fehler.push(`${name}: ${err.message}`);
    ergebnisse.set(name, { zustand: 'fehler', roh: 0, gzip: 0, text: `FEHLER — ${err.message}` });
  }
}

const warteschlange = [...DATEINAMEN];
let fertig = 0;
await Promise.all(
  Array.from({ length: ARBEITER }, async () => {
    for (;;) {
      const name = warteschlange.shift();
      if (!name) return;
      await bearbeite(name);
      fertig++;
      if (fertig % 100 === 0) console.log(`… ${fertig}/${DATEINAMEN.length}`);
    }
  }),
);

// Zusammenfassung je Sprache (nicht 685 Einzelzeilen).
console.log(`\nSprache | Dateien ok | roh | gzip`);
console.log('--------+------------+----------+---------');
for (const spr of [...SPRACHEN, 'meta']) {
  const namen = spr === 'meta' ? ['meta.json'] : DATEINAMEN.filter((n) => n.startsWith(`${spr}/`));
  let ok = 0;
  let roh = 0;
  let gzip = 0;
  for (const n of namen) {
    const e = ergebnisse.get(n);
    if (!e) continue;
    if (e.zustand === 'neu' || e.zustand === 'unveraendert') ok++;
    roh += e.roh;
    gzip += e.gzip;
  }
  console.log(
    `${spr.padEnd(7)} | ${`${ok}/${namen.length}`.padStart(10)} | ${`${Math.round(roh / 1024)} KB`.padStart(8)} | ${`${Math.round(gzip / 1024)} KB`.padStart(8)}`,
  );
}

const bestaetigt = [...ergebnisse.values()].filter((e) => e.zustand === 'neu' || e.zustand === 'unveraendert').length;
const neu = [...ergebnisse.values()].filter((e) => e.zustand === 'neu').length;
const bytesRoh = [...ergebnisse.values()].reduce((s, e) => s + e.roh, 0);
const bytesGzip = [...ergebnisse.values()].reduce((s, e) => s + e.gzip, 0);
console.log(
  `\n${bestaetigt}/${DATEINAMEN.length} Dateien bestätigt unter ${oeffentlich}/${PRAEFIX}/` +
    (nurPruefen ? '' : ` (${neu} neu hochgeladen, ${bestaetigt - neu} unverändert übersprungen)`) +
    ` · roh ${(bytesRoh / 1024 / 1024).toFixed(1)} MB → gzip ${(bytesGzip / 1024 / 1024).toFixed(1)} MB`,
);

if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:`);
  for (const f of fehler.slice(0, 30)) console.log(`  - ${f}`);
  if (fehler.length > 30) console.log(`  … und ${fehler.length - 30} weitere`);
  // Kein process.exit() — s. build-wbw.mjs.
  process.exitCode = 1;
}
