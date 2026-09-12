// Laden der Wort-Morphologie- und Syntaxdaten je Sure (QAC-Segmentierung).
//
// Ausgeliefert über denselben R2-Bucket wie der KI-Korpus (features/ki/korpus.ts)
// und die Offline-Audios — hier aber pro SURE eine eigene, vergleichsweise
// kleine JSON-Datei (morphologie/v<N>/<sure>.json, aktuell v3 — siehe
// MORPHOLOGIE_SCHEMA_VERSION), da die Nutzung (Wortanalyse-
// Overlay im Reader) immer genau eine Sure gleichzeitig braucht. Gleiches
// Muster wie ki/korpus.ts: Cache im Dokumentverzeichnis prüfen, sonst von R2
// laden, Inhalt validieren, kaputten Cache verwerfen statt abzustürzen. Web
// hat kein Dateisystem — dort bleibt es beim reinen fetch() (React-Query
// übernimmt dort die Zwischenspeicherung, siehe morphologieHooks.ts).
//
// WARUM DER PFAD DIE VERSION TRÄGT (morphologie/v<N>/… statt morphologie/…):
// upload-morphologie-r2.mjs liefert diese Dateien mit
// "Cache-Control: public, max-age=31536000, immutable" aus (siehe Kommentar
// dort). Eine inhaltlich geänderte Datei unter DERSELBEN URL würde weder bei
// Clients (die den alten Stand bis zu einem Jahr lang gar nicht erst erneut
// abfragen) noch beim CDN je ankommen — "immutable" verbietet genau das. Jede
// inhaltliche Schema-Änderung (siehe MORPHOLOGIE_SCHEMA_VERSION) bekommt
// deshalb ein neues URL-Präfix, aus derselben Konstante abgeleitet wie die
// Schema-Zahl, statt die alte Version stillschweigend zu überschreiben.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/lib/errorLog';
import { fetchWithTimeout } from '@/lib/fetchJson';

import {
  MORPHOLOGIE_SCHEMA_VERSION,
  type LemmataDatei,
  type MetaDatei,
  type MorphologieDatei,
  type WurzelnDatei,
} from './morphologieTypen';

/** R2-Präfix für die aktuelle Schema-Version — abgeleitet aus
 * {@link MORPHOLOGIE_SCHEMA_VERSION}, damit URL und Schema-Prüfung nie
 * auseinanderlaufen können. Siehe Kopf-Kommentar, "WARUM DER PFAD DIE VERSION
 * TRÄGT". */
const MORPHOLOGIE_VERSION_PFAD = `v${MORPHOLOGIE_SCHEMA_VERSION}`;

/** Öffentliche R2-Basis — gleicher Bucket wie Modell-/Korpus-Download (ki/korpus.ts, ki/model.ts). */
export const MORPHOLOGIE_BASIS_URL = `https://pub-d0489c0572704285af79896edb72cbed.r2.dev/morphologie/${MORPHOLOGIE_VERSION_PFAD}`;

export function morphologieUrl(surah: number): string {
  return `${MORPHOLOGIE_BASIS_URL}/${surah}.json`;
}

/** Die drei globalen (nicht sure-spezifischen) Begleitdateien derselben Pipeline. */
export function wurzelnUrl(): string {
  return `${MORPHOLOGIE_BASIS_URL}/roots.json`;
}

export function lemmataUrl(): string {
  return `${MORPHOLOGIE_BASIS_URL}/lemmas.json`;
}

export function metaUrl(): string {
  return `${MORPHOLOGIE_BASIS_URL}/meta.json`;
}

/**
 * Ablageort aller zwischengespeicherten Morphologie-Dateien (Sure-Dateien und
 * die drei globalen Begleitdateien) im Dokumentverzeichnis. Exportiert für die
 * Speicherverwaltung (features/settings/storage.ts), damit sie Größe und
 * Löschung über DIESEN Pfad rechnet, statt ihn ein zweites Mal
 * zusammenzusetzen.
 */
export function morphologieDatenVerzeichnis(): string {
  return `${FileSystem.documentDirectory}morphologie/`;
}

function cacheVerzeichnis(): string {
  return morphologieDatenVerzeichnis();
}

function cachePfad(surah: number): string {
  return `${cacheVerzeichnis()}${surah}.json`;
}

function globalerCachePfad(dateiname: 'roots.json' | 'lemmas.json' | 'meta.json'): string {
  return `${cacheVerzeichnis()}${dateiname}`;
}

/** Auf Web gibt es kein Dateisystem — dort bleibt es beim reinen Netz-Abruf. */
export function hatDateisystem(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

/**
 * Prüft Schema-Version, Sure und dass mindestens ein Vers geliefert wurde.
 * Sowohl für frisch heruntergeladene als auch für zwischengespeicherte Dateien
 * genutzt — ein kaputter/veralteter Cache muss dieselbe Prüfung bestehen wie
 * eine frische Antwort, sonst würde ein einmal geschriebener defekter Cache
 * für immer als gültig durchgehen.
 */
function istGueltig(datei: unknown, surah: number): datei is MorphologieDatei {
  if (!datei || typeof datei !== 'object') return false;
  const d = datei as Partial<MorphologieDatei>;
  return (
    d.schema === MORPHOLOGIE_SCHEMA_VERSION &&
    d.surah === surah &&
    !!d.verses &&
    typeof d.verses === 'object' &&
    Object.keys(d.verses).length > 0
  );
}

async function ausCacheLesen(surah: number): Promise<MorphologieDatei | null> {
  if (!hatDateisystem()) return null;
  try {
    const info = await FileSystem.getInfoAsync(cachePfad(surah));
    if (!info.exists || (info.size ?? 0) <= 0) return null;
    const roh = await FileSystem.readAsStringAsync(cachePfad(surah));
    const datei = JSON.parse(roh) as unknown;
    if (!istGueltig(datei, surah)) return null;
    return datei;
  } catch (err) {
    // Beschädigter Cache darf die Wortanalyse nicht lahmlegen: Datei weg,
    // danach neu laden — analog zu ki/korpus.ts.
    void logError(err, 'morphologie: Cache lesen');
    await FileSystem.deleteAsync(cachePfad(surah), { idempotent: true }).catch(() => {});
    return null;
  }
}

async function inCacheSchreiben(surah: number, roh: string): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.makeDirectoryAsync(cacheVerzeichnis(), { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(cachePfad(surah), roh).catch((err: unknown) =>
    // Nur protokollieren: ohne Cache wird beim nächsten Öffnen der Sure erneut
    // geladen — ärgerlich, aber kein Grund, die Wortanalyse zu blockieren.
    logError(err, 'morphologie: Cache schreiben'),
  );
}

const laufend = new Map<number, Promise<MorphologieDatei>>();

/**
 * Morphologiedaten einer Sure laden: zuerst der lokale Cache (Dokumentverzeichnis),
 * sonst Download von R2. Wirft bei HTTP-Fehler, Netzfehler oder ungültigem
 * Inhalt (Schema-Version/Surennummer/leere Verse) — es gibt hier bewusst
 * KEINEN Rückfall auf einen veralteten Cache wie bei ki/korpus.ts: anders als
 * der übersetzte Korpus (der sich inhaltlich weiterentwickelt) hat eine
 * einmal gültige Morphologie-Datei kein Frische-Konzept — entweder der Cache
 * ist gültig (dann wird gar nicht erst neu geladen) oder es gibt keinen
 * brauchbaren Stand, und der Aufrufer (React Query) zeigt den Fehlerzustand.
 * Der `enabled`-Flag der Hooks (morphologieHooks.ts) sorgt dafür, dass dieser
 * Aufruf nur passiert, wenn der Nutzer die Wortanalyse aktiv eingeschaltet hat.
 */
export function ladeMorphologie(surah: number): Promise<MorphologieDatei> {
  const bereits = laufend.get(surah);
  if (bereits) return bereits;

  const auftrag = (async (): Promise<MorphologieDatei> => {
    try {
      const zwischenstand = await ausCacheLesen(surah);
      if (zwischenstand) return zwischenstand;

      const r = await fetchWithTimeout(morphologieUrl(surah), { errorPrefix: 'morphologie' });
      if (!r.ok) throw new Error(`morphologie_${surah}_http_${r.status}`);
      const roh = await r.text();
      const datei = JSON.parse(roh) as unknown;
      if (!istGueltig(datei, surah)) throw new Error(`morphologie_${surah}_ungueltig`);
      await inCacheSchreiben(surah, roh);
      return datei;
    } finally {
      laufend.delete(surah);
    }
  })();
  laufend.set(surah, auftrag);
  return auftrag;
}

// ---------- Globale Begleitdateien (roots.json, lemmas.json, meta.json) ----------
//
// Dieselbe Pipeline liefert neben den 114 Sure-Dateien drei globale Dateien:
// eine Wurzel- und eine Lemma-Konkordanz (für "alle Vorkommen dieser Wurzel/
// dieses Lemmas im Koran zeigen") sowie eine Statistik-/Herkunftsdatei (meta.json,
// u. a. Grundlage für die POS-/Relations-Häufigkeiten in grammatik.ts). Anders
// als die Sure-Dateien sind sie nicht nach einer Nummer geschlüsselt — je genau
// eine Instanz, mit demselben Cache-dann-Netz-Muster wie ladeMorphologie oben.

interface GlobaleDateiKonfig<T> {
  name: 'roots.json' | 'lemmas.json' | 'meta.json';
  url: string;
  istGueltig: (datei: unknown) => datei is T;
}

async function globaleDateiAusCacheLesen<T>(konfig: GlobaleDateiKonfig<T>): Promise<T | null> {
  if (!hatDateisystem()) return null;
  const pfad = globalerCachePfad(konfig.name);
  try {
    const info = await FileSystem.getInfoAsync(pfad);
    if (!info.exists || (info.size ?? 0) <= 0) return null;
    const roh = await FileSystem.readAsStringAsync(pfad);
    const datei = JSON.parse(roh) as unknown;
    if (!konfig.istGueltig(datei)) return null;
    return datei;
  } catch (err) {
    void logError(err, `morphologie: Cache lesen (${konfig.name})`);
    await FileSystem.deleteAsync(pfad, { idempotent: true }).catch(() => {});
    return null;
  }
}

async function globaleDateiInCacheSchreiben(konfig: GlobaleDateiKonfig<unknown>, roh: string): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.makeDirectoryAsync(cacheVerzeichnis(), { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(globalerCachePfad(konfig.name), roh).catch((err: unknown) =>
    logError(err, `morphologie: Cache schreiben (${konfig.name})`),
  );
}

function macheGlobalenLoader<T>(konfig: GlobaleDateiKonfig<T>): () => Promise<T> {
  let laufend: Promise<T> | null = null;
  return function laden(): Promise<T> {
    if (laufend) return laufend;
    const auftrag = (async (): Promise<T> => {
      try {
        const zwischenstand = await globaleDateiAusCacheLesen(konfig);
        if (zwischenstand) return zwischenstand;

        const r = await fetchWithTimeout(konfig.url, { errorPrefix: `morphologie_${konfig.name}` });
        if (!r.ok) throw new Error(`morphologie_${konfig.name}_http_${r.status}`);
        const roh = await r.text();
        const datei = JSON.parse(roh) as unknown;
        if (!konfig.istGueltig(datei)) throw new Error(`morphologie_${konfig.name}_ungueltig`);
        await globaleDateiInCacheSchreiben(konfig, roh);
        return datei;
      } finally {
        laufend = null;
      }
    })();
    laufend = auftrag;
    return auftrag;
  };
}

function istWurzelnGueltig(datei: unknown): datei is WurzelnDatei {
  if (!datei || typeof datei !== 'object') return false;
  return Object.keys(datei).length > 0;
}

function istLemmataGueltig(datei: unknown): datei is LemmataDatei {
  if (!datei || typeof datei !== 'object') return false;
  return Object.keys(datei).length > 0;
}

function istMetaGueltig(datei: unknown): datei is MetaDatei {
  if (!datei || typeof datei !== 'object') return false;
  const d = datei as Partial<MetaDatei>;
  return (
    d.schema === MORPHOLOGIE_SCHEMA_VERSION &&
    !!d.posHaeufigkeit &&
    typeof d.posHaeufigkeit === 'object' &&
    !!d.relationHaeufigkeit &&
    typeof d.relationHaeufigkeit === 'object'
  );
}

/** Wurzel-Konkordanz (roots.json) laden — Cache im Dokumentverzeichnis, sonst R2. */
export const ladeWurzeln = macheGlobalenLoader<WurzelnDatei>({
  name: 'roots.json',
  url: wurzelnUrl(),
  istGueltig: istWurzelnGueltig,
});

/** Lemma-Konkordanz (lemmas.json) laden — Cache im Dokumentverzeichnis, sonst R2. */
export const ladeLemmata = macheGlobalenLoader<LemmataDatei>({
  name: 'lemmas.json',
  url: lemmataUrl(),
  istGueltig: istLemmataGueltig,
});

/** Statistik-/Herkunftsdatei (meta.json) laden — Cache im Dokumentverzeichnis, sonst R2. */
export const ladeMeta = macheGlobalenLoader<MetaDatei>({
  name: 'meta.json',
  url: metaUrl(),
  istGueltig: istMetaGueltig,
});

/**
 * Löscht den gesamten Morphologie-Zwischenspeicher. Verlustfrei: die Dateien
 * kommen aus R2 und werden beim nächsten Öffnen der Wortanalyse neu geladen —
 * es gibt hier keine Nutzerdaten. Ohne Netz ist die Wortanalyse danach bis zum
 * nächsten erfolgreichen Abruf nicht verfügbar.
 */
export async function morphologieCacheLoeschen(): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.deleteAsync(morphologieDatenVerzeichnis(), { idempotent: true }).catch(() => {});
}
