#!/usr/bin/env node
// Schnelle Layout-Aufnahmen fuer die Tablet-Arbeit: EIN Geraet, EINE Sprache,
// viele Bildschirme. Kein Store-Format, keine Demo-Statusleiste — nur Belege
// fuer die Breitbild-Regeln (docs/OFFENE-PUNKTE-GESCHLOSSEN.md).
//
//   node scripts/layout-shots.mjs --device emulator-5560 --out /tmp/base --lang de-DE
//   node scripts/layout-shots.mjs --device emulator-5560 --out /tmp/dark --dark
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ADB = process.env.ADB ?? 'C:/Android/platform-tools/adb.exe';
const PKG = 'de.salatibox.de';

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const DEVICE = arg('--device');
const OUT = arg('--out', 'layout-shots');
const LANG = arg('--lang', 'de-DE');
const DARK = argv.includes('--dark');
const RESET = argv.includes('--reset');
const NUR = arg('--nur');
if (!DEVICE) throw new Error('--device fehlt');

const SHOTS = [
  { name: '01-home', link: 'salatibox://', wait: 9000 },
  { name: '02-mehr', link: 'salatibox://more', wait: 3500 },
  { name: '03-einstellungen', link: 'salatibox://settings', wait: 3500 },
  { name: '04-lernen', link: 'salatibox://lernen', wait: 3500 },
  { name: '05-koran-liste', link: 'salatibox://quran', wait: 4000 },
  { name: '06-koran-sure', link: 'salatibox://quran/1', wait: 7000 },
  { name: '07-tracker', link: 'salatibox://tracker', wait: 3500 },
  { name: '08-kalender', link: 'salatibox://calendar', wait: 5000 },
  { name: '09-duas', link: 'salatibox://duas', wait: 3000 },
  { name: '10-qibla', link: 'salatibox://qibla', wait: 6000 },
  { name: '11-namen', link: 'salatibox://names', wait: 3500 },
  { name: '12-guides', link: 'salatibox://guides', wait: 3000 },
  { name: '13-hadith', link: 'salatibox://hadith', wait: 3500 },
  { name: '14-tasbih', link: 'salatibox://tasbih', wait: 3000 },
  { name: '15-medien', link: 'salatibox://media', wait: 3500 },
  { name: '16-study', link: 'salatibox://study', wait: 3500 },
  { name: '17-ki', link: 'salatibox://ki-native', wait: 4000 },
  { name: '18-suche', link: 'salatibox://search', wait: 3000 },
];

function adb(...a) {
  let letzter;
  for (let v = 0; v < 3; v++) {
    try { return execFileSync(ADB, ['-s', DEVICE, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
    catch (e) { letzter = e; try { execFileSync(ADB, ['-s', DEVICE, 'wait-for-device'], { encoding: 'utf8' }); } catch { /* ignorieren */ } }
  }
  throw letzter;
}
const sh = (c) => adb('shell', c);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
try { adb('root'); } catch { /* schon root */ }
sh('settings put global window_animation_scale 0');
sh('settings put global transition_animation_scale 0');
sh('settings put global animator_duration_scale 0');
sh(`cmd uimode night ${DARK ? 'yes' : 'no'}`);

if (RESET) {
  sh(`pm clear ${PKG}`);
  sh(`cmd locale set-app-locales ${PKG} --locales ${LANG}`);
  for (const p of ['POST_NOTIFICATIONS', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
    try { sh(`pm grant ${PKG} android.permission.${p}`); } catch { /* egal */ }
  }
  try { adb('emu', 'geo', 'fix', '13.405', '52.52'); } catch { /* egal */ }
  sh(`am start -n ${PKG}/.MainActivity`);
  await sleep(15000);
  sh(`am force-stop ${PKG}`);
  await sleep(1500);
  sh(`sqlite3 /data/data/${PKG}/databases/RKStorage "insert or replace into catalystLocalStorage(key,value) values('salatibox:onboarding-done','1')"`);
}
sh(`am force-stop ${PKG}`);
sh(`am start -n ${PKG}/.MainActivity`);
await sleep(9000);

for (const s of SHOTS) {
  if (NUR && !s.name.includes(NUR)) continue;
  sh(`am start -a android.intent.action.VIEW -d "${s.link}"`);
  await sleep(s.wait);
  sh('screencap -p /sdcard/shot.png');
  adb('pull', '/sdcard/shot.png', path.join(OUT, `${s.name}.png`));
  console.log(`  ${s.name}`);
}
console.log(`fertig -> ${OUT}`);
