import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { parseHighlightedText, type QuranSearchResult } from '@/features/quran/api';
import { useQuranSearch, useSurahList } from '@/features/quran/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function QuranSearchScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data: surahs } = useSurahList();
  const rtl = isRtlLocale(locale);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuranSearchResult[]>([]);
  const debouncedQuery = useDebounced(query, 400);

  // Seite + gesammelte Treffer zurücksetzen, sobald sich der (entprellte)
  // Suchbegriff ändert — bewusst während des Renders statt in einem Effect
  // (React-Empfehlung für "state reset on prop change", vermeidet Flackern).
  const [resetKey, setResetKey] = useState(debouncedQuery);
  if (debouncedQuery !== resetKey) {
    setResetKey(debouncedQuery);
    setPage(1);
    setItems([]);
  }

  const { data, isLoading, isFetching, isError } = useQuranSearch(debouncedQuery, locale, page);

  // Neue Seite an die bereits gesammelten Treffer anhängen (echtes "mehr
  // laden" statt Ersetzen) — ebenfalls während des Renders, mit einem
  // Verarbeitungs-Schlüssel gegen Doppel-Anhängen bei Refetches derselben Seite.
  const [appendedKey, setAppendedKey] = useState('');
  if (data) {
    const key = `${debouncedQuery}|${data.currentPage}`;
    if (key !== appendedKey) {
      setAppendedKey(key);
      // Mushaf-Reihenfolge (Sure, dann Vers) statt API-Reihenfolge - die
      // lieferte z. B. Sure 43 vor Sure 39 (Audit 2026-07-19 B11). Beim
      // Nachladen wird die Gesamtliste erneut sortiert, damit neue Treffer
      // an der richtigen Stelle einsortiert werden.
      const merged = data.currentPage === 1 ? [...data.results] : [...items, ...data.results];
      merged.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
      setItems(merged);
    }
  }

  const renderResult = (item: QuranSearchResult) => {
    const meta = surahs?.find((s) => s.number === item.surah);
    return (
      <PressableCard
        onPress={() =>
          router.push({ pathname: '/quran/[surah]', params: { surah: item.surah, ayah: item.ayah } })
        }
        style={styles.resultCard}>
        <ThemedText type="small" themeColor="accent" style={styles.resultRef}>
          {meta?.englishName ?? t('quran.surahN').replace('{n}', String(item.surah))} · {t('quran.verse')} {item.ayah}
        </ThemedText>
        <ThemedText type="default" style={styles.arabic}>
          {item.arabicText}
        </ThemedText>
        {item.translationHtml && (
          <ThemedText type="small" themeColor="textSecondary">
            {parseHighlightedText(item.translationHtml).map((seg, i) => (
              <ThemedText
                key={i}
                type="small"
                themeColor={seg.bold ? 'accent' : 'textSecondary'}
                style={seg.bold ? styles.bold : undefined}>
                {seg.text}
              </ThemedText>
            ))}
          </ThemedText>
        )}
      </PressableCard>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, rtl && styles.headerRtl]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
            <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t('quran.searchAyahs')}
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ThemedView type="backgroundElement" style={styles.searchBox}>
          <IconSymbol name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('quran.searchAyahsPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
            autoFocus
          />
        </ThemedView>

        {locale === 'ar' && query.trim().length > 1 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {t('quran.searchArabicNote')}
          </ThemedText>
        )}

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}

        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('quran.searchError')}
            </ThemedText>
          </View>
        )}

        {!isLoading && data && items.length === 0 && debouncedQuery.trim().length > 1 && (
          <EmptyState
            icon="search-outline"
            title={t('quran.searchNoResults').replace('{query}', debouncedQuery.trim())}
          />
        )}

        {!isLoading && data && items.length > 0 && (
          <FlatList
            data={items}
            keyExtractor={(item) => item.verseKey}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                {t('quran.searchResultsCount').replace('{count}', String(data.totalResults))}
              </ThemedText>
            }
            renderItem={({ item }) => renderResult(item)}
            ListFooterComponent={
              data.totalPages > page ? (
                <Pressable
                  onPress={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedView type="backgroundElement" style={styles.loadMore}>
                    {isFetching ? (
                      <ThemedActivityIndicator size="small" />
                    ) : (
                      <ThemedText type="small" themeColor="accent">
                        {t('quran.loadMore')}
                      </ThemedText>
                    )}
                  </ThemedView>
                </Pressable>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  headerRtl: { flexDirection: 'row-reverse' },
  headerSpacer: { width: 24 },
  title: { flex: 1, textAlign: 'center' },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.two, fontSize: 15 },
  hint: { marginHorizontal: Spacing.three, marginBottom: Spacing.two },
  count: { marginBottom: Spacing.two },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  resultCard: { padding: Spacing.three, gap: Spacing.one },
  resultRef: {},
  arabic: { fontSize: 20, textAlign: 'right', lineHeight: 34 },
  bold: { fontWeight: '700' },
  loadMore: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    marginTop: Spacing.two,
  },
  pressableWeb: { cursor: 'pointer' },
});
