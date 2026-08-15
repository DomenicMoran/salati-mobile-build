#!/usr/bin/env node
/**
 * Erzeugt dist/sitemap.xml aus den tatsächlich exportierten HTML-Seiten.
 *
 * Hintergrund (Audit 2026-07-27, WEBSITE-MEDIEN.md): GET /sitemap.xml -> 404,
 * obwohl der Export mehrere hundert statische Inhaltsseiten enthält (Suren,
 * Duas, Hadithe, Kurslektionen, Podcast-Folgen). Ohne Sitemap findet eine
 * Suchmaschine sie nur über interne Links.
 *
 * Läuft NACH `expo export --platform web` (s. package.json "build").
 * Aufruf:  node scripts/generate-sitemap.mjs [dist-Verzeichnis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.argv[2] ?? 'dist');
const SITE = 'https://www.salati.pro';

// App-interne Bildschirme ohne Suchmaschinen-Nutzen (Modals, Einstellungen,
// Onboarding, Fehlerseiten) — sie stehen im Index nur im Weg.
const EXCLUDED = new Set([
  '/+not-found',
  '/404',
  '/_sitemap',
  '/onboarding',
  '/settings',
  '/storage',
  '/sync',
  '/search',
  '/dashboard-reorder',
  '/notifications-overview',
  '/tv-connect',
  '/getting-started',
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield abs;
  }
}

if (!fs.existsSync(DIST)) {
  console.error(`Kein Export gefunden: ${DIST}`);
  process.exit(1);
}

const entries = new Map(); // Pfad -> lastmod (ISO-Datum)

for (const file of walk(DIST)) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  // Expo-Router-Gruppen ("(tabs)/index.html") sind keine öffentlichen URLs,
  // dieselbe Seite liegt zusätzlich unter ihrem echten Pfad.
  if (rel.split('/').some((seg) => seg.startsWith('('))) continue;
  // Platzhalter-Templates dynamischer Routen ("quran/[surah].html").
  if (rel.includes('[')) continue;

  let route = `/${rel.replace(/\.html$/, '')}`;
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
  if (route === '/index' || route === '') route = '/';
  if (EXCLUDED.has(route)) continue;

  const lastmod = fs.statSync(file).mtime.toISOString().slice(0, 10);
  entries.set(route, lastmod);
}

const sorted = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
const urls = sorted
  .map(
    ([route, lastmod]) =>
      `  <url>\n    <loc>${SITE}${route === '/' ? '/' : route}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml: ${sorted.length} URLs -> ${path.join(DIST, 'sitemap.xml')}`);
