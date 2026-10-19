#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LISTING = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'store', 'listing');
for (const lang of fs.readdirSync(LISTING).filter((f) => f.endsWith('.md') && f !== 'data-safety.md')) {
  const fp = path.join(LISTING, lang);
  let body = fs.readFileSync(fp, 'utf8');
  const start = body.indexOf('## Vollständige Beschreibung');
  const descStart = body.indexOf('\n', start) + 1;
  const end = body.indexOf('\n\n(', descStart);
  const desc = body.slice(descStart, end).trim();
  const n = desc.length;
  body = body.replace(/\(\d+\/4000 Zeichen\)/, `(${n}/4000 Zeichen)`);
  fs.writeFileSync(fp, body, 'utf8');
  const ok = n <= 4000 ? 'ok' : 'OVER';
  console.log(`${lang.replace('.md', '')}: ${n}/4000 ${ok}`);
}
