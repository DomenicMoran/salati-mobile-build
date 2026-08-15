import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SLIDES, CANVASES, RAW_LOCALE } from './slides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// Roh-Aufnahmen: echte Geraete-Screenshots (1080x2400) aus
// scripts/device-screenshots.mjs statt der alten, handgesammelten raw/-Ablage.
const RAW_WURZEL = path.join(ROOT, 'device');
const OUT = path.join(ROOT, 'out');

const b64 = (p) => fs.readFileSync(p).toString('base64');
const OUTFIT = b64(path.join(__dirname, 'fonts/Outfit.ttf'));
const FRAUNCES = b64(path.join(__dirname, 'fonts/Fraunces.ttf'));
const GEO = b64(path.join(__dirname, 'geo.svg'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// {Wort} -> <span class=hl>Wort</span>
const headHtml = (h) => esc(h).replace(/\{([^}]+)\}/g, '<span class="hl">$1</span>');

// --- iOS-Statusleiste ------------------------------------------------------
// App-Store-Ablehnung 2026-07-27 (1.33.0, Guideline 2.3.10 Accurate Metadata):
// "Revise the app's screenshots to remove non-iOS status bar images." Die
// Roh-Aufnahmen in store-assets/raw/ stammen von einem Android-Geraet und
// zeigen oben die Android-Statusleiste (Roboto-Uhrzeit, WLAN-Kegel,
// Dreiecks-Signal, Rechteck-Akku) - im App Store nicht erlaubt.
//
// Statt die PNGs nachtraeglich zu retuschieren wird die Leiste hier beim
// Rendern ueberzeichnet: der Bereich y 0..120 ist in ALLEN Roh-Aufnahmen eine
// einfarbige Flaeche #f7f3ea (App-Inhalt beginnt fruehestens bei y=185,
// Android-Glyphen liegen bei y 47..79) - eine deckende Flaeche in genau dieser
// Farbe erzeugt daher keine sichtbare Kante, und darauf liegt eine saubere,
// vektorielle iOS-Statusleiste. Kein Weichzeichnen, kein Stempeln, keine
// Aenderung der Bildmasse.
//
// Alle Koordinaten in Roh-Pixeln (Aufnahme 1080x2400); das SVG skaliert per
// width:100% exakt mit der Telefon-Attrappe mit.
// Der Streifen ist NICHT in allen Screens gleich eingefaerbt (die
// Einstellungen laufen auf einem dunkleren Sandton). Die Fuellfarbe wird
// deshalb je Aufnahme aus dem Bild selbst gelesen (siehe hintergrundFarbe()),
// statt fest verdrahtet zu sein — sonst entsteht dort eine sichtbare Kante.
// Masse je Geraeteklasse — ausgemessen mit store-assets/build/messe-statusleiste.mjs
// an den echten Aufnahmen:
//   Telefon 1080x2400: Android-Glyphen y 47..79, erster Inhalt ab y=191
//   Tablet  2048x2732: Android-Glyphen y 11..36, erster Inhalt ab y=90
//                      (gemessen ueber alle 16 Aufnahmen, engster Fall)
// Der ueberzeichnete Streifen muss also unter dem ersten Inhalt bleiben und
// ueber den Glyphen liegen. `probeY` ist die Zeile, aus der die Fuellfarbe
// gelesen wird (unter der Leiste, ueber dem Inhalt, am linken Rand).
const SB_GERAET = {
  phone: { ref: 1080, h: 120, probeY: 130 },
  // iPad: die iOS-Statusleiste ist 24 pt hoch (bei 2x = 96 px inkl. Rand),
  // ohne Notch, mit Uhrzeit links und WLAN/Akku rechts — und OHNE
  // Mobilfunk-Balken, weil der Screenshot-Referenzgeraet ein WiFi-iPad ist.
  ipad: { ref: 2048, h: 84, probeY: 60 },
};

/**
 * Vektorielle iOS-Statusleiste ueber der Android-Leiste der Roh-Aufnahme.
 * `geraet` waehlt die Zeichnung: 'phone' (iPhone, Notch-Layout mit
 * Mobilfunk-Balken) oder 'ipad' (flache Leiste ueber die volle Breite).
 */
const iosStatusBar = (SB_BG, SB_INK, geraet = 'phone') => {
  const { ref, h } = SB_GERAET[geraet] ?? SB_GERAET.phone;
  if (geraet === 'ipad') {
    // Masse in Aufnahme-Pixeln (2048 breit, 2x): Uhrzeit linksbuendig auf dem
    // Textrand der App (x=60), Glyphen rechts bis x=1988 — dieselbe Flucht,
    // die die Android-Leiste hatte (gemessen: x 35..1991).
    const mitte = 42; // vertikale Mitte der 24-pt-Leiste in Aufnahme-Pixeln
    return `<svg class="sbar" viewBox="0 0 ${ref} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${ref}" height="${h}" fill="${SB_BG}"/>
  <text x="60" y="${mitte + 11}" fill="${SB_INK}" font-family="-apple-system,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="600" font-size="31" letter-spacing="0.3">9:41</text>
  <g fill="none" stroke="${SB_INK}" stroke-width="5" stroke-linecap="round">
    <path d="M1856 ${mitte - 6}a22 22 0 0 1 30 0"/>
    <path d="M1862 ${mitte + 0.5}a13 13 0 0 1 18 0"/>
  </g>
  <circle cx="1871" cy="${mitte + 6}" r="3.4" fill="${SB_INK}"/>
  <rect x="1918" y="${mitte - 10}" width="60" height="20" rx="6.5" fill="none" stroke="${SB_INK}" stroke-opacity="0.38" stroke-width="2.4"/>
  <rect x="1921.5" y="${mitte - 6.5}" width="43" height="13" rx="3.5" fill="${SB_INK}"/>
  <path d="M1982 ${mitte - 4.5}a4.5 4.5 0 0 1 0 9z" fill="${SB_INK}" fill-opacity="0.38"/>
</svg>`;
  }
  // Position der urspruenglichen Glyphen: x 83..1004, y 47..79 (ausgemessen) -
  // die iOS-Leiste uebernimmt diese Raender, damit die Optik unveraendert wirkt.
  const bars = [11, 17, 23, 30]
    .map((bh, i) => `<rect x="${829 + i * 12}" y="${78 - bh}" width="8" height="${bh}" rx="2.5"/>`)
    .join('');
  return `<svg class="sbar" viewBox="0 0 ${ref} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${ref}" height="${h}" fill="${SB_BG}"/>
  <text x="83" y="80" fill="${SB_INK}" font-family="-apple-system,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="600" font-size="42" letter-spacing="0.4">9:41</text>
  <g fill="${SB_INK}">${bars}</g>
  <g fill="none" stroke="${SB_INK}" stroke-width="7" stroke-linecap="round">
    <path d="M886 60.5a30 30 0 0 1 41 0"/>
    <path d="M894.5 69a18 18 0 0 1 24 0"/>
  </g>
  <circle cx="906.5" cy="75" r="4.6" fill="${SB_INK}"/>
  <rect x="942.5" y="49.5" width="54" height="27" rx="8.5" fill="none" stroke="${SB_INK}" stroke-opacity="0.38" stroke-width="3"/>
  <rect x="947" y="54" width="38" height="18" rx="5" fill="${SB_INK}"/>
  <path d="M1000.5 57.5a6 6 0 0 1 0 11z" fill="${SB_INK}" fill-opacity="0.38"/>
</svg>`;
};

/** Hintergrundfarbe des Statusleisten-Streifens direkt aus der Aufnahme lesen. */
async function hintergrundFarbe(page, b64, geraet = 'phone') {
  const probeY = (SB_GERAET[geraet] ?? SB_GERAET.phone).probeY;
  return page.evaluate(async ({ daten, y }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${daten}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    // Die Probezeile liegt unter der Android-Leiste und ueber dem ersten
    // Inhaltselement aller acht Motive; x=12 ist der linke Rand, dort steht
    // nie Inhalt.
    const [r, g, b] = c.getContext('2d').getImageData(12, y, 1, 1).data;
    const hex = (n) => n.toString(16).padStart(2, '0');
    const luminanz = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return { bg: `#${hex(r)}${hex(g)}${hex(b)}`, ink: luminanz > 0.5 ? '#0f1113' : '#f4eddd' };
  }, { daten: b64, y: probeY });
}

function html({ w, h, headline, sub, shotB64, statusBar, sbBg, sbInk, geraet = 'phone', shotW, shotH }) {
  const S = (v) => (v * h) / 1920; // vertikal skaliert auf Referenzhoehe 1920
  const W = (v) => (v * w) / 1080; // horizontal skaliert auf Referenzbreite 1080
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Outfit';src:url(data:font/ttf;base64,${OUTFIT}) format('truetype');font-weight:100 900;}
@font-face{font-family:'Fraunces';src:url(data:font/ttf;base64,${FRAUNCES}) format('truetype');font-weight:100 900;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
html,body{width:${w}px;height:${h}px;overflow:hidden;}
body{position:relative;font-family:'Outfit',sans-serif;
  background:
    radial-gradient(130% 70% at 50% 16%, rgba(212,175,55,.22), rgba(212,175,55,0) 58%),
    radial-gradient(90% 50% at 50% 100%, rgba(212,175,55,.10), rgba(212,175,55,0) 60%),
    linear-gradient(176deg,#1c1710 0%,#251d12 44%,#171109 100%);}
.pattern{position:absolute;inset:0;opacity:.05;background-image:url(data:image/svg+xml;base64,${GEO});background-size:${W(300)}px;}
.vignette{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 42%,rgba(0,0,0,0) 55%,rgba(0,0,0,.34) 100%);}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:${S(96)}px ${W(92)}px 0;}
.brand{display:flex;align-items:center;gap:${W(14)}px;margin-bottom:${S(50)}px;}
.brand svg{width:${W(30)}px;height:${W(30)}px;display:block;}
.brand .name{font-family:'Outfit';font-weight:600;letter-spacing:.42em;color:#e6c86a;font-size:${W(29)}px;text-transform:uppercase;padding-left:.42em;}
.headline{font-family:'Fraunces';font-weight:600;color:#f4eddd;text-align:center;font-size:${W(86)}px;line-height:1.05;letter-spacing:-.012em;font-optical-sizing:auto;}
.headline .hl{color:#e9c25a;font-style:italic;padding:0 .06em;}
.sub{font-family:'Outfit';font-weight:400;color:rgba(240,233,216,.64);text-align:center;font-size:${W(37)}px;margin-top:${S(30)}px;line-height:1.42;max-width:${W(860)}px;}
.stage{flex:1;width:100%;min-height:0;display:flex;justify-content:center;align-items:flex-end;margin-top:${S(56)}px;}
.glow{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:${W(760)}px;height:${W(760)}px;background:radial-gradient(circle,rgba(212,175,55,.22),rgba(212,175,55,0) 62%);filter:blur(${W(20)}px);}
.phone{position:relative;height:98%;aspect-ratio:${shotW}/${shotH};background:linear-gradient(160deg,#232019,#0a0906);border-radius:${W(62)}px;padding:${W(13)}px;
  box-shadow:0 ${S(34)}px ${S(70)}px rgba(0,0,0,.55),0 ${S(4)}px ${S(12)}px rgba(0,0,0,.4),0 0 0 1.5px rgba(233,196,120,.14),inset 0 0 0 1px rgba(0,0,0,.6);}
.screen{position:relative;width:100%;height:100%;border-radius:${W(50)}px;overflow:hidden;background-image:url(data:image/png;base64,${shotB64});background-size:cover;background-position:top center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);}
.sbar{position:absolute;left:0;top:0;width:100%;height:auto;display:block;}
</style></head><body>
<div class="pattern"></div><div class="vignette"></div>
<div class="wrap">
  <div class="brand">
    <svg viewBox="0 0 24 24" fill="none"><path d="M17.5 15.5A7 7 0 1 1 12.2 3a5.6 5.6 0 1 0 5.3 12.5Z" fill="#e6c86a"/><path d="M18.6 4.7l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="#e6c86a"/></svg>
    <span class="name">Salati</span>
  </div>
  <div class="headline">${headHtml(headline)}</div>
  <div class="sub">${esc(sub)}</div>
  <div class="stage"><div class="glow"></div><div class="phone"><div class="screen">${statusBar === 'ios' ? iosStatusBar(sbBg, sbInk, geraet) : ''}</div></div></div>
</div>
</body></html>`;
}

// Optional: nur einen Store rendern (z.B. `node render.mjs appstore`), damit
// eine Korrektur an einem Store die PNGs des anderen nicht unnoetig neu
// schreibt.
const only = process.argv[2];
if (only && !CANVASES[only]) {
  throw new Error(`Unbekannter Store "${only}" - erlaubt: ${Object.keys(CANVASES).join(', ')}`);
}

const browser = await chromium.launch();
let count = 0;
for (const [store, canvas] of Object.entries(CANVASES)) {
  if (only && store !== only) continue;
  for (const [locale, slides] of Object.entries(SLIDES)) {
    const dir = path.join(OUT, store, locale);
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: canvas.w, height: canvas.h }, deviceScaleFactor: 1 });
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const geraet = canvas.geraet ?? 'phone';
      const shotPath = path.join(RAW_WURZEL, geraet, RAW_LOCALE[locale], `${s.shot}.png`);
      const shotB64 = b64(shotPath);
      const { bg, ink } = await hintergrundFarbe(page, shotB64, geraet);
      const content = html({
        w: canvas.w,
        h: canvas.h,
        headline: s.head,
        sub: s.sub,
        shotB64,
        statusBar: canvas.statusBar,
        sbBg: bg,
        sbInk: ink,
        geraet,
        shotW: SB_GERAET[geraet].ref,
        shotH: canvas.shotH,
      });
      await page.setContent(content, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${s.shot}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: canvas.w, height: canvas.h } });
      count++;
    }
    await page.close();
    console.log(`done ${store}/${locale} (${slides.length} slides)`);
  }
}
await browser.close();
console.log(`TOTAL ${count} screenshots rendered`);
