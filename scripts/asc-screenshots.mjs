#!/usr/bin/env node
// Ersetzt die App-Store-Screenshots ueber die App-Store-Connect-API.
//
// Warum: Apple hat 1.33.0 u.a. nach Richtlinie 2.3.10 abgelehnt, weil auf den
// bei Apple liegenden Screenshots eine ANDROID-Statusleiste zu sehen war
// (dreieckiges Signal, senkrechte Batterie, Material-WLAN-Faecher). Die lokal
// erzeugten Bilder unter store-assets/out/appstore/{de,en} haben die korrekte
// iOS-Leiste. Da eine neue App-Store-Version die Metadaten der Vorversion erbt,
// muessen die alten Bilder bei Apple aktiv ersetzt werden — sonst wandern die
// beanstandeten Screenshots automatisch in die naechste Einreichung.
//
// Usage:
//   node scripts/asc-screenshots.mjs --pruefen            nur auflisten
//   node scripts/asc-screenshots.mjs                      hochladen (editierbare Version)
//   node scripts/asc-screenshots.mjs 1.36.0               hochladen fuer bestimmte Version
//   node scripts/asc-screenshots.mjs --pruefen 1.36.0
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';

const WURZEL = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_BASIS = path.join(WURZEL, 'store-assets', 'out');

// Zuordnung ASC-Locale -> lokaler Ordner. Nur diese Sprachen werden angefasst.
const SPRACHEN = { 'de-DE': 'de', 'en-US': 'en' };

// Zuordnung ASC-Geraeteklasse -> Quellordner unter store-assets/out/ und die
// dort erwarteten Pixelmasse. Ein Satz wird NUR ersetzt, wenn im zugehoerigen
// Ordner Bilder in exakt einer dieser Groessen liegen.
//
// Zwei Ordner, weil Telefon und Tablet unterschiedlich gerendert werden:
// `render.mjs` zeichnet die iOS-Statusleiste mit fest vermassten Glyphen, je
// Geraeteprofil einmal. Beide Saetze in einen Ordner zu legen hiesse, dass
// passtZuKlasse() fuer keine der beiden Klassen mehr zutrifft (die Pruefung
// verlangt EINE Groesse fuer ALLE Bilder des Ordners) — dann bliebe stumm
// alles unveraendert.
const KLASSEN = {
  APP_IPHONE_67: { quelle: 'appstore', masse: [[1290, 2796], [1284, 2778]] },
  APP_IPAD_PRO_3GEN_129: { quelle: 'appstoreIpad', masse: [[2048, 2732], [2732, 2048]] },
};

const argv = process.argv.slice(2);
const NUR_PRUEFEN = argv.includes('--pruefen');
const ZIEL_VERSION = argv.find((a) => !a.startsWith('--'));

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

// Apples API antwortet beim Lesen frisch hochgeladener Objekte zeitweise mit
// 500 UNEXPECTED_ERROR — im 1.41.0-Durchgang sah das wie "Verarbeitung haengt"
// aus. Lesende Aufrufe werden deshalb wiederholt; schreibende NICHT, ein
// wiederholtes POST /appScreenshots legt ein zweites Objekt im Satz an.
async function api(pfad, init = {}, versuche = 6) {
  const methode = init.method ?? 'GET';
  for (let i = 0; ; i++) {
    const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await r.text();
    if (r.ok) return text ? JSON.parse(text) : null;
    if (methode === 'GET' && r.status >= 500 && i < versuche) {
      console.log(`         (Apple ${r.status} bei GET ${pfad} — Wiederholung ${i + 1}/${versuche})`);
      await new Promise((res) => setTimeout(res, 5000 * (i + 1)));
      continue;
    }
    throw new Error(`${methode} ${pfad} -> HTTP ${r.status}\n${text.slice(0, 600)}`);
  }
}

// ---------------------------------------------------------------- PNG-Masse
// Liest Breite/Hoehe direkt aus dem IHDR-Chunk, ohne Bildbibliothek.
function pngMasse(datei) {
  const fd = fs.openSync(datei, 'r');
  const kopf = Buffer.alloc(24);
  fs.readSync(fd, kopf, 0, 24, 0);
  fs.closeSync(fd);
  if (kopf.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`${datei}: kein PNG`);
  return [kopf.readUInt32BE(16), kopf.readUInt32BE(20)];
}

function lokaleBilder(quelle, ordner) {
  const dir = path.join(OUT_BASIS, quelle, ordner);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => {
      const voll = path.join(dir, f);
      return { name: f, pfad: voll, masse: pngMasse(voll), groesse: fs.statSync(voll).size };
    });
}

function passtZuKlasse(bilder, klasse) {
  const erlaubt = KLASSEN[klasse]?.masse ?? [];
  return bilder.length > 0 && bilder.every((b) => erlaubt.some(([w, h]) => b.masse[0] === w && b.masse[1] === h));
}

// ------------------------------------------------------------ Version finden
const EDITIERBAR = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
  'WAITING_FOR_REVIEW',
  'DEVELOPER_REMOVED_FROM_SALE',
]);

const versionen = await api(`/apps/${APP_ID}/appStoreVersions?limit=20`);
console.log('App-Store-Versionen:');
for (const v of versionen.data) {
  console.log(`  ${v.attributes.versionString.padEnd(9)} ${v.attributes.appStoreState.padEnd(24)} ${v.id}`);
}

let version;
if (ZIEL_VERSION) {
  version = versionen.data.find((v) => v.attributes.versionString === ZIEL_VERSION);
  if (!version) throw new Error(`Version ${ZIEL_VERSION} existiert bei App Store Connect nicht`);
} else {
  version = versionen.data.find((v) => EDITIERBAR.has(v.attributes.appStoreState));
  if (!version) throw new Error('Keine editierbare App-Store-Version gefunden (kein PREPARE_FOR_SUBMISSION/REJECTED o.ae.)');
}
const ZUSTAND = version.attributes.appStoreState;
console.log(`\nBearbeite Version ${version.attributes.versionString} (${ZUSTAND}, ${version.id})\n`);
if (!NUR_PRUEFEN && !EDITIERBAR.has(ZUSTAND)) {
  throw new Error(`Version ${version.attributes.versionString} ist im Zustand ${ZUSTAND} — nicht editierbar.`);
}

// -------------------------------------------------------- Lokalisierungen
const locs = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);

async function saetzeVon(locId) {
  const r = await api(`/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=50`);
  return r.data;
}

async function shotsVon(setId) {
  const r = await api(`/appScreenshotSets/${setId}/appScreenshots?limit=50`);
  return r.data;
}

// ------------------------------------------------------------ Pruefmodus
if (NUR_PRUEFEN) {
  for (const loc of locs.data.sort((a, b) => a.attributes.locale.localeCompare(b.attributes.locale))) {
    const locale = loc.attributes.locale;
    const saetze = await saetzeVon(loc.id);
    if (!saetze.length) {
      console.log(`${locale}: keine Screenshot-Saetze`);
      continue;
    }
    for (const s of saetze) {
      const shots = await shotsVon(s.id);
      const zustaende = shots.map((x) => x.attributes.assetDeliveryState?.state ?? '?');
      const uniq = [...new Set(zustaende)];
      console.log(`${locale.padEnd(7)} ${s.attributes.screenshotDisplayType.padEnd(26)} ${String(shots.length).padStart(2)} Bilder  [${uniq.join(', ') || '—'}]`);
      for (const x of shots) {
        const a = x.attributes;
        console.log(
          `    ${String(a.fileName).padEnd(28)} ${String(a.imageAsset?.width ?? '?')}x${String(a.imageAsset?.height ?? '?')}  ${a.assetDeliveryState?.state ?? '?'}`,
        );
      }
    }
  }
  process.exit(0);
}

// ------------------------------------------------------------ Upload-Ablauf
async function uploadBild(setId, bild, index) {
  console.log(`    [${index}] ${bild.name} (${bild.masse[0]}x${bild.masse[1]}, ${bild.groesse} Bytes)`);

  // Schritt 1: Reservierung — liefert die uploadOperations.
  const reserviert = (
    await api('/appScreenshots', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appScreenshots',
          attributes: { fileName: bild.name, fileSize: bild.groesse },
          relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
        },
      }),
    })
  ).data;
  const ops = reserviert.attributes.uploadOperations ?? [];
  console.log(`         reserviert ${reserviert.id}, ${ops.length} Upload-Operation(en)`);
  if (!ops.length) throw new Error(`Keine uploadOperations fuer ${bild.name} erhalten`);

  // Schritt 2: Datei stueckweise an die von Apple genannten URLs senden.
  const daten = fs.readFileSync(bild.pfad);
  for (const [i, op] of ops.entries()) {
    const teil = daten.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: teil });
    if (!r.ok) {
      throw new Error(`Upload-Teil ${i + 1}/${ops.length} von ${bild.name} -> HTTP ${r.status}\n${(await r.text()).slice(0, 400)}`);
    }
    console.log(`         Teil ${i + 1}/${ops.length}: ${op.length} Bytes ab Offset ${op.offset} -> ${r.status}`);
  }

  // Schritt 3: Abschluss mit MD5-Pruefsumme.
  const md5 = crypto.createHash('md5').update(daten).digest('hex');
  await api(`/appScreenshots/${reserviert.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'appScreenshots', id: reserviert.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
    }),
  });
  console.log(`         abgeschlossen (md5 ${md5.slice(0, 8)}…), warte auf Verarbeitung`);

  return warteAufComplete(reserviert.id, bild.name, md5);
}

/**
 * Wartet, bis Apple ein hochgeladenes Bild verarbeitet hat.
 *
 * Zwei Beobachtungen aus dem 1.41.0-Lauf, die die Schleife so aussehen lassen:
 *
 *  1. Die iPad-Bilder sind mit 2,8 MB rund viermal so gross wie die
 *     Telefon-Bilder. 120 s Wartezeit reichten dafuer nicht — deshalb 10 min.
 *  2. Der Abschluss-PATCH (`uploaded: true` + Pruefsumme) kann bei Apple
 *     stumm verpuffen: die Antwort ist 200, aber `sourceFileChecksum` liest
 *     sich danach als `null` zurueck und das Bild bleibt fuer immer auf
 *     UPLOAD_COMPLETE. Genau dann wird der PATCH hier wiederholt; erst wenn
 *     die Pruefsumme wirklich am Objekt steht, laeuft die Verarbeitung an.
 */
async function warteAufComplete(shotId, name, md5) {
  const BIS = Date.now() + 10 * 60 * 1000;
  let nachgereicht = 0;
  for (let versuch = 0; Date.now() < BIS; versuch++) {
    await new Promise((r) => setTimeout(r, 5000));
    let attr;
    try {
      attr = (await api(`/appScreenshots/${shotId}`)).data.attributes;
    } catch (e) {
      console.log(`         Lesen fehlgeschlagen, weiter warten: ${String(e.message).split('\n')[0]}`);
      continue;
    }
    const s = attr.assetDeliveryState;
    if (s?.state === 'COMPLETE') {
      console.log(`         COMPLETE`);
      return shotId;
    }
    if (s?.state === 'FAILED') {
      const fehler = (s.errors ?? []).map((e) => `${e.code}: ${e.description}`).join(' | ');
      throw new Error(`${name} wurde von Apple ABGELEHNT (assetDeliveryState FAILED): ${fehler || JSON.stringify(s)}`);
    }
    // Pruefsumme fehlt trotz UPLOAD_COMPLETE -> Abschluss-PATCH ging verloren.
    if (!attr.sourceFileChecksum && versuch >= 3 && nachgereicht < 3) {
      nachgereicht += 1;
      console.log(`         Pruefsumme fehlt bei Apple — Abschluss wird wiederholt (${nachgereicht}/3)`);
      await api(`/appScreenshots/${shotId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appScreenshots', id: shotId, attributes: { uploaded: true, sourceFileChecksum: md5 } },
        }),
      });
      continue;
    }
    if (versuch % 6 === 5) console.log(`         … Zustand ${s?.state ?? '?'} (${Math.round((BIS - Date.now()) / 1000)} s Rest)`);
  }
  throw new Error(`${name}: assetDeliveryState wurde nicht COMPLETE (Timeout nach 10 min)`);
}

let ersetzt = 0;
const unangetastet = [];

for (const loc of locs.data) {
  const locale = loc.attributes.locale;
  const ordner = SPRACHEN[locale];
  if (!ordner) {
    unangetastet.push(`${locale}: keine lokale Bildquelle hinterlegt`);
    continue;
  }
  console.log(`\n== ${locale}`);

  const saetze = await saetzeVon(loc.id);
  const klassen = new Set([...saetze.map((s) => s.attributes.screenshotDisplayType), ...Object.keys(KLASSEN)]);

  for (const klasse of klassen) {
    if (!KLASSEN[klasse]) {
      unangetastet.push(`${locale}/${klasse}: unbekannte Geraeteklasse — nicht angefasst`);
      continue;
    }
    const quelle = KLASSEN[klasse].quelle;
    const bilder = lokaleBilder(quelle, ordner);
    console.log(`  ${klasse}: lokal store-assets/out/${quelle}/${ordner} — ${bilder.length} Bilder`);
    const satz = saetze.find((s) => s.attributes.screenshotDisplayType === klasse);
    if (!passtZuKlasse(bilder, klasse)) {
      const grund = bilder.length
        ? `lokale Bilder sind ${bilder[0].masse.join('x')}, ${klasse} erwartet ${KLASSEN[klasse].masse.map((m) => m.join('x')).join(' oder ')}`
        : 'keine lokalen Bilder';
      if (satz) {
        const vorhanden = await shotsVon(satz.id);
        unangetastet.push(`${locale}/${klasse}: ${vorhanden.length} Bilder bei Apple UNVERAENDERT — ${grund}`);
      } else {
        unangetastet.push(`${locale}/${klasse}: kein Satz bei Apple, nichts zu tun — ${grund}`);
      }
      continue;
    }

    let satzId = satz?.id;
    if (!satzId) {
      satzId = (
        await api('/appScreenshotSets', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'appScreenshotSets',
              attributes: { screenshotDisplayType: klasse },
              relationships: {
                appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } },
              },
            },
          }),
        })
      ).data.id;
      console.log(`  ${klasse}: neuer Satz angelegt (${satzId})`);
    } else {
      console.log(`  ${klasse}: bestehender Satz ${satzId}`);
    }

    // Was liegt schon richtig da? Ein abgebrochener Lauf hat die alten Bilder
    // bereits geloescht und einen Teil der neuen hochgeladen; ohne diese
    // Pruefung wuerde der Wiederholungslauf die eigene Arbeit wegwerfen und
    // koennte auf halbem Weg erneut abbrechen. Verglichen wird die
    // Pruefsumme, nicht der Dateiname — gleicher Name mit anderem Inhalt
    // (neu gerendert) muss ersetzt werden.
    const alt = await shotsVon(satzId);
    const md5Von = (bild) => crypto.createHash('md5').update(fs.readFileSync(bild.pfad)).digest('hex');
    const sollMd5 = new Map(bilder.map((b) => [b.name, md5Von(b)]));
    const behalten = new Map();
    for (const a of alt) {
      const attr = a.attributes;
      const passt =
        attr.assetDeliveryState?.state === 'COMPLETE' &&
        attr.sourceFileChecksum &&
        sollMd5.get(attr.fileName) === attr.sourceFileChecksum;
      if (passt) {
        behalten.set(attr.fileName, a.id);
        console.log(`    unveraendert: ${attr.fileName} (${a.id})`);
      } else {
        await api(`/appScreenshots/${a.id}`, { method: 'DELETE' });
        console.log(`    geloescht: ${attr.fileName} (${a.id}, ${attr.assetDeliveryState?.state})`);
      }
    }
    if (!alt.length) console.log('    (Satz war leer)');

    // Fehlende hochladen, in Dateinamen-Reihenfolge.
    const neueIds = [];
    for (const [i, bild] of bilder.entries()) {
      const schonDa = behalten.get(bild.name);
      if (schonDa) {
        neueIds.push(schonDa);
        continue;
      }
      neueIds.push(await uploadBild(satzId, bild, i + 1));
    }

    // Reihenfolge explizit festschreiben.
    await api(`/appScreenshotSets/${satzId}/relationships/appScreenshots`, {
      method: 'PATCH',
      body: JSON.stringify({ data: neueIds.map((id) => ({ type: 'appScreenshots', id })) }),
    });
    console.log(`    Reihenfolge festgeschrieben (${neueIds.length} Bilder)`);
    ersetzt += neueIds.length;
  }
}

console.log(`\nFertig: ${ersetzt} Bilder hochgeladen.`);
if (unangetastet.length) {
  console.log('Unveraendert geblieben:');
  for (const z of unangetastet) console.log(`  - ${z}`);
}
console.log('\nGegenpruefen: node scripts/asc-screenshots.mjs --pruefen');
