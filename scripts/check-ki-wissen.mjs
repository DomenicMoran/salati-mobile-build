// Prüft die kuratierte Wissensschicht der Salati-KI gegen den echten Korpus.
//
// Geprüft wird:
//  1. Schema (id/titel/text/tags/belege, eindeutige IDs, Textlänge)
//  2. Jede „Koran X:Y"-Angabe existiert wirklich in public/rag/korpus-de.json
//     (Schutz gegen halluzinierte Vers-Nummern — der häufigste Fehler in
//     KI-erzeugten religiösen Texten).
//  3. Jede „an-Nawawī Nr. N"-Angabe existiert als Hadith-Dokument im Korpus.
//  4. Gibt zu jedem Beleg den echten Verstext aus (--zeige), damit ein Mensch
//     prüfen kann, ob der Beleg die Aussage wirklich trägt.
//
// Ausführen: cd apps/mobile && node scripts/check-ki-wissen.mjs [datei.json] [--zeige]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const zeige = process.argv.includes('--zeige');
const datei = args[0]
  ? path.resolve(args[0])
  : path.join(MOBILE, 'src', 'features', 'ki', 'wissen-de.json');

const korpus = JSON.parse(readFileSync(path.join(MOBILE, 'public', 'rag', 'korpus-de.json'), 'utf8'));
const verse = new Map(); // "2:255" -> { src, t }
const hadithe = new Map(); // "3" -> { src, t }
for (const d of korpus.docs) {
  const mq = /^Koran (\d+):(\d+)/.exec(d.src ?? '');
  if (mq) verse.set(`${mq[1]}:${mq[2]}`, d);
  const mh = /^an-Nawaw[īi] Nr\.\s*(\d+)/.exec(d.src ?? '');
  if (mh) hadithe.set(mh[1], d);
}

const wissen = JSON.parse(readFileSync(datei, 'utf8'));
const eintraege = wissen.eintraege ?? [];
const ids = new Set();
let fehler = 0;
const meld = (id, msg) => {
  console.log(`FEHLER  ${id}: ${msg}`);
  fehler++;
};

for (const e of eintraege) {
  if (!e.id || !e.titel || !e.text) {
    meld(e.id ?? '(ohne id)', 'id/titel/text unvollständig');
    continue;
  }
  if (ids.has(e.id)) meld(e.id, 'doppelte id');
  ids.add(e.id);
  if (!/^[a-z0-9-]+$/.test(e.id)) meld(e.id, 'id muss kebab-case sein');
  if (e.text.length < 200) meld(e.id, `Text zu kurz (${e.text.length} Zeichen, mind. 200)`);
  if (e.text.length > 1600) meld(e.id, `Text zu lang (${e.text.length} Zeichen, max. 1600)`);
  if (!Array.isArray(e.tags) || e.tags.length < 3) meld(e.id, 'mind. 3 tags nötig');
  for (const t of e.tags ?? []) {
    if (t !== t.toLowerCase()) meld(e.id, `tag nicht klein geschrieben: "${t}"`);
  }
  for (const b of e.belege ?? []) {
    const mq = /^Koran (\d+):(\d+)$/.exec(b);
    const mh = /^an-Nawaw[īi] Nr\.\s*(\d+)/.exec(b);
    if (mq) {
      const doc = verse.get(`${mq[1]}:${mq[2]}`);
      if (!doc) meld(e.id, `Koran-Beleg existiert nicht im Korpus: "${b}"`);
      else if (zeige) console.log(`  ${e.id} · ${doc.src}: ${doc.t}`);
    } else if (mh) {
      const doc = hadithe.get(mh[1]);
      if (!doc) meld(e.id, `Hadith-Beleg existiert nicht im Korpus: "${b}"`);
      else if (zeige) console.log(`  ${e.id} · ${doc.src}: ${doc.t.slice(0, 160)}…`);
    } else {
      meld(e.id, `Beleg-Format unbekannt: "${b}" (erlaubt: "Koran 2:255", "an-Nawawī Nr. 3 — <Quelle>")`);
    }
  }
}

console.log(`\n${eintraege.length} Einträge geprüft · ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
