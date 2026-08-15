// Kleiner Pill-Umschalter für zwei bis drei gleichrangige Ansichten
// innerhalb eines Screens (z. B. Themen-Sammlungen vs. Tages-Pläne).
// Bewusst generisch statt feature-spezifisch, damit er auch anderswo
// wiederverwendbar bleibt.
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';

export interface SegmentedTab {
  key: string;
  label: string;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function SegmentedTabs({ tabs, activeKey, onChange }: SegmentedTabsProps) {
  // Audit 2026-07-28 (U4): die Reihenfolge der Reiter trägt Bedeutung („zuerst"
  // ist in ar/fa/ur/ps rechts). Als geteilter Baustein gehört die Spiegelung
  // hierher — genau das Muster, das die Entwurfsentscheidung in
  // `hooks/use-rtl.ts` statt eines globalen forceRTL vorsieht.
  const rtl = useRtl();
  return (
    <View style={[styles.row, rtl && styles.rowRtl]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            // Audit 2026-07-27 (P2): „Taste, ausgewählt" sagt nichts über den
            // Umschalt-Charakter — `tab` in einer `tablist` schon.
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.pill}>
              <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
                {tab.label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    // 44pt-Mindesthoehe (Audit 2026-07-27, N8): lineHeight 20 + 2x4 Padding
    // ergab nur 28pt Trefferflaeche.
    minHeight: 44,
    justifyContent: 'center',
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.7 },
});
