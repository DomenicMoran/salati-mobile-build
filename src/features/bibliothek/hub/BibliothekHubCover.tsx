import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';

function coverInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type Props = {
  title: string;
  /** Optional remote cover — Bibliothek nutzt derzeit nur Typo-Platzhalter. */
  imageUrl?: string | null;
  compact?: boolean;
};

export function BibliothekHubCover({ title, compact }: Props) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const initials = coverInitials(title);

  return (
    <View
      style={[
        styles.root,
        compact ? styles.compact : null,
        { backgroundColor: colors.backgroundSelected, borderColor: colors.separator },
      ]}
      accessibilityRole="image"
      accessibilityLabel={title}>
      <ThemedText type="smallBold" style={{ color: colors.accent }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 52,
    height: 68,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  compact: {
    width: 44,
    height: 58,
  },
});
