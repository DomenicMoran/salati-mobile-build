// Abzeichen „Inhalt auf Deutsch" fuer Medienkarten und Player.
//
// Erscheint NUR, wenn die Oberflaechensprache von der Inhaltssprache abweicht
// (s. content-language.ts). Fuer deutsche Nutzer aendert sich nichts; fuer die
// uebrigen 13 Sprachen steht der Hinweis dort, wo er gebraucht wird: VOR dem
// Antippen und vor dem Offline-Download.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { contentLanguageLabel } from './content-language';

export interface ContentLanguageBadgeProps {
  /** `lang` aus dem Medien-Contract; fehlt es, gilt Deutsch (s. Modulkopf). */
  lang?: string;
  /** `compact` fuer Listenzeilen (11 pt, neben Dauer/Offline-Kennzeichen),
   *  Standard fuer Player-Kopfzeilen. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ContentLanguageBadge({ lang, compact = false, style }: ContentLanguageBadgeProps) {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const label = contentLanguageLabel(t, locale, lang);
  if (!label) return null;
  return (
    <View
      style={[styles.badge, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}>
      <IconSymbol name="language-outline" size={compact ? 13 : 15} color={colors.textSecondary} />
      <ThemedText
        type="small"
        themeColor="textSecondary"
        numberOfLines={1}
        style={compact ? styles.compactLabel : undefined}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  compactLabel: { fontSize: 11 },
});
