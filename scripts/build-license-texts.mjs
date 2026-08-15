// Erzeugt src/features/licenses/texts.json aus den Volltexten in
// public/licenses/*.txt.
//
// Warum zwei Ablagen für denselben Text?
//   • public/licenses/*.txt  — Quelle der Wahrheit. Wird beim Web-Export 1:1
//     nach dist/licenses/ kopiert und ist damit auf der Webseite unter
//     /licenses/<id>.txt abrufbar (Apache-2.0 §4a, MIT/BSD-Vermerkpflicht).
//   • src/features/licenses/texts.json — dieselben Bytes als JSON, damit die
//     App die Texte OFFLINE im Bundle hat. public/ landet nur im Web-Export,
//     nicht im Android-/iOS-Bundle; ein Nachladen per Netz wäre kein
//     "beigelegter" Lizenztext.
// Damit die beiden Seiten nicht driften, läuft `--check` in `pnpm build` vor
// dem Web-Export: weicht texts.json von den .txt-Dateien ab, bricht der Build
// ab, statt eine App mit anderem Lizenztext als die Webseite auszuliefern.
// (Der Vergleich steckt hier statt in einem Jest-Test, weil das Projekt bewusst
// ohne @types/node arbeitet — Node-Globals im TS-Programm würden die Timer-
// Typen der React-Native-Quellen verändern.)
//
// Ausführen nach jeder Änderung an public/licenses/:
//   node scripts/build-license-texts.mjs           (neu erzeugen)
//   node scripts/build-license-texts.mjs --check   (nur prüfen, Exit 1 bei Drift)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const QUELLE = path.join(MOBILE, 'public', 'licenses');
const ZIEL = path.join(MOBILE, 'src', 'features', 'licenses', 'texts.json');

const dateien = readdirSync(QUELLE)
  .filter((f) => f.endsWith('.txt'))
  .sort();

const texte = {};
for (const datei of dateien) {
  // NOTICE.txt -> "notice", apache-2.0.txt -> "apache-2.0"
  const id = path.basename(datei, '.txt').toLowerCase();
  texte[id] = readFileSync(path.join(QUELLE, datei), 'utf8').replace(/\r\n/g, '\n');
}

const inhalt = `${JSON.stringify(texte, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const vorhanden = readFileSync(ZIEL, 'utf8');
  if (vorhanden !== inhalt) {
    console.error(
      `${path.relative(MOBILE, ZIEL)} weicht von public/licenses ab. ` +
        'Bitte `node scripts/build-license-texts.mjs` ausfuehren.',
    );
    process.exit(1);
  }
  console.log(`${dateien.length} Lizenztexte: App-Bundle und Webseite identisch.`);
} else {
  writeFileSync(ZIEL, inhalt, 'utf8');
  console.log(`${dateien.length} Lizenztexte -> ${path.relative(MOBILE, ZIEL)}`);
}
