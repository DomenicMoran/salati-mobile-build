import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');

const extraLines = `      "sortAdded": "Recently added",
      "sectionMyBooks": "My books (offline)",
      "sectionRecentlyAdded": "Recently added",
`;

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json') || f === 'de.json' || f === 'en.json') continue;
  const p = path.join(dir, f);
  let t = fs.readFileSync(p, 'utf8');
  if (!t.includes('"hub":') || t.includes('sectionMyBooks')) continue;
  const anchor = /("sortRecent":[^\n]+\n)/;
  if (!anchor.test(t)) {
    console.error('no hub sortRecent', f);
    continue;
  }
  t = t.replace(anchor, `$1${extraLines}`);
  fs.writeFileSync(p, t);
  console.log('patched shelves', f);
}
