// Quellen-Korpus der Salati-KI — sprachabhängig.
//
// AUSLIEFERUNG (bewusst zweigeteilt):
//  · DEUTSCH liegt als Metro-JSON-Asset im App-Bundle (~1,7 MB). Es ist
//    dieselbe Datei, die die Web-Version per fetch('/rag/korpus-de.json') holt
//    — eine Quelle der Wahrheit, kein Duplikat. Dadurch ist die KI ohne jeden
//    Netzzugriff sofort antwortfähig, und jede andere Sprache hat einen
//    sofort verfügbaren Rückfall.
//  · DIE ÜBRIGEN 13 SPRACHEN liegen auf Cloudflare R2 (rag/korpus-<lang>.json,
//    1,6-3,3 MB) und werden bei Bedarf geladen und lokal zwischengespeichert.
//    Alle 14 zu bündeln wären rund 30 MB — eine Verdopplung der App-Größe,
//    obwohl jeder Nutzer immer nur EINEN Korpus braucht. Gegenüber dem
//    einmaligen Modell-Download von 1,1 GB (model.ts), den die KI ohnehin
//    voraussetzt, fällt ein Korpus nicht ins Gewicht.
//
// WARUM ÜBERHAUPT ÜBERSETZTE KORPORA: Am echten Gerätemodell wurde gemessen,
// dass Qwen2.5-1.5B aus deutschen Quellen nicht zuverlässig in andere Sprachen
// antworten kann (Protokoll im Kopf von sprachen.ts). Übersetzte Quellen lösen
// das an der Wurzel: das Modell muss nur noch nah am Wortlaut bleiben.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/lib/errorLog';

import { baueIndex, type Index, type KorpusDoc } from './retrieval';
import { KI_SPRACHEN, KORPUS_SPRACHE } from './sprachen';
import korpusJson from '../../../public/rag/korpus-de.json';

interface KorpusDatei {
  v: number;
  /**
   * Inhaltsstempel des Bau-Laufs (scripts/build-ki-korpus.mjs), in allen 14
   * Dateien identisch. Dient allein dazu, einen veralteten Cache zu erkennen —
   * siehe `cacheIstAktuell`. Ältere Dateien haben ihn nicht.
   */
  stand?: string;
  lang: string;
  /** Anzahl Dokumente, die in dieser Sprache nur auf Deutsch vorliegen (Feld `fb`). */
  fallback?: number;
  docs: KorpusDoc[];
}

/** Öffentliche R2-Basis — gleicher Bucket wie der Modell-Download (model.ts). */
export const KORPUS_BASIS_URL = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/rag';

export function korpusUrl(sprache: string): string {
  return `${KORPUS_BASIS_URL}/korpus-${sprache}.json`;
}

/** Was gerade als Quellenbasis dient — Grundlage für den ehrlichen Hinweis im KI-Screen. */
export interface KorpusStand {
  /** Sprache des tatsächlich geladenen Korpus (`de`, solange nur der Rückfall da ist). */
  sprache: string;
  index: Index;
  gesamt: number;
  /** Dokumente, die in dieser Sprache noch deutsch sind (kuratierte Wissensschicht). */
  deutsch: number;
  /** true, wenn der Korpus vollständig deutsch ist (Rückfall oder App-Sprache Deutsch). */
  nurDeutsch: boolean;
}

function standAus(datei: KorpusDatei): KorpusStand {
  const deutsch = datei.lang === KORPUS_SPRACHE ? 0 : (datei.fallback ?? datei.docs.filter((d) => d.fb === 1).length);
  return {
    sprache: datei.lang,
    index: baueIndex(datei.docs),
    gesamt: datei.docs.length,
    deutsch,
    nurDeutsch: datei.lang === KORPUS_SPRACHE,
  };
}

let deutscherStandCache: KorpusStand | null = null;

/** Der gebündelte deutsche Korpus. Rein synchron (kein I/O) — Rückfall für alle Sprachen. */
export function deutscherStand(): KorpusStand {
  if (!deutscherStandCache) deutscherStandCache = standAus(korpusJson as KorpusDatei);
  return deutscherStandCache;
}

/** Baut den BM25-Index des deutschen Korpus einmalig. */
export function ladeKorpusIndex(): Index {
  return deutscherStand().index;
}

// Aktiv gesetzter Stand: bestimmt, aus welchem Korpus dokumentNachId() liest.
let aktiv: KorpusStand | null = null;

export function aktiverStand(): KorpusStand {
  return aktiv ?? deutscherStand();
}

let nachId: Map<string, KorpusDoc> | null = null;
let nachIdSprache: string | null = null;

/**
 * Dokument über seine ID nachschlagen — für Verlauf und Antwort-Cache, in denen
 * nur die IDs der Quellen gespeichert werden (die Texte liegen ohnehin im
 * Korpus; sie zusätzlich in AsyncStorage zu schreiben wäre reine Verdopplung
 * von rund 3 KB je Antwort).
 *
 * Zuerst im aktiven (übersetzten) Korpus, dann im deutschen: Ein Verlauf, der
 * vor dem Sprachwechsel entstanden ist, kann IDs enthalten, die es nur in der
 * deutschen Stückelung gibt (Kurs-/Guide-/Wissenstexte werden pro Sprache an
 * Satzgrenzen geschnitten und ergeben dabei unterschiedlich viele Teile).
 */
export function dokumentNachId(id: string): KorpusDoc | undefined {
  const stand = aktiverStand();
  if (!nachId || nachIdSprache !== stand.sprache) {
    nachId = new Map(stand.index.docs.map((d) => [d.id, d]));
    nachIdSprache = stand.sprache;
  }
  const treffer = nachId.get(id);
  if (treffer || stand.sprache === KORPUS_SPRACHE) return treffer;
  return deutscherStand().index.docs.find((d) => d.id === id);
}

// ---------- Laden der übrigen 13 Sprachen ----------

function cacheVerzeichnis(): string {
  return `${FileSystem.documentDirectory}ki-korpus/`;
}

function cachePfad(sprache: string): string {
  return `${cacheVerzeichnis()}korpus-${sprache}.json`;
}

/**
 * Inhaltsstempel, den ein gültiger Cache tragen muss. Es ist der Stempel des
 * gebündelten deutschen Korpus — alle 14 Dateien entstehen in einem Lauf von
 * scripts/build-ki-korpus.mjs und tragen denselben Wert. Fehlt er (Datei aus
 * der Zeit vor dieser Prüfung), gilt der Cache als veraltet.
 */
export function erwarteterStand(): string | undefined {
  return (korpusJson as KorpusDatei).stand;
}

/** Auf Web gibt es kein Dateisystem — dort bleibt es beim reinen Netz-Abruf (Browser-Cache). */
function hatDateisystem(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

async function ausCacheLesen(sprache: string): Promise<KorpusDatei | null> {
  if (!hatDateisystem()) return null;
  try {
    const info = await FileSystem.getInfoAsync(cachePfad(sprache));
    if (!info.exists || (info.size ?? 0) <= 0) return null;
    const roh = await FileSystem.readAsStringAsync(cachePfad(sprache));
    const datei = JSON.parse(roh) as KorpusDatei;
    if (!Array.isArray(datei.docs) || datei.docs.length === 0) return null;
    return datei;
  } catch (err) {
    // Beschädigter Cache darf die KI nicht lahmlegen: Datei weg, danach neu laden.
    void logError(err, 'ki-korpus: Cache lesen');
    await FileSystem.deleteAsync(cachePfad(sprache), { idempotent: true }).catch(() => {});
    return null;
  }
}

async function inCacheSchreiben(sprache: string, roh: string): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.makeDirectoryAsync(cacheVerzeichnis(), { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(cachePfad(sprache), roh).catch((err: unknown) =>
    // Nur protokollieren: ohne Cache wird der Korpus beim nächsten Start erneut
    // geladen (1,6-3,3 MB) — ärgerlich, aber kein Grund, die KI zu blockieren.
    logError(err, 'ki-korpus: Cache schreiben'),
  );
}

const laufend = new Map<string, Promise<KorpusStand>>();

/**
 * Korpus der App-Sprache besorgen. Blockiert den Screen NICHT: der Aufrufer
 * arbeitet bis zur Auflösung mit deutscherStand() weiter. Schlägt Netz und
 * Cache fehl, kommt der deutsche Stand zurück — die KI bleibt in jedem Fall
 * benutzbar, nur eben mit deutschen Quellen.
 */
export function ladeKorpusStand(sprache: string): Promise<KorpusStand> {
  if (sprache === KORPUS_SPRACHE || !KI_SPRACHEN[sprache]) {
    aktiv = deutscherStand();
    return Promise.resolve(aktiv);
  }
  if (aktiv?.sprache === sprache) return Promise.resolve(aktiv);
  const bereits = laufend.get(sprache);
  if (bereits) return bereits;

  const auftrag = (async (): Promise<KorpusStand> => {
    // Zwischengespeicherte Datei nur verwenden, wenn sie aus DEMSELBEN Bau-Lauf
    // stammt wie der gebündelte deutsche Korpus. Vorher wurde der Cache blind
    // wiederverwendet: wer einmal einen Korpus geladen hatte, behielt ihn
    // dauerhaft und bekam keine inhaltliche Korrektur mehr — die Übersetzungen
    // und die 59 nachgetragenen Duas hätten diese Geräte nie erreicht.
    const zwischenstand = await ausCacheLesen(sprache);
    const veraltet = !!zwischenstand && zwischenstand.stand !== erwarteterStand();
    try {
      let datei = veraltet ? null : zwischenstand;
      if (!datei) {
        const r = await fetch(korpusUrl(sprache));
        if (!r.ok) throw new Error(`korpus_${sprache}_http_${r.status}`);
        const roh = await r.text();
        datei = JSON.parse(roh) as KorpusDatei;
        if (!Array.isArray(datei.docs) || datei.docs.length === 0) throw new Error(`korpus_${sprache}_leer`);
        await inCacheSchreiben(sprache, roh);
      }
      const stand = standAus(datei);
      aktiv = stand;
      return stand;
    } catch (err) {
      // Kein Netz, R2 nicht erreichbar, kaputtes JSON: still auf Deutsch
      // zurückfallen wäre falsch — der Nutzer sähe unerklärt deutsche Antworten.
      // Deshalb protokollieren; der Screen zeigt über KorpusStand.nurDeutsch
      // weiterhin den ehrlichen Hinweis an.
      void logError(err, `ki-korpus: Sprache ${sprache} laden`);
      // Ohne Netz ist ein VERALTETER Korpus in der richtigen Sprache immer noch
      // besser als deutsche Quellen: der Nutzer bekommt Antworten, die er lesen
      // kann. Beim nächsten Start mit Netz wird er ersetzt.
      if (zwischenstand) {
        const stand = standAus(zwischenstand);
        aktiv = stand;
        return stand;
      }
      aktiv = deutscherStand();
      return aktiv;
    } finally {
      laufend.delete(sprache);
    }
  })();
  laufend.set(sprache, auftrag);
  return auftrag;
}

/** Nur für Tests: Modulzustand zurücksetzen. */
export function _zuruecksetzen(): void {
  aktiv = null;
  nachId = null;
  nachIdSprache = null;
  laufend.clear();
}
