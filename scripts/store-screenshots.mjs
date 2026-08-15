#!/usr/bin/env node
// Store-Screenshots (Play + App Store) aus dem lokalen Web-Build.
// Phone: 430x932 CSS @3x = 1290x2796 (exakt Apple 6.7"-Format, Play-tauglich).
// Tablet: 1024x1366 @2x = 2048x2732 (iPad Pro 12.9", Play-Tablet-tauglich).
// Usage: node scripts/store-screenshots.mjs <lang>   (Sprache via localStorage)
import fs from 'fs';
import { chromium } from 'playwright';

const LANG = process.argv[2] ?? 'de';
const BASE = 'http://localhost:8085';
const OUT = `store/screenshots/${LANG}`;
fs.mkdirSync(`${OUT}/phone`, { recursive: true });
fs.mkdirSync(`${OUT}/tablet`, { recursive: true });

// Reihenfolge = Story im Store: Gebet -> Koran -> Lernen -> Qibla -> Duas -> Kalender
const SHOTS = [
  { name: '01-gebetszeiten', path: '/prayer', wait: 2500 },
  { name: '02-koran', path: '/quran/1', wait: 3500 },
  { name: '03-studium', path: '/study', wait: 2000 },
  { name: '04-qibla', path: '/qibla', wait: 1500 },
  { name: '05-duas', path: '/duas', wait: 1500 },
  { name: '06-kalender', path: '/calendar', wait: 2500 },
];

const DEVICES = [
  { kind: 'phone', width: 430, height: 932, dsf: 3 },
  { kind: 'tablet', width: 1024, height: 1366, dsf: 2 },
];

const browser = await chromium.launch();
for (const dev of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.dsf,
    locale: LANG,
  });
  const page = await ctx.newPage();
  // Sprache vor App-Start setzen (Settings-Store liest AsyncStorage/localStorage).
  await page.addInitScript((lang) => {
    const KEY = 'salatibox:settings';
    const existing = window.localStorage.getItem(KEY);
    const settings = existing ? JSON.parse(existing) : {};
    settings.language = lang;
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  }, LANG);
  for (const shot of SHOTS) {
    await page.goto(BASE + shot.path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(shot.wait);
    const file = `${OUT}/${dev.kind}/${shot.name}.png`;
    await page.screenshot({ path: file });
    console.log('OK', file);
  }
  await ctx.close();
}
await browser.close();
