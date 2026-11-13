import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');

const hubBlock = `,
    "hub": {
      "searchPlaceholder": "Search library",
      "sortTitle": "Title",
      "sortAuthor": "Author",
      "sortRecent": "Recently opened",
      "sortAdded": "Recently added",
      "filterAll": "All",
      "filterAllCategories": "All categories",
      "filterOffline": "Offline",
      "filterInProgress": "In progress",
      "filterRead": "Read",
      "sectionShortcuts": "Quick access",
      "sectionAudiobooks": "Audiobook PDFs",
      "sectionMyBooks": "My books (offline)",
      "sectionRecentlyAdded": "Recently added",
      "emptyFiltered": "No books match your filters.",
      "pagesMeta": "{{pages}} pages",
      "percentRead": "{{percent}}% read"
    }`;

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json') || f === 'de.json' || f === 'en.json') continue;
  const p = path.join(dir, f);
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes('"hub":')) {
    if (!t.includes('sectionMyBooks')) {
      const anchor = /("sortRecent":[^\n]+\n)/;
      const extra = `      "sortAdded": "Recently added",\n      "sectionMyBooks": "My books (offline)",\n      "sectionRecentlyAdded": "Recently added",\n`;
      if (anchor.test(t)) {
        t = t.replace(anchor, `$1${extra}`);
        fs.writeFileSync(p, t);
        console.log('patched shelf keys', f);
      }
    }
    continue;
  }
  const re = /("allHandoutsNote":[^\n]+\n)(  \})/;
  if (!re.test(t)) {
    console.error('skip no anchor', f);
    continue;
  }
  t = t.replace(re, `$1${hubBlock}\n$2`);
  fs.writeFileSync(p, t);
  console.log('added hub', f);
}
