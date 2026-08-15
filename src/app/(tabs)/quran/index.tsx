import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSurahList } from '@/features/quran/hooks';
import { JUZ_STARTS } from '@/features/quran/juz';
import { useQuranProgress } from '@/features/quran/progress';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { useGrid } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type ViewMode = 'surah' | 'juz';

export default function QuranScreen() {
  const { data: surahs, isLoading, isError } = useSurahList();
  const { lastRead, bookmarks, history } = useQuranProgress();
  const { t, locale } = useTranslation();
  const [mode, setMode] = useState<ViewMode>('surah');
  const [query, setQuery] = useState('');
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Breitbild: 114 Suren bzw. 30 Juz stehen auf Tablets in zwei bzw. drei
  // Spalten — auf 800 dp war jede Zeile 770 dp breit und die Liste doppelt so
  // lang wie noetig (Gerätebefund 2026-07-29).
  const grid = useGrid();

  const filteredSurahs = useMemo(() => {
    if (!surahs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        surahNameTranslation(s.number, locale, s.englishNameTranslation).toLowerCase().includes(q) ||
        s.name.includes(query.trim()) ||
        String(s.number) === q,
    );
  }, [surahs, query, locale]);

  const lastReadSurah = lastRead ? surahs?.find((s) => s.number === lastRead.surah) : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t('nav.quran')}
        </ThemedText>

        {lastRead && lastReadSurah && (
          <PressableCard
            onPress={() =>
              router.push({
                pathname: '/quran/[surah]',
                params: { surah: lastRead.surah, ayah: lastRead.ayah },
              })
            }
            type="backgroundSelected"
            style={styles.continueCard}>
            <View style={styles.continueText}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('quran.continueReading')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {lastReadSurah.englishName} · {t('quran.verse')} {lastRead.ayah}
              </ThemedText>
            </View>
            <IconSymbol name="play-circle" size={26} color={colors.accent} />
          </PressableCard>
        )}

        {history.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.historyBar}
            contentContainerStyle={styles.historyBarContent}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.historyLabel}>
              {t('quran.recentlyRead')}:
            </ThemedText>
            {history.slice(0, 5).map((h) => (
              <Pressable
                key={h.surah}
                onPress={() =>
                  router.push({ pathname: '/quran/[surah]', params: { surah: h.surah, ayah: h.ayah } })
                }
                accessibilityRole="button"
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.rowPressed,
                ]}>
                <ThemedView type="backgroundElement" style={styles.historyChip}>
                  <ThemedText type="small">
                    {surahs?.find((s) => s.number === h.surah)?.englishName ?? t('quran.surahN').replace('{n}', String(h.surah))} {h.surah}:{h.ayah}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.controlsRow}>
          <View style={styles.segments}>
            {(['surah', 'juz'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView
                  type={mode === m ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.segment}>
                  <ThemedText type="small" themeColor={mode === m ? 'accent' : 'text'}>
                    {t(m === 'surah' ? 'quran.surahs' : 'quran.juz')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>
          <View style={styles.headerActions}>
            <Link href="/quran/mushaf" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('quran.mushafOpen')}
                hitSlop={8}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.rowPressed]}>
                <ThemedView type="backgroundElement" style={styles.iconSegment}>
                  <IconSymbol name="book-outline" size={16} color={colors.text} />
                </ThemedView>
              </Pressable>
            </Link>
            <Link href="/quran/search" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('a11y.search')}
                hitSlop={8}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.rowPressed]}>
                <ThemedView type="backgroundElement" style={styles.iconSegment}>
                  <IconSymbol name="search" size={16} color={colors.text} />
                </ThemedView>
              </Pressable>
            </Link>
            <Link href="/quran/bookmarks" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('a11y.bookmarks')}
                hitSlop={8}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.rowPressed]}>
                <ThemedView type="backgroundElement" style={[styles.segment, styles.bookmarkSegment]}>
                  <IconSymbol name="bookmark" size={14} color={colors.text} />
                  {bookmarks.length > 0 && <ThemedText type="small">{bookmarks.length}</ThemedText>}
                </ThemedView>
              </Pressable>
            </Link>
          </View>
        </View>

        {mode === 'surah' && (
          <ThemedView type="backgroundElement" style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('quran.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </ThemedView>
        )}

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('quran.listError')}
            </ThemedText>
          </View>
        )}

        {surahs && mode === 'surah' && (
          <FlatList
            data={grid.pad(filteredSurahs)}
            key={grid.listKey}
            numColumns={grid.numColumns}
            columnWrapperStyle={grid.columnWrapperStyle}
            keyExtractor={(s, i) => (s ? String(s.number) : `luecke-${i}`)}
            contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
            renderItem={({ item, index }) =>
              !item ? (
                <View style={grid.cellStyle} />
              ) : (
              <AnimatedListItem index={index} style={grid.cellStyle}>
                <PressableCard
                  onPress={() => router.push({ pathname: '/quran/[surah]', params: { surah: item.number } })}
                  style={styles.row}>
                  <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                    <ThemedText type="small">{item.number}</ThemedText>
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{item.englishName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {surahNameTranslation(item.number, locale, item.englishNameTranslation)} · {item.numberOfAyahs} {t('quran.verses')}
                    </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.arabicName}>
                    {item.name}
                  </ThemedText>
                </PressableCard>
              </AnimatedListItem>
              )
            }
          />
        )}

        {surahs && mode === 'juz' && (
          <FlatList
            data={grid.pad(JUZ_STARTS)}
            key={grid.listKey}
            numColumns={grid.numColumns}
            columnWrapperStyle={grid.columnWrapperStyle}
            keyExtractor={(j, i) => (j ? String(j.juz) : `luecke-${i}`)}
            contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
            renderItem={({ item, index }) => {
              if (!item) return <View style={grid.cellStyle} />;
              const startSurah = surahs.find((s) => s.number === item.surah);
              return (
                <AnimatedListItem index={index} style={grid.cellStyle}>
                  <PressableCard
                    onPress={() =>
                      router.push({
                        pathname: '/quran/[surah]',
                        params: { surah: item.surah, ayah: item.ayah },
                      })
                    }
                    style={styles.row}>
                    <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                      <ThemedText type="small">{item.juz}</ThemedText>
                    </ThemedView>
                    <View style={styles.rowText}>
                      <ThemedText type="default">
                        {t('quran.juzItem')} {item.juz}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {startSurah?.englishName ?? t('quran.surahN').replace('{n}', String(item.surah))} · {t('quran.verse')}{' '}
                        {item.ayah}
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.arabicName}>
                      {startSurah?.name ?? ''}
                    </ThemedText>
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
  title: { textAlign: 'center', marginBottom: Spacing.three },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.one,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  continueText: { gap: Spacing.half },
  // minHeight + flexShrink:0: die horizontale ScrollView kollabierte auf Web
  // sonst zu Höhe 0, wodurch die "Zuletzt gelesen"-Chips nach oben in die
  // "Weiterlesen"-Karte überliefen (durchscheinender/verankerter Text-Bug).
  historyBar: { flexGrow: 0, flexShrink: 0, minHeight: 44, marginBottom: Spacing.two },
  historyBarContent: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  historyLabel: { marginRight: Spacing.half },
  historyChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  segments: { flexDirection: 'row', gap: Spacing.one },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  segment: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  iconSegment: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
  },
  bookmarkSegment: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  searchBox: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: Spacing.two,
  },
  searchInput: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  rowPressed: { opacity: 0.6 },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  arabicName: { fontSize: 18 },
  pressableWeb: { cursor: 'pointer' },
});
