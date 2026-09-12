// Reiter "Wurzeln & Wortschatz" — virtualisierte Liste aller 1.642 Wurzeln
// (roots.json), standardmäßig nach Häufigkeit sortiert, umschaltbar auf
// alphabetisch. Tippen auf eine Wurzel öffnet die Detailansicht
// (app/lexikon/wurzel/[wurzel].tsx).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, type ThemeColor } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { useLocaleTerm, type Term } from './grammatikTerm';
import { useWurzeln } from './hooks';
import { buildRootList, sortRoots, type RootListItem, type RootSortMode } from './rootIndex';
import { TermLabel } from './TermLabel';

const ROW_HEIGHT = 84;

export function RootsListView() {
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [sortMode, setSortMode] = useState<RootSortMode>('frequency');
  const { data, isLoading, isError, refetch, isFetching } = useWurzeln();

  const FALLBACK_TERM: Term = { name: '', ar: '' };
  const sortByFrequencyTerm = useLocaleTerm('lexikon.roots.sortByFrequency') ?? FALLBACK_TERM;
  const sortByAlphabetTerm = useLocaleTerm('lexikon.roots.sortByAlphabet') ?? FALLBACK_TERM;

  const list = useMemo(() => {
    if (!data) return [];
    return sortRoots(buildRootList(data), sortMode);
  }, [data, sortMode]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ThemedActivityIndicator />
        <ThemedText type="small" themeColor="textSecondary">
          {t('lexikon.roots.loading')}
        </ThemedText>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={t('lexikon.roots.loadError')}
        actionLabel={t('common.retry')}
        onAction={() => refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, rtl && styles.headerRowRtl]}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('lexikon.roots.totalCount').replace('{n}', list.length.toLocaleString())}
        </ThemedText>
        <View style={[styles.sortRow, rtl && styles.sortRowRtl]}>
          <SortChip
            testID="lexikon-sort-frequency"
            active={sortMode === 'frequency'}
            term={sortByFrequencyTerm}
            onPress={() => setSortMode('frequency')}
          />
          <SortChip
            testID="lexikon-sort-alphabetical"
            active={sortMode === 'alphabetical'}
            term={sortByAlphabetTerm}
            onPress={() => setSortMode('alphabetical')}
          />
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.root}
        renderItem={renderRootRow}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialNumToRender={14}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={styles.listContent}
        style={styles.list}
        refreshing={isFetching}
        onRefresh={() => refetch()}
      />
    </View>
  );

  function renderRootRow({ item }: ListRenderItemInfo<RootListItem>) {
    return <RootRow item={item} colors={colors} rtl={rtl} t={t} />;
  }
}

function SortChip({
  testID,
  active,
  term,
  onPress,
}: {
  testID: string;
  active: boolean;
  term: { name: string; ar: string };
  onPress: () => void;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.sortChip}>
        <TermLabel
          term={term}
          layout="inline"
          nameType="smallBold"
          nameColor={active ? 'accent' : 'textSecondary'}
          arType="small"
        />
      </ThemedView>
    </Pressable>
  );
}

function RootRow({
  item,
  colors,
  rtl,
  t,
}: {
  item: RootListItem;
  colors: Record<ThemeColor, string>;
  rtl: boolean;
  t: (key: string) => string;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/lexikon/wurzel/[wurzel]', params: { wurzel: item.root } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}>
      <View style={[styles.row, rtl && styles.rowRtl, { borderColor: colors.separator }]}>
        <ThemedText type="title" style={styles.rootLetters}>
          {item.root}
        </ThemedText>
        <View style={styles.rowMeta}>
          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
            {t('lexikon.roots.occurrences').replace('{n}', item.count.toLocaleString())}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
            {t('lexikon.roots.lemmaCount').replace('{n}', item.lemmaCount.toLocaleString())}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  headerRowRtl: { flexDirection: 'row-reverse' },
  sortRow: { flexDirection: 'row', gap: Spacing.one },
  sortRowRtl: { flexDirection: 'row-reverse' },
  sortChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
  },
  list: { flex: 1 },
  listContent: { paddingBottom: Spacing.five },
  rowPressable: { minHeight: ROW_HEIGHT, justifyContent: 'center' },
  rowPressed: { opacity: 0.6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rootLetters: { fontSize: 32 },
  rowMeta: { alignItems: 'flex-end', gap: 2 },
  textRtl: { textAlign: 'right' },
});
