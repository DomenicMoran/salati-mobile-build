import { Text, type TextProps, type TextStyle, StyleSheet } from 'react-native';

import { useQuranFont } from '@/features/quran/useQuranFont';

export type QuranArabicTextProps = Omit<TextProps, 'children'> & {
  children: string;
  /** Basis-Schriftgrad vor Koran-Metrik-Anpassung. */
  baseFontSize?: number;
  baseLineHeight?: number;
};

/**
 * Arabischer Koran-Text (Surennamen, API-`name`, Einstellungsproben): immer die
 * aktive Koran-Schrift + `adaptQuranText`, nie die UI-Systemschrift — sonst
 * fehlen KFGQPC-Zeichen wie U+06E1 (Sukūn) und es entstehen .notdef-Kästchen.
 */
export function QuranArabicText({
  children,
  style,
  baseFontSize = 18,
  baseLineHeight = 32,
  ...rest
}: QuranArabicTextProps) {
  const quranFont = useQuranFont();
  const metrics = quranFont.metrics(baseFontSize, baseLineHeight);
  const textStyle: TextStyle = {
    ...quranFont.style,
    fontSize: metrics.fontSize,
    lineHeight: metrics.lineHeight,
    writingDirection: 'rtl',
    textAlign: 'right',
  };

  return (
    <Text style={[textStyle, styles.root, style]} {...rest}>
      {quranFont.text(children)}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    includeFontPadding: false,
  },
});
