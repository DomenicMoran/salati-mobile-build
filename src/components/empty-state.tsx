// Wiederverwendbarer Leer-Zustand fuer Listen-/Sammlungs-Screens (Lesezeichen,
// Verlauf, Suchergebnisse, Downloads, ...). Icon + kurzer Text + optionaler
// Call-to-Action statt einer nackten Textzeile - konsistent ueber alle Screens
// hinweg (Audit 2026-07-21: Empty-States).
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Kompaktere Variante fuer eingebettete Nutzung (z. B. innerhalb einer
   * Settings-Section statt als eigener, zentrierter Screen-Bereich). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, text, actionLabel, onAction, compact, style }: EmptyStateProps) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <ThemedView type="backgroundElement" style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
        <IconSymbol name={icon} size={compact ? 18 : 26} color={colors.textSecondary} />
      </ThemedView>
      <ThemedText type={compact ? 'small' : 'default'} style={styles.title}>
        {title}
      </ThemedText>
      {text && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {text}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <PressableCard onPress={onAction} type="backgroundSelected" style={styles.action}>
          <ThemedText type="smallBold" themeColor="accent">
            {actionLabel}
          </ThemedText>
        </PressableCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  containerCompact: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  title: { textAlign: 'center' },
  text: { textAlign: 'center' },
  action: { marginTop: Spacing.one, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
});
