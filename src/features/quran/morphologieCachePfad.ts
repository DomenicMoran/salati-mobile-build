// Einzige Stelle, die weiß, WO der lokal gebaute Morphologie-Cache
// (.daten-cache/out/morphologie/v<N>/, von scripts/build-morphologie.mjs
// erzeugt, gitignored) im Dateisystem liegt — für Tests, die den Cache DIREKT
// von der Platte lesen statt über ladeMorphologie() (./morphologie.ts, die
// RN-Runtime-Schicht mit R2-Netz-Fallback).
//
// WARUM DIESE DATEI: bis hierhin trug jeder betroffene Test seine eigene
// Kopie von `join(__dirname, ..., '.daten-cache', 'out', 'morphologie')` —
// beim Sprung auf den versionierten Pfad (morphologie/v2/, siehe
// MORPHOLOGIE_SCHEMA_VERSION in ./morphologieTypen.ts) blieben mehrere Kopien
// auf dem alten, flachen Pfad stehen. Weil diese Tests so gebaut sind, dass
// sie den Korpus-Block bei fehlendem Cache ÜBERSPRINGEN statt rot zu werden,
// liefen sie danach still und unbemerkt grün durch, OHNE eine einzige
// Assertion auszuführen — schlimmer als ein roter Test. Ein künftiger
// Versionswechsel muss deshalb NUR hier (bzw. an MORPHOLOGIE_SCHEMA_VERSION)
// nachgezogen werden. Der Wechsel v2 -> v3 (2026-09) hat genau das bestätigt:
// mehrere Tests unter src/features/lexikon/data/erklaerungen/ trugen noch
// eine eigene, fest verdrahtete Kopie von "v2" und wurden dabei auf diesen
// Helfer umgestellt.
//
// Genutzt von allen Tests unter src/features/lexikon/data/ (paradigmen*.test.ts,
// erklaerungen/de-*.test.ts), die den Cache direkt von der Platte lesen.
// scripts/build-morphologie.test.mjs (Node-ESM, andere Ökosystem-Grenze —
// kein Cross-Import von hier aus) trägt denselben Versionswert separat als
// eigene Konstante, siehe dort.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { MORPHOLOGIE_SCHEMA_VERSION } from './morphologieTypen';

/** Name des Versionsordners (z. B. "v2") — abgeleitet aus MORPHOLOGIE_SCHEMA_VERSION,
 * damit Ausliefer-URL (morphologie.ts) und lokaler Cache-Pfad nie auseinanderlaufen. */
export const MORPHOLOGIE_CACHE_VERSIONSORDNER = `v${MORPHOLOGIE_SCHEMA_VERSION}`;

/**
 * Absoluter Pfad zum Ausgabeordner der Morphologie-Pipeline, gegeben das
 * `apps/mobile`-Verzeichnis (z. B. `join(__dirname, '..', '..', '..', '..')`
 * von einer Datei unter `src/features/<bereich>/data/`). Existiert nur nach
 * einem lokalen `node scripts/build-morphologie.mjs`-Lauf — gitignored, siehe
 * Kopf-Kommentar in scripts/build-morphologie.mjs.
 */
export function morphologieCacheVerzeichnis(mobileDir: string): string {
  return path.join(mobileDir, '.daten-cache', 'out', 'morphologie', MORPHOLOGIE_CACHE_VERSIONSORDNER);
}

/**
 * true, wenn der Cache tatsächlich vorhanden UND vollständig genug ist, um
 * `roots.json` zu lesen (der Mindestbedarf jeder Korpus-Gegenprobe im Repo).
 *
 * WICHTIG für Aufrufer: liefert diese Funktion `false`, MUSS der übersprungene
 * Testblock das unmissverständlich zeigen — ein `describe.skip(...)` mit dem
 * IDENTISCHEN Namen wie im Erfolgsfall UND ohne Warnung sieht in einer
 * flüchtig gelesenen CI-Ausgabe wie eine bestandene (oder harmlos leere)
 * Suite aus. Stattdessen: (1) den Suite-Namen sichtbar mit "ÜBERSPRUNGEN"
 * kennzeichnen, (2) zusätzlich `console.warn(...)` mit einer Anleitung, wie
 * der Cache erzeugt wird (`node scripts/build-morphologie.mjs`).
 */
export function morphologieCacheVorhanden(mobileDir: string): boolean {
  const dir = morphologieCacheVerzeichnis(mobileDir);
  return existsSync(dir) && existsSync(path.join(dir, 'roots.json'));
}
