#!/usr/bin/env node
// Schreibt ios-locales/<lang>.json aus catalog.json (Expo `locales`-Format).
// Prueft Schluesselparitaet — wird von Jest und release-check genutzt.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'ios-locales', 'catalog.json');
const OUT_DIR = path.join(ROOT, 'ios-locales');
const WATCH_DIR = path.join(ROOT, 'targets', 'salati-watch');
const LOCATION_KEY = 'NSLocationWhenInUseUsageDescription';

function writeWatchLocationLproj(languages) {
  if (!fs.existsSync(WATCH_DIR)) return;
  for (const [lang, entry] of Object.entries(languages)) {
    const text = entry[LOCATION_KEY];
    if (typeof text !== 'string' || !text.trim()) continue;
    const lproj = path.join(WATCH_DIR, `${lang}.lproj`);
    fs.mkdirSync(lproj, { recursive: true });
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    fs.writeFileSync(
      path.join(lproj, 'InfoPlist.strings'),
      `${LOCATION_KEY} = "${escaped}";\n`,
      'utf8',
    );
  }
}

function loadCatalog() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const { keys, languages } = catalog;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('catalog.json: keys fehlt oder leer');
  }
  if (!languages || typeof languages !== 'object') {
    throw new Error('catalog.json: languages fehlt');
  }
  return { keys, languages };
}

export function assertIosInfoPlistLocaleParity({ write = false } = {}) {
  const { keys, languages } = loadCatalog();
  const langs = Object.keys(languages).sort();
  const errors = [];

  for (const lang of langs) {
    const entry = languages[lang];
    for (const key of keys) {
      const val = entry?.[key];
      if (typeof val !== 'string' || val.trim() === '') {
        errors.push(`${lang}: fehlender/leerer Schluessel ${key}`);
      }
    }
    for (const key of Object.keys(entry ?? {})) {
      if (!keys.includes(key)) {
        errors.push(`${lang}: unbekannter Schluessel ${key}`);
      }
    }
  }

  for (const lang of langs) {
    const outPath = path.join(OUT_DIR, `${lang}.json`);
    const expected = { ios: languages[lang] };
    if (write) {
      fs.writeFileSync(outPath, `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
    } else if (!fs.existsSync(outPath)) {
      errors.push(`${lang}.json fehlt (sync mit --write ausfuehren)`);
    } else {
      const onDisk = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const diskIos = onDisk.ios ?? onDisk;
      for (const key of keys) {
        if (diskIos[key] !== languages[lang][key]) {
          errors.push(`${lang}.json weicht von catalog.json ab (${key})`);
        }
      }
    }
  }

  const extraFiles = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'catalog.json')
    .map((f) => f.replace(/\.json$/, ''));
  for (const f of extraFiles) {
    if (!langs.includes(f)) {
      errors.push(`ios-locales/${f}.json ohne Eintrag in catalog.json`);
    }
  }

  if (errors.length) {
    throw new Error(`ios-info-plist-locales:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return { keys, langs, languages };
}

const write = process.argv.includes('--write');
try {
  const result = assertIosInfoPlistLocaleParity({ write });
  if (write) {
    writeWatchLocationLproj(result.languages);
    console.log(
      `ios-locales: ${result.langs.length} Dateien geschrieben, ${result.keys.length} Schluessel (+ watch lproj).`,
    );
  } else {
    console.log(`ios-locales: OK (${result.langs.length} Sprachen, ${result.keys.length} Schluessel).`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
