/**
 * Web prod + React #418 + mobile viewport screenshots
 * Evidence: output/audit-20261114-prompt-final/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(MOBILE_ROOT, '../..');
const AUDIT = path.join(REPO, 'output/audit-20261114-prompt-final');
const LOG_DIR = path.join(AUDIT, 'logs');
const SHOT_DIR = path.join(AUDIT, 'screenshots');
const BASE = 'https://www.salati.pro';

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });

const PROD_ROUTES = [
  { route: '/bibliothek', expectStay: true, note: 'hub not quran redirect' },
  { route: '/handouts', noStack: true, note: 'no Maximum call stack' },
  { route: '/pdf-reader', note: 'empty state visible in DOM' },
  { route: '/learn/abc/abc-welcome', expectStay: true, note: 'deep link lesson' },
];

const CORE_ROUTES = ['/', '/prayer', '/quran/1', '/settings', '/bibliothek', '/learn'];

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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await seedDeLocale(page);

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

const prodResults = [];
for (const spec of PROD_ROUTES) {
  pageErrors.length = 0;
  await page.goto(`${BASE}${spec.route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  const finalPath = new URL(page.url()).pathname;
  const title = (await page.title()).trim();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const entry = {
    route: spec.route,
    finalUrl: page.url(),
    title,
    titleNonempty: title.length > 0,
    redirectAway: spec.expectStay && !finalPath.startsWith(spec.route.split('?')[0]),
    stackError: pageErrors.some((e) => e.includes('Maximum call stack')),
    pdfEmptyHint: spec.route === '/pdf-reader' && /Kein Buch geöffnet|PDF/i.test(bodyText),
    abcLesson: spec.route.includes('abc-welcome') && /Willkommen|Schriftlauf|الْقُرْآن/i.test(bodyText),
    ok: true,
    note: spec.note,
    errors: [...pageErrors],
  };
  if (spec.expectStay) entry.ok &&= !entry.redirectAway;
  if (spec.noStack) entry.ok &&= !entry.stackError;
  if (spec.route === '/pdf-reader') entry.ok &&= entry.pdfEmptyHint;
  if (spec.route.includes('abc-welcome')) entry.ok &&= entry.abcLesson;
  entry.ok &&= entry.titleNonempty;
  prodResults.push(entry);
}

const react418Out = [];
for (const route of CORE_ROUTES) {
  pageErrors.length = 0;
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const hits = pageErrors.filter((e) => e.includes('#418') || e.includes('Minified React error #418'));
  react418Out.push({ route, react418: hits });
}

for (const route of CORE_ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
  await page.screenshot({ path: path.join(SHOT_DIR, `web-${slug}.png`), fullPage: false });
}

await browser.close();

fs.writeFileSync(
  path.join(LOG_DIR, 'web-prod.json'),
  JSON.stringify({ at: new Date().toISOString(), base: BASE, results: prodResults }, null, 2),
);
const allClear = react418Out.every((r) => r.react418.length === 0);
fs.writeFileSync(
  path.join(LOG_DIR, 'react418.json'),
  JSON.stringify({ allClear, at: new Date().toISOString(), out: react418Out }, null, 2),
);

const allOk = prodResults.every((r) => r.ok) && allClear;
console.log(JSON.stringify({ allOk, prod: prodResults.map((r) => ({ route: r.route, ok: r.ok })), allClear }, null, 2));
process.exit(allOk ? 0 : 1);