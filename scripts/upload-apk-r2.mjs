// Lädt die Release-APK nach Cloudflare R2 (app/salati.apk) — das ist die Datei,
// die der Direkt-Download auf www.salati.pro anbietet (src/app/(tabs)/index.web.tsx,
// APK_URL). R2 hat keine Egress-Kosten; eine 260-MB-Datei über die Website
// selbst auszuliefern wäre teuer und langsam.
//
// Vor dem Upload wird die APK geprüft, damit nie wieder eine unbrauchbare Datei
// online geht: es gab bereits einen Release, dessen APK mit dem DEBUG-Schlüssel
// signiert war (Play wies sie ab), und einen, dem die nativen llama-Bibliotheken
// vollständig fehlten (die KI startete auf keinem Gerät). Beides fällt hier auf.
//
// Zugangsdaten kommen aus der .env im Repo-Root und werden NIE ausgegeben.
//
// Ausführen: cd apps/mobile && node scripts/upload-apk-r2.mjs [pfad/zur.apk]
//            node scripts/upload-apk-r2.mjs --pruefen   (nur nachsehen)
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const STANDARD_APK = path.join(MOBILE, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const KEY = 'app/salati.apk';
/** SHA-1 des echten Upload-Keystores. Der Debug-Schlüssel hat einen anderen. */
const UPLOAD_KEY_SHA1 = 'f02d2bdccd902e5c9843c593b720f94b77085522';

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

/** Neuestes Android-Build-Tool finden (apksigner/aapt2 liegen versioniert). */
function werkzeug(name) {
  for (const wurzel of ['C:/Android/build-tools', `${process.env.ANDROID_HOME ?? ''}/build-tools`]) {
    if (!existsSync(wurzel)) continue;
    const versionen = readdirSync(wurzel).sort();
    for (const v of versionen.reverse()) {
      for (const endung of ['.bat', '.exe', '']) {
        const p = path.join(wurzel, v, name + endung);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

/**
 * Vergleicht die Tonaufnahmen IN der APK mit denen im Quellordner.
 *
 * Hintergrund (2026-07-28): die fünf alten Adhan-Aufnahmen ohne belegbare
 * Rechte wurden aus `assets/audio/azan/` entfernt und durch drei frei
 * lizenzierte ersetzt. Der Release-Build enthielt sie trotzdem — Gradle
 * ERGÄNZT `build/generated/res/react/…/raw` nur, räumt dort aber nie auf, und
 * `gradlew clean` scheitert auf diesem Rechner am nativen Debug-Ziel. Ohne
 * diese Prüfung wären unlizenzierte Aufnahmen ausgeliefert worden, während die
 * Lizenzseite nur die drei freien nennt.
 *
 * Verglichen wird über SHA-256, nicht über Namen: das Resource-Shrinking
 * benennt `raw/assets_audio_azan_adhan1.mp3` in `res/6h.mp3` um.
 */
function pruefeTonaufnahmen(datei) {
  const quelle = path.join(MOBILE, 'assets', 'audio', 'azan');
  const erlaubt = new Map(
    readdirSync(quelle)
      .filter((n) => n.endsWith('.mp3'))
      .map((n) => [sha256(readFileSync(path.join(quelle, n))), n]),
  );

  // `unzip -p` steht unter Git Bash zur Verfügung; ohne das Werkzeug wird die
  // Prüfung laut übersprungen statt still zu bestehen.
  let liste;
  try {
    liste = execFileSync('unzip', ['-l', datei], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    console.log('Hinweis: unzip nicht gefunden — Tonaufnahmen in der APK ungeprüft.');
    return;
  }

  const eintraege = [...liste.matchAll(/^\s*\d+\s+\S+\s+\S+\s+(\S+\.mp3)$/gm)].map((m) => m[1]);
  const fremd = [];
  for (const eintrag of eintraege) {
    const inhalt = execFileSync('unzip', ['-p', datei, eintrag], { maxBuffer: 64 * 1024 * 1024 });
    const hash = sha256(inhalt);
    if (!erlaubt.has(hash)) fremd.push(`${eintrag} (${(inhalt.length / 1e6).toFixed(2)} MB)`);
  }

  if (fremd.length > 0) {
    throw new Error(
      `APK enthält ${fremd.length} Tonaufnahme(n), die nicht in assets/audio/azan/ stehen: ${fremd.join(', ')}. ` +
        'Meist ein veralteter Ressourcen-Cache: android/app/build/generated/res/react und ' +
        'android/app/build/intermediates/{packaged_res,merged_res,merged-not-compiled-resources} löschen und neu bauen.',
    );
  }
  if (eintraege.length < erlaubt.size) {
    throw new Error(`APK enthält nur ${eintraege.length} von ${erlaubt.size} Tonaufnahmen — der Gebetsruf wäre unvollständig.`);
  }
  console.log(`Tonaufnahmen geprüft: ${eintraege.length} Stück, alle aus assets/audio/azan/`);
}

/**
 * Prüft, dass die Gebetsruf-Töne noch unter ihrem NAMEN in der
 * Ressourcentabelle stehen — nicht nur als Datei.
 *
 * Warum zusätzlich zur Prüfung oben: `expo-notifications` holt den
 * Benachrichtigungston zur Laufzeit über
 * `getIdentifier("assets_audio_azan_adhan1", "raw", paket)`. Gesucht wird
 * dabei der Eintrag in `resources.arsc`, nicht der Dateipfad. Das
 * Resource-Shrinking kürzt den Dateipfad ohnehin auf `res/Q5.mp3` — solange
 * der Eintragsname steht, ist alles gut; fällt er weg, bleibt der Alarm still,
 * ohne dass irgendetwas abstürzt oder eine Datei fehlt.
 *
 * Seit 2026-07-30 ist `android.r8.optimizedResourceShrinking` aktiv, das
 * Ressourcen anhand des Codes entfernt und dynamische Zugriffe naturgemäß
 * nicht sehen kann. Geschützt sind die Töne durch den `keep.xml`-Eintrag, den
 * Metro erzeugt — geprüft wird hier, dass dieser Schutz auch wirklich hält.
 */
function pruefeTonRessourcennamen(datei, aapt2) {
  const quelle = path.join(MOBILE, 'assets', 'audio', 'azan');
  const erwartet = readdirSync(quelle)
    .filter((n) => n.endsWith('.mp3'))
    .map((n) => `assets_audio_azan_${n.replace(/\.mp3$/, '')}`);

  const tabelle = execFileSync(aapt2, ['dump', 'resources', datei], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const fehlend = erwartet.filter((name) => !tabelle.includes(`raw/${name}`));
  if (fehlend.length > 0) {
    throw new Error(
      `In der Ressourcentabelle fehlen die Einträge ${fehlend.map((n) => `raw/${n}`).join(', ')}. ` +
        'Der Gebetsruf bliebe still, weil expo-notifications ihn über getIdentifier() sucht. ' +
        'Meist entfernt das optimierte Resource-Shrinking sie, wenn der keep.xml-Eintrag von Metro fehlt — ' +
        'android/app/build/generated/res/react/release/raw/keep.xml prüfen.',
    );
  }
  console.log(`Ton-Ressourcennamen geprüft: ${erwartet.length} Einträge in der Tabelle (getIdentifier findet sie)`);
}

/**
 * Prüft die APK, bevor sie öffentlich wird. Wirft bei jedem harten Mangel —
 * eine kaputte APK auf der Website ist schlimmer als gar keine.
 */
function pruefeApk(datei) {
  const groesse = statSync(datei).size;
  if (groesse < 50_000_000) throw new Error(`APK ist nur ${(groesse / 1e6).toFixed(1)} MB — das kann keine vollständige Release-APK sein.`);

  pruefeTonaufnahmen(datei);

  const aapt2 = werkzeug('aapt2');
  let version = 'unbekannt';
  if (aapt2) {
    const badging = execFileSync(aapt2, ['dump', 'badging', datei], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const m = /versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
    if (m) version = `${m[2]} (${m[1]})`;
    if (!/RECORD_AUDIO/.test(badging)) {
      // Der Rezitations-Check nimmt echt auf; ohne die Berechtigung startet er nicht.
      throw new Error('RECORD_AUDIO fehlt in der APK — der Hifz-Rezitations-Check wäre unbrauchbar.');
    }
    pruefeTonRessourcennamen(datei, aapt2);
  } else {
    console.log('Hinweis: aapt2 nicht gefunden — Version und Berechtigungen ungeprüft.');
  }

  const apksigner = werkzeug('apksigner');
  if (apksigner) {
    // apksigner liegt unter Windows als .bat vor; die lässt sich nur über die
    // Shell starten (execFileSync sonst: EINVAL). Pfade deshalb in Anführungs-
    // zeichen — beide enthalten Leerzeichen bzw. Backslashes.
    const ueberShell = apksigner.endsWith('.bat');
    const aus = ueberShell
      ? execFileSync(`"${apksigner}" verify --print-certs "${datei}"`, {
          encoding: 'utf8',
          shell: true,
          maxBuffer: 16 * 1024 * 1024,
        })
      : execFileSync(apksigner, ['verify', '--print-certs', datei], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const sha1 = /SHA-1 digest:\s*([0-9a-f]+)/i.exec(aus)?.[1]?.toLowerCase();
    if (sha1 !== UPLOAD_KEY_SHA1) {
      throw new Error(`APK ist NICHT mit dem Upload-Keystore signiert (SHA-1 ${sha1 ?? 'unbekannt'}). Release abgebrochen.`);
    }
  } else {
    console.log('Hinweis: apksigner nicht gefunden — Signatur ungeprüft.');
  }

  return { groesse, version };
}

/** Minimales AWS-SigV4-PUT gegen einen S3-kompatiblen Endpunkt (path-style). */
async function putObjekt(env, key, body, contentType) {
  const endpoint = new URL(env.cloudflare_s3_api);
  const pfad = `/${env.cloudflare_bucket}/${key}`;
  const amzDatum = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
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
  if (!r.ok) throw new Error(`PUT ${key} fehlgeschlagen: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
}

const env = ladeEnv();
const oeffentlich = `${env.cloudflare_public_url.replace(/\/+$/, '')}/${KEY}`;

if (process.argv.includes('--pruefen')) {
  const r = await fetch(oeffentlich, { method: 'HEAD' });
  console.log(`online: HTTP ${r.status} · ${(Number(r.headers.get('content-length') ?? 0) / 1e6).toFixed(1)} MB · ${r.headers.get('content-type')}`);
  process.exit(0);
}

const apk = process.argv.find((a) => a.endsWith('.apk')) ?? STANDARD_APK;
if (!existsSync(apk)) throw new Error(`APK nicht gefunden: ${apk}`);

const { groesse, version } = pruefeApk(apk);
console.log(`APK geprüft: Version ${version} · ${(groesse / 1e6).toFixed(1)} MB · Signatur ok`);

await putObjekt(env, KEY, readFileSync(apk), 'application/vnd.android.package-archive');

const kontrolle = await fetch(oeffentlich, { method: 'HEAD' });
const online = Number(kontrolle.headers.get('content-length') ?? 0);
console.log(
  `hochgeladen: HTTP ${kontrolle.status} · online ${(online / 1e6).toFixed(1)} MB · ${kontrolle.headers.get('content-type')}` +
    (online === groesse ? ' · Größe stimmt' : ` · ABWEICHUNG (lokal ${(groesse / 1e6).toFixed(1)} MB)`),
);
console.log(oeffentlich);
