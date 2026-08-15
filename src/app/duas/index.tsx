import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { HubBanner } from '@/components/hub-banner';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { DUA_CATEGORIES, categoryLabel } from '@/features/duas/hooks';
import { useGrid } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const CATEGORY_ICONS: Record<string, IconName> = {
  morning: 'sunny',
  evening: 'moon',
  prayer: 'body',
  eating: 'restaurant',
  sleep: 'bed',
  home: 'home',
  mosque: 'location',
  travel: 'airplane',
  protection: 'shield-checkmark',
  forgiveness: 'heart',
  distress: 'alert-circle',
  illness: 'medkit',
  family: 'people',
  quran: 'book',
  daily: 'calendar',
};

export default function DuasScreen() {
  const { t, locale } = useTranslation();
  // Breitbild: auf Tablets mehrspaltig statt einer 800-dp-Telefonspalte
  // (Geraetebefund 2026-07-29, 1600x2560).
  const grid = useGrid();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('nav.duas')} subtitle={t('duas.offlineNote')} />

        <FlatList
          data={grid.pad(DUA_CATEGORIES)}
          key={grid.listKey}
          numColumns={grid.numColumns}
          columnWrapperStyle={grid.columnWrapperStyle}
          keyExtractor={(c, i) => (c ? c.id : `luecke-${i}`)}
          contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
          ListHeaderComponent={<HubBanner source={require('../../../assets/images/guides/beads.jpg')} noPadding />}
          renderItem={({ item, index }) =>
            !item ? (
              <View style={grid.cellStyle} />
            ) : (
            <AnimatedListItem index={index} style={grid.cellStyle}>
              <PressableCard
                onPress={() => router.push({ pathname: '/duas/[category]', params: { category: item.id } })}
                style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name={CATEGORY_ICONS[item.id] ?? 'hand-left'} size={16} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{categoryLabel(item.id, locale)}</ThemedText>
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
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
});
