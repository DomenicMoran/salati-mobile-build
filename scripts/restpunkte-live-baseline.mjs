/**
 * Baseline capture + P0 signal checks on www.salati.pro (pre-fix).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const AUDIT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../output/audit-20261113-salati-restpunkte',
);
const OUT = path.join(AUDIT_ROOT, 'screenshots', 'baseline');
const LOG = path.join(AUDIT_ROOT, 'logs');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(LOG, { recursive: true });

const BASE = 'https://www.salati.pro';
const VIEWPORTS = [
  { tag: 'phone', ...devices['iPhone 13'] },
  { tag: 'tablet', width: 820, height: 1180, userAgent: devices['iPad Pro 11'].userAgent },
  { tag: 'desktop', width: 1440, height: 900 },
];

const ROUTES = [
  '/',
  '/bibliothek',
  '/handouts',
  '/pdf-reader',
  '/quran',
  '/prayer',
  '/prayer-times-week',
  '/settings',
  '/learn',
  '/learn/abc/abc-welcome',
  '/does-not-exist-xyz',
];

async function seedDeLocale(page) {
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('salatibox:settings');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.language = 'de';
      localStorage.setItem('salatibox:settings', JSON.stringify(parsed));
    } catch {
      /* ignore */
    }
  });
}

const results = [];
const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const contextOpts = {
    viewport: vp.viewport ?? { width: vp.width, height: vp.height },
    userAgent: vp.userAgent,
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
  };
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  await seedDeLocale(page);

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const req404 = [];
  page.on('response', (resp) => {
    const u = resp.url();
    if (resp.status() === 404 && (u.includes('viewer.mjs') || u.includes('pdf-reader'))) {
      req404.push(u);
    }
  });

  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(3000);
      const finalUrl = page.url();
      const title = await page.title();
      const file = path.join(OUT, `${vp.tag}${route.replace(/\//g, '-') || '-home'}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const nav = await page
        .locator('body')
        .innerText()
        .then((t) => t.split('\n').slice(0, 15).join(' | '))
        .catch(() => '');
      results.push({
        viewport: vp.tag,
        route,
        http: resp?.status(),
        finalUrl,
        title,
        screenshot: path.relative(AUDIT_ROOT, file),
        redirectAway:
          route !== '/' && !finalUrl.replace(BASE, '').startsWith(route.split('?')[0]),
        errors: [...errors],
        viewer404: req404.length > 0,
        viewer404Urls: [...req404],
        navSnippet: nav,
      });
      errors.length = 0;
      req404.length = 0;
    } catch (e) {
      results.push({ viewport: vp.tag, route, error: String(e) });
    }
  }
  await context.close();
}

const darkCtx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
const darkPage = await darkCtx.newPage();
await seedDeLocale(darkPage);
for (const route of ['/bibliothek', '/settings', '/quran', '/learn', '/hifz']) {
  await darkPage.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await darkPage.waitForTimeout(2000);
  const file = path.join(OUT, `phone-dark${route.replace(/\//g, '-')}.png`);
  await darkPage.screenshot({ path: file, fullPage: true });
}
await darkCtx.close();
await browser.close();

fs.writeFileSync(path.join(LOG, 'baseline-live.json'), JSON.stringify(results, null, 2));
const p0 = {
  bibliothekRedirect: results.filter((r) => r.route === '/bibliothek' && r.redirectAway),
  handoutsErrors: results.filter((r) => r.route === '/handouts' && (r.errors?.length || 0) > 0),
  stackOverflow: results.filter((r) => r.errors?.some((e) => e.includes('Maximum call stack'))),
  viewer404: results.filter((r) => r.viewer404),
};
fs.writeFileSync(path.join(LOG, 'p0-signals.json'), JSON.stringify(p0, null, 2));
console.log(JSON.stringify({ rows: results.length, p0 }, null, 2));
