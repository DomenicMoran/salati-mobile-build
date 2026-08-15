import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { knownCount, useHifzProgress } from '@/features/hifz/progress';
import { useSurahList } from '@/features/quran/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function HifzSurahPickerScreen() {
  const { data: surahs, isLoading, isError } = useSurahList();
  const { progress } = useHifzProgress();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const filtered = useMemo(() => {
    if (!surahs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.name.includes(query.trim()) ||
        String(s.number) === q,
    );
  }, [surahs, query]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('hifz.title')} subtitle={t('hifz.subtitle')} />

        <ThemedView type="backgroundElement" style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('quran.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </ThemedView>

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

        {surahs && (
          <FlatList
            data={filtered}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="search-outline"
                title={t('hifz.searchNoResults').replace('{query}', query.trim())}
                actionLabel={t('common.clearSearch')}
                onAction={() => setQuery('')}
              />
            }
            renderItem={({ item, index }) => {
              const known = knownCount(progress, item.number);
              return (
                <AnimatedListItem index={index}>
                  <PressableCard
                    onPress={() => router.push({ pathname: '/hifz/[surah]', params: { surah: item.number } })}
                    style={styles.row}>
                    <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                      <ThemedText type="small">{item.number}</ThemedText>
                    </ThemedView>
                    <View style={styles.rowText}>
                      <ThemedText type="default">{item.englishName}</ThemedText>
                      <ThemedText
                        type="small"
                        themeColor={known > 0 ? 'accent' : 'textSecondary'}>
                        {known} / {item.numberOfAyahs} {t('hifz.memorized')}
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.arabicName}>
                      {item.name}
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
  safeArea: { flex: 1, paddingTop: Spacing.two },
  searchBox: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: Spacing.two,
  },
  searchInput: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 15 },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.one, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  arabicName: { fontSize: 18 },
});
