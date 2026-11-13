import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const OUTFIT = b64(path.join(__dirname, 'fonts/Outfit.ttf'));
const FRAUNCES = b64(path.join(__dirname, 'fonts/Fraunces.ttf'));
const GEO = b64(path.join(__dirname, 'geo.svg'));
const SHOT = b64(path.join(ROOT, 'raw/de-01-home.png'));

const W = 1024, H = 500;
const COPY = {
  de: { tag: 'Gebetszeiten · Koran · Qibla · Dhikr', line: 'Dein täglicher Begleiter im Deen — werbefrei.' },
  en: { tag: 'Prayer times · Quran · Qibla · Dhikr', line: 'Your daily companion in the deen — ad-free.' },
};

function html(c) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Outfit';src:url(data:font/ttf;base64,${OUTFIT}) format('truetype');font-weight:100 900;}
@font-face{font-family:'Fraunces';src:url(data:font/ttf;base64,${FRAUNCES}) format('truetype');font-weight:100 900;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;}
html,body{width:${W}px;height:${H}px;overflow:hidden;}
body{position:relative;font-family:'Outfit';
  background:radial-gradient(80% 120% at 82% 30%,rgba(212,175,55,.26),rgba(212,175,55,0) 55%),linear-gradient(120deg,#1a140d 0%,#241c12 55%,#140f08 100%);}
.pattern{position:absolute;inset:0;opacity:.06;background-image:url(data:image/svg+xml;base64,${GEO});background-size:180px;}
.left{position:absolute;left:70px;top:0;height:100%;width:600px;display:flex;flex-direction:column;justify-content:center;}
.brand{display:flex;align-items:center;gap:16px;margin-bottom:22px;}
.brand svg{width:52px;height:52px;}
.brand .name{font-family:'Fraunces';font-weight:600;font-size:76px;color:#f4eddd;letter-spacing:-.01em;}
.tag{font-family:'Outfit';font-weight:600;font-size:27px;color:#e9c25a;letter-spacing:.02em;margin-bottom:14px;}
.line{font-family:'Outfit';font-weight:400;font-size:24px;color:rgba(240,233,216,.66);}
.phone{position:absolute;right:-30px;top:54%;transform:translateY(-50%) rotate(-8deg);height:150%;aspect-ratio:1080/2400;
  background:linear-gradient(160deg,#232019,#0a0906);border-radius:44px;padding:9px;
  box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 1.2px rgba(233,196,120,.16);}
.screen{width:100%;height:100%;border-radius:36px;background-image:url(data:image/png;base64,${SHOT});background-size:cover;background-position:top center;}
.fade{position:absolute;right:0;top:0;width:300px;height:100%;background:linear-gradient(90deg,rgba(20,15,8,0),rgba(20,15,8,.55));}
</style></head><body>
<div class="pattern"></div>
<div class="phone"><div class="screen"></div></div>
<div class="fade"></div>
<div class="left">
  <div class="brand"><svg viewBox="0 0 24 24" fill="none"><path d="M17.5 15.5A7 7 0 1 1 12.2 3a5.6 5.6 0 1 0 5.3 12.5Z" fill="#e6c86a"/><path d="M18.6 4.7l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="#e6c86a"/></svg><span class="name">Salati</span></div>
  <div class="tag">${c.tag}</div>
  <div class="line">${c.line}</div>
</div>
</body></html>`;
}

const browser = await chromium.launch();
for (const [locale, c] of Object.entries(COPY)) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html(c), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(ROOT, `feature-graphic-${locale}.png`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log('wrote', file);
}
await browser.close();
