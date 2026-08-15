#!/usr/bin/env node
// Wear-OS-Store-Screenshots aus dem ECHTEN Uhr-Modul (android/wear), aufgenommen
// auf einem Wear-Emulator. Keine Montage, keine Bildgenerierung — nur
// `adb screencap` der laufenden App.
//
// Voraussetzungen:
//   - Wear-AVD laeuft (z. B. `emulator -avd salati_wear`), `adb root` moeglich
//     (Systemimage-Tag `android-wear`, kein Play-Store-Image)
//   - android/wear/build/outputs/apk/release/wear-release.apk ist installiert
//     oder wird von diesem Skript installiert (--install)
//
// Die Uhr zeigt ohne Telefon nur den Leerzustand. Deshalb wird der lokale
// Stand (SharedPreferences `salati_wear_prefs`, siehe PrayerData.kt) mit ECHTEN
// Gebetszeiten befuellt — abgerufen bei derselben AlAdhan-API und mit denselben
// Parametern (Methode 13/Diyanet, school 0), die die Telefon-App nutzt.
//
// Sprache: `cmd locale set-app-locales` (Android 13+) setzt die App-Sprache
// ohne Neustart des Systems; die Uhr-App hat Strings fuer alle 13 Play-Sprachen
// (android/wear/src/main/res/values-*/strings.xml).
//
// Usage:
//   node scripts/wear-screenshots.mjs [--install] [--device emulator-5554] [locale ...]
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ADB = process.env.ADB ?? 'C:/Android/platform-tools/adb.exe';
const PKG = 'de.salatibox.de.wear';
const APK = 'android/wear/build/outputs/apk/release/wear-release.apk';
const OUT = 'store-assets/wear';

// Play-Sprachcode -> BCP47 fuer `cmd locale set-app-locales`.
const LOCALES = {
  'de-DE': 'de-DE', 'en-US': 'en-US', 'tr-TR': 'tr-TR', ar: 'ar', 'es-ES': 'es-ES',
  'fr-FR': 'fr-FR', 'bn-BD': 'bn-BD', fa: 'fa', id: 'id', ms: 'ms', 'ru-RU': 'ru-RU',
  sw: 'sw', ur: 'ur',
};
// Ortsname so, wie ihn die Telefon-App in dieser Sprache anzeigt (Geocoder
// liefert lokalisierte Namen). Land ueber Intl.DisplayNames, Stadt in der
// jeweiligen Schrift.
const CITY = {
  ar: 'برلين', fa: 'برلین', ur: 'برلن', 'bn-BD': 'বার্লিন', 'ru-RU': 'Берлин',
};

const args = process.argv.slice(2);
const INSTALL = args.includes('--install');
const devIdx = args.indexOf('--device');
const DEVICE = devIdx >= 0 ? args[devIdx + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--device');

const adb = (...a) =>
  execFileSync(ADB, [...(DEVICE ? ['-s', DEVICE] : []), ...a], { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Gebetszeiten fuer heute + morgen, exakt wie features/prayer-times/api.ts sie holt. */
async function timings(lat, lon, date) {
  const d = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timings/${d}?latitude=${lat}&longitude=${lon}&method=13&school=0&latitudeAdjustmentMethod=3`;
  const r = await (await fetch(url)).json();
  const t = r.data.timings;
  const cut = (v) => v.split(' ')[0];
  return { Fajr: cut(t.Fajr), Dhuhr: cut(t.Dhuhr), Asr: cut(t.Asr), Maghrib: cut(t.Maghrib), Isha: cut(t.Isha) };
}

function qibla(lat, lon) {
  const rad = (x) => (x * Math.PI) / 180;
  const deg = (x) => (x * 180) / Math.PI;
  const kLat = 21.4225, kLon = 39.8262;
  const dLon = rad(kLon - lon);
  const y = Math.sin(dLon) * Math.cos(rad(kLat));
  const x = Math.cos(rad(lat)) * Math.sin(rad(kLat)) - Math.sin(rad(lat)) * Math.cos(rad(kLat)) * Math.cos(dLon);
  const a = Math.sin(rad(kLat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(kLat)) * Math.sin(dLon / 2) ** 2;
  return {
    qiblaBearing: Number((((deg(Math.atan2(y, x)) + 360) % 360)).toFixed(1)),
    qiblaDistanceKm: Math.round(2 * 6371 * Math.asin(Math.sqrt(a))),
  };
}

const LAT = 52.52, LON = 13.405;
const today = await timings(LAT, LON, new Date());
const tomorrow = await timings(LAT, LON, new Date(Date.now() + 86_400_000));
const q = qibla(LAT, LON);

if (INSTALL) {
  console.log(adb('install', '-r', '-t', APK).trim());
}
adb('root');
adb('shell', 'settings', 'put', 'system', 'time_12_24', '24');
adb('shell', 'setprop', 'persist.sys.timezone', 'Europe/Berlin');
// Datenverzeichnis anlegen lassen (erster Start), damit shared_prefs existiert.
adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
await sleep(4000);
adb('shell', 'am', 'force-stop', PKG);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const tmp = path.join(process.cwd(), '.wear-prefs.xml');

for (const play of only.length ? only : Object.keys(LOCALES)) {
  const tag = LOCALES[play];
  if (!tag) throw new Error(`Unbekannte Sprache ${play}`);
  const lang = tag.split('-')[0];
  const country = new Intl.DisplayNames([tag], { type: 'region' }).of('DE');
  // RTL-Sprachen nutzen das arabische Komma; das lateinische Komma landet in
  // der RTL-Anzeige sonst optisch am falschen Ende der Zeile.
  const komma = ['ar', 'fa', 'ur'].includes(lang) ? '،' : ',';
  const label = `${CITY[play] ?? 'Berlin'}${komma} ${country}`;
  const payload = JSON.stringify({ locationLabel: label, today, tomorrow, timeFormat: '24h', ...q });

  fs.writeFileSync(
    tmp,
    `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n` +
      `    <long name="payload_updated_at" value="${Date.now()}" />\n` +
      `    <string name="payload_json">${esc(payload)}</string>\n</map>\n`,
  );
  adb('push', tmp, '/data/local/tmp/wear_prefs.xml');
  adb('shell', `cp /data/local/tmp/wear_prefs.xml /data/data/${PKG}/shared_prefs/salati_wear_prefs.xml && chown $(stat -c %U:%G /data/data/${PKG}) /data/data/${PKG}/shared_prefs/salati_wear_prefs.xml`);
  adb('shell', 'cmd', 'locale', 'set-app-locales', PKG, '--locales', tag);
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(5000);

  const dir = path.join(OUT, play);
  fs.mkdirSync(dir, { recursive: true });
  const shot = async (name) => {
    adb('shell', 'screencap', '-p', '/sdcard/wear.png');
    adb('pull', '/sdcard/wear.png', path.join(dir, name));
  };
  // 1) Naechstes Gebet
  await shot('01-naechstes-gebet.png');
  // 2) Tagesliste
  for (let i = 0; i < 2; i++) { adb('shell', 'input', 'swipe', '192', '300', '192', '90', '400'); await sleep(900); }
  await sleep(900);
  await shot('02-tagesliste.png');
  // 3) Qibla
  for (let i = 0; i < 2; i++) { adb('shell', 'input', 'swipe', '192', '300', '192', '90', '400'); await sleep(900); }
  await sleep(900);
  adb('shell', 'input', 'tap', '192', '146');
  await sleep(2500);
  await shot('03-qibla.png');

  console.log(`OK ${play} (${lang}) — ${label}`);
}
fs.rmSync(tmp, { force: true });
console.log('fertig');
