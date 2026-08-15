// Einheitliche Navigations-ZEILE für Studium (Lernen-Tab), „Mehr" und Medien.
//
// Bis zum Design-Audit 2026-07-29 war jede dieser Zeilen eine eigene, beschattete
// PressableCard mit Reanimated-Press-Skalierung — bei ~30 Einträgen im „Mehr"-Tab
// also 30 Schattenebenen und 30 Worklets nur für Hover-Feedback. Jetzt sind es
// schlichte Zeilen INNERHALB einer ListCard (components/ui/list.tsx): dieselbe
// Grammatik wie die Navigationszeilen der Einstellungen (Symbol in der Zeile,
// Label, Chevron), ohne Schatten und ohne zusätzliche Animation.
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, IconBadge, IconBadgeRadius, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';

export function NavTile({
  label,
  icon,
  index,
  onPress,
}: {
  label: string;
  icon: IconName;
  index: number;
  onPress: () => void;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Audit 2026-07-27 (N5): in ar/fa/ur/ps standen Icon-Badge + Label links,
  // während der DisclosureChevron bereits korrekt nach links zeigte. Beide
  // Zeilen-Achsen werden hier gespiegelt, damit Lernen- und Mehr-Hub (die
  // beiden Haupt-Navigationsflächen) vollständig rechtsläufig lesen.
  const rtl = useRtl();
  return (
    <AnimatedListItem index={index}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          Platform.OS === 'web' ? navTileStyles.pressableWeb : undefined,
          pressed && navTileStyles.pressed,
        ]}>
        <View style={[navTileStyles.row, rtl && navTileStyles.rowRtl]}>
          <ThemedView type="backgroundSelected" style={navTileStyles.iconBadge}>
            <IconSymbol name={icon} size={18} color={colors.accent} />
          </ThemedView>
          <ThemedText
            type="default"
            numberOfLines={2}
            style={[navTileStyles.label, rtl && navTileStyles.labelRtl]}>
            {label}
          </ThemedText>
          <DisclosureChevron size={16} color={colors.textSecondary} />
        </View>
      </Pressable>
    </AnimatedListItem>
  );
}

export const navTileStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  label: { flex: 1, minWidth: 0 },
  labelRtl: { textAlign: 'right' },
  iconBadge: {
    width: IconBadge.row,
    height: IconBadge.row,
    borderRadius: IconBadgeRadius.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  pressableWeb: { cursor: 'pointer' },
});
