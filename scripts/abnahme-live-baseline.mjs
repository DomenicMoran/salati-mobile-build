/**
 * Abnahme fixes — baseline/after gegen www.salati.pro (Playwright aus apps/mobile).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const AUDIT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../output/audit-20261113-abnahme-fixes',
);
const PHASE = process.argv.includes('--after') ? 'after' : 'baseline';
const SHOT_DIR = path.join(AUDIT_ROOT, 'screenshots', PHASE);
const LOG = path.join(AUDIT_ROOT, 'logs');
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(LOG, { recursive: true });

const BASE = process.env.SALATI_BASE_URL ?? 'https://www.salati.pro';

const VIEWPORTS = [
  { tag: 'phone', ...devices['iPhone 13'] },
  { tag: 'tablet', width: 820, height: 1180, userAgent: devices['iPad Pro 11'].userAgent },
  { tag: 'desktop', width: 1440, height: 900 },
];

const ROUTES = [
  '/',
  '/bibliothek',
  '/bibliothek/tafsir',
  '/handouts',
  '/pdf-reader',
  '/quran',
  '/quran/1',
  '/quran/2',
  '/quran/9',
  '/quran/mushaf',
  '/prayer',
  '/prayer-times-week',
  '/qibla',
  '/lernen',
  '/settings',
  '/learn',
  '/learn/abc/abc-welcome',
  '/learn/abc/abc-vowels',
  '/learn/abc/abc-sukun',
  '/datenschutz',
  '/impressum',
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
  const context = await browser.newContext({
    viewport: vp.viewport ?? { width: vp.width, height: vp.height },
    userAgent: vp.userAgent,
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
  });
  const page = await context.newPage();
  await seedDeLocale(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(3000);
      const finalUrl = page.url();
      const title = await page.title();
      const file = path.join(SHOT_DIR, `${vp.tag}${route.replace(/\//g, '-') || '-home'}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const genericHome =
        title === 'Salati - Dein Begleiter für Gebet, Koran und Wissen' &&
        !['/', '/index'].includes(route);
      results.push({
        viewport: vp.tag,
        route,
        finalUrl,
        title,
        emptyTitle: !title?.trim(),
        genericHome,
        redirectAway: route !== '/' && !finalUrl.replace(BASE, '').startsWith(route.split('?')[0]),
        errors: [...errors],
        screenshot: path.relative(AUDIT_ROOT, file),
      });
      errors.length = 0;
    } catch (e) {
      results.push({ viewport: vp.tag, route, error: String(e) });
    }
  }
  await context.close();
}

await browser.close();

fs.writeFileSync(path.join(LOG, `${PHASE}-live.json`), JSON.stringify(results, null, 2));

const phone = results.filter((r) => r.viewport === 'phone');
const p0 = {
  bibliothekRedirect: phone.filter((r) => r.route === '/bibliothek' && r.redirectAway),
  handoutsStack: phone.filter((r) => r.route === '/handouts' && r.errors?.some((e) => e.includes('Maximum call stack'))),
  abcWelcomeRedirect: phone.filter((r) => r.route === '/learn/abc/abc-welcome' && r.redirectAway),
};
const p1 = {
  emptyTitles: phone.filter(
    (r) =>
      ['/', '/quran', '/quran/1', '/prayer', '/qibla', '/lernen'].includes(r.route) &&
      (r.emptyTitle || r.genericHome),
  ),
  react418: phone.filter((r) => r.errors?.some((e) => e.includes('#418'))),
};

fs.writeFileSync(path.join(LOG, `${PHASE}-signals.json`), JSON.stringify({ p0, p1 }, null, 2));
console.log(JSON.stringify({ phase: PHASE, rows: results.length, p0, p1 }, null, 2));
