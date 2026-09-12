// Laden der Wort-für-Wort-Bedeutungen je Sprache und Sure.
//
// HERKUNFT (Entwicklerdoku — an der Oberfläche wird sie bewusst NICHT
// genannt): die Wort-für-Wort-Datensätze des Quranic-Universal-Library-
// Projekts (qul.tarteel.ai), aufbereitet von scripts/build-wbw.mjs und
// ausgeliefert von scripts/upload-wbw-r2.mjs unter wbw/v2/<sprache>/<sure>.json.
//
// WARUM ÜBERHAUPT: quran.coms Wort-Endpunkt (features/quran/api.ts,
// fetchSurahWordByWord) liefert die Einzelwort-Bedeutung AUSSCHLIESSLICH auf
// Englisch — weder `language` noch `word_translation_language` ändern das
// (live geprüft). ./wbw-de.ts schließt die Lücke für Deutsch, aber nur
// handgepflegt für die vier Kernsuren. Dieser Datensatz deckt sechs weitere
// Sprachen über den ganzen Koran ab.
//
// MUSTER: exakt wie ./morphologie.ts — Cache im Dokumentverzeichnis prüfen,
// sonst von R2 laden, Inhalt validieren, kaputten Cache verwerfen statt
// abzustürzen; Web hat kein Dateisystem, dort bleibt es beim reinen fetch()
// (React Query übernimmt die Zwischenspeicherung, siehe ./wbwHooks.ts).
//
// WARUM DER PFAD DIE VERSION TRÄGT (wbw/v<N>/… statt wbw/…): upload-wbw-r2.mjs
// liefert mit "Cache-Control: public, max-age=31536000, immutable" aus. Eine
// inhaltlich geänderte Datei unter DERSELBEN URL käme weder bei Clients noch
// beim CDN je an. Jede Schema-/Inhaltsänderung bekommt deshalb ein neues
// URL-Präfix, aus derselben Konstante abgeleitet wie die Schema-Zahl.
//
// WORTGRUPPEN statt Einzelwörtern (Schema 2): eine Glosse deckt EINE ODER
// MEHRERE aufeinanderfolgende arabische Wörter ab. Der Herausgeber verschmilzt
// Wörter, deren Bedeutung in der Zielsprache zusammengehört — z. B. trägt in
// 2:4 „مِن" die türkische Glosse „senden önce" (*vor dir*) gemeinsam mit dem
// folgenden „قَبْلِكَ"; das einzeln zu glossieren wäre sprachlich falsch. Je Vers
// steht deshalb eine Liste von [vonPosition, bisPosition, Text] (1-basiert,
// aufsteigend, lückenlos, `bis` der letzten Gruppe = Wortzahl des Verses).
//
// VOLLSTÄNDIGKEIT: die Pipeline schreibt einen Vers nur, wenn er lückenlos
// abgedeckt ist — unvollständige Verse fehlen ganz. Die App braucht deshalb
// keine eigene Vollständigkeitsprüfung, nur "Eintrag da oder nicht". Der
// Abgleich gegen die tatsächlich geladene Wortliste (siehe
// {@link waehleVersGruppen}) bleibt trotzdem als zweite Sicherung: er schützt
// gegen eine abweichende Segmentierung der Wortliste, nicht gegen Lücken.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/lib/errorLog';
import { fetchWithTimeout } from '@/lib/fetchJson';

/** Schema- UND Pfadversion — dieselbe Zahl wie WBW_VERSION in
 * scripts/build-wbw.mjs. Grund siehe Kopf-Kommentar. */
export const WBW_SCHEMA_VERSION = 2;

const WBW_VERSION_PFAD = `v${WBW_SCHEMA_VERSION}`;

/** Öffentliche R2-Basis — gleicher Bucket wie Morphologie/Korpus/Modell. */
export const WBW_BASIS_URL = `https://pub-d0489c0572704285af79896edb72cbed.r2.dev/wbw/${WBW_VERSION_PFAD}`;

/** Die Sprachen, für die ein Datensatz ausgeliefert wird (Reihenfolge wie in
 * scripts/upload-wbw-r2.mjs). Deutsch ist bewusst NICHT dabei: dafür gibt es
 * die handgepflegten Glossen in ./wbw-de.ts, Englisch kommt von quran.com. */
export const WBW_SPRACHEN = ['fr', 'fa', 'id', 'bn', 'ur', 'tr'] as const;

export type WbwSprache = (typeof WBW_SPRACHEN)[number];

/** Ein Eintrag der Ausliefer-Datei: `[vonPosition, bisPosition, Text]`,
 * Positionen 1-basiert und einschließend. `von === bis` ist der Normalfall
 * (ein Wort), `von < bis` eine Wortgruppe mit gemeinsamer Bedeutung. */
export type WbwVersEintrag = [number, number, string];

/** Eine Sure in einer Sprache: Vers-Nummer (als Zeichenkette) → Wortgruppen in
 * Lesereihenfolge, lückenlos von Position 1 bis zur Wortzahl des Verses. */
export interface WbwDatei {
  schema: number;
  lang: string;
  surah: number;
  verses: Record<string, WbwVersEintrag[]>;
}

/** Abdeckung einer Sprache laut meta.json. `anteilVerse`/`anteilWoerter` sind
 * Anteile zwischen 0 und 1. */
export interface WbwSprachStatistik {
  verse: number;
  woerter: number;
  anteilVerse: number;
  anteilWoerter: number;
  /** Zahl der Gloss-Gruppen (≤ `woerter`, weil eine Gruppe mehrere Wörter
   * abdecken kann) und der Anteil der Wörter, die in einer Mehrwortgruppe
   * stehen. Die App wertet beides nicht aus — nur mitgeführt, damit die
   * Ausliefer-Form vollständig beschrieben ist. */
  gruppen?: number;
  anteilInMehrwortgruppe?: number;
}

export interface WbwMetaDatei {
  schema: number;
  korpus: { verse: number; woerter: number };
  sprachen: Partial<Record<string, WbwSprachStatistik>>;
}

/** Sprachschlüssel der App (Locale) → Datensatz-Sprache, oder `null`, wenn es
 * für diese Sprache keinen Datensatz gibt (de/en/es/ms/ru/sw/ps/ar). */
export function wbwSpracheFuerLocale(locale: string): WbwSprache | null {
  return (WBW_SPRACHEN as readonly string[]).includes(locale) ? (locale as WbwSprache) : null;
}

export function wbwUrl(sprache: WbwSprache, surah: number): string {
  return `${WBW_BASIS_URL}/${sprache}/${surah}.json`;
}

export function wbwMetaUrl(): string {
  return `${WBW_BASIS_URL}/meta.json`;
}

/**
 * Wurzel ALLER Wort-für-Wort-Daten im Dokumentverzeichnis — bewusst OHNE den
 * Versionsordner: nach einem Schema-Wechsel liegen die Dateien der alten
 * Version weiter auf der Platte (nichts räumt sie ab). Die Speicherverwaltung
 * (features/settings/storage.ts) muss genau diesen Elternordner messen und
 * löschen, sonst bliebe der alte Stand unsichtbar liegen.
 */
export function wbwDatenVerzeichnis(): string {
  return `${FileSystem.documentDirectory}wbw/`;
}

function cacheVerzeichnis(sprache?: WbwSprache): string {
  const basis = `${wbwDatenVerzeichnis()}${WBW_VERSION_PFAD}/`;
  return sprache ? `${basis}${sprache}/` : basis;
}

function cachePfad(sprache: WbwSprache, surah: number): string {
  return `${cacheVerzeichnis(sprache)}${surah}.json`;
}

function metaCachePfad(): string {
  return `${cacheVerzeichnis()}meta.json`;
}

/** Auf Web gibt es kein Dateisystem — dort bleibt es beim reinen Netz-Abruf. */
function hatDateisystem(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

/**
 * Prüft Schema-Version, Sprache, Sure und dass mindestens ein Vers geliefert
 * wurde. Sowohl für frisch heruntergeladene als auch für zwischengespeicherte
 * Dateien genutzt — ein kaputter/veralteter Cache muss dieselbe Prüfung
 * bestehen wie eine frische Antwort (sonst ginge ein einmal geschriebener
 * defekter Cache für immer als gültig durch).
 */
function istGueltig(datei: unknown, sprache: WbwSprache, surah: number): datei is WbwDatei {
  if (!datei || typeof datei !== 'object') return false;
  const d = datei as Partial<WbwDatei>;
  return (
    d.schema === WBW_SCHEMA_VERSION &&
    d.lang === sprache &&
    d.surah === surah &&
    !!d.verses &&
    typeof d.verses === 'object' &&
    Object.keys(d.verses).length > 0
  );
}

function istMetaGueltig(datei: unknown): datei is WbwMetaDatei {
  if (!datei || typeof datei !== 'object') return false;
  const d = datei as Partial<WbwMetaDatei>;
  return (
    d.schema === WBW_SCHEMA_VERSION &&
    !!d.korpus &&
    typeof d.korpus === 'object' &&
    !!d.sprachen &&
    typeof d.sprachen === 'object' &&
    Object.keys(d.sprachen).length > 0
  );
}

async function ausCacheLesen(pfad: string, pruefen: (datei: unknown) => boolean, zweck: string): Promise<unknown> {
  if (!hatDateisystem()) return null;
  try {
    const info = await FileSystem.getInfoAsync(pfad);
    if (!info.exists || (info.size ?? 0) <= 0) return null;
    const roh = await FileSystem.readAsStringAsync(pfad);
    const datei = JSON.parse(roh) as unknown;
    if (!pruefen(datei)) return null;
    return datei;
  } catch (err) {
    // Beschädigter Cache darf die Wort-für-Wort-Ansicht nicht lahmlegen:
    // Datei weg, danach neu laden — analog zu ./morphologie.ts.
    void logError(err, `wbw: Cache lesen (${zweck})`);
    await FileSystem.deleteAsync(pfad, { idempotent: true }).catch(() => {});
    return null;
  }
}

async function inCacheSchreiben(verzeichnis: string, pfad: string, roh: string, zweck: string): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.makeDirectoryAsync(verzeichnis, { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(pfad, roh).catch((err: unknown) =>
    // Nur protokollieren: ohne Cache wird beim nächsten Öffnen erneut geladen —
    // ärgerlich, aber kein Grund, die Wort-Ansicht zu blockieren.
    logError(err, `wbw: Cache schreiben (${zweck})`),
  );
}

/**
 * Fehler bauen UND in den lokalen Fehler-Ringpuffer schreiben (lib/errorLog.ts).
 *
 * WARUM: fetchWithTimeout protokolliert nur Netz-/Timeout-Fehler selbst; ein
 * HTTP-4xx/5xx oder eine inhaltlich kaputte Datei kam bisher nirgends an —
 * der Reader fiel still auf das englische Gloss zurück und der
 * Support-Fehlerbericht im Einstellungs-Screen blieb leer. Gleiches Muster wie
 * fetchJson() in lib/fetchJson.ts, das hier nicht direkt nutzbar ist: der
 * Rohtext wird für den Datei-Cache gebraucht, nicht nur das geparste JSON.
 */
function fehlerMelden(nachricht: string, zweck: string): Error {
  const fehler = new Error(nachricht);
  void logError(fehler, zweck);
  return fehler;
}

const laufend = new Map<string, Promise<WbwDatei>>();

/**
 * Wort-Bedeutungen einer Sure in einer Sprache laden: zuerst der lokale Cache
 * (Dokumentverzeichnis), sonst Download von R2. Wirft bei HTTP-Fehler,
 * Netzfehler oder ungültigem Inhalt — es gibt bewusst KEINEN Rückfall auf
 * einen veralteten Cache: eine einmal gültige Datei hat kein Frische-Konzept,
 * entweder der Cache ist gültig (dann wird gar nicht neu geladen) oder es gibt
 * keinen brauchbaren Stand, und der Aufrufer (React Query) zeigt den
 * Fehlerzustand. Der Reader fällt dann auf das englische Gloss von quran.com
 * zurück — die Wort-Ansicht bleibt also in jedem Fall benutzbar.
 */
export function ladeWbw(sprache: WbwSprache, surah: number): Promise<WbwDatei> {
  const schluessel = `${sprache}/${surah}`;
  const bereits = laufend.get(schluessel);
  if (bereits) return bereits;

  const auftrag = (async (): Promise<WbwDatei> => {
    try {
      const zwischenstand = await ausCacheLesen(
        cachePfad(sprache, surah),
        (d) => istGueltig(d, sprache, surah),
        schluessel,
      );
      if (zwischenstand) return zwischenstand as WbwDatei;

      const r = await fetchWithTimeout(wbwUrl(sprache, surah), { errorPrefix: 'wbw' });
      if (!r.ok) throw fehlerMelden(`wbw_${schluessel}_http_${r.status}`, `wbw ${wbwUrl(sprache, surah)}`);
      const roh = await r.text();
      const datei = JSON.parse(roh) as unknown;
      if (!istGueltig(datei, sprache, surah)) {
        throw fehlerMelden(`wbw_${schluessel}_ungueltig`, `wbw ${wbwUrl(sprache, surah)}`);
      }
      await inCacheSchreiben(cacheVerzeichnis(sprache), cachePfad(sprache, surah), roh, schluessel);
      return datei;
    } finally {
      laufend.delete(schluessel);
    }
  })();
  laufend.set(schluessel, auftrag);
  return auftrag;
}

let laufendeMeta: Promise<WbwMetaDatei> | null = null;

/**
 * Abdeckungs-Statistik (meta.json) laden — dieselbe Cache-dann-Netz-Logik wie
 * {@link ladeWbw}, aber genau eine Instanz statt einer je Sprache/Sure. Nur
 * für die ehrliche Beschriftung des Umschalters gebraucht (siehe
 * {@link wbwUmschalterZustand}); scheitert der Abruf, bleibt es bei der
 * Beschriftung ohne Zusatz.
 */
export function ladeWbwMeta(): Promise<WbwMetaDatei> {
  if (laufendeMeta) return laufendeMeta;
  const auftrag = (async (): Promise<WbwMetaDatei> => {
    try {
      const zwischenstand = await ausCacheLesen(metaCachePfad(), istMetaGueltig, 'meta.json');
      if (zwischenstand) return zwischenstand as WbwMetaDatei;

      const r = await fetchWithTimeout(wbwMetaUrl(), { errorPrefix: 'wbw_meta' });
      if (!r.ok) throw fehlerMelden(`wbw_meta_http_${r.status}`, `wbw_meta ${wbwMetaUrl()}`);
      const roh = await r.text();
      const datei = JSON.parse(roh) as unknown;
      if (!istMetaGueltig(datei)) throw fehlerMelden('wbw_meta_ungueltig', `wbw_meta ${wbwMetaUrl()}`);
      await inCacheSchreiben(cacheVerzeichnis(), metaCachePfad(), roh, 'meta.json');
      return datei;
    } finally {
      laufendeMeta = null;
    }
  })();
  laufendeMeta = auftrag;
  return auftrag;
}

// ---------- Reine Auswahl-/Beschriftungslogik (ohne Netz, ohne React) ----------

/**
 * Ab diesem Vers-Anteil gilt eine Sprache als voll abgedeckt und der
 * Umschalter trägt keinen Zusatz; darunter nennt die Caption den Anteil und
 * sagt, dass der Rest englisch bleibt. Ein Vers ohne Eintrag bleibt in beiden
 * Fällen englisch — der Zusatz sagt es nur dort, wo es dem Leser tatsächlich
 * auffällt.
 *
 * Der Anteil kommt IMMER aus meta.json, nie aus dem Code: mit dem Schema-2-Lauf
 * liegen alle sechs Sprachen über der Schwelle (fr 100 %, id/bn/fa 99,95 %,
 * ur 99,92 %, tr 99,42 % — Stand 2026-09-07), der Teilabdeckungs-Zweig greift
 * also gerade nirgends. Er bleibt trotzdem: ein künftiger Datenlauf oder eine
 * neue Sprache kann darunter liegen, und dann muss die Beschriftung von selbst
 * ehrlich werden.
 */
export const WBW_VOLLE_ABDECKUNG_AB = 0.99;

/** Eine Wortgruppe des Verses, wie der Leser sie darstellt: die arabischen
 * Wörter der Positionen `von`…`bis` (1-basiert, einschließend) stehen
 * nebeneinander, darunter EIN gemeinsamer Text. */
export interface WbwGruppe {
  von: number;
  bis: number;
  text: string;
}

/**
 * Decken die Einträge die Positionen 1…`wortzahl` lückenlos und
 * überschneidungsfrei ab? Das ist die zweite Sicherung an die Stelle des
 * früheren Längenabgleichs: stimmt es nicht, fällt der GANZE Vers auf Englisch
 * zurück — nie ein halb übersetzter Vers, nie eine verschobene Zuordnung.
 *
 * Geprüft wird bewusst gegen die Wortzahl der tatsächlich angezeigten
 * Wortliste (quran.com-Segmentierung), nicht gegen die Datei selbst: eine
 * abweichende Segmentierung ist genau der Fall, den die Pipeline nicht sehen
 * kann.
 */
export function gruppenDeckenVersAb(eintraege: readonly WbwVersEintrag[] | undefined, wortzahl: number): boolean {
  if (!eintraege || eintraege.length === 0 || wortzahl <= 0) return false;
  let erwartet = 1;
  for (const eintrag of eintraege) {
    if (!Array.isArray(eintrag) || eintrag.length !== 3) return false;
    const [von, bis, text] = eintrag;
    if (!Number.isInteger(von) || !Number.isInteger(bis)) return false;
    if (von !== erwartet || bis < von || bis > wortzahl) return false;
    if (typeof text !== 'string' || text.length === 0) return false;
    erwartet = bis + 1;
  }
  return erwartet === wortzahl + 1;
}

/**
 * Wortgruppen für EINEN Vers auswählen. Deutsch hat Vorrang (handgepflegt,
 * siehe ./wbw-de.ts — dort ist jedes Wort einzeln glossiert, also eine Gruppe
 * je Wort), danach der Datensatz der App-Sprache. Deckt keiner von beiden den
 * Vers lückenlos ab, gibt es `undefined` und der Aufrufer bleibt für den
 * ganzen Vers beim englischen Gloss von quran.com.
 */
export function waehleVersGruppen(args: {
  /** Handgepflegte deutsche Glossen dieses Verses (eine je Wort), falls vorhanden. */
  deutscheGlossen: readonly string[] | undefined;
  /** Geladene Datei der App-Sprache, falls vorhanden. */
  datei: WbwDatei | undefined;
  ayah: number;
  /** Wortzahl der tatsächlich angezeigten Wortliste (quran.com-Segmentierung). */
  wortzahl: number;
}): WbwGruppe[] | undefined {
  const { deutscheGlossen, datei, ayah, wortzahl } = args;
  if (deutscheGlossen && deutscheGlossen.length === wortzahl && wortzahl > 0) {
    return deutscheGlossen.map((text, i) => ({ von: i + 1, bis: i + 1, text }));
  }
  const eintraege = datei?.verses[String(ayah)];
  if (!gruppenDeckenVersAb(eintraege, wortzahl)) return undefined;
  return (eintraege as WbwVersEintrag[]).map(([von, bis, text]) => ({ von, bis, text }));
}

/**
 * Wie der Umschalter „Wort für Wort" beschriftet werden muss:
 * - `eigen`: die Glossen erscheinen in der App-Sprache (oder die App läuft auf
 *   Englisch) — kein Zusatz.
 * - `teilweise`: es gibt einen Datensatz, aber er deckt nicht alle Verse ab —
 *   die Caption sagt, wie viel Prozent der Verse abgedeckt sind und dass der
 *   Rest englisch bleibt.
 * - `fehler`: ein Abruf ist fehlgeschlagen. `quelle` sagt WELCHER, denn die
 *   beiden Fehlschläge haben völlig verschiedene Folgen:
 *   – `'wortliste'`: die Wortliste von quran.com (features/quran/wortliste.ts)
 *     fehlt. Sie trägt die arabischen Wörter selbst — ohne sie zeigt die
 *     Wort-Ansicht in JEDER Sprache überhaupt nichts, auch kein englisches
 *     Gloss. Deshalb steht bei diesem Fehler auch kein „(EN)" am Label: es
 *     wäre die Zusage eines Rückfalls, den es nicht gibt.
 *   – `'sprachdatei'`: nur der Datensatz der App-Sprache (./wbw.ts) fehlt. Die
 *     Wort-Ansicht funktioniert, die Glossen bleiben englisch — Label „(EN)".
 *   In beiden Fällen nennt die Caption den Grund und den Weg zum erneuten
 *   Versuch. Ohne diesen Zweig sähe der Leser nur englische Glossen (oder gar
 *   keine) und erführe nie, warum (Befund der Geräteabnahme).
 * - `englisch`: keine Daten für diese Sprache — wie bisher „(EN)".
 */
export type WbwUmschalterZustand =
  | { art: 'eigen' }
  | { art: 'teilweise'; prozentVerse: number }
  | { art: 'fehler'; quelle: WbwFehlerQuelle }
  | { art: 'englisch' };

/** Welcher der beiden Abrufe fehlgeschlagen ist — siehe {@link WbwUmschalterZustand}. */
export type WbwFehlerQuelle = 'wortliste' | 'sprachdatei';

export function wbwUmschalterZustand(args: {
  locale: string;
  /** true, wenn für diese Sure deutsche Glossen gepflegt sind UND die App auf
   * Deutsch läuft (siehe hasGermanWordByWord in ./wbw-de.ts). */
  deutscheGlossenVerfuegbar: boolean;
  /** meta.json, solange noch nicht geladen `undefined`. */
  meta: WbwMetaDatei | undefined;
  /** true, wenn der Abruf der WORTLISTE dieser Sure fehlgeschlagen ist
   * (useSurahWordByWord().isError, features/quran/wortliste.ts). Sie trägt die
   * arabischen Wörter selbst; fällt sie aus, zeigt die Wort-Ansicht in jeder
   * Sprache nichts — der Fehlerzustand muss sie deshalb genauso umfassen wie
   * die Sprachdatei. Genau hier riss die erste Fassung: der Umschalter gab
   * Entwarnung („(EN)" weg), während die Sure ganz ohne Glossen dastand. */
  wortlisteFehler: boolean;
  /** true, wenn der Abruf der Wort-Datei der App-Sprache fehlgeschlagen ist
   * (useSurahWbw().isError). Ohne diese Angabe wäre der Rückfall auf Englisch
   * für den Leser nicht von „für diese Sprache gibt es nichts" zu
   * unterscheiden — genau der stille Rückfall aus der Geräteabnahme. */
  sprachdateiFehler: boolean;
}): WbwUmschalterZustand {
  const { locale, deutscheGlossenVerfuegbar, meta, wortlisteFehler, sprachdateiFehler } = args;
  // GANZ VORNE, vor jeder Sprachfrage: ohne Wortliste gibt es keine einzige
  // Glosse — weder in der App-Sprache noch auf Englisch, und auch nicht bei
  // gepflegten deutschen Glossen (die brauchen die Wortliste als Gerüst).
  if (wortlisteFehler) return { art: 'fehler', quelle: 'wortliste' };
  if (locale === 'en' || deutscheGlossenVerfuegbar) return { art: 'eigen' };
  const sprache = wbwSpracheFuerLocale(locale);
  if (!sprache) return { art: 'englisch' };
  // Vor der Abdeckungsfrage: ein Ladefehler macht die Abdeckung gegenstandslos
  // (es ist gar nichts da), und der Zusatz muss den GRUND nennen, nicht eine
  // Prozentzahl, die gerade niemandem hilft.
  if (sprachdateiFehler) return { art: 'fehler', quelle: 'sprachdatei' };
  const anteil = meta?.sprachen[sprache]?.anteilVerse;
  // Ohne meta.json ist die Abdeckung unbekannt — Daten gibt es aber sicher
  // (die Sprache steht in WBW_SPRACHEN), also kein „(EN)". Der Zusatz kommt
  // nach, sobald meta.json da ist.
  if (typeof anteil !== 'number' || anteil >= WBW_VOLLE_ABDECKUNG_AB) return { art: 'eigen' };
  return { art: 'teilweise', prozentVerse: Math.round(anteil * 100) };
}

/**
 * Löscht alle zwischengespeicherten Wort-für-Wort-Dateien (alle Sprachen, alle
 * Schema-Versionen). Verlustfrei: die Dateien kommen aus R2 und werden bei
 * Bedarf neu geladen — Nutzerdaten liegen hier keine.
 */
export async function wbwCacheLoeschen(): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.deleteAsync(wbwDatenVerzeichnis(), { idempotent: true }).catch(() => {});
}
