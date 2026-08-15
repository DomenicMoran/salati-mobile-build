import { Colors } from './theme';

/**
 * Kontrast-Regression (Audit 2026-07-27, N12 + P2): `accent` und
 * `textSecondary` sind in der App als TEXT-Farben auf allen vier
 * Flächen-Tokens im Einsatz (144 `type="backgroundSelected"`-Nutzungen allein
 * für den generischen EmptyState-CTA und die Mehr-Tab-Suchkarte). Vor dem
 * Audit fielen sie auf den dunkleren Light-Flächen unter die AA-Schwelle
 * (accent 4.24:1 auf `backgroundSelected`, textSecondary 4.29:1 auf
 * `groupedBackground`). Dieser Test hält das fest, damit ein späterer
 * Paletten-Dreh nicht unbemerkt wieder darunter rutscht.
 */

// WCAG 2.x Relative Luminanz + Kontrastverhältnis.
function toRgb(color: string): [number, number, number] {
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => Number(p.trim()));
    return [parts[0], parts[1], parts[2]];
  }
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(color: string): number {
  const [r, g, b] = toRgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['background', 'backgroundElement', 'backgroundSelected', 'groupedBackground'] as const;

describe('theme contrast (WCAG AA, 4.5:1 für Fließtext)', () => {
  it('bekannte Referenzwerte werden korrekt berechnet', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#f7f3ea', '#f7f3ea')).toBeCloseTo(1, 5);
  });

  for (const scheme of ['light', 'dark'] as const) {
    for (const surface of SURFACES) {
      it(`${scheme}: accent auf ${surface} erreicht AA`, () => {
        expect(contrast(Colors[scheme].accent, Colors[scheme][surface])).toBeGreaterThanOrEqual(4.5);
      });

      it(`${scheme}: text auf ${surface} erreicht AA`, () => {
        expect(contrast(Colors[scheme].text, Colors[scheme][surface])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // textSecondary ist im Dark-Theme halbtransparent (rgba über der Fläche) —
  // dort greift die Alpha-Kompositierung, deshalb nur das Light-Theme
  // (deckende Farbe) direkt prüfbar.
  for (const surface of SURFACES) {
    it(`light: textSecondary auf ${surface} erreicht AA`, () => {
      expect(contrast(Colors.light.textSecondary, Colors.light[surface])).toBeGreaterThanOrEqual(4.5);
    });
  }

  // Sepia-Reader (app/(tabs)/quran/mushaf.tsx) nutzt eigene Flächen, auf denen
  // dieselben Textfarben liegen.
  const SEPIA_BG = '#f1e7d0';
  const SEPIA_CARD = '#e9dcbf';
  for (const [name, bg] of [
    ['SEPIA_BG', SEPIA_BG],
    ['SEPIA_CARD', SEPIA_CARD],
  ] as const) {
    it(`light: accent und textSecondary auf ${name} erreichen AA`, () => {
      expect(contrast(Colors.light.accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(Colors.light.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
