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

// Manche Beschriftungen tragen einen Fachbegriff in Klammern mit, der
// IMMER sichtbar bleiben muss (z. B. "Wurzeln & Wortschatz (جذر)" im
// Lexikon). Statt ihn in dieselbe Zeile zu zwingen — was bei vier langen
// Reitern zu horizontalem Seiten-Überlauf führte (Prüfbefund 2026-09-05:
// body.scrollWidth 550 bei 430px Breite, der 4. Reiter war unsichtbar) —
// wird er als zweite, kleinere Zeile innerhalb DERSELBEN Text-Komponente
// dargestellt (Zeilenumbruch statt getrenntes Element): Tests/Screenreader
// lesen weiterhin den vollen, unveränderten Beschriftungstext, weil
// Testing-Library Leerraum (inkl. `\n`) beim Textvergleich normalisiert.
// Labels ohne Klammer-Suffix (z. B. "Woche"/"Monat") durchlaufen das
// Regex unverändert einzeilig, bestehende Aufrufer sind also unberührt.
const BRACKET_SUFFIX_RE = /^(.*\S)\s+(\([^()]+\))\s*$/;

function splitLabel(label: string): { main: string; bracket: string | null } {
  const match = label.match(BRACKET_SUFFIX_RE);
  return match ? { main: match[1], bracket: match[2] } : { main: label, bracket: null };
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
        const { main, bracket } = splitLabel(tab.label);
        const color = active ? 'accent' : 'textSecondary';
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
              {/* EIN Text-Knoten (Zeilenumbruch statt zweitem Element): der
                  volle Beschriftungstext bleibt für Tests/Screenreader als
                  ein zusammenhängender String auffindbar. */}
              <ThemedText type="smallBold" themeColor={color} style={styles.mainLabel}>
                {main}
                {bracket ? '\n' : null}
                {bracket ? (
                  <ThemedText type="small" themeColor={color} style={styles.subLabel}>
                    {bracket}
                  </ThemedText>
                ) : null}
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
    // Prüfbefund 2026-09-05: ohne flexWrap ragten vier lange Reiter (Lexikon,
    // je mit arabischem Fachbegriff) über den Bildschirmrand hinaus und
    // erzeugten Seiten-Überlauf statt in eine zweite Zeile umzubrechen. Bei
    // Aufrufern mit wenigen/kurzen Reitern (Themen, Tracker) bleibt eine
    // Zeile, `wrap` greift dort also nie sichtbar ein.
    flexWrap: 'wrap',
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
    alignItems: 'center',
  },
  mainLabel: { textAlign: 'center' },
  // Der Fachbegriff in Klammern (z. B. "جذر") begleitet die Beschriftung auf
  // einer eigenen, kleineren Zeile statt die Pille in die Breite zu ziehen.
  subLabel: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.7 },
});
