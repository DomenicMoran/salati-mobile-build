import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
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
import { chaptersForLocale, fetchAudiobookIndex, type AudiobookChapter } from '@/features/audiobooks/data';
import audiobookFallbackIndex from '@/features/audiobooks/index.fallback.json';
import { hubTracksForLocale } from '@/features/audiobooks/tracks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type HubRow =
  | { kind: 'track'; key: string; trackId: string; labelKey: string; index: number }
  | { kind: 'books'; key: 'books'; index: number };

function maybeRedirectChapterFromUrl(url: string | null): boolean {
  if (!url) return false;
  const parsed = Linking.parse(url);
  const path = (parsed.path ?? '').replace(/^\/+/, '');
  const m = path.match(/^audiobooks\/([^/]+)\/(\d+)$/);
  if (!m) return false;
  const lang = typeof parsed.queryParams?.lang === 'string' ? parsed.queryParams.lang : undefined;
  router.replace({
    pathname: '/audiobooks/[track]/[chapter]',
    params: { track: m[1], chapter: m[2], ...(lang ? { lang } : {}) },
  } as Href);
  return true;
}

export default function AudiobooksHubScreen() {
  const { t, locale } = useTranslation();

  useEffect(() => {
    void Linking.getInitialURL().then(maybeRedirectChapterFromUrl);
    const sub = Linking.addEventListener('url', ({ url }) => {
      maybeRedirectChapterFromUrl(url);
    });
    return () => sub.remove();
  }, []);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isPending: isLoading, isError } = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });

  const fallbackEntries = (audiobookFallbackIndex as { entries: AudiobookChapter[] }).entries ?? [];
  const entries = data?.entries && data.entries.length > 0 ? data.entries : fallbackEntries;
  const rows: HubRow[] = [];
  let itemIndex = 0;
  for (const track of hubTracksForLocale(entries, locale)) {
    rows.push({
      kind: 'track',
      key: track.id,
      trackId: track.id,
      labelKey: track.labelKey,
      index: itemIndex++,
    });
  }
  const localized = chaptersForLocale(entries, locale, data);
  const hasBooks = localized.some(
    (e) => (e.track === 'grammatik-hoerbuch' || e.track === 'pflichtwissen') && !!e.book_pdf_url?.trim(),
  );
  if (hasBooks) {
    rows.push({ kind: 'books', key: 'books', index: itemIndex++ });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('audiobooks.title')} subtitle={t('audiobooks.subtitle')} />
        {isLoading ? (
          <ThemedActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <AnimatedListItem index={item.index % 12}>
                <PressableCard
                  onPress={() => {
                    if (item.kind === 'books') router.push('/audiobooks/books' as Href);
                    else
                      router.push({
                        pathname: '/audiobooks/[track]',
                        params: { track: item.trackId },
                      } as Href);
                  }}
                  type="backgroundElement"
                  style={styles.row}>
                  <IconSymbol
                    name={item.kind === 'books' ? 'document-text' : 'headset'}
                    size={22}
                    color={colors.accent}
                  />
                  <View style={styles.rowText}>
                    <ThemedText type="default">
                      {item.kind === 'books' ? t('audiobooks.tracks.books') : t(item.labelKey)}
                    </ThemedText>
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
                <EmptyState icon="headset" title={t('audiobooks.empty')} />
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
  rowText: { flex: 1, minWidth: 0 },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
});
