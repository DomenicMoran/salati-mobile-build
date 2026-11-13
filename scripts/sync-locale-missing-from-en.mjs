/**
 * One-off: copy missing leaf keys from de structure using en (fallback de).
 * Keeps existing translations; only fills gaps for locale parity tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const locDir = path.join(here, '..', 'src', 'locales');

const de = JSON.parse(fs.readFileSync(path.join(locDir, 'de.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(locDir, 'en.json'), 'utf8'));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fillMissing(target, deNode, enNode) {
  for (const [key, deVal] of Object.entries(deNode)) {
    const enVal = enNode?.[key];
  if (isPlainObject(deVal)) {
      if (!isPlainObject(target[key])) target[key] = {};
      fillMissing(target[key], deVal, isPlainObject(enVal) ? enVal : undefined);
    } else if (!(key in target)) {
      target[key] = enVal ?? deVal;
    }
  }
}

const files = fs.readdirSync(locDir).filter((f) => f.endsWith('.json') && f !== 'de.json');
for (const file of files) {
  const locale = file.replace(/\.json$/, '');
  const p = path.join(locDir, file);
  const dict = JSON.parse(fs.readFileSync(p, 'utf8'));
  fillMissing(dict, de, en);
  fs.writeFileSync(p, `${JSON.stringify(dict, null, 2)}\n`);
  console.log(`synced ${locale}`);
}
