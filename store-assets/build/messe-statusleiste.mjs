#!/usr/bin/env node
// Misst in einer Roh-Aufnahme, wie hoch die Android-Statusleiste ist und wo
// der Inhalt beginnt — Grundlage fuer die Masse der vektoriellen iOS-Leiste in
// render.mjs. Kein Raten: gemeldet werden die Zeilen, in denen ueberhaupt
// Nicht-Hintergrundpixel vorkommen.
//
//   node store-assets/build/messe-statusleiste.mjs store-assets/device/ipad/de-DE/01-gebetszeiten.png
import { chromium } from 'playwright';
import fs from 'fs';

const datei = process.argv[2];
if (!datei) throw new Error('Pfad zur PNG fehlt');
const b64 = fs.readFileSync(datei).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const ergebnis = await page.evaluate(async (daten) => {
  const img = new Image();
  img.src = `data:image/png;base64,${daten}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const zeilen = [];
  const bis = Math.min(img.height, 400);
  const d = ctx.getImageData(0, 0, img.width, bis).data;
  // Referenzfarbe: linker Rand auf halber Hoehe des Messbereichs.
  const off = (x, y) => (y * img.width + x) * 4;
  for (let y = 0; y < bis; y++) {
    let abweichend = 0;
    let ersteX = -1;
    let letzteX = -1;
    const r0 = d[off(4, y)], g0 = d[off(4, y) + 1], b0 = d[off(4, y) + 2];
    for (let x = 0; x < img.width; x++) {
      const i = off(x, y);
      if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 40) {
        abweichend++;
        if (ersteX < 0) ersteX = x;
        letzteX = x;
      }
    }
    zeilen.push({ y, abweichend, ersteX, letzteX });
  }
  const belegt = zeilen.filter((z) => z.abweichend > 0);
  const luecken = [];
  let vorher = -2;
  for (const z of belegt) {
    if (z.y !== vorher + 1) luecken.push({ start: z.y, ende: z.y });
    else luecken[luecken.length - 1].ende = z.y;
    vorher = z.y;
  }
  return {
    breite: img.width,
    hoehe: img.height,
    ersteBelegteZeile: belegt[0]?.y ?? null,
    letzteBelegteImMessbereich: belegt[belegt.length - 1]?.y ?? null,
    bloecke: luecken.map((l) => [l.start, l.ende]),
    glyphenSpanne: belegt.length
      ? [Math.min(...belegt.map((z) => z.ersteX)), Math.max(...belegt.map((z) => z.letzteX))]
      : null,
  };
}, b64);
console.log(JSON.stringify(ergebnis, null, 2));
await browser.close();
