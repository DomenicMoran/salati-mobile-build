/**
 * Full prod web route sweep (mobile + desktop) → output/audit-20261114-testloop/
 * Usage: node apps/mobile/scripts/testloop-web-full.mjs
 *        AUDIT=/path/to/out node apps/mobile/scripts/testloop-web-full.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(MOBILE_ROOT, '../..');
const AUDIT = process.env.AUDIT || path.join(REPO, 'output/audit-20261114-testloop');
const LOG_DIR = path.join(AUDIT, 'logs');
const SHOT_DIR = path.join(AUDIT, 'screenshots');
const BASE = 'https://www.salati.pro';

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });

const STATIC_ROUTES = [
  '/',
  '/prayer',
  '/quran',
  '/quran/1',
  '/settings',
  '/bibliothek',
  '/learn',
  '/learn/abc/abc-welcome',
  '/handouts',
  '/pdf-reader',
  '/mosques',
  '/qibla',
  '/datenschutz',
  '/impressum',
  '/more',
];

const HUB_ROUTES_FOR_DISCOVERY = ['/bibliothek', '/more', '/learn'];
const DEEP_LINK_PATTERNS = [
  /^\/study\/dialects(\/|$)/,
  /^\/audiobooks(\/|$)/,
];

const VIEWPORTS = [
  { id: 'mobile', label: 'iPhone 13', contextOptions: { ...devices['iPhone 13'] } },
  {
    id: 'desktop',
    label: '1440x900',
    contextOptions: { viewport: { width: 1440, height: 900 } },
  },
];

function routeSlug(route) {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '-');
}

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

function isActionableConsole(msg) {
  if (msg.type() !== 'error') return false;
  const text = msg.text();
  if (/favicon|Failed to load resource.*\.(png|jpg|webp|ico)/i.test(text)) return false;
  // Overpass queue/502 is external; page shell still renders (mobile often misses it in timing).
  if (/overpass-api\.de/i.test(text)) return false;
  if (/Failed to load resource.*\b502\b/i.test(text)) return false;
  return true;
}

function classifyBugs(entry) {
  const bugs = [];
  for (const e of entry.pageErrors) {
    if (e.includes('#418') || e.includes('Minified React error #418')) {
      bugs.push({ kind: 'react-418', message: e.slice(0, 500) });
    } else if (e.includes('Maximum call stack')) {
      bugs.push({ kind: 'max-call-stack', message: e.slice(0, 500) });
    } else {
      bugs.push({ kind: 'pageerror', message: e.slice(0, 500) });
    }
  }
  if (!entry.titleNonempty) bugs.push({ kind: 'empty-title', message: 'document.title is empty' });
  if (entry.blankBody) bugs.push({ kind: 'blank-body', message: `body text length ${entry.bodyLength}` });
  for (const c of entry.consoleErrors) {
    bugs.push({ kind: 'console-error', message: c.slice(0, 500) });
  }
  return bugs;
}

async function discoverDeepLinks(page) {
  const found = new Set();
  for (const hub of HUB_ROUTES_FOR_DISCOVERY) {
    await page.goto(`${BASE}${hub}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || ''),
    );
    for (const href of hrefs) {
      let pathname = href;
      try {
        if (href.startsWith('http')) pathname = new URL(href).pathname;
        else if (href.startsWith('/')) pathname = href.split('?')[0].split('#')[0];
        else continue;
      } catch {
        continue;
      }
      if (DEEP_LINK_PATTERNS.some((re) => re.test(pathname))) found.add(pathname);
    }
  }
  return [...found].sort();
}

async function auditRoute(page, route, viewportId) {
  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (e) => pageErrors.push(String(e));
  const onConsole = (msg) => {
    if (isActionableConsole(msg)) consoleErrors.push(msg.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  let loadError = null;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    loadError = String(e);
  }

  page.off('pageerror', onPageError);
  page.off('console', onConsole);

  const title = (await page.title().catch(() => '')).trim();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const bodyLength = bodyText.replace(/\s+/g, ' ').trim().length;
  const slug = routeSlug(route);
  const shotPath = path.join(SHOT_DIR, `web-${viewportId}-${slug}.png`);
  await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});

  const bugs = classifyBugs({
    pageErrors: loadError ? [loadError, ...pageErrors] : pageErrors,
    titleNonempty: title.length > 0,
    blankBody: bodyLength < 50,
    bodyLength,
    consoleErrors,
  });

  return {
    route,
    viewport: viewportId,
    finalUrl: page.url(),
    title,
    titleNonempty: title.length > 0,
    bodyLength,
    blankBody: bodyLength < 50,
    screenshot: path.relative(REPO, shotPath),
    pageErrors: [...pageErrors],
    consoleErrors: [...consoleErrors],
    loadError,
    bugs,
    ok: bugs.length === 0 && !loadError,
  };
}

const browser = await chromium.launch({ headless: true });

const discoveryCtx = await browser.newContext({ ...devices['iPhone 13'] });
const discoveryPage = await discoveryCtx.newPage();
await seedDeLocale(discoveryPage);
const discovered = await discoverDeepLinks(discoveryPage);
await discoveryCtx.close();

const routeFilter = process.env.WEB_ROUTE?.trim();
const allRoutes = [...new Set([...STATIC_ROUTES, ...discovered])]
  .filter((r) => !routeFilter || r === routeFilter)
  .sort((a, b) => a.localeCompare(b));
if (routeFilter && allRoutes.length === 0) {
  console.error(`WEB_ROUTE not in route list: ${routeFilter}`);
  process.exit(2);
}

const results = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext(vp.contextOptions);
  const page = await ctx.newPage();
  await seedDeLocale(page);
  for (const route of allRoutes) {
    const entry = await auditRoute(page, route, vp.id);
    results.push(entry);
    const status = entry.ok ? 'ok' : 'FAIL';
    console.log(`[${vp.id}] ${route} → ${status}`);
  }
  await ctx.close();
}

await browser.close();

const bugFlat = [];
for (const r of results) {
  for (const b of r.bugs) {
    bugFlat.push({
      route: r.route,
      viewport: r.viewport,
      ...b,
    });
  }
  if (r.loadError) {
    bugFlat.push({
      route: r.route,
      viewport: r.viewport,
      kind: 'navigation',
      message: r.loadError.slice(0, 500),
    });
  }
}

const failCount = results.filter((r) => !r.ok).length;
const summary = {
  at: new Date().toISOString(),
  base: BASE,
  auditDir: AUDIT,
  routes: allRoutes,
  discoveredFromHubs: discovered,
  viewports: VIEWPORTS.map((v) => v.id),
  totalChecks: results.length,
  passCount: results.filter((r) => r.ok).length,
  failCount,
  bugCount: bugFlat.length,
};

fs.writeFileSync(
  path.join(LOG_DIR, 'web-full.json'),
  JSON.stringify({ ...summary, results }, null, 2),
);
fs.writeFileSync(path.join(LOG_DIR, 'bugs-web.json'), JSON.stringify({ ...summary, bugs: bugFlat }, null, 2));

console.log(JSON.stringify({ failCount, bugCount: bugFlat.length, discovered }, null, 2));
process.exit(failCount > 0 ? 1 : 0);