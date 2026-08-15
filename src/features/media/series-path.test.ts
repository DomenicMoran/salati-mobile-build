// Vertragstest gegen die EINE Reihen-Quelle: podcast/scripts/series.py.
//
// Warum hier und nicht nur in Python: `npx jest` in apps/mobile ist der Lauf,
// der vor jedem Release gruen sein muss. Die Reihen-Zuordnung entscheidet, was
// die App in welcher Sektion und an welcher Stelle des Lernwegs zeigt — sie
// gehoert damit in denselben Lauf. Der Python-Selbsttest
// (podcast/scripts/test_series.py) prueft zusaetzlich das harte Abbrechen von
// `series_for()`.
//
// Vorgeschichte (Audit 2026-07-27, MEDIEN-LUECKEN.md §4.2): Podcast, Video und
// Reels pflegten je eine eigene Tabelle. Der Video-Uploader kannte nur fuenf
// Reihen und fiel fuer alles Uebrige still auf "grammar" zurueck — 19 der 62
// Videos standen dadurch live unter „Sprache des Qur'an".
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERIES_PY = join(__dirname, '../../../../../podcast/scripts/series.py');
const MANIFEST_JSON = join(__dirname, '../../../../../podcast/manifest.json');

interface Reihe {
  key: string;
  title: string;
  ranges: [number, number][];
  order: number;
}

/** Liest SERIES_PATH aus series.py — bewusst die echte Quelle, keine Kopie:
 *  eine Kopie im Test wuerde exakt den Zustand nachbauen, den dieser Test
 *  verhindern soll (zwei Wahrheiten fuer dieselbe Zuordnung). */
function readSeriesPath(): Reihe[] {
  const src = readFileSync(SERIES_PY, 'utf-8');
  const block = src.slice(src.indexOf('SERIES_PATH'), src.indexOf('\n]', src.indexOf('SERIES_PATH')));
  const entry = /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*\[([^\]]*(?:\([^)]*\)[^\]]*)*)\]\s*\)/g;
  const reihen: Reihe[] = [];
  for (const m of block.matchAll(entry)) {
    const ranges = [...m[3].matchAll(/\((\d+)\s*,\s*(\d+)\)/g)].map(
      (r) => [Number(r[1]), Number(r[2])] as [number, number],
    );
    reihen.push({ key: m[1], title: m[2], ranges, order: reihen.length + 1 });
  }
  return reihen;
}

function seriesFor(reihen: Reihe[], no: number): Reihe | undefined {
  return reihen.find((r) => r.ranges.some(([lo, hi]) => no >= lo && no <= hi));
}

function produzierteFolgen(): number[] {
  const manifest = JSON.parse(readFileSync(MANIFEST_JSON, 'utf-8')) as {
    episodes: { episode_no: number }[];
  };
  return manifest.episodes.map((e) => e.episode_no);
}

describe('Reihen-Zuordnung (podcast/scripts/series.py)', () => {
  const reihen = readSeriesPath();

  it('wird ueberhaupt gelesen (Regex trifft die Tabelle)', () => {
    expect(reihen.length).toBeGreaterThanOrEqual(10);
    expect(reihen[0].key).toBe('lesen');
    expect(reihen.every((r) => r.ranges.length > 0)).toBe(true);
  });

  // DER Test: eine produzierte Folge, die in keinem Bereich liegt, macht ihn
  // rot. Genau dieser Fall lief frueher still in eine Default-Reihe.
  it('ordnet jede produzierte Folge genau einer Reihe zu', () => {
    const ohneReihe = produzierteFolgen().filter((no) => !seriesFor(reihen, no));
    expect(ohneReihe).toEqual([]);
  });

  it('laesst eine Folge ausserhalb aller Bereiche unzugeordnet (kein stiller Rueckfall)', () => {
    expect(seriesFor(reihen, 0)).toBeUndefined();
    expect(seriesFor(reihen, 999)).toBeUndefined();
  });

  it('ordnet keine Folge zwei Reihen zu', () => {
    const gesehen = new Map<number, string>();
    for (const r of reihen) {
      for (const [lo, hi] of r.ranges) {
        for (let n = lo; n <= hi; n++) {
          expect(gesehen.get(n)).toBeUndefined();
          gesehen.set(n, r.key);
        }
      }
    }
  });

  it('stellt die Lese-Reihe an den Anfang des Lernwegs', () => {
    const lesen = seriesFor(reihen, 63);
    const grammar = seriesFor(reihen, 1);
    expect(lesen?.key).toBe('lesen');
    expect(lesen?.order).toBe(1);
    expect(grammar?.order).toBeGreaterThan(1);
  });

  it('nennt die Reihen der frueher falsch einsortierten Videos (38-56) richtig', () => {
    const erwartet: [number, string][] = [
      [38, 'suren'],
      [47, 'suren'],
      [48, 'madinah'],
      [49, 'madinah'],
      [50, 'aqida'],
      [52, 'aqida'],
      [53, 'seerah'],
      [55, 'seerah'],
      [56, 'review'],
    ];
    for (const [no, key] of erwartet) {
      expect([no, seriesFor(reihen, no)?.key]).toEqual([no, key]);
    }
  });
});
