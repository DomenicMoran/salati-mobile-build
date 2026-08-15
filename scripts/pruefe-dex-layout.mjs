#!/usr/bin/env node
// Prüft, ob die Startklassen der App in der ERSTEN DEX-Datei liegen.
//
// Hintergrund: Android öffnet beim Kaltstart die DEX-Dateien der Reihe nach.
// Liegen `MainActivity`/`MainApplication` erst in `classes3.dex`, müssen drei
// Dateien geladen werden, bevor die erste eigene Klasse gefunden ist. Genau so
// war es in der Release-APK vom 30.07.2026 — die Play-Console meldet das als
// „Klassen neu bündeln".
//
// Behoben wird es durch das Startup-Profil unter
// `android/app/src/main/baselineProfiles/startup-prof.txt`, das
// AGPs DEX-Layout-Optimierung steuert (seit AGP 8.1 verfügbar, seit 8.3 an —
// entgegen der früheren Annahme braucht es dafür KEIN AGP 9).
//
// Dieses Skript ist die Gegenprobe: es liest die gebaute APK, nicht die
// Konfiguration. Ohne Beleg ist eine solche Optimierung wertlos, weil ihr
// Ausbleiben nirgends auffällt.
//
//   node scripts/pruefe-dex-layout.mjs [pfad/zur/app-release.apk]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const APK = process.argv[2] ?? path.join(MOBILE, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

/** Klassen, die im Startpfad liegen und deshalb in classes.dex gehören. */
const ERWARTET = ['MainActivity', 'MainApplication'];

if (!existsSync(APK)) {
  console.error(`APK nicht gefunden: ${APK}`);
  process.exit(1);
}

/** Neuestes Android-Build-Tool finden (dexdump liegt versioniert). */
function werkzeug(name) {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? 'C:/Android';
  const wurzel = path.join(sdk, 'build-tools');
  if (!existsSync(wurzel)) return null;
  const versionen = readdirSync(wurzel).sort();
  for (const v of versionen.reverse()) {
    for (const endung of ['.exe', '.bat', '']) {
      const p = path.join(wurzel, v, name + endung);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const dexdump = werkzeug('dexdump');
if (!dexdump) {
  console.log('Hinweis: dexdump nicht gefunden — DEX-Anordnung ungeprüft.');
  process.exit(0);
}

const arbeit = mkdtempSync(path.join(tmpdir(), 'dexlayout-'));
try {
  // Wie viele DEX-Dateien gibt es?
  const liste = execFileSync('unzip', ['-l', APK], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const dexDateien = [...liste.matchAll(/(classes\d*\.dex)/g)].map((m) => m[1]);
  const sortiert = [...new Set(dexDateien)].sort((a, b) => {
    const n = (s) => (s === 'classes.dex' ? 1 : Number(s.replace(/\D/g, '')));
    return n(a) - n(b);
  });
  console.log(`DEX-Dateien in der APK: ${sortiert.join(', ')}`);

  const fundort = new Map();
  for (const datei of sortiert) {
    const ziel = path.join(arbeit, datei);
    writeFileSync(ziel, execFileSync('unzip', ['-p', APK, datei], { maxBuffer: 256 * 1024 * 1024 }));
    const inhalt = execFileSync(dexdump, [ziel], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    for (const klasse of ERWARTET) {
      if (!fundort.has(klasse) && inhalt.includes(klasse)) fundort.set(klasse, datei);
    }
  }

  const spaet = [];
  for (const klasse of ERWARTET) {
    const wo = fundort.get(klasse);
    if (!wo) {
      console.log(`  ${klasse}: NICHT GEFUNDEN (umbenannt? dann diese Prüfung anpassen)`);
      continue;
    }
    console.log(`  ${klasse}: ${wo}`);
    if (wo !== 'classes.dex') spaet.push(`${klasse} liegt in ${wo}`);
  }

  if (spaet.length > 0) {
    console.error(
      `\nStartklassen liegen nicht in classes.dex: ${spaet.join(', ')}.\n` +
        'Das Startup-Profil greift nicht — prüfen, ob ' +
        'android/app/src/main/baselineProfiles/startup-prof.txt vorhanden und gültig ist ' +
        '(HRF-Format, Klassennamen mit L…; und Semikolon).',
    );
    process.exit(2);
  }
  console.log('\nDEX-Anordnung in Ordnung: alle Startklassen liegen in classes.dex.');
} finally {
  rmSync(arbeit, { recursive: true, force: true });
}
