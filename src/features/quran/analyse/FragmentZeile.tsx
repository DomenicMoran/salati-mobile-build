// Eine Zeile der Fragment-Aufschlüsselung (Punkt 3 der Wortanalyse): die
// arabische Form des Segments, optisch abgesetzt, plus Rolle (Klartext +
// arabischer Fachbegriff) und Erklärsatz. Stamm vs. Präfix/Suffix ist über
// Hintergrundfläche + Akzentfarbe klar unterscheidbar, OHNE neue Farben:
// backgroundSelected/accent für den Stamm, backgroundElement/textSecondary
// für angehängte Teile — beides bestehende Tokens aus constants/theme.ts.
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import type { QuranFontResult } from '../useQuranFont';
import { Fachbegriff } from './Fachbegriff';
import type { FragmentAnzeige } from './wortAnalyseModel';

export interface FragmentZeileProps {
  fragment: FragmentAnzeige;
  quranFont: QuranFontResult;
}

export function FragmentZeile({ fragment, quranFont }: FragmentZeileProps) {
  const rtl = useRtl();
  const istStamm = fragment.kind === 'stem';

  return (
    <ThemedView
      type={istStamm ? 'backgroundSelected' : 'backgroundElement'}
      style={[styles.box, rtl && styles.boxRtl]}
      accessibilityRole="summary"
      accessibilityLabel={`${fragment.kindLabel}: ${fragment.name}`}>
      <View style={[styles.head, rtl && styles.headRtl]}>
        <ThemedText style={[styles.arabic, quranFont.style]}>{quranFont.text(fragment.segment.text)}</ThemedText>
        <ThemedText type="small" themeColor={istStamm ? 'accent' : 'textSecondary'} style={styles.kindLabel}>
          {fragment.kindLabel}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={rtl && styles.textRtl}>
        <Fachbegriff text={fragment.name} ar={fragment.ar} />
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
        {fragment.info}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: { padding: Spacing.two, borderRadius: Spacing.two, gap: 4 },
  boxRtl: { alignItems: 'flex-end' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headRtl: { flexDirection: 'row-reverse' },
  arabic: { fontSize: 24, lineHeight: 36 },
  kindLabel: { textTransform: 'uppercase', letterSpacing: 0.5 },
  textRtl: { textAlign: 'right' },
});
