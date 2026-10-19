import type { Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { booksForLocale, fetchAudiobookIndex } from '@/features/audiobooks/data';
import { AUDIOBOOK_HUB_TRACKS } from '@/features/audiobooks/tracks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const TRACK_LABEL_KEYS = Object.fromEntries(AUDIOBOOK_HUB_TRACKS.map((t) => [t.id, t.labelKey]));

export default function AudiobookBooksScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isPending: isLoading, isError } = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });

  const books = data ? booksForLocale(data.entries, locale, TRACK_LABEL_KEYS) : [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('audiobooks.tracks.books')} onBack={() => backOr('/audiobooks' as Href)} />
        {isLoading ? (
          <ThemedActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            data={books}
            keyExtractor={(b) => b.track}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableCard
                  onPress={() => void Linking.openURL(item.pdf_url).catch(() => {})}
                  type="backgroundElement"
                  style={styles.row}>
                  <IconSymbol name="document-text" size={22} color={colors.accent} />
                  <View style={styles.rowText}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(item.trackLabelKey)}
                    </ThemedText>
                    <ThemedText type="default">{t('audiobooks.bookOpen')}</ThemedText>
                  </View>
                  <DisclosureChevron color={colors.textSecondary} />
                </PressableCard>
              </AnimatedListItem>
            )}
            ListEmptyComponent={
              isError ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  {t('common.error')}
                </ThemedText>
              ) : (
                <EmptyState icon="document-text" title={t('audiobooks.booksEmpty')} />
              )
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  loader: { marginTop: Spacing.five },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
});
