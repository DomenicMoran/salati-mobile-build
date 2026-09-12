/**
 * Regressionswächter für genau den Fehler, der `morphologieCachePfad.ts`
 * (siehe Kopf-Kommentar dort) überhaupt nötig gemacht hat: ein Test, der den
 * lokal gebauten Morphologie-Cache (`.daten-cache/out/morphologie/v<N>/`,
 * gitignored, siehe `scripts/build-morphologie.mjs`) DIREKT von der Platte
 * liest, trägt dafür seine EIGENE, fest verdrahtete Kopie der Versionsnummer
 * statt sie über `morphologieCacheVerzeichnis()`/`morphologieCacheVorhanden()`
 * aus `MORPHOLOGIE_SCHEMA_VERSION` abzuleiten.
 *
 * Warum das gefährlich ist: diese Tests sind bewusst so gebaut, dass sie den
 * Korpus-Block bei fehlendem Cache ÜBERSPRINGEN statt rot zu werden (siehe
 * `morphologieCacheVorhanden()`). Bei einem Versionswechsel (zuletzt v2 -> v3,
 * 2026-09) bleibt ein fest verdrahteter Pfad auf der alten Version stehen.
 * Solange lokal noch beide Cache-Fassungen vorliegen, bleibt das UNSICHTBAR:
 * der alte Pfad existiert ja noch, der Test läuft grün durch. Nach einem
 * frischen Aufsetzen (nur die neue Version liegt vor) würde derselbe Test
 * plötzlich still übersprungen, OHNE eine einzige Assertion auszuführen —
 * und ohne dass es in einer flüchtig gelesenen CI-Ausgabe auffällt.
 *
 * Dieser Test durchsucht deshalb JEDE Quelldatei unter `src/` nach dem
 * Muster "morphologie" gefolgt (durch Anführungszeichen/Komma/Schrägstrich/
 * Backtick/Leerraum getrennt) von "v" + einer festen Ziffer — genau das
 * Muster eines hartcodierten Versionsordners wie `morphologie/v2` oder
 * `'morphologie', 'v2'`. Ein Treffer außerhalb der explizit erlaubten
 * Ausnahmen bedeutet: irgendwo wurde die Versionsnummer wieder von Hand
 * hingeschrieben statt über den Helfer abgeleitet — Fehler.
 *
 * Ein Verweis der Form `morphologie/v<N>` (Platzhalter, keine Ziffer) oder
 * `` `v${MORPHOLOGIE_SCHEMA_VERSION}` `` (Template-Literal mit Variable)
 * lösen bewusst NICHT aus, weil auf "v" keine Ziffer folgt.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(__dirname, '..', '..');

/**
 * Dateien, in denen die Versionsnummer legitim als Ziffer auftauchen darf:
 *  - diese Datei selbst (ihr eigener Kopf-Kommentar erklärt das Muster mit
 *    Beispielen wie "v2");
 *  - `morphologieCachePfad.ts`: der Helfer selbst, dessen Kopf-Kommentar die
 *    Historie des Fehlers ("Sprung auf morphologie/v2/") dokumentiert;
 *  - `morphologieTypen.ts`: die EINE Stelle, die `MORPHOLOGIE_SCHEMA_VERSION`
 *    definiert und ihre Schema-Historie (v1/v2/v3 als inhaltliche Meilen-
 *    steine, nicht als Cache-Pfad) im Kopf-Kommentar festhält;
 *  - `morphologie.test.ts`: prüft die per `morphologieUrl()` tatsächlich
 *    PRODUZIERTE R2-URL gegen einen Literal-String. Das ist keine eigene
 *    Kopie eines Auflösungswegs, sondern eine gewöhnliche Verhaltensprüfung
 *    der echten Produktionsfunktion — bei einem Versionswechsel schlägt sie
 *    LAUT fehl (String-Mismatch), nicht still übersprungen wie die
 *    Cache-Lese-Tests, die dieser Wächter eigentlich im Blick hat.
 */
const AUSNAHMEN = new Set([
  join(__dirname, 'keinFestverdrahteterMorphologiePfad.test.ts'),
  join(__dirname, 'morphologieCachePfad.ts'),
  join(__dirname, 'morphologieTypen.ts'),
  join(__dirname, 'morphologie.test.ts'),
]);

const FEST_VERDRAHTETER_PFAD = /morphologie[/'",`\s]{0,8}v\d/i;

function quellDateien(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...quellDateien(full));
      continue;
    }
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    out.push(full);
  }
  return out;
}

describe('kein Quelltext unter src/ verdrahtet die Morphologie-Cache-Version fest', () => {
  const dateien = quellDateien(SRC_DIR).filter((f) => !AUSNAHMEN.has(f));

  it('Selbstkontrolle: findet überhaupt eine nennenswerte Anzahl Quelldateien (Suche läuft wirklich)', () => {
    expect(dateien.length).toBeGreaterThan(50);
  });

  it('Selbstkontrolle: die Ausnahmeliste zeigt auf tatsächlich existierende Dateien (kein toter Pfad, keine Tippfehler)', () => {
    for (const pfad of AUSNAHMEN) {
      expect(quellDateien(SRC_DIR)).toContain(pfad);
    }
  });

  for (const datei of dateien) {
    const inhalt = readFileSync(datei, 'utf8');
    if (!FEST_VERDRAHTETER_PFAD.test(inhalt)) continue;
    it(`${relative(SRC_DIR, datei)} verdrahtet KEINE Morphologie-Cache-Version fest`, () => {
      // Nur Dateien mit einem Treffer bekommen einen `it()` — so bleibt die
      // Testliste bei Erfolg kurz, und ein neuer Verstoß erzeugt sofort einen
      // benannten, roten Testfall statt eines stummen Sammel-Fails.
      expect(FEST_VERDRAHTETER_PFAD.test(inhalt)).toBe(false);
    });
  }
});
