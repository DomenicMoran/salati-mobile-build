import { Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

/**
 * iOS-artige Suchleiste für den Einstellungs-Screen: abgerundetes "Pill"-Feld
 * mit Lupen-Icon links und Löschen-Button rechts, sobald etwas eingetippt ist.
 * Kapselt Styling + RTL-Spiegelung, damit settings.tsx nur value/onChange
 * verdrahten muss. Live-Filter (welche Sektionen sichtbar sind) liegt bewusst
 * NICHT hier, sondern beim Aufrufer — diese Komponente ist rein präsentational.
 */
export function SettingsSearchBar({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <ThemedView type="backgroundElement" style={[styles.wrap, rtl && styles.wrapRtl]}>
      <IconSymbol name="search-outline" size={17} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('settings.search')}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        accessibilityLabel={t('settings.search')}
        style={[styles.input, rtl && styles.inputRtl, { color: colors.text }]}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <IconSymbol name="close-circle" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two : Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  wrapRtl: { flexDirection: 'row-reverse' },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  inputRtl: { textAlign: 'right' },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
