// Eine Eigenschafts-Zeile (Genus, Numerus, Bestimmtheit, Kasus, Tempus, …)
// mit sichtbarer Beleg-/Herleitungs-Kennzeichnung (grammatik.herkunft.*).
//
// "Hergeleitet" darf laut Aufgabenstellung NICHT wie ein Befund aussehen —
// deshalb bewusst zurückhaltender gesetzt (kursiv, reduzierte Deckkraft,
// keine eigene Akzentfarbe), während "beleg" in normaler Textstärke steht.
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { Fachbegriff } from './Fachbegriff';
import type { MerkmalAnzeige } from './wortAnalyseModel';

export function MerkmalZeile({ merkmal }: { merkmal: MerkmalAnzeige }) {
  const rtl = useRtl();
  const hergeleitet = merkmal.herkunft === 'hergeleitet';

  return (
    <View style={styles.zeile}>
      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
        <Fachbegriff text={merkmal.label} ar={merkmal.ar} />
      </ThemedText>
      <View style={[styles.wertZeile, rtl && styles.wertZeileRtl]}>
        <ThemedText type="default" style={rtl && styles.textRtl}>
          <Fachbegriff text={merkmal.wertName} ar={merkmal.wertAr} />
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={hergeleitet ? 'textSecondary' : 'accent'}
          style={hergeleitet ? styles.herkunftHergeleitet : styles.herkunftBeleg}
          accessibilityLabel={merkmal.herkunftInfo}>
          {merkmal.herkunftLabel}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zeile: { gap: 2, marginBottom: Spacing.two },
  wertZeile: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  wertZeileRtl: { flexDirection: 'row-reverse' },
  herkunftBeleg: { fontWeight: '600' },
  // Kursiv + reduzierte Deckkraft: eine Herleitung ist eine grammatische
  // Konvention, kein Fund im Korpus — soll nicht wie einer aussehen.
  herkunftHergeleitet: { fontStyle: 'italic', opacity: 0.75 },
  textRtl: { textAlign: 'right' },
});
