// SVG-Diagramm einer Gebets-Aufstellung (Dschamāʿa) — rendert eine
// `AufstellungsKonstellation` aus daten.ts generisch: eine Liste von Reihen
// (vorn = Imam, hinten = letzte Reihe), jede Reihe eine Liste von Rollen.
//
// Vorbild für SVG-in-RN: src/app/(tabs)/qibla.tsx:248-316 (Kompass-Rose).
// Wie dort: nur Farb-Tokens aus constants/theme.ts, keine hartkodierten
// Hex-Werte außer Brand.gold (dieselbe dekorative Ausnahme wie beim
// Qibla-Kompass).
//
// Barrierefreiheit für Farbsehschwäche (theme.ts-Konvention, s.
// GrammarColors-Kommentar dort): Rollen unterscheiden sich NICHT nur über
// Farbe, sondern über Form (Kreis/Quadrat/Raute), Linienstil (durchgezogen/
// gestrichelt) UND eine Beschriftung unter jeder Form. Der Imam ist zusätzlich
// größer und trägt ein Sternsymbol.
//
// WARUM DIE BESCHRIFTUNGEN NICHT IN `SvgText` STEHEN: react-native-svg
// zeichnet Text über eine eigene Glyph-Engine ohne Schriftformung
// (Shaping/Ligaturen) für komplexe Schriften. Arabisch, Urdu, Persisch und
// Paschtu sind kursive Verbundschriften — jedes Zeichen sieht je nach
// Nachbarn anders aus. Ohne Shaping zerfällt das Wort in isolierte
// Einzelzeichen statt Verbundschrift (am Gerät beobachtet: "القبلة"/"الإمام"
// als lose Buchstaben) — derselbe Text rendert in einem normalen `Text`
// (System-Textengine) auf jeder anderen Seite dieser App fehlerfrei. Deshalb
// zeichnet das SVG nur die Formen, jede Beschriftung liegt als natives
// `Text`-Overlay lagegenau darüber (dafür bekommt `Svg` eine feste
// Pixelbreite statt "100%", damit die Overlay-Position nicht vom
// SVG-eigenen Skalierungsfaktor abhängt).
import Svg, { G, Path, Polygon, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Colors, type ThemeColor } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import type { AufstellungsRolle } from './daten';

const SLOT = 68;
const ROW_GAP = 58;
const TOP_Y = 58;
const SIDE_PADDING = 24;
const MIN_WIDTH = 220;

interface AufstellungDiagrammProps {
  reihen: AufstellungsRolle[][];
  imamLabel: string;
  mannLabel: string;
  frauLabel: string;
  qiblaLabel: string;
  accessibilityLabel: string;
}

interface Person {
  x: number;
  y: number;
  rolle: AufstellungsRolle;
  label: string;
  key: string;
}

export function AufstellungDiagramm({
  reihen,
  imamLabel,
  mannLabel,
  frauLabel,
  qiblaLabel,
  accessibilityLabel,
}: AufstellungDiagrammProps) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const maxCols = Math.max(...reihen.map((reihe) => reihe.length));
  const width = Math.max(MIN_WIDTH, maxCols * SLOT + SIDE_PADDING * 2);
  const height = TOP_Y + (reihen.length - 1) * ROW_GAP + 54;
  const centerX = width / 2;

  const personen: Person[] = reihen.flatMap((reihe, rowIndex) => {
    const y = TOP_Y + rowIndex * ROW_GAP;
    const rowWidth = reihe.length * SLOT;
    const startX = centerX - rowWidth / 2 + SLOT / 2;
    return reihe.map((rolle, i) => ({
      x: startX + i * SLOT,
      y,
      rolle,
      label: rolle === 'imam' ? imamLabel : rolle === 'mann' ? mannLabel : frauLabel,
      key: `${rowIndex}-${i}`,
    }));
  });

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.wrap}>
      <View style={{ width, height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Qibla-Richtung: fester Pfeil oben, wie beim Qibla-Kompass. */}
          <Path d={`M ${centerX} 4 L ${centerX + 7} 18 L ${centerX - 7} 18 Z`} fill={Brand.gold} />

          {personen.map((p) => (
            <PersonForm key={p.key} rolle={p.rolle} x={p.x} y={p.y} colors={colors} />
          ))}
        </Svg>

        {/* Beschriftungen als natives Text-Overlay, s. Kopfkommentar. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Text
            style={{
              position: 'absolute',
              left: centerX - 40,
              top: 22,
              width: 80,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: '700',
              color: colors.accent,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {qiblaLabel}
          </Text>

          {personen.map((p) => (
            <Text
              key={p.key}
              style={{
                position: 'absolute',
                left: p.x - SLOT / 2,
                top: p.y + 20,
                width: SLOT,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: '600',
                color: colors.text,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}>
              {p.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Nur die Form (Kreis/Quadrat/Raute) plus — beim Imam — das Sternsymbol.
 *  Der Stern ist KEIN Verbundschrift-Zeichen (kein Shaping-Bedarf, jede
 *  Systemschrift trägt ihn als eigenständiges Zeichen) und bleibt deshalb im
 *  SVG, wo er lagegenau in der Kreismitte sitzt — anders als die
 *  Beschriftungen betrifft ihn der Shaping-Fehler aus dem Kopfkommentar
 *  nicht. Vgl. [[feedback_gezeichnete_zeichen_statt_schriftzeichen]]: DORT
 *  ging es um Zeichen, die der Systemschrift fehlen (leeres Kästchen) — der
 *  Stern (★, U+2605) ist dagegen in praktisch jeder Schrift vorhanden. */
function PersonForm({
  rolle,
  x,
  y,
  colors,
}: {
  rolle: AufstellungsRolle;
  x: number;
  y: number;
  colors: Record<ThemeColor, string>;
}) {
  const shapeFill = colors.backgroundElement;

  return (
    <G>
      {rolle === 'imam' && (
        <G>
          <Circle cx={x} cy={y} r={16} fill={shapeFill} stroke={colors.accent} strokeWidth={3} />
          <SvgText x={x} y={y + 5} textAnchor="middle" fontSize={14} fill={Brand.gold}>
            ★
          </SvgText>
        </G>
      )}
      {rolle === 'mann' && (
        <Rect
          x={x - 12}
          y={y - 12}
          width={24}
          height={24}
          rx={4}
          fill={shapeFill}
          stroke={colors.textSecondary}
          strokeWidth={2}
        />
      )}
      {rolle === 'frau' && (
        <Polygon
          points={`${x},${y - 15} ${x + 15},${y} ${x},${y + 15} ${x - 15},${y}`}
          fill={shapeFill}
          stroke={colors.textSecondary}
          strokeWidth={2}
          strokeDasharray="3,2"
        />
      )}
    </G>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
