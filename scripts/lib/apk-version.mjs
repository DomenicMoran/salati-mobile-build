// Liest versionCode/versionName aus einer APK, OHNE sie komplett herunterzuladen
// und OHNE Android-Werkzeuge (aapt2/apkanalyzer) vorauszusetzen.
//
// Hintergrund (12.09.2026): Die auf salati.pro zum Direktdownload angebotene
// APK auf R2 stand auf 1.51.0/76, waehrend Play seit dem 06.09. 1.53.1/80
// hatte - drei Fassungen Rueckstand, unbemerkt, weil scripts/release-check.mjs
// bislang nur HTTP-HEAD + Groessenpruefung machte (jede hinreichend grosse
// Datei besteht das). Diese Datei schliesst die Luecke: Eine APK ist ein ZIP;
// wir holen per HTTP-Range nur das ZIP-Ende (fuer den zentralen Verzeichnis-
// eintrag) und danach nur den Eintrag AndroidManifest.xml (ein paar KB), statt
// die ganze Datei (100-265 MB) zu laden. AndroidManifest.xml liegt binaer vor
// (AXML) - der Parser unten deckt genau so viel vom Format ab, wie fuer
// versionCode/versionName im Wurzelelement <manifest> noetig ist.
//
// Kein aapt2/apkanalyzer noetig: die Maschine, auf der release-check.mjs
// laeuft, hat kein Android-SDK installiert - ein Weg, der ein SDK voraussetzt,
// wuerde die Pruefung dort einfach ausfallen lassen statt sie zu schaerfen.
import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const AXML_STRING_POOL = 0x0001;
const AXML_START_ELEMENT = 0x0102;
const RES_TYPE_STRING = 0x03;

/**
 * Sucht den "End of Central Directory"-Datensatz in einem Puffer, der das
 * Ende einer ZIP-Datei enthaelt (nicht zwingend die ganze Datei).
 * @returns {{ cdOffset: number, cdSize: number, entryCount: number }}
 */
export function findEndOfCentralDirectory(buf) {
  // EOCD hat eine variable Kommentarlaenge (0-65535) am Ende - deshalb von
  // hinten nach der Signatur suchen statt eine feste Position anzunehmen.
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      const cdSize = buf.readUInt32LE(i + 12);
      const cdOffset = buf.readUInt32LE(i + 16);
      const entryCount = buf.readUInt16LE(i + 10);
      if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
        throw new Error('ZIP64 wird nicht unterstuetzt (APK groesser/mehr Eintraege als ueblich?)');
      }
      return { cdOffset, cdSize, entryCount };
    }
  }
  throw new Error('keine ZIP End-of-Central-Directory-Signatur gefunden - keine gueltige APK?');
}

/**
 * Findet einen Eintrag per Dateiname im zentralen Verzeichnis.
 * @param {Buffer} cdBuf Bytes, die EXAKT beim zentralen Verzeichnis beginnen (cdOffset).
 * @returns {{ method: number, compressedSize: number, localHeaderOffset: number } | null}
 */
export function findCentralDirectoryEntry(cdBuf, dateiname) {
  let offset = 0;
  while (offset + 46 <= cdBuf.length) {
    const sig = cdBuf.readUInt32LE(offset);
    if (sig !== CENTRAL_DIR_SIGNATURE) break;
    const method = cdBuf.readUInt16LE(offset + 10);
    const compressedSize = cdBuf.readUInt32LE(offset + 20);
    const filenameLen = cdBuf.readUInt16LE(offset + 28);
    const extraLen = cdBuf.readUInt16LE(offset + 30);
    const commentLen = cdBuf.readUInt16LE(offset + 32);
    const localHeaderOffset = cdBuf.readUInt32LE(offset + 42);
    const name = cdBuf.toString('utf8', offset + 46, offset + 46 + filenameLen);
    if (name === dateiname) {
      return { method, compressedSize, localHeaderOffset };
    }
    offset += 46 + filenameLen + extraLen + commentLen;
  }
  return null;
}

/**
 * Entpackt einen ZIP-Eintrag aus einem Puffer, der beim lokalen Datei-Header
 * (localHeaderOffset) beginnt und mindestens compressedSize + etwas Puffer
 * fuer Dateiname/Extra-Feld enthaelt (Groesse dieser Felder ist erst nach dem
 * Lesen des lokalen Headers bekannt, kann leicht vom zentralen Verzeichnis
 * abweichen - deshalb wird sie hier neu gelesen statt uebernommen).
 */
export function entpackeLokalenEintrag(buf, { method, compressedSize }) {
  if (buf.readUInt32LE(0) !== LOCAL_FILE_SIGNATURE) {
    throw new Error('kein lokaler ZIP-Datei-Header an der erwarteten Stelle');
  }
  const filenameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + filenameLen + extraLen;
  if (buf.length < dataStart + compressedSize) {
    throw new Error(`Puffer zu klein: ${buf.length} Bytes, benoetigt ${dataStart + compressedSize}`);
  }
  const komprimiert = buf.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return Buffer.from(komprimiert);
  if (method === 8) return inflateRawSync(komprimiert);
  throw new Error(`unbekannte ZIP-Kompressionsmethode ${method}`);
}

function liesU32(buf, o) {
  return buf.readUInt32LE(o);
}
function liesU16(buf, o) {
  return buf.readUInt16LE(o);
}

// Android-Binaer-XML-Stringpool: Zeichenketten liegen entweder als UTF-8 oder
// UTF-16 vor (Flag 0x100), jeweils mit einer variablen Laengenkodierung
// (1 bzw. 2 Einheiten, High-Bit der ersten Einheit markiert die 2-Einheiten-
// Variante). Siehe frameworks/base ResourceTypes.h (ResStringPool_header).
function parseStringPool(buf, offset) {
  const chunkSize = liesU32(buf, offset + 4);
  const stringCount = liesU32(buf, offset + 8);
  const flags = liesU32(buf, offset + 16);
  const stringsStart = liesU32(buf, offset + 20);
  const istUtf8 = (flags & 0x100) !== 0;
  const offsetsStart = offset + 28;
  const strings = [];
  for (let i = 0; i < stringCount; i++) {
    const relOffset = liesU32(buf, offsetsStart + i * 4);
    let p = offset + stringsStart + relOffset;
    if (istUtf8) {
      const utf16LenByte0 = buf[p];
      p += utf16LenByte0 & 0x80 ? 2 : 1; // UTF-16-Laengenfeld ueberspringen, wird hier nicht gebraucht
      const utf8LenByte0 = buf[p];
      let len;
      if (utf8LenByte0 & 0x80) {
        len = ((utf8LenByte0 & 0x7f) << 8) | buf[p + 1];
        p += 2;
      } else {
        len = utf8LenByte0;
        p += 1;
      }
      strings.push(buf.toString('utf8', p, p + len));
    } else {
      const lenUnit0 = liesU16(buf, p);
      let lenChars;
      if (lenUnit0 & 0x8000) {
        lenChars = ((lenUnit0 & 0x7fff) << 16) | liesU16(buf, p + 2);
        p += 4;
      } else {
        lenChars = lenUnit0;
        p += 2;
      }
      strings.push(buf.toString('utf16le', p, p + lenChars * 2));
    }
  }
  return { strings, chunkEnd: offset + chunkSize };
}

/**
 * Parst eine kompilierte AndroidManifest.xml (binaeres AXML) so weit, dass
 * versionCode/versionName vom Wurzelelement <manifest> herauskommen. Deckt
 * bewusst nur die dafuer noetigen Chunk-Typen ab (Stringpool + StartElement),
 * kein vollstaendiger AXML-Parser.
 */
export function parseAndroidManifest(buf) {
  const outerType = liesU16(buf, 0);
  if (outerType !== 0x0003) {
    throw new Error(`kein binaeres AndroidManifest.xml (Chunk-Typ 0x${outerType.toString(16)} statt 0x0003)`);
  }
  const headerSize = liesU16(buf, 2);
  let offset = headerSize;
  let strings = [];

  while (offset + 8 <= buf.length) {
    const type = liesU16(buf, offset);
    const chunkSize = liesU32(buf, offset + 4);
    if (chunkSize <= 0) break;

    if (type === AXML_STRING_POOL) {
      strings = parseStringPool(buf, offset).strings;
    } else if (type === AXML_START_ELEMENT) {
      const nameIdx = liesU32(buf, offset + 20);
      const name = strings[nameIdx] ?? '';
      if (name === 'manifest') {
        const attributeStart = liesU16(buf, offset + 24);
        const attributeSize = liesU16(buf, offset + 26);
        const attributeCount = liesU16(buf, offset + 28);
        const attrsBase = offset + 16 + attributeStart;
        const attrs = [];
        for (let i = 0; i < attributeCount; i++) {
          const a = attrsBase + i * attributeSize;
          const attrNameIdx = liesU32(buf, a + 4);
          const rawValueIdx = liesU32(buf, a + 8);
          const dataType = buf.readUInt8(a + 15);
          const data = liesU32(buf, a + 16);
          attrs.push({ name: strings[attrNameIdx] ?? '', rawValueIdx, dataType, data });
        }
        const vc = attrs.find((a) => a.name === 'versionCode');
        const vn = attrs.find((a) => a.name === 'versionName');
        if (!vc || !vn) {
          throw new Error('versionCode/versionName nicht als Attribute des <manifest>-Elements gefunden');
        }
        const versionName =
          vn.dataType === RES_TYPE_STRING
            ? (strings[vn.rawValueIdx] ?? strings[vn.data])
            : String(vn.data);
        return { versionCode: vc.data, versionName };
      }
    }
    offset += chunkSize;
  }
  throw new Error('<manifest>-Wurzelelement in AndroidManifest.xml nicht gefunden');
}

/**
 * Holt versionCode/versionName aus einer online liegenden APK per HTTP-Range-
 * Anfragen: zuerst das ZIP-Ende (EOCD, <=64 KB), dann das zentrale
 * Verzeichnis, dann nur den Eintrag AndroidManifest.xml. Laedt dabei nie mehr
 * als ein paar hundert KB, egal wie gross die APK selbst ist.
 */
export async function leseApkVersionVonUrl(url, { timeoutMs = 20_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Zeitlimit (${timeoutMs} ms) beim Lesen der APK-Version`)), timeoutMs);
  try {
    const holeRange = async (von, bis) => {
      const r = await fetchImpl(url, { headers: { Range: `bytes=${von}-${bis}` }, signal: controller.signal });
      if (!r.ok && r.status !== 206) {
        throw new Error(`HTTP ${r.status} beim Lesen von bytes=${von}-${bis}`);
      }
      return Buffer.from(await r.arrayBuffer());
    };

    const kopf = await fetchImpl(url, { method: 'HEAD', signal: controller.signal });
    if (!kopf.ok) throw new Error(`HTTP ${kopf.status} bei HEAD ${url}`);
    const groesse = Number(kopf.headers.get('content-length') ?? 0);
    if (!groesse) throw new Error('kein Content-Length in der HEAD-Antwort - Groesse unbekannt');

    // EOCD + Kommentar passen immer in die letzten 64 KB (Kommentar max. 65535 Byte + 22 Byte Header).
    const endeGroesse = Math.min(65_557, groesse);
    const ende = await holeRange(groesse - endeGroesse, groesse - 1);
    const { cdOffset, cdSize } = findEndOfCentralDirectory(ende);

    const zentralesVerzeichnis = await holeRange(cdOffset, cdOffset + cdSize - 1);
    const eintrag = findCentralDirectoryEntry(zentralesVerzeichnis, 'AndroidManifest.xml');
    if (!eintrag) throw new Error('AndroidManifest.xml nicht im ZIP-Verzeichnis gefunden');

    // Lokaler Header + Dateiname + Extra-Feld sind vorab unbekannt gross,
    // 1 KB Sicherheitsspanne reicht in der Praxis (Dateiname ist hier kurz,
    // "AndroidManifest.xml", Extra-Felder bei Manifest-Eintraegen sind klein).
    const lokalGroesse = eintrag.compressedSize + 1024;
    const lokal = await holeRange(eintrag.localHeaderOffset, eintrag.localHeaderOffset + lokalGroesse - 1);
    const manifestBuf = entpackeLokalenEintrag(lokal, eintrag);
    return parseAndroidManifest(manifestBuf);
  } finally {
    clearTimeout(timer);
  }
}
