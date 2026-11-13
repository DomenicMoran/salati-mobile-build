import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');

const hubBlock = `    "hub": {
      "searchPlaceholder": "Search library",
      "sortTitle": "Title",
      "sortAuthor": "Author",
      "sortRecent": "Recently opened",
      "filterAll": "All",
      "filterAllCategories": "All categories",
      "filterOffline": "Offline",
      "filterInProgress": "In progress",
      "filterRead": "Read",
      "sectionShortcuts": "Quick access",
      "sectionAudiobooks": "Audiobook PDFs",
      "emptyFiltered": "No books match your filters.",
      "pagesMeta": "{{pages}} pages",
      "percentRead": "{{percent}}% read"
    }
`;

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json') || f === 'de.json' || f === 'en.json') continue;
  const p = path.join(dir, f);
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes('"hub":')) continue;
  const re = /("readerImmersive":[^\n]+\n)(\s*\},\n\s*"audiobooks")/;
  const reTail = /("readerImmersive":[^\r\n]+[\r\n]+)(  \}[\r\n]+\})/;
  if (re.test(t)) {
    t = t.replace(re, `$1${hubBlock}$2`);
  } else if (reTail.test(t)) {
    t = t.replace(reTail, (_, line, close) => `${line.replace(/\r?\n$/, '')},\n${hubBlock}${close}`);
  } else {
    console.error('no match', f);
    continue;
  }
  fs.writeFileSync(p, t);
  console.log('patched hub', f);
}
