#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT =
  process.env.AUDIT_OUT != null
    ? path.join(path.resolve(process.env.AUDIT_OUT), 'screenshots')
    : path.join(ROOT, 'output/audit-20261113-khutba-live/screenshots/after');
const ADB = process.env.ADB ?? 'adb';
const DEVICE = process.env.ADB_DEVICE ?? 'emulator-5554';
const PKG = 'de.salatibox.de';
const MODE = process.env.KHUTBA_AUDIT_FLAGS ?? 'off';

const SHOTS_OFF = [
  { name: 'mobile-prayer-flags-off.png', link: 'salatibox://prayer', wait: 4000 },
  { name: 'mobile-mosque-admin-gated.png', link: 'salatibox://mosque-admin', wait: 5000 },
  { name: 'mobile-khutba-live-gated.png', link: 'salatibox://khutba-live', wait: 5000 },
  { name: 'mobile-daily-ibadah-settings.png', link: 'salatibox://daily-ibadah-settings', wait: 2500 },
];

const SHOTS_ON = [
  { name: 'mobile-mosque-admin-flags-on.png', link: 'salatibox://mosque-admin', wait: 3500 },
  { name: 'mobile-khutba-live-flags-on.png', link: 'salatibox://khutba-live', wait: 3500 },
  { name: 'mobile-expansion-hub-flags-on.png', link: 'salatibox://expansion-hub', wait: 3000 },
  { name: 'mobile-prayer-flags-on-travel.png', link: 'salatibox://prayer', wait: 4000 },
];

function adb(...args) {
  return execFileSync(ADB, ['-s', DEVICE, ...args], { encoding: MODE === 'inject' ? 'utf8' : undefined });
}

function sh(cmd) {
  return execFileSync('adb', ['-s', DEVICE, 'shell', cmd], { encoding: 'utf8' }).trim();
}

function sleep(ms) {
  execFileSync('node', ['-e', `setTimeout(()=>{}, ${ms})`]);
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

const HOST_SQLITE = process.env.HOST_SQLITE ?? 'sqlite3';

function injectExperimentalFlags(on) {
  const patch = on
    ? {
        mosqueDisplayEnabled: true,
        khutbaLiveEnabled: true,
        dailyIbadahExtrasEnabled: true,
        expansionExtrasEnabled: true,
        expansionMultiLocations: true,
        expansionQasrJam: true,
        expansionHabitTracker: true,
      }
    : {
        mosqueDisplayEnabled: false,
        khutbaLiveEnabled: false,
        dailyIbadahExtrasEnabled: false,
        expansionExtrasEnabled: false,
      };

  const settingsPatch = (base) => JSON.stringify({ ...base, ...patch });

  try {
    const raw = sh(
      `sqlite3 /data/data/${PKG}/databases/RKStorage "select value from catalystLocalStorage where key='salatibox:settings'"`,
    );
    let settings = {};
    if (raw) {
      try {
        settings = JSON.parse(raw);
      } catch {
        settings = {};
      }
    }
    const next = settingsPatch(settings);
    sh(
      `sqlite3 /data/data/${PKG}/databases/RKStorage "insert or replace into catalystLocalStorage(key,value) values('salatibox:settings','${sqlEscape(next)}')"`,
    );
    return;
  } catch {
    /* device sqlite missing — try debug run-as + host sqlite3 */
  }

  const tmpDb = path.join(ROOT, 'output/audit-20261113-khutba-live/_rkstorage-inject.db');
  fs.mkdirSync(path.dirname(tmpDb), { recursive: true });
  try {
    adb('shell', 'am', 'force-stop', PKG);
    sleep(1200);
    const dbBytes = execFileSync(ADB, ['-s', DEVICE, 'shell', 'run-as', PKG, 'cat', 'databases/RKStorage'], {
      maxBuffer: 50 * 1024 * 1024,
    });
    fs.writeFileSync(tmpDb, dbBytes);
  } catch (e) {
    throw new Error(`settings inject failed (no device sqlite, not debuggable): ${e.message}`);
  }

  let settings = {};
  try {
    const row = execFileSync(
      HOST_SQLITE,
      [
        tmpDb,
        `select value from catalystLocalStorage where key='salatibox:settings';`,
      ],
      { encoding: 'utf8' },
    ).trim();
    if (row) settings = JSON.parse(row);
  } catch {
    settings = {};
  }
  const next = sqlEscape(settingsPatch(settings));
  execFileSync(HOST_SQLITE, [
    tmpDb,
    `insert or replace into catalystLocalStorage(key,value) values('salatibox:settings','${next}');`,
  ]);
  const remote = `/data/local/tmp/_rk_${Date.now()}.db`;
  execFileSync(ADB, ['-s', DEVICE, 'push', tmpDb, remote]);
  sh(`run-as ${PKG} cp ${remote} databases/RKStorage`);
  sh(`rm ${remote}`);
}

function tapUiByTexts(textHints) {
  const dumpPath = '/sdcard/khutba-ui.xml';
  sh(`uiautomator dump ${dumpPath}`);
  const xml = sh(`cat ${dumpPath}`);
  for (const hint of textHints) {
    const re = new RegExp(
      `text="${hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      'i',
    );
    const m = xml.match(re);
    if (m) {
      const x = Math.round((Number(m[1]) + Number(m[3])) / 2);
      const y = Math.round((Number(m[2]) + Number(m[4])) / 2);
      sh(`input tap ${x} ${y}`);
      sleep(800);
      return true;
    }
  }
  return false;
}

function tapFirstSwitch() {
  const dumpPath = '/sdcard/khutba-ui.xml';
  sh(`uiautomator dump ${dumpPath}`);
  const xml = sh(`cat ${dumpPath}`);
  const m = xml.match(/class="android.widget.Switch"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!m) return false;
  const x = Math.round((Number(m[1]) + Number(m[3])) / 2);
  const y = Math.round((Number(m[2]) + Number(m[4])) / 2);
  sh(`input tap ${x} ${y}`);
  sleep(800);
  return true;
}

/** Release-APK fallback wenn weder Geräte-sqlite3 noch run-as-Injektion geht. */
function enableFlagsViaUi() {
  adb('shell', 'am', 'force-stop', PKG);
  sleep(800);
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'salatibox://mosque-admin', PKG);
  sleep(2500);
  tapUiByTexts([
    'Moschee-Display experimentell aktivieren',
    'Enable mosque display (experimental)',
  ]);
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'salatibox://daily-ibadah-settings', PKG);
  sleep(2000);
  tapUiByTexts(['Experimentell einschalten', 'Enable experimental']);
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'salatibox://khutba-live', PKG);
  sleep(2000);
  tapUiByTexts([
    'Khutba live experimentell aktivieren',
    'Enable Khutba live (experimental)',
  ]);
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'salatibox://expansion-hub', PKG);
  sleep(2000);
  tapFirstSwitch();
  adb('shell', 'am', 'force-stop', PKG);
  sleep(1000);
}

function captureShots(shots) {
  for (const s of shots) {
    adb('shell', 'am', 'force-stop', PKG);
    sleep(800);
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', s.link, PKG);
    sleep(s.wait);
    const png = adb('exec-out', 'screencap', '-p');
    const outPath = path.join(OUT, s.name);
    fs.writeFileSync(outPath, png);
    console.log('wrote', s.name, png.length, 'bytes');
  }
}

if (process.argv.includes('--inject-only')) {
  try {
    injectExperimentalFlags(true);
    console.log('injected experimental flags ON');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });

if (MODE === 'on' || MODE === 'all') {
  let flagsOn = false;
  try {
    injectExperimentalFlags(true);
    flagsOn = true;
  } catch (e) {
    console.warn('sqlite inject failed, trying UI:', e.message);
    try {
      enableFlagsViaUi();
      flagsOn = true;
    } catch (uiErr) {
      console.warn('flags-on UI enable failed:', uiErr.message);
    }
  }
  if (flagsOn) {
    adb('shell', 'am', 'force-stop', PKG);
    sleep(1500);
    captureShots(SHOTS_ON);
  }
}

if (MODE === 'off' || MODE === 'all') {
  try {
    injectExperimentalFlags(false);
  } catch {
    try {
      sh(`pm clear ${PKG}`);
      sleep(2000);
    } catch {
      /* keep prior defaults if clear blocked */
    }
  }
  adb('shell', 'am', 'force-stop', PKG);
  captureShots(SHOTS_OFF);
}

const TV_PKG = 'de.salatibox.tv';
try {
  adb('shell', 'am', 'force-stop', TV_PKG);
  adb('shell', 'monkey', '-p', TV_PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  sleep(5000);
  const tvClock = adb('exec-out', 'screencap', '-p');
  fs.writeFileSync(path.join(OUT, 'tv-clock-flags-off.png'), tvClock);
  console.log('wrote tv-clock-flags-off.png', tvClock.length, 'bytes');
} catch (e) {
  console.warn('TV screenshot skipped:', e.message);
}
