#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'output/audit-20261113-khutba-live/loop3/screenshots');
const DEVICE = 'emulator-5554';
const PKG = 'de.salatibox.de';
const SHOTS = [
  { name: 'mobile-prayer-flags-off.png', link: 'salatibox://prayer', wait: 6000 },
  { name: 'mobile-mosque-admin-gated.png', link: 'salatibox://mosque-admin', wait: 6000 },
  { name: 'mobile-khutba-live-gated.png', link: 'salatibox://khutba-live', wait: 6000 },
];

function adb(...args) {
  return execFileSync('adb', ['-s', DEVICE, ...args], {
    encoding: args[0] === 'exec-out' ? undefined : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function sleep(ms) {
  execFileSync('node', ['-e', `setTimeout(()=>{}, ${ms})`]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const s of SHOTS) {
  adb('shell', 'am', 'force-stop', PKG);
  sleep(800);
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', s.link, PKG);
  sleep(s.wait);
  const png = adb('exec-out', 'screencap', '-p');
  const p = path.join(OUT, s.name);
  fs.writeFileSync(p, png);
  console.log('wrote', s.name, png.length);
}
