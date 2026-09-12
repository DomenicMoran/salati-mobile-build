// Test fuer scripts/lib/apk-version.mjs (Auslesen von versionCode/versionName
// aus einer online liegenden APK per HTTP-Range, ohne sie komplett zu laden).
//
// Wie build-morphologie.test.mjs: Nodes eingebauter Testrunner, keine
// .test.mjs-Konvention in Jest hier:
//
//   cd apps/mobile && node --test scripts/lib/apk-version.test.mjs
//
// Statt einer echten APK als Fixture (bindaer, extern, nicht reproduzierbar)
// baut dieser Test ein minimales ZIP mit einer minimalen kompilierten
// AndroidManifest.xml (AXML) selbst zusammen - klein genug zum Lesen, aber
// bit-genau im selben Format wie eine echte APK (ResChunk_header,
// ResStringPool, Res_XMLTree_node/attrExt gemaess frameworks/base
// ResourceTypes.h).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  findEndOfCentralDirectory,
  findCentralDirectoryEntry,
  entpackeLokalenEintrag,
  parseAndroidManifest,
  leseApkVersionVonUrl,
} from './apk-version.mjs';

const RES_TYPE_INT_DEC = 0x10;
const RES_TYPE_STRING = 0x03;

// ---- AXML-Schnipsel bauen -------------------------------------------------

function utf8StringEntry(str) {
  const utf8 = Buffer.from(str, 'utf8');
  if (str.length >= 0x80 || utf8.length >= 0x80) {
    throw new Error('Test-Helfer deckt nur kurze Strings ab (<128 Byte)');
  }
  // [UTF-16-Laenge][UTF-8-Laenge][UTF-8-Bytes][0x00] - siehe
  // ResStringPool_header in frameworks/base ResourceTypes.h.
  return Buffer.concat([Buffer.from([str.length]), Buffer.from([utf8.length]), utf8, Buffer.from([0])]);
}

function buildStringPoolUtf8(strings) {
  const entries = strings.map(utf8StringEntry);
  const stringsStart = 28 + strings.length * 4; // Header(28) + Offset-Tabelle
  const offsets = [];
  let laufend = 0;
  for (const e of entries) {
    offsets.push(laufend);
    laufend += e.length;
  }
  const rohdaten = Buffer.concat(entries);
  const padLen = (4 - (rohdaten.length % 4)) % 4;
  const daten = Buffer.concat([rohdaten, Buffer.alloc(padLen)]);
  const chunkSize = stringsStart + daten.length;
  const buf = Buffer.alloc(chunkSize);
  buf.writeUInt16LE(0x0001, 0); // type: RES_STRING_POOL_TYPE
  buf.writeUInt16LE(28, 2); // headerSize
  buf.writeUInt32LE(chunkSize, 4);
  buf.writeUInt32LE(strings.length, 8); // stringCount
  buf.writeUInt32LE(0, 12); // styleCount
  buf.writeUInt32LE(0x100, 16); // flags: UTF8_FLAG
  buf.writeUInt32LE(stringsStart, 20);
  buf.writeUInt32LE(0, 24); // stylesStart
  offsets.forEach((o, i) => buf.writeUInt32LE(o, 28 + i * 4));
  daten.copy(buf, stringsStart);
  return buf;
}

// Baut ein <manifest>-StartElement mit Attributen, exakt im Layout, das
// parseAndroidManifest() in apk-version.mjs erwartet (Res_XMLTree_node +
// Res_XMLTree_attrExt).
function buildManifestStartElement(nameIdx, attrs) {
  const attrsBase = 36; // offset(16) + attributeStart(20)
  const size = attrsBase + attrs.length * 20;
  const buf = Buffer.alloc(size);
  buf.writeUInt16LE(0x0102, 0); // type: RES_XML_START_ELEMENT_TYPE
  buf.writeUInt16LE(16, 2); // headerSize
  buf.writeUInt32LE(size, 4); // chunkSize
  buf.writeUInt32LE(1, 8); // lineNumber
  buf.writeUInt32LE(0xffffffff, 12); // comment
  buf.writeUInt32LE(0xffffffff, 16); // namespaceURI
  buf.writeUInt32LE(nameIdx, 20); // name -> "manifest"
  buf.writeUInt16LE(20, 24); // attributeStart (relativ zu offset+16)
  buf.writeUInt16LE(20, 26); // attributeSize
  buf.writeUInt16LE(attrs.length, 28); // attributeCount
  buf.writeUInt16LE(0, 30); // idIndex
  buf.writeUInt16LE(0, 32); // classIndex
  buf.writeUInt16LE(0, 34); // styleIndex
  attrs.forEach((a, i) => {
    const o = attrsBase + i * 20;
    buf.writeUInt32LE(0xffffffff, o); // attrNamespaceURI
    buf.writeUInt32LE(a.nameIdx, o + 4);
    buf.writeUInt32LE(a.rawValueIdx ?? 0xffffffff, o + 8);
    buf.writeUInt16LE(8, o + 12); // typedValue.size
    buf.writeUInt8(0, o + 14); // typedValue.res0
    buf.writeUInt8(a.dataType, o + 15);
    buf.writeUInt32LE(a.data, o + 16);
  });
  return buf;
}

// strings: ["manifest", "versionCode", "versionName", versionNameWert]
function buildeAxml({ versionCode, versionName }) {
  const strings = ['manifest', 'versionCode', 'versionName', versionName];
  const pool = buildStringPoolUtf8(strings);
  const element = buildManifestStartElement(0, [
    { nameIdx: 1, dataType: RES_TYPE_INT_DEC, data: versionCode },
    { nameIdx: 2, rawValueIdx: 3, dataType: RES_TYPE_STRING, data: 3 },
  ]);
  const body = Buffer.concat([pool, element]);
  const outer = Buffer.alloc(8 + body.length);
  outer.writeUInt16LE(0x0003, 0); // type: RES_XML_TYPE
  outer.writeUInt16LE(8, 2); // headerSize
  outer.writeUInt32LE(outer.length, 4); // chunkSize
  body.copy(outer, 8);
  return outer;
}

// ---- ZIP-Schnipsel bauen ---------------------------------------------------

function buildeMinimalesZip(dateiname, inhalt, method) {
  const nameBuf = Buffer.from(dateiname, 'utf8');
  const komprimiert = method === 8 ? deflateRawSync(inhalt) : inhalt;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(method, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14); // crc32 — wird von unserem Parser nicht geprueft
  localHeader.writeUInt32LE(komprimiert.length, 18);
  localHeader.writeUInt32LE(inhalt.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  const localRecord = Buffer.concat([localHeader, nameBuf, komprimiert]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(method, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(0, 16);
  centralHeader.writeUInt32LE(komprimiert.length, 20);
  centralHeader.writeUInt32LE(inhalt.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42); // localHeaderOffset — Eintrag liegt am Zip-Anfang
  const centralRecord = Buffer.concat([centralHeader, nameBuf]);

  const cdOffset = localRecord.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralRecord.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localRecord, centralRecord, eocd]);
}

// ---- Tests ------------------------------------------------------------

test('parseAndroidManifest liest versionCode/versionName aus einem selbst gebauten AXML-Schnipsel', () => {
  const axml = buildeAxml({ versionCode: 999, versionName: '9.9.9' });
  const version = parseAndroidManifest(axml);
  assert.deepEqual(version, { versionCode: 999, versionName: '9.9.9' });
});

test('parseAndroidManifest wirft eine verstaendliche Meldung bei falschem Chunk-Typ', () => {
  assert.throws(() => parseAndroidManifest(Buffer.alloc(16)), /Chunk-Typ/);
});

test('ZIP-Pipeline (Methode "store"): EOCD -> zentrales Verzeichnis -> lokaler Eintrag -> AXML', () => {
  const axml = buildeAxml({ versionCode: 76, versionName: '1.51.0' });
  const zip = buildeMinimalesZip('AndroidManifest.xml', axml, 0);

  const { cdOffset, cdSize, entryCount } = findEndOfCentralDirectory(zip);
  assert.equal(entryCount, 1);

  const cdBuf = zip.subarray(cdOffset, cdOffset + cdSize);
  const eintrag = findCentralDirectoryEntry(cdBuf, 'AndroidManifest.xml');
  assert.ok(eintrag, 'Eintrag muss gefunden werden');
  assert.equal(eintrag.method, 0);

  const lokal = zip.subarray(eintrag.localHeaderOffset, eintrag.localHeaderOffset + eintrag.compressedSize + 64);
  const manifestBuf = entpackeLokalenEintrag(lokal, eintrag);
  assert.deepEqual(parseAndroidManifest(manifestBuf), { versionCode: 76, versionName: '1.51.0' });
});

test('ZIP-Pipeline (Methode "deflate"): entpackeLokalenEintrag inflated korrekt', () => {
  const axml = buildeAxml({ versionCode: 80, versionName: '1.53.1' });
  const zip = buildeMinimalesZip('AndroidManifest.xml', axml, 8);

  const { cdOffset, cdSize } = findEndOfCentralDirectory(zip);
  const eintrag = findCentralDirectoryEntry(zip.subarray(cdOffset, cdOffset + cdSize), 'AndroidManifest.xml');
  assert.equal(eintrag.method, 8);

  const lokal = zip.subarray(eintrag.localHeaderOffset, eintrag.localHeaderOffset + eintrag.compressedSize + 64);
  const manifestBuf = entpackeLokalenEintrag(lokal, eintrag);
  assert.deepEqual(parseAndroidManifest(manifestBuf), { versionCode: 80, versionName: '1.53.1' });
});

test('findEndOfCentralDirectory wirft eine verstaendliche Meldung ohne EOCD-Signatur', () => {
  assert.throws(() => findEndOfCentralDirectory(Buffer.alloc(30)), /End-of-Central-Directory/);
});

test('findCentralDirectoryEntry findet nichts fuer einen unbekannten Dateinamen', () => {
  const axml = buildeAxml({ versionCode: 1, versionName: '1.0.0' });
  const zip = buildeMinimalesZip('AndroidManifest.xml', axml, 0);
  const { cdOffset, cdSize } = findEndOfCentralDirectory(zip);
  const eintrag = findCentralDirectoryEntry(zip.subarray(cdOffset, cdOffset + cdSize), 'nicht-vorhanden.xml');
  assert.equal(eintrag, null);
});

test('entpackeLokalenEintrag wirft bei unbekannter Kompressionsmethode', () => {
  const axml = buildeAxml({ versionCode: 1, versionName: '1.0.0' });
  const zip = buildeMinimalesZip('AndroidManifest.xml', axml, 0);
  const { cdOffset, cdSize } = findEndOfCentralDirectory(zip);
  const eintrag = findCentralDirectoryEntry(zip.subarray(cdOffset, cdOffset + cdSize), 'AndroidManifest.xml');
  const lokal = zip.subarray(eintrag.localHeaderOffset, eintrag.localHeaderOffset + eintrag.compressedSize + 64);
  assert.throws(() => entpackeLokalenEintrag(lokal, { ...eintrag, method: 99 }), /Kompressionsmethode/);
});

// ---- Ende-zu-Ende ueber leseApkVersionVonUrl (mit einem Fake statt echtem HTTP) ----

function fakeFetchFuer(buf) {
  return async (_url, init = {}) => {
    if (init.method === 'HEAD') {
      return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-length' ? String(buf.length) : null) } };
    }
    const bereich = /bytes=(\d+)-(\d+)/.exec(init.headers?.Range ?? '');
    assert.ok(bereich, 'erwarte einen Range-Header');
    const von = Number(bereich[1]);
    const bis = Math.min(Number(bereich[2]), buf.length - 1);
    const teil = buf.subarray(von, bis + 1);
    return {
      ok: true,
      status: 206,
      headers: { get: () => null },
      arrayBuffer: async () => teil.buffer.slice(teil.byteOffset, teil.byteOffset + teil.byteLength),
    };
  };
}

test('leseApkVersionVonUrl liest die Version nur ueber HTTP-Range-Anfragen (HEAD + gezielte Bereiche)', async () => {
  const axml = buildeAxml({ versionCode: 76, versionName: '1.51.0' });
  const zip = buildeMinimalesZip('AndroidManifest.xml', axml, 8);

  let angeforderteBytes = 0;
  const fetchImpl = async (url, init) => {
    if (init?.headers?.Range) {
      const [, von, bis] = /bytes=(\d+)-(\d+)/.exec(init.headers.Range);
      angeforderteBytes += Math.min(Number(bis), zip.length - 1) - Number(von) + 1;
    }
    return fakeFetchFuer(zip)(url, init);
  };

  const version = await leseApkVersionVonUrl('https://example.invalid/app/salati.apk', { fetchImpl });
  assert.deepEqual(version, { versionCode: 76, versionName: '1.51.0' });
  // Bei einer echten, 100+ MB grossen APK darf das nie in die Naehe der
  // Gesamtgroesse kommen — hier (winziges Test-Zip) zaehlt nur, dass ueberhaupt
  // nur einzelne Bereiche angefordert wurden, nicht die ganze Datei in einem Zug.
  assert.ok(angeforderteBytes < zip.length * 3, 'Range-Anfragen duerfen die Datei nicht mehrfach komplett laden');
});

test('leseApkVersionVonUrl bricht mit verstaendlicher Meldung ab, wenn Content-Length fehlt', async () => {
  const fetchImpl = async (_url, init) => {
    if (init?.method === 'HEAD') return { ok: true, status: 200, headers: { get: () => null } };
    throw new Error('sollte nicht aufgerufen werden');
  };
  await assert.rejects(
    () => leseApkVersionVonUrl('https://example.invalid/app/salati.apk', { fetchImpl }),
    /Content-Length/,
  );
});
