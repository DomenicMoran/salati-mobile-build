#!/usr/bin/env node
/**
 * Nach `expo export --platform web`: pro HTML-Datei genau ein sichtbares,
 * deutsches <title> setzen und leere react-helmet-Platzhalter entfernen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, process.argv[2] ?? 'dist');
const SITE_SUFFIX = ' – Salati';
const HOME_TITLE = 'Salati - Dein Begleiter für Gebet, Koran und Wissen';

const de = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/de.json'), 'utf8'));

function loadGermanSurahNames() {
  const src = fs.readFileSync(path.join(ROOT, 'src/features/quran/surahNames.ts'), 'utf8');
  const m = src.match(/const GERMAN_SURAH_NAMES[^=]*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error('GERMAN_SURAH_NAMES nicht gefunden');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${m[1]});`)();
}

const SURAH = loadGermanSurahNames();

const ABC_TITLE_KEYS = {};
try {
  const curriculum = fs.readFileSync(path.join(ROOT, 'src/features/learn/abc/curriculum.ts'), 'utf8');
  for (const m of curriculum.matchAll(/id:\s*'([^']+)'[\s\S]*?titleKey:\s*'([^']+)'/g)) {
    ABC_TITLE_KEYS[m[1]] = m[2];
  }
} catch {
  /* optional */
}

function tKey(key) {
  const parts = key.split('.');
  let cur = de;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function routeFromHtml(rel) {
  if (rel.split('/').some((seg) => seg.startsWith('('))) return null;
  if (rel.includes('[') && rel !== 'quran/[surah].html') return null;
  if (rel === 'quran/[surah].html') return '/quran/[surah]';
  let route = `/${rel.replace(/\.html$/, '')}`;
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
  if (route === '/index' || route === '') route = '/';
  return route;
}

function titleForRoute(route) {
  if (route === '/') return HOME_TITLE;

  const abc = route.match(/^\/learn\/abc\/([^/]+)$/);
  if (abc) {
    const key = ABC_TITLE_KEYS[abc[1]];
    const lesson = key ? tKey(key) : undefined;
    if (lesson) return `${lesson}${SITE_SUFFIX}`;
    return `Koran-ABC${SITE_SUFFIX}`;
  }

  if (route === '/quran/[surah]') return `Koran${SITE_SUFFIX}`;

  const surah = route.match(/^\/quran\/(\d{1,3})$/);
  if (surah) {
    const n = Number(surah[1]);
    const name = SURAH[n];
    if (name) return `${name} – Koran${SITE_SUFFIX}`;
    return `Sure ${n} – Koran${SITE_SUFFIX}`;
  }

  const mushaf = route.match(/^\/quran\/mushaf$/);
  if (mushaf) return `Mushaf – Koran${SITE_SUFFIX}`;

  const staticTitles = {
    '/quran': `Koran${SITE_SUFFIX}`,
    '/prayer': `${tKey('nav.prayerTimes') ?? 'Gebet'}${SITE_SUFFIX}`,
    '/qibla': `${tKey('nav.qibla') ?? 'Qibla'}${SITE_SUFFIX}`,
    '/lernen': `${tKey('nav.lernen') ?? 'Lernen'}${SITE_SUFFIX}`,
    '/learn': `${tKey('nav.learn') ?? 'Koran lesen lernen'}${SITE_SUFFIX}`,
    '/bibliothek': `${tKey('bibliothek.title') ?? 'Bibliothek'}${SITE_SUFFIX}`,
    '/handouts': `${tKey('handouts.title') ?? 'Lernunterlagen'}${SITE_SUFFIX}`,
    '/settings': `${tKey('nav.settings') ?? 'Einstellungen'}${SITE_SUFFIX}`,
    '/more': `${tKey('nav.more') ?? 'Mehr'}${SITE_SUFFIX}`,
    '/prayer-times-week': `${tKey('prayerWeek.title') ?? 'Wochenübersicht'}${SITE_SUFFIX}`,
    '/datenschutz': `${tKey('nav.datenschutz') ?? 'Datenschutz'}${SITE_SUFFIX}`,
    '/impressum': `${tKey('nav.impressum') ?? 'Impressum'}${SITE_SUFFIX}`,
    '/changelog': `${tKey('nav.changelog') ?? 'Was ist neu'}${SITE_SUFFIX}`,
    '/pdf-reader': 'Salati PDF Reader',
    '/media': `${tKey('nav.media') ?? 'Medien'}${SITE_SUFFIX}`,
    '/hifz': `${tKey('nav.hifz') ?? 'Rezitieren'}${SITE_SUFFIX}`,
    '/study': `${tKey('nav.study') ?? 'Studium'}${SITE_SUFFIX}`,
  };

  if (staticTitles[route]) return staticTitles[route];

  const last = route.split('/').filter(Boolean).pop() ?? '';
  if (last && /^[a-z0-9-]+$/i.test(last)) {
    const human = last.replace(/-/g, ' ');
    return `${human.charAt(0).toUpperCase()}${human.slice(1)}${SITE_SUFFIX}`;
  }

  return HOME_TITLE;
}

function patchHtml(html, title) {
  let out = html.replace(/<title[^>]*data-rh="true"[^>]*>\s*<\/title>/gi, '');
  out = out.replace(/<title[^>]*>\s*<\/title>/gi, '');
  const canonical = `<title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`;
  if (/<title[\s>]/i.test(out)) {
    out = out.replace(/<title[^>]*>[^<]*<\/title>/i, canonical);
  } else if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${canonical}`);
  }
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}"/>`,
  );
  return out;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield abs;
  }
}

if (!fs.existsSync(DIST)) {
  console.error(`Kein Export: ${DIST}`);
  process.exit(1);
}

let patched = 0;
const report = [];

for (const file of walk(DIST)) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  const route = routeFromHtml(rel);
  if (!route) continue;
  const title = titleForRoute(route);
  const before = fs.readFileSync(file, 'utf8');
  const after = patchHtml(before, title);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    patched += 1;
    report.push({ route, title, file: rel });
  }
}

const logPath = path.resolve(ROOT, '../../output/audit-20261113-abnahme-fixes/ssr/title-patch-report.json');
try {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify({ patched, sample: report.slice(0, 40) }, null, 2));
} catch {
  /* audit dir optional during local build */
}

console.log(`SSR titles: ${patched} HTML-Dateien angepasst (${DIST})`);
