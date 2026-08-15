import { router } from 'expo-router';
import { FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { COLLECTIONS } from '@/features/hadith/api';
import { hadithOfTheDay, useHadithCollection } from '@/features/hadith/hooks';
import { useGrid } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useSettings } from '@/features/settings/store';
import { useTranslation } from '@/lib/i18n';

export default function HadithScreen() {
  const { t } = useTranslation();
  // Breitbild: auf Tablets mehrspaltig statt einer 800-dp-Telefonspalte
  // (Geraetebefund 2026-07-29, 1600x2560).
  const grid = useGrid();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // An-Nawawi 40: klein, kuratiert, keine Themen-Auswahl nötig — passend für
  // eine tägliche Reflexion (analog zu wisdomOfTheDay()).
  const { data: nawawi } = useHadithCollection('nawawi', settings.hadithLanguage);
  const today = nawawi ? hadithOfTheDay(nawawi.hadiths) : undefined;

  function shareToday() {
    if (!today) return;
    Share.share({
      message: `${today.arabic}\n\n${today.translation}\n\n— ${t('hadith.todaySource').replace('{n}', String(today.hadithnumber))}`,
    }).catch(() => {});
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title={t('nav.hadith')}
          subtitle={t('hadith.languagesNote')}
          right={
            <Pressable
              onPress={() => router.push('/hadith/search')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.search')}
              style={styles.searchIcon}>
              <IconSymbol name="search" size={20} color={colors.accent} />
            </Pressable>
          }
        />

        <FlatList
          data={grid.pad(COLLECTIONS)}
          key={grid.listKey}
          numColumns={grid.numColumns}
          columnWrapperStyle={grid.columnWrapperStyle}
          keyExtractor={(c, i) => (c ? c.id : `luecke-${i}`)}
          contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
          ListHeaderComponent={
            <View>
              {today ? (
                <View>
                <PressableCard
                  onPress={() =>
                    router.push({
                      pathname: '/hadith/[collection]/[number]',
                      params: { collection: 'nawawi', number: String(today.hadithnumber) },
                    })
                  }
                  type="backgroundSelected"
                  style={styles.todayCard}>
                <View style={styles.todayLabel}>
                  <IconSymbol name="sparkles" size={14} color={colors.accent} />
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('hadith.today')}
                  </ThemedText>
                </View>
                <ThemedText style={styles.arabic} numberOfLines={3}>
                  {today.arabic}
                </ThemedText>
                <ThemedText type="default" numberOfLines={4}>
                  {today.translation}
                </ThemedText>
                </PressableCard>
                {/* Teilen steht NEBEN der Karte, nicht darin: verschachtelte
                    Pressables werden im Web zu <button> in <button> und lösen
                    beim Hydrieren einen Fehler aus (gemessen auf /hadith). */}
                <View style={styles.sourceRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    — {t('hadith.todaySource').replace('{n}', String(today.hadithnumber))}
                  </ThemedText>
                  <Pressable onPress={shareToday} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('wisdom.share')}>
                    <IconSymbol name="share-outline" size={13} color={colors.textSecondary} />
                  </Pressable>
                </View>
                </View>
              ) : null}

              {/* Der Haupteinstieg. Seit dem Lizenz-Audit (30.07.2026) ist die
                  HadeethEnc-Enzyklopädie die Quelle des Hadith-Bestands: sie ist
                  nach Themen geordnet statt nach Sammlungen und liegt in allen
                  14 App-Sprachen redaktionell übersetzt vor. Die frueher hier
                  stehenden zehn Sammlungen sind entfallen, weil sich bei ihren
                  Uebersetzungen die Rechtekette nicht belegen liess. */}
              <AnimatedListItem index={0}>
                <PressableCard
                  onPress={() => router.push('/hadith/topics')}
                  type="backgroundSelected"
                  style={styles.topicsCard}>
                  <View style={styles.topicsHeading}>
                    <IconSymbol name="list-outline" size={18} color={colors.accent} />
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('hadith.topicsTitle')}
                    </ThemedText>
                    <View style={styles.topicsSpacer} />
                    <DisclosureChevron size={18} color={colors.accent} />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('hadith.topicsSubtitle')}
                  </ThemedText>
                </PressableCard>
              </AnimatedListItem>
            </View>
          }
          renderItem={({ item, index }) =>
            !item ? (
              <View style={grid.cellStyle} />
            ) : (
            <AnimatedListItem index={index} style={grid.cellStyle}>
              <PressableCard
                onPress={() => router.push({ pathname: '/hadith/[collection]', params: { collection: item.id } })}
                style={styles.row}>
                <ThemedText type="default">{item.name}</ThemedText>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
            </AnimatedListItem>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  searchIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  todayCard: { padding: Spacing.four, gap: Spacing.two },
  topicsCard: { padding: Spacing.four, gap: Spacing.one, marginTop: Spacing.two },
  topicsHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topicsSpacer: { flex: 1 },
  todayLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Steht seit dem Hydration-Fix ausserhalb der Karte und braucht deren
  // Innenabstand deshalb selbst.
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    marginBottom: Spacing.two,
  },
  arabic: { fontSize: 20, lineHeight: 34, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
  },
});
