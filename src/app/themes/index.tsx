import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { THEME_COLLECTIONS } from '@/features/themes/collections';
import { useGrid } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function ThemesHubScreen() {
  const { t } = useTranslation();
  // Breitbild: auf Tablets mehrspaltig statt einer 800-dp-Telefonspalte
  // (Geraetebefund 2026-07-29, 1600x2560).
  const grid = useGrid();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('themes.title')} subtitle={t('themes.subtitle')} />

        <SegmentedTabs
          tabs={[
            { key: 'collections', label: t('journeys.tabCollections') },
            { key: 'journeys', label: t('journeys.tabJourneys') },
          ]}
          activeKey="collections"
          onChange={(key) => {
            if (key === 'journeys') router.replace('/themes/journeys');
          }}
        />

        <FlatList
          data={grid.pad(THEME_COLLECTIONS)}
          key={grid.listKey}
          numColumns={grid.numColumns}
          columnWrapperStyle={grid.columnWrapperStyle}
          keyExtractor={(c, i) => (c ? c.id : `luecke-${i}`)}
          contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
          renderItem={({ item, index }) =>
            !item ? (
              <View style={grid.cellStyle} />
            ) : (
            <AnimatedListItem index={index} style={grid.cellStyle}>
              <PressableCard
                onPress={() => router.push({ pathname: '/themes/[topic]', params: { topic: item.id } })}
                style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name={item.icon} size={18} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{t(item.titleKey)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.verses.length} {t('themes.versesCount')}
                  </ThemedText>
                </View>
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
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
});
