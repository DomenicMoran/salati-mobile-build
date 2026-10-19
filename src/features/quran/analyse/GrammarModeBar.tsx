// Grammatik-Auswahl in [surah].tsx und mushaf.tsx. Der erste Button öffnet
// die gleichzeitige Gesamtanalyse; die folgenden fünf Chips wählen ergänzend
// einen einzelnen Fokus-Farbmodus. Radio-Verhalten der Fokus-Chips:
// Antippen des bereits aktiven Modus schaltet ihn wieder aus (zurück zu
// 'aus'), Antippen eines anderen wechselt direkt — nie zwei gleichzeitig an.
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

import { Fachbegriff } from './Fachbegriff';
import { FARB_MODI, FARB_MODUS_ICON, farbModusAr, farbModusLabel, type FarbModus } from './grammarColorModes';

export interface GrammarModeBarProps {
  modus: FarbModus;
  onChange: (modus: FarbModus) => void;
  gesamtanalyse?: boolean;
  onToggleGesamtanalyse?: () => void;
  scheme: 'light' | 'dark';
  sepia?: boolean;
}

export function GrammarModeBar({ modus, onChange, gesamtanalyse, onToggleGesamtanalyse, scheme, sepia }: GrammarModeBarProps) {
  const { t } = useTranslation();
  const colors = Colors[scheme];
  return (
    <View style={styles.row}>
      {onToggleGesamtanalyse && (
        <Pressable
          onPress={onToggleGesamtanalyse}
          accessibilityRole="button"
          accessibilityState={{ selected: !!gesamtanalyse }}
          accessibilityLabel={t('quran.wortAnalyse.totalModeLabel')}
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <ThemedView type={gesamtanalyse ? 'backgroundSelected' : 'backgroundElement'} style={[styles.chip, styles.chipRow]}>
            <IconSymbol name="layers-outline" size={13} color={gesamtanalyse ? colors.accent : colors.text} />
            <ThemedText type="smallBold" themeColor={gesamtanalyse ? 'accent' : 'text'} sepia={sepia}>
              {t('quran.wortAnalyse.totalModeLabel')}
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}
      {FARB_MODI.map((m) => {
        const active = modus === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(active ? 'aus' : m)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={farbModusLabel(m, t)}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={[styles.chip, styles.chipRow]}>
              <IconSymbol name={FARB_MODUS_ICON[m]} size={13} color={active ? colors.accent : colors.text} />
              <ThemedText type="small" themeColor={active ? 'accent' : 'text'} sepia={sepia}>
                <Fachbegriff text={farbModusLabel(m, t)} ar={farbModusAr(m, t)} />
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
