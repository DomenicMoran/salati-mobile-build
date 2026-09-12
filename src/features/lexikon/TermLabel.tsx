// Zeigt ein {name, ar}-Fachbegriffs-Paar (siehe grammatikTerm.ts) einheitlich
// an: der arabische Begriff optisch abgesetzt (eigene Zeile bzw. gedämpfte
// Sekundärfarbe), nie als gleichrangiger Fließtext neben der Übersetzung
// (Vorgabe des Auftraggebers, Lexikon-Ausbau 2026-09-05 — arabische
// Fachbegriffe laufen überall mit, nicht nur an ausgewählten Stellen).
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';

import { normalizeForSearch } from './arabicSearch';

export interface TermLabelTerm {
  name: string;
  ar: string;
}

export interface TermLabelProps {
  term: TermLabelTerm;
  nameType?: ThemedTextProps['type'];
  nameColor?: ThemeColor;
  arType?: ThemedTextProps['type'];
  arColor?: ThemeColor;
  /** 'stacked' (Default) = arabischer Begriff in eigener Zeile darunter,
   *  'inline' = auf derselben Zeile, durch Abstand getrennt (für knappe
   *  Kontexte wie Filter-Chips). */
  layout?: 'stacked' | 'inline';
  style?: StyleProp<ViewStyle>;
  nameStyle?: StyleProp<TextStyle>;
}

/** Zeigt den arabischen Begriff NICHT an, wenn er (nach Normalisierung)
 *  ohnehin mit dem angezeigten Namen identisch wäre — betrifft vor allem die
 *  Sprachen mit arabischer Schrift (ar/fa/ur/ps), wo Name und Fachbegriff
 *  sonst redundant nebeneinander stünden. */
function shouldShowAr(term: TermLabelTerm): boolean {
  if (!term.ar) return false;
  return normalizeForSearch(term.ar) !== normalizeForSearch(term.name);
}

export function TermLabel({
  term,
  nameType = 'default',
  nameColor,
  arType = 'small',
  arColor = 'textSecondary',
  layout = 'stacked',
  style,
  nameStyle,
}: TermLabelProps) {
  const rtl = useRtl();
  const showAr = shouldShowAr(term);
  const align = rtl ? styles.alignRight : styles.alignLeft;

  if (layout === 'inline') {
    return (
      <View style={[styles.inlineRow, rtl && styles.inlineRowRtl, style]}>
        <ThemedText type={nameType} themeColor={nameColor} style={nameStyle}>
          {term.name}
        </ThemedText>
        {showAr ? (
          <ThemedText type={arType} themeColor={arColor}>
            {term.ar}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={style}>
      <ThemedText type={nameType} themeColor={nameColor} style={[align, nameStyle]}>
        {term.name}
      </ThemedText>
      {showAr ? (
        <ThemedText type={arType} themeColor={arColor} style={align}>
          {term.ar}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  inlineRowRtl: { flexDirection: 'row-reverse' },
  alignLeft: { textAlign: 'left' },
  alignRight: { textAlign: 'right' },
});
