import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard, stopNestedPressBubble } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { useSurahList } from '@/features/quran/hooks';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { BOOKMARK_LABELS, useQuranProgress, type BookmarkLabel } from '@/features/quran/progress';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { formatRelativeTime } from '@/lib/relativeTime';

const LABEL_ICONS: Record<BookmarkLabel, IconName> = {
  favorite: 'star',
  memorize: 'bulb',
  reflect: 'leaf',
};

type ListView = 'bookmarks' | 'history';

export default function QuranBookmarksScreen() {
  const { bookmarks, history, toggle, setLabel } = useQuranProgress();
  const { data: surahs } = useSurahList();
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // null = alle Sammlungen anzeigen
  const [filter, setFilter] = useState<BookmarkLabel | null>(null);
  const [view, setView] = useState<ListView>('bookmarks');

  const filtered = filter === null ? bookmarks : bookmarks.filter((b) => b.label === filter);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t(view === 'bookmarks' ? 'quran.bookmarks' : 'quran.history.title')} />

        <View style={styles.viewTabs}>
          {(['bookmarks', 'history'] as const).map((v) => {
            const active = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.viewTab}>
                  <ThemedText type="small" themeColor={active ? 'accent' : 'text'}>
                    {t(v === 'bookmarks' ? 'quran.bookmarks' : 'quran.history.title')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        {view === 'bookmarks' && bookmarks.length > 0 && (
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setFilter(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === null }}
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <ThemedView type={filter === null ? 'backgroundSelected' : 'backgroundElement'} style={styles.filterChip}>
                <ThemedText type="small" themeColor={filter === null ? 'accent' : 'textSecondary'}>
                  {t('quran.labelAll')}
                </ThemedText>
              </ThemedView>
            </Pressable>
            {BOOKMARK_LABELS.map((label) => {
              const active = filter === label;
              return (
                <Pressable
                  key={label}
                  onPress={() => setFilter(active ? null : label)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.filterChip, styles.filterChipRow]}>
                    <IconSymbol name={LABEL_ICONS[label]} size={12} color={active ? colors.accent : colors.textSecondary} />
                    <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                      {t(`quran.labels.${label}`)}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        )}

        {view === 'bookmarks' && filtered.length === 0 && (
          <EmptyState
            icon="bookmark-outline"
            title={t('quran.noBookmarks')}
            actionLabel={t('common.openQuran')}
            onAction={() => router.push('/quran')}
          />
        )}

        {view === 'bookmarks' && (
          <FlatList
            data={filtered}
            keyExtractor={(b) => `${b.surah}:${b.ayah}`}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => {
              const meta = surahs?.find((s) => s.number === item.surah);
              return (
                <AnimatedListItem index={index}>
                  <PressableCard
                    onPress={() =>
                      router.push({ pathname: '/quran/[surah]', params: { surah: item.surah, ayah: item.ayah } })
                    }
                    style={styles.row}>
                    <View style={styles.rowTop}>
                      <View style={styles.rowText}>
                        <ThemedText type="default">
                          {meta?.englishName ?? t('quran.surahN').replace('{n}', String(item.surah))} · {t('quran.verse')} {item.ayah}
                        </ThemedText>
                        {meta && (
                          <ThemedText type="small" themeColor="textSecondary">
                            {surahNameTranslation(item.surah, locale, meta.englishNameTranslation)}
                          </ThemedText>
                        )}
                      </View>
                      <Pressable
                        onPress={(e) => {
                          stopNestedPressBubble(e);
                          toggle(item.surah, item.ayah);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('a11y.removeBookmark')}
                        style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.rowPressed]}>
                        <IconSymbol name="bookmark" size={18} color={colors.accent} />
                      </Pressable>
                    </View>
                    <View style={styles.labelRow}>
                      {BOOKMARK_LABELS.map((label) => {
                        const active = item.label === label;
                        return (
                          <Pressable
                            key={label}
                            onPress={(e) => {
                              stopNestedPressBubble(e);
                              setLabel(item.surah, item.ayah, active ? null : label);
                            }}
                            hitSlop={4}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={t(`quran.labels.${label}`)}
                            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.rowPressed]}>
                            <ThemedView
                              type={active ? 'backgroundSelected' : 'backgroundElement'}
                              style={[styles.labelChip, styles.filterChipRow]}>
                              <IconSymbol
                                name={LABEL_ICONS[label]}
                                size={11}
                                color={active ? colors.accent : colors.textSecondary}
                              />
                              <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                                {t(`quran.labels.${label}`)}
                              </ThemedText>
                            </ThemedView>
                          </Pressable>
                        );
                      })}
                    </View>
                  </PressableCard>
                </AnimatedListItem>
              );
            }}
          />
        )}

        {view === 'history' && history.length === 0 && (
          <EmptyState
            icon="time-outline"
            title={t('quran.history.empty')}
            actionLabel={t('common.openQuran')}
            onAction={() => router.push('/quran')}
          />
        )}

        {view === 'history' && (
          <FlatList
            data={history}
            keyExtractor={(h) => `${h.surah}:${h.ayah}`}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => {
              const meta = surahs?.find((s) => s.number === item.surah);
              return (
                <AnimatedListItem index={index}>
                  <PressableCard
                    onPress={() =>
                      router.push({ pathname: '/quran/[surah]', params: { surah: item.surah, ayah: item.ayah } })
                    }
                    style={styles.row}>
                    <View style={styles.rowTop}>
                      <View style={styles.rowText}>
                        <ThemedText type="default">
                          {meta?.englishName ?? t('quran.surahN').replace('{n}', String(item.surah))} · {t('quran.verse')} {item.ayah}
                        </ThemedText>
                        {meta && (
                          <ThemedText type="small" themeColor="textSecondary">
                            {surahNameTranslation(item.surah, locale, meta.englishNameTranslation)}
                          </ThemedText>
                        )}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatRelativeTime(t, item.at)}
                      </ThemedText>
                    </View>
                  </PressableCard>
                </AnimatedListItem>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  viewTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  viewTab: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  filterChip: { paddingVertical: 6, paddingHorizontal: Spacing.two, borderRadius: 999 },
  filterChipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: { padding: Spacing.three, gap: Spacing.two },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { flex: 1, gap: Spacing.half },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  labelChip: { paddingVertical: 4, paddingHorizontal: Spacing.two, borderRadius: 999 },
  rowPressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
