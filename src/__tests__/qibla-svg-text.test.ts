/**
 * Regressionstest für den SVG-Verbundschrift-Fehler (siehe Commit de8358d8):
 * react-native-svg formt komplexe Verbundschriften (Arabisch, Urdu, Persisch,
 * Paschtu) nicht — der Text zerfällt in unverbundene Einzelbuchstaben. Der
 * Qibla-Kompass hatte denselben Fehler bei den Himmelsrichtungs-
 * Beschriftungen (N/O/S/W, z. B. Paschtu "east": "ختیځ" / "west": "لویدیځ" —
 * mehrbuchstabige Wörter, die Formung brauchen). Behoben, indem die
 * Beschriftung als natives Text-Overlay über dem SVG liegt statt als
 * `SvgText`-Element darin (gleiches Muster wie
 * features/gebet-gemeinsam/AufstellungDiagramm.tsx).
 *
 * Dieser Test liest die Quelldatei als Text (kein Rendering nötig — das
 * eigentliche Rendering von react-native-svg testet ohnehin nicht die
 * Schriftformung, die passiert erst nativ am Gerät) und stellt sicher, dass
 * künftig kein Übersetzungsaufruf (`t(...)`) wieder in ein `SvgText`-Element
 * einzieht. Das verbleibende SvgText-Element (Kaaba-Emoji 🕋) ist bewusst
 * ausgenommen: ein einzelnes Piktogramm ist keine kursive Verbundschrift und
 * braucht kein Shaping.
 */
import fs from 'fs';
import path from 'path';

const QIBLA_SOURCE_PATH = path.join(__dirname, '..', 'app', '(tabs)', 'qibla.tsx');
const QIBLA_SOURCE = fs.readFileSync(QIBLA_SOURCE_PATH, 'utf8');

function svgTextBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /<SvgText\b[\s\S]*?<\/SvgText>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    blocks.push(match[0]);
  }
  return blocks;
}

describe('qibla.tsx: keine lokalisierten Beschriftungen in SvgText', () => {
  const blocks = svgTextBlocks(QIBLA_SOURCE);

  it('findet überhaupt SvgText-Blöcke (sonst wäre dieser Test wirkungslos)', () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('kein SvgText-Block ruft eine Übersetzungsfunktion (t(...)) auf', () => {
    for (const block of blocks) {
      expect(block).not.toMatch(/\bt\(/);
    }
  });

  it('das einzige verbleibende SvgText ist das nicht-kursive Kaaba-Piktogramm', () => {
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('🕋');
  });

  it('die Himmelsrichtungs-Beschriftung läuft stattdessen über ein natives Text-Overlay', () => {
    expect(QIBLA_SOURCE).toMatch(/directionLabels\.map/);
    expect(QIBLA_SOURCE).toMatch(/<Text\s/);
  });
});
