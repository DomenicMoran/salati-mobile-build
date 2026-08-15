#!/usr/bin/env node
/**
 * Erzeugt WebP-Varianten der Web-/Marketing-Bilder in den tatsächlich
 * angezeigten Größen (Performance-Audit 2026-07-27, §5.3: 0 WebP/0 AVIF im
 * Repo, Marketing-PNGs 780x1733 bei ~220 CSS-px Anzeigebreite; Lighthouse
 * Mobile: modern-image-formats 1.473 KiB + uses-responsive-images 1.594 KiB).
 *
 * Die Original-PNG/JPG bleiben liegen — sie werden für Play-/App-Store-Uploads
 * und als Quelle für dieses Skript gebraucht. Nur die Landingpage (Web) zeigt
 * auf die WebP-Varianten; `expo-image` baut aus einem Source-Array automatisch
 * ein `srcset` (responsivePolicy 'static'), der Browser wählt die Breite.
 *
 * KEIN AVIF: ohne <picture>-Element kann ein einzelnes `srcset` nur EIN Format
 * transportieren; AVIF als einziges Format schließt ältere Safari-Versionen
 * (<16) aus. WebP ist seit 2020 überall unterstützt.
 *
 * Lauf:  node scripts/optimize-web-images.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** sharp ist keine deklarierte Abhängigkeit der App (nur Build-Werkzeug) —
 *  es liegt über andere Pakete im pnpm-Store. Von dort laden statt es der
 *  App-Bundle-Größe hinzuzufügen. */
function loadSharp() {
  try {
    return require('sharp');
  } catch {
    const store = path.resolve(ROOT, '../../node_modules/.pnpm');
    const dir = fs
      .readdirSync(store)
      .filter((d) => d.startsWith('sharp@'))
      .sort()
      .pop();
    if (!dir) throw new Error('sharp nicht gefunden (weder als Dependency noch im pnpm-Store)');
    return require(path.join(store, dir, 'node_modules', 'sharp'));
  }
}

// widths = Zielbreiten in Pixeln; der erste Eintrag ist die 1x-Größe.
// Herleitung jeweils aus dem Style in src/app/(tabs)/index.web.tsx.
const JOBS = [
  // styles.shot: 220x480 CSS -> 480w deckt 2x ab, 780w (= Quellbreite) 3x/Desktop.
  ...['prayer', 'quran', 'ki', 'settings', 'qibla', 'tracker', 'names', 'tasbih', 'calendar'].map((n) => ({
    src: `assets/marketing/shot-${n}.png`,
    widths: [480, 780],
    quality: 78,
  })),
  // styles.tabletShot: 300x392 CSS (Seitenverhaeltnis 2048x2676 der Aufnahme
  // ohne Statusleiste) -> 600w deckt 2x ab, 900w Desktop/3x. Quelle sind die
  // Tablet-Aufnahmen der 1.41.0-Release-APK (store-assets/device/ipad, dort
  // gitignored — deshalb liegen die PNGs hier als nachvollziehbare Quelle).
  ...['prayer', 'settings', 'ki'].map((n) => ({
    src: `assets/marketing/tablet-${n}.png`,
    widths: [600, 900],
    quality: 78,
  })),
  // styles.tvShot: 320x180 CSS -> 640w = 2x.
  ...['clock', 'quran', 'home', 'reciters', 'quiz', 'pairing', 'settings'].map((n) => ({
    src: `assets/marketing/tv/tv-${n}.png`,
    widths: [640],
    quality: 78,
  })),
  // Hero (LCP-Element): Container maxWidth 800 CSS -> genau EINE Breite (800w).
  // Kein srcset, weil das Bild eager geladen wird: dann ignoriert der Browser
  // `sizes="auto"` und rechnet mit 100vw — auf einem breiten Desktop würde er
  // sonst die 1200w-Datei holen, obwohl der Container nie breiter als 800 ist.
  // Qualität bewusst sehr niedrig: das Foto liegt unter einem 86-%-Overlay
  // (index.web.tsx), Detailschärfe ist dort nicht sichtbar. Von 55 auf 30
  // gesenkt (LCP-Runde 2026-07-28): 104.786 B -> 64.330 B (-38,6 %). Das ist
  // die letzte verbliebene LCP-Schraube, seit das Bild als echtes <img> im
  // HTML steht — es ist dann rein bandbreitengebunden. Gemessen (Playwright,
  // Moto-G-Profil, gleicher Build): LCP 2.316 ms -> 1.572 ms.
  // Gegenprobe, dass nichts sichtbar verloren geht: Vollbild-Screenshot der
  // Landingpage hell UND dunkel, Pixelvergleich q55 vs. q30 -> mittlere
  // Abweichung 0,33 von 255 pro Kanal, Maximum 10. Noch niedriger (q25 =
  // 57.432 B) bringt nur ~40 ms und wurde daher nicht genommen.
  { src: 'assets/images/landing/landing-hero.jpg', widths: [800], quality: 30 },
  // Foto-Band: volle Breite bis 800, Höhe 240 (cover).
  { src: 'assets/images/landing/landing-band.jpg', widths: [800, 1200], quality: 62 },
  // styles.glow: 201x201 CSS -> 402w = 2x.
  { src: 'assets/images/logo-glow.png', widths: [402], quality: 80 },
];

const sharp = loadSharp();
let before = 0;
let after = 0;
const rows = [];

for (const job of JOBS) {
  const abs = path.join(ROOT, job.src);
  if (!fs.existsSync(abs)) {
    console.warn(`übersprungen (fehlt): ${job.src}`);
    continue;
  }
  const srcBytes = fs.statSync(abs).size;
  const meta = await sharp(abs).metadata();
  before += srcBytes;
  let jobAfter = 0;
  const outs = [];
  for (const width of job.widths) {
    if (width > meta.width) {
      console.warn(`  ${job.src}: Zielbreite ${width} > Quellbreite ${meta.width}, übersprungen`);
      continue;
    }
    const out = path.join(
      path.dirname(abs),
      `${path.basename(abs, path.extname(abs))}-${width}w.webp`,
    );
    await sharp(abs)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: job.quality, effort: 6 })
      .toFile(out);
    const outBytes = fs.statSync(out).size;
    jobAfter += outBytes;
    outs.push(`${path.basename(out)} ${outBytes} B`);
  }
  after += jobAfter;
  rows.push({
    src: job.src,
    from: `${meta.width}x${meta.height}`,
    srcBytes,
    outBytes: jobAfter,
    outs,
  });
}

console.log('\nDatei                                    Quelle       ->  WebP (alle Breiten)');
for (const r of rows) {
  console.log(
    `${r.src.padEnd(40)} ${String(r.srcBytes).padStart(8)} B  ->  ${String(r.outBytes).padStart(8)} B   ${r.outs.join(', ')}`,
  );
}
console.log(
  `\nSumme Quellen: ${before} B · Summe WebP: ${after} B · Ersparnis: ${before - after} B (${(((before - after) / before) * 100).toFixed(1)} %)`,
);
console.log(
  'Hinweis: die 1x-Variante allein ist das, was ein Handy lädt — siehe Spalte rechts.',
);
