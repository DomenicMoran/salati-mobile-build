import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const G = path.join(__dirname, 'gallery');
const ROOT = path.resolve(__dirname, '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const img = (p) => `data:image/png;base64,${b64(p)}`;
const OUTFIT = b64(path.join(__dirname, 'fonts/Outfit.ttf'));
const FRAUNCES = b64(path.join(__dirname, 'fonts/Fraunces.ttf'));
const VIDEO = `data:video/mp4;base64,${b64(path.join(G, 'promo.mp4'))}`;

const de = Array.from({ length: 7 }, (_, i) => img(path.join(G, `de-${i + 1}.png`)));
const en = Array.from({ length: 7 }, (_, i) => img(path.join(G, `en-${i + 1}.png`)));
const feat = img(path.join(G, 'feat-de.png'));

const CAP_DE = ['Gebetszeiten', 'Koran', 'Qibla', 'Gebets-Tracker', '99 Namen', 'Tasbih', 'Kalender'];
const CAP_EN = ['Prayer times', 'Quran', 'Qibla', 'Tracker', '99 Names', 'Tasbih', 'Calendar'];

const grid = (arr, caps) => arr.map((s, i) => `
  <figure class="shot">
    <img src="${s}" alt="${caps[i]}" loading="lazy" />
    <figcaption>${caps[i]}</figcaption>
  </figure>`).join('');

const html = `<title>Salati — Store-Auftritt</title>
<style>
@font-face{font-family:'Outfit';src:url(data:font/ttf;base64,${OUTFIT}) format('truetype');font-weight:100 900;font-display:swap;}
@font-face{font-family:'Fraunces';src:url(data:font/ttf;base64,${FRAUNCES}) format('truetype');font-weight:100 900;font-display:swap;}
:root{
  --ink:#15110b; --paper:#f5efe1; --card:#ffffff; --line:rgba(30,24,14,.12);
  --text:#241d12; --muted:#7c7263; --gold:#a9861a; --gold-bright:#c9a227;
  --ground:var(--paper); --panel:#efe7d4; --shadow:rgba(40,30,10,.16);
}
@media (prefers-color-scheme:dark){:root{
  --ground:#15110b; --card:#211a11; --panel:#1c160e; --text:#f2ead9; --muted:#a99b83;
  --line:rgba(233,196,120,.14); --gold:#e6c86a; --gold-bright:#e6c86a; --shadow:rgba(0,0,0,.5);
}}
:root[data-theme="light"]{--ground:var(--paper);--card:#fff;--panel:#efe7d4;--text:#241d12;--muted:#7c7263;--line:rgba(30,24,14,.12);--gold:#a9861a;--gold-bright:#c9a227;--shadow:rgba(40,30,10,.16);}
:root[data-theme="dark"]{--ground:#15110b;--card:#211a11;--panel:#1c160e;--text:#f2ead9;--muted:#a99b83;--line:rgba(233,196,120,.14);--gold:#e6c86a;--gold-bright:#e6c86a;--shadow:rgba(0,0,0,.5);}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--ground);color:var(--text);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;
  background-image:radial-gradient(70% 45% at 50% -5%, rgba(201,162,39,.10), transparent 60%);}
.wrap{max-width:1120px;margin:0 auto;padding:clamp(28px,5vw,72px) clamp(18px,4vw,40px) 80px;}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:26px;}
.brand svg{width:34px;height:34px;}
.brand .name{font-family:'Fraunces';font-weight:600;font-size:30px;letter-spacing:-.01em;}
h1{font-family:'Fraunces';font-weight:600;font-size:clamp(34px,6vw,60px);line-height:1.04;letter-spacing:-.015em;text-wrap:balance;margin:14px 0 16px;}
h1 em{color:var(--gold-bright);font-style:italic;}
.lede{font-size:clamp(16px,2vw,19px);color:var(--muted);max-width:60ch;}
.meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;}
.chip{font-size:13px;font-weight:500;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:7px 14px;}
.chip b{color:var(--gold);font-weight:700;}
section{margin-top:clamp(44px,6vw,72px);}
.head{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:26px;}
.head h2{font-family:'Fraunces';font-weight:600;font-size:clamp(22px,3vw,30px);letter-spacing:-.01em;}
.head .tag{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-left:auto;}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:clamp(14px,2vw,26px);}
.shot{display:flex;flex-direction:column;align-items:center;gap:12px;}
.shot img{width:100%;border-radius:18px;box-shadow:0 18px 40px var(--shadow);display:block;}
.shot figcaption{font-size:13px;font-weight:500;color:var(--muted);letter-spacing:.01em;}
.feature img{width:100%;border-radius:16px;box-shadow:0 20px 46px var(--shadow);display:block;}
.split{display:grid;grid-template-columns:1fr;gap:34px;align-items:center;}
@media(min-width:760px){.split{grid-template-columns:300px 1fr;}}
.video-wrap{display:flex;justify-content:center;}
.video-wrap video{width:270px;border-radius:26px;box-shadow:0 24px 54px var(--shadow);background:#000;}
.copy-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:clamp(20px,3vw,32px);display:grid;gap:22px;}
.copy-row{display:grid;gap:6px;}
.copy-row .k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);}
.copy-row .v{font-family:'Fraunces';font-size:clamp(17px,2.2vw,21px);font-weight:500;}
.copy-row .s{font-size:15px;color:var(--muted);}
.two{display:grid;grid-template-columns:1fr;gap:22px;}
@media(min-width:680px){.two{grid-template-columns:1fr 1fr;}}
.note{margin-top:14px;font-size:14px;color:var(--muted);}
.note code{font-family:'Outfit';background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:2px 7px;font-size:13px;color:var(--text);}
footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);}
</style>

<div class="wrap">
  <header>
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none"><path d="M17.5 15.5A7 7 0 1 1 12.2 3a5.6 5.6 0 1 0 5.3 12.5Z" fill="var(--gold-bright)"/><path d="M18.6 4.7l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="var(--gold-bright)"/></svg>
      <span class="name">Salati</span>
    </div>
    <div class="eyebrow">Store-Auftritt · Play Store · App Store · Web</div>
    <h1>Ein Auftritt, der <em>überzeugt</em>.</h1>
    <p class="lede">Alle Store-Assets aus der echten App gerendert — Premium-Screenshots, Feature-Graphic, Promo-Video und geprüfte Texte. Deutsch und Englisch, fertig zum Hochladen.</p>
    <div class="meta">
      <span class="chip"><b>28</b>&nbsp; Screenshots (Play + App Store, DE + EN)</span>
      <span class="chip"><b>2</b>&nbsp; Feature-Graphics</span>
      <span class="chip"><b>1</b>&nbsp; Promo-Video</span>
      <span class="chip"><b>4</b>&nbsp; Store-Texte (limit-geprüft)</span>
    </div>
  </header>

  <section>
    <div class="head"><h2>Google Play — Deutsch</h2><span class="tag">1080 × 1920</span></div>
    <div class="shots">${grid(de, CAP_DE)}</div>
  </section>

  <section>
    <div class="head"><h2>Google Play — English</h2><span class="tag">1080 × 1920</span></div>
    <div class="shots">${grid(en, CAP_EN)}</div>
  </section>

  <section>
    <div class="head"><h2>Feature-Graphic</h2><span class="tag">1024 × 500 · Play</span></div>
    <div class="feature"><img src="${feat}" alt="Salati Feature-Graphic" /></div>
  </section>

  <section>
    <div class="head"><h2>Promo-Video</h2><span class="tag">1080 × 1920 · 19 s</span></div>
    <div class="split">
      <div class="video-wrap"><video src="${VIDEO}" autoplay muted loop playsinline></video></div>
      <div>
        <p class="lede">Sanfte Zooms und Crossfades durch die sieben stärksten Screens — als YouTube-Link fürs Play-Store-Listing oder als Reel für Social Media.</p>
        <p class="note">Datei: <code>store-assets/promo-video-de.mp4</code> (volle Qualität, mit Ton stumm)</p>
      </div>
    </div>
  </section>

  <section>
    <div class="head"><h2>Store-Texte</h2><span class="tag">Zeichenlimits ✓</span></div>
    <div class="two">
      <div class="copy-card">
        <div class="copy-row"><span class="k">Titel · Deutsch</span><span class="v">Salati: Gebetszeiten &amp; Koran</span></div>
        <div class="copy-row"><span class="k">Kurzbeschreibung</span><span class="s">Gebetszeiten, Koran, Qibla, Dhikr &amp; Adhan – dein Begleiter im Deen. Werbefrei.</span></div>
      </div>
      <div class="copy-card">
        <div class="copy-row"><span class="k">Title · English</span><span class="v">Salati: Prayer Times &amp; Quran</span></div>
        <div class="copy-row"><span class="k">Short description</span><span class="s">Prayer times, Quran, Qibla, Dhikr &amp; Adhan – your companion in the deen. Ad-free.</span></div>
      </div>
    </div>
    <p class="note">Vollständige Beschreibungen, Untertitel, Keywords und Promo-Texte (DE + EN, Play + App Store): <code>store-assets/STORE-LISTING.md</code></p>
  </section>

  <footer>
    App-Store-Versionen der Screenshots (1290 × 2796) liegen unter <code>store-assets/out/appstore/</code>. Alle Assets aus der echten Android-App (SDK 57) gerendert · Marken-Typografie Fraunces &amp; Outfit.
  </footer>
</div>`;

fs.writeFileSync(path.join(ROOT, 'gallery.html'), html);
console.log('wrote gallery.html', (fs.statSync(path.join(ROOT, 'gallery.html')).size / 1024 / 1024).toFixed(2) + ' MB');
