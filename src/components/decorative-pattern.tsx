import Svg, { Path, type SvgProps } from 'react-native-svg';

/**
 * Dezentes islamisches Achtstern-Rosetten-Muster (greift das App-Icon-Motiv
 * auf) als rein dekoratives SVG-Hintergrundelement — ersetzt keine Inhalte,
 * sorgt aber für visuelle Tiefe statt reiner Flächenfarbe (User-Feedback
 * "sieht lieblos aus"). Bewusst als handgezeichnetes SVG statt KI-generiertem
 * Bild: kein neuer Account/API-Key nötig (Projekt-Regel "kein Geld
 * ausgeben"), und ein geometrisches Rosettenmuster ist ein authentisches,
 * lizenzfreies Motiv islamischer Ornamentik statt einer Foto-Illustration.
 */
// 16 Punkte (8 außen bei R=48, 8 innen bei r=34 — nah an R für weiche,
// rundliche Zacken statt eines spitzen "Ninja-Sterns") im 22.5°-Abstand um
// den Mittelpunkt (50,50), passend zur weichen Rosettenform des App-Icons.
const EIGHT_POINT_STAR_PATH =
  'M50 2 L63.01 18.59 L83.94 16.06 L81.41 36.99 L98 50 L81.41 63.01 L83.94 83.94 ' +
  'L63.01 81.41 L50 98 L36.99 81.41 L16.06 83.94 L18.59 63.01 L2 50 L18.59 36.99 ' +
  'L16.06 16.06 L36.99 18.59 Z';

export function EightPointStar({ color = '#D4AF37', ...props }: SvgProps & { color?: string }) {
  return (
    <Svg viewBox="0 0 100 100" fill="none" {...props}>
      <Path d={EIGHT_POINT_STAR_PATH} fill={color} />
    </Svg>
  );
}

/** Drei überlappende, unterschiedlich große Rosetten als Ecken-Deko — für
 * Hero-Sektionen gedacht, absolute Positionierung liegt beim Aufrufer. */
export function StarClusterDecoration({ color = '#D4AF37', opacity = 0.08 }: { color?: string; opacity?: number }) {
  return (
    <>
      <EightPointStar color={color} width={200} height={200} style={{ opacity, position: 'absolute', top: -50, right: -70 }} />
      <EightPointStar color={color} width={130} height={130} style={{ opacity, position: 'absolute', bottom: -30, left: -55 }} />
    </>
  );
}
