// "Was ist neu"-Screen: liest die statische Historie aus
// src/features/changelog/changelog.ts. Dezent verlinkt ganz unten im
// Mehr-Screen (src/app/(tabs)/more.tsx) - kein prominenter Eintrag, da sich
// die App an Endnutzer richtet, die selten "Changelogs" lesen wollen, aber
// bei Bedarf nachvollziehen können sollen was sich getan hat.
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { changelogNewestFirst, getChangelogText, type ChangelogEntry, type ChangelogEntryType } from '@/features/changelog/changelog';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const TYPE_ORDER: ChangelogEntryType[] = ['feature', 'improvement', 'fix'];

const TYPE_ICON: Record<ChangelogEntryType, IconName> = {
  feature: 'sparkles',
  improvement: 'trending-up-outline',
  fix: 'build-outline',
};

const TYPE_LABEL_KEY: Record<ChangelogEntryType, string> = {
  feature: 'changelog.typeFeature',
  improvement: 'changelog.typeImprovement',
  fix: 'changelog.typeFix',
};

function groupByType(entries: ChangelogEntry[]): Partial<Record<ChangelogEntryType, ChangelogEntry[]>> {
  const groups: Partial<Record<ChangelogEntryType, ChangelogEntry[]>> = {};
  for (const entry of entries) {
    (groups[entry.type] ??= []).push(entry);
  }
  return groups;
}

export default function ChangelogScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const versions = changelogNewestFirst();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('changelog.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('changelog.subtitle')}
          </ThemedText>

          {versions.map((version, index) => {
            const groups = groupByType(version.entries);
            const formattedDate = new Date(version.date).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            return (
              <ThemedView key={version.version} type="backgroundElement" style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('changelog.versionLabel').replace('{version}', version.version)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formattedDate}
                  </ThemedText>
                </View>
                {index === 0 && (
                  <ThemedView type="backgroundSelected" style={styles.latestBadge}>
                    <ThemedText type="small" themeColor="accent">
                      {t('changelog.latest')}
                    </ThemedText>
                  </ThemedView>
                )}

                {TYPE_ORDER.map((type) => {
                  const list = groups[type];
                  if (!list || list.length === 0) return null;
                  return (
                    <View key={type} style={styles.group}>
                      <ThemedText
                        type="smallBold"
                        themeColor="textSecondary"
                        style={styles.groupLabel}>
                        {t(TYPE_LABEL_KEY[type])}
                      </ThemedText>
                      {list.map((entry, entryIndex) => (
                        <View key={entryIndex} style={styles.entryRow}>
                          <IconSymbol name={TYPE_ICON[type]} size={16} color={colors.accent} />
                          <ThemedText type="small" style={styles.entryText}>
                            {getChangelogText(entry, locale)}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </ThemedView>
            );
          })}

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            {t('changelog.footer')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { marginBottom: Spacing.two },
  card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  latestBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    marginTop: -Spacing.two,
  },
  group: { gap: Spacing.one },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  entryRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  entryText: { flex: 1, lineHeight: 20 },
  footer: { textAlign: 'center', marginTop: Spacing.two },
});
