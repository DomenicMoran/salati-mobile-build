import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src', 'locales');
const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'bibliothek-reader-hub-i18n.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

for (const [locale, patch] of Object.entries(data)) {
  const p = path.join(dir, `${locale}.json`);
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  const bibliothek = obj.bibliothek ?? (obj.bibliothek = {});
  const { hub, tafsirGermanOnly, ...reader } = patch;
  if (tafsirGermanOnly) bibliothek.tafsirGermanOnly = tafsirGermanOnly;
  Object.assign(bibliothek, reader);
  bibliothek.hub = { ...(bibliothek.hub ?? {}), ...hub };
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  console.log('ok', locale);
}
