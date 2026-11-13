/**
 * P0 web spotcheck — prod URL (prompt-tests abschluss).
 * Log: output/audit-20261113-khutba-live/logs/web-prod-final.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(MOBILE_ROOT, '../..');
const LOG = path.join(REPO, 'output/audit-20261113-khutba-live/logs/web-prod-final.json');
const BASE = 'https://www.salati.pro';

const ROUTES = [
  { route: '/bibliothek', expectStay: true, note: 'hub not quran redirect' },
  { route: '/handouts', noStack: true, note: 'no Maximum call stack' },
  { route: '/pdf-reader', note: 'empty state visible in DOM' },
  { route: '/learn/abc/abc-welcome', expectStay: true, note: 'deep link lesson' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

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

const results = [];

for (const spec of ROUTES) {
  pageErrors.length = 0;
  const url = `${BASE}${spec.route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  const finalPath = new URL(page.url()).pathname;
  const title = (await page.title()).trim();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const entry = {
    route: spec.route,
    finalUrl: page.url(),
    title,
    titleNonempty: title.length > 0,
    redirectAway:
      spec.expectStay && !finalPath.startsWith(spec.route.split('?')[0]),
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
  results.push(entry);
}

await browser.close();
fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.writeFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
const allOk = results.every((r) => r.ok);
console.log(JSON.stringify({ allOk, results: results.map((r) => ({ route: r.route, ok: r.ok })) }, null, 2));
process.exit(allOk ? 0 : 1);
