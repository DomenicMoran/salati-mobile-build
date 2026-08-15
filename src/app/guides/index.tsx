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
import { GUIDES, resolveText } from '@/features/guides/hooks';
import { useGrid } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const GUIDE_ICONS: Record<string, IconName> = {
  wudu: 'water',
  ghusl: 'water-outline',
  tayammum: 'sunny-outline',
  'how-to-pray': 'body',
  rakat: 'calculator',
  witr: 'moon',
  jumuah: 'calendar',
};

export default function GuidesScreen() {
  const { t, locale } = useTranslation();
  // Breitbild: auf Tablets mehrspaltig statt einer 800-dp-Telefonspalte
  // (Geraetebefund 2026-07-29, 1600x2560).
  const grid = useGrid();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('guides.title')} subtitle={t('guides.subtitle')} />

        <FlatList
          data={grid.pad(GUIDES)}
          key={grid.listKey}
          numColumns={grid.numColumns}
          columnWrapperStyle={grid.columnWrapperStyle}
          keyExtractor={(g, i) => (g ? g.id : `luecke-${i}`)}
          contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
          ListHeaderComponent={<HubBanner source={require('../../../assets/images/guides/pray.jpg')} noPadding />}
          renderItem={({ item, index }) =>
            !item ? (
              <View style={grid.cellStyle} />
            ) : (
            <AnimatedListItem index={index} style={grid.cellStyle}>
              <PressableCard
                onPress={() => router.push({ pathname: '/guides/[guide]', params: { guide: item.id } })}
                style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name={GUIDE_ICONS[item.id] ?? 'book'} size={18} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{resolveText(item.title, locale)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.steps.length} {t('guides.steps')}
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
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
});
