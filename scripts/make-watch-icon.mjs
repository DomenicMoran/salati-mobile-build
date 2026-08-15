#!/usr/bin/env node
// Erzeugt das App-Icon der watchOS-Companion-App: targets/salati-watch/icon.png.
//
// WARUM EIN EIGENES ICON (App-Store-Ablehnung 2026-07-27, Guideline 4 Design):
// Bis 1.33.0 hat die Uhren-App das iPhone-Icon (assets/images/icon.png)
// mitbenutzt - goldener Achtstern auf fast schwarzem Grund (#0B0B0D). watchOS
// beschneidet App-Icons zu einem Kreis und zeigt sie auf schwarzem Zifferblatt;
// mit schwarzem Icon-Hintergrund verschwimmt der Rand mit dem Zifferblatt, das
// Icon wirkt randlos statt kreisrund. Apple: "Modify the app's Apple Watch app
// icon to include a lighter background color".
//
// LOESUNG: dieselbe Bildsprache umgedreht - heller Goldverlauf als Grund,
// dunkler Achtstern als Motiv. Marke bleibt erkennbar, der Kreis ist auf
// schwarzem Zifferblatt eindeutig sichtbar.
//
// GEOMETRIE: der Achtstern ist die Vereinigung zweier identischer,
// abgerundeter Quadrate (eines um 45 Grad gedreht) - exakt aus
// assets/images/icon.png ausgemessen (Kantenlaenge 536/1024 = 52,34 % der
// Kantenlaenge, Eckradius 34/536 = 6,34 % der Quadratseite, Sternbreite damit
// 730/1024 = 71,3 %). Die Werte werden hier relativ gehalten, damit jede
// Ausgabegroesse dieselben Proportionen hat.
//
// GROESSEN: watchOS braucht als Quelle nur EIN 1024x1024-PNG. @bacons/apple-
// targets legt fuer type:"watch" ein AppIcon.appiconset mit genau einem
// universal/watchos-Eintrag (App-Icon-1024x1024@1x.png) an und Xcode leitet
// alle Geraetegroessen daraus ab - siehe node_modules/@bacons/apple-targets/
// build/icon/with-ios-icon.js -> generateWatchIconsInternalAsync().
// Zur Kontrolle schreibt dieses Skript zusaetzlich die watchOS-Rastergroessen
// nach store/graphics/watch-icon-preview/ (nur Beleg, nicht im Build genutzt).
//
// Usage: node scripts/make-watch-icon.mjs
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT = 'targets/salati-watch/icon.png';
// watchOS-Rastergroessen (Punkte x Skalierung) nur als Sichtpruefung.
const PREVIEW_DIR = 'store/graphics/watch-icon-preview';
const PREVIEW_SIZES = [1024, 216, 172, 120, 108, 100, 88, 87, 80, 66, 58, 55, 48, 44];

// Brand-Farben aus src/constants/theme.ts bzw. assets/images/icon.png.
const GOLD = '#d4af37'; // Brand.gold
const GOLD_LIGHT = '#f6dd92'; // aufgehellter Goldton fuer den Verlauf
const INK = '#12100a'; // dunkles Motiv, angelehnt an den Icon-Grund #0b0b0d

// Aus assets/images/icon.png ausgemessen: Quadratseite 536/1024 = 0,5234,
// Eckradius 34/536 = 0,0634 (siehe Kopfkommentar). Fuer die Uhr ist das
// Quadrat bewusst kleiner (0,455 statt 0,5234): der Kreisbeschnitt von watchOS
// nimmt mehr weg als die Squircle-Maske von iOS, mit 0,5234 bliebe nur ein
// ~14 % breiter Goldrand und das Icon wirkte auf 44 pt wieder randlos. Mit
// 0,455 ist der Stern 62,0 % breit (0,455 * 1,3617) und der Goldrand 19 %.
const SQUARE = 0.455; // Quadratseite / Kantenlaenge
const RADIUS = 0.0634; // Eckradius / Quadratseite

function svg(size) {
  const s = SQUARE * size;
  const r = RADIUS * s;
  const c = size / 2;
  const o = c - s / 2;
  const rect = `<rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${r}" ry="${r}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
    <radialGradient id="lift" cx="0.5" cy="0.34" r="0.72">
      <stop offset="0" stop-color="#fff" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#lift)"/>
  <g fill="${INK}">
    ${rect}
    <g transform="rotate(45 ${c} ${c})">${rect}</g>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });

async function render(size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;overflow:hidden;background:${GOLD}}svg{display:block}</style></head><body>${svg(size)}</body></html>`,
    { waitUntil: 'load' }
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`OK ${file} (${size}x${size})`);
}

await render(1024, OUT);
for (const size of PREVIEW_SIZES) {
  await render(size, path.join(PREVIEW_DIR, `watch-icon-${size}.png`));
}

await page.close();
await browser.close();
