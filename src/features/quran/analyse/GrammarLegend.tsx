// Kompakte Legende zum jeweils aktiven Grammatik-Farbmodus — Farbe ist nie
// die einzige Information: jede Zeile nennt den Fachbegriff UND (wo
// vorhanden) den arabischen Terminus als Klartext (Auftrag). Rendert nichts,
// wenn kein Modus aktiv ist ('aus').
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { farbLegende, type FarbModus } from './grammarColorModes';
import { Fachbegriff } from './Fachbegriff';
import { useTranslation } from '@/lib/i18n';

export interface GrammarLegendProps {
  modus: FarbModus;
  scheme: 'light' | 'dark';
  sepia?: boolean;
}

export function GrammarLegend({ modus, scheme, sepia }: GrammarLegendProps) {
  const { t } = useTranslation();
  if (modus === 'aus') return null;
  const eintraege = farbLegende(scheme, modus, t);
  return (
    <View style={styles.row}>
      {eintraege.map((e) => (
        <View key={e.label} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: e.color }]} />
          <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
            <Fachbegriff text={e.label} ar={e.ar} />
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
