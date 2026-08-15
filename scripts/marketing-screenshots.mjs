#!/usr/bin/env node
// Landing-Page-Carousel-Shots (assets/marketing/shot-*.png) aus dem lokalen
// Web-Build neu erzeugen - Gegenstueck zu store-screenshots.mjs, aber fuer
// die 6 tatsaechlich in app/(tabs)/index.web.tsx genutzten Marketing-Bilder
// (780x1600, deviceScaleFactor 2 -> Viewport 390x800, matcht die bestehenden
// Datei-Dimensionen exakt).
import { chromium } from 'playwright';

const BASE = 'http://localhost:8085';
const OUT = 'assets/marketing';

const SHOTS = [
  { name: 'shot-prayer', path: '/prayer', wait: 2500 },
  { name: 'shot-quran', path: '/quran/1', wait: 3500 },
  { name: 'shot-study', path: '/study', wait: 2000 },
  { name: 'shot-duel', path: '/quiz/duel', wait: 2000 },
  { name: 'shot-qibla', path: '/qibla', wait: 1500 },
  { name: 'shot-calendar', path: '/calendar', wait: 2500 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 800 },
  deviceScaleFactor: 2,
  locale: 'de',
});
const page = await ctx.newPage();
for (const shot of SHOTS) {
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(shot.wait);
  const file = `${OUT}/${shot.name}.png`;
  await page.screenshot({ path: file });
  console.log('OK', file);
}
await ctx.close();
await browser.close();
