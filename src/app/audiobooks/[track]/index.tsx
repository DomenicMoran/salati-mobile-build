import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import {
  AUDIOBOOK_LANGUAGE_ENDONYM,
  chaptersForTrack,
  fetchAudiobookIndex,
  formatDuration,
  languagesForTrack,
} from '@/features/audiobooks/data';
import { AUDIOBOOK_HUB_TRACKS, isAudiobookTrackId } from '@/features/audiobooks/tracks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

export default function AudiobookTrackScreen() {
  const { track: trackParam, lang: langParam } = useLocalSearchParams<{ track: string; lang?: string }>();
  const trackId = typeof trackParam === 'string' ? trackParam : '';
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const labelKey = AUDIOBOOK_HUB_TRACKS.find((x) => x.id === trackId)?.labelKey;
  const title = labelKey ? t(labelKey) : trackId;

  const { data, isPending: isLoading, isError } = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });
  const [pickedLang, setPickedLang] = useState<string | null>(null);
  const languages = data && isAudiobookTrackId(trackId) ? languagesForTrack(data.entries, trackId) : [];
  const contentLang =
    pickedLang && languages.includes(pickedLang)
      ? pickedLang
      : typeof langParam === 'string' && languages.includes(langParam)
        ? langParam
        : locale;

  const chapters =
    data && isAudiobookTrackId(trackId) ? chaptersForTrack(data.entries, trackId, contentLang) : [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={title} onBack={() => backOr('/audiobooks' as Href)} />
        <FlatList
          data={chapters}
          keyExtractor={(ch) => `${ch.track}-${ch.chapter_no}-${ch.lang}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            languages.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.langRow}>
                {languages.map((lang) => {
                  const active = lang === contentLang;
                  return (
                    <Pressable
                      key={lang}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={AUDIOBOOK_LANGUAGE_ENDONYM[lang] ?? lang}
                      onPress={() => setPickedLang(lang)}
                      style={[
                        styles.langChip,
                        { borderColor: colors.accent, backgroundColor: active ? colors.accent : 'transparent' },
                      ]}>
                      <ThemedText type="smallBold" style={{ color: active ? colors.background : colors.text }}>
                        {AUDIOBOOK_LANGUAGE_ENDONYM[lang] ?? lang.toUpperCase()}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index % 12}>
              <PressableCard
                onPress={() =>
                  router.push({
                    pathname: '/audiobooks/[track]/[chapter]',
                    params: { track: trackId, chapter: String(item.chapter_no), lang: contentLang },
                  } as Href)
                }
                type="backgroundElement"
                style={styles.row}>
                <View style={[styles.numBadge, { backgroundColor: colors.accent }]}>
                  <ThemedText type="smallBold" style={{ color: colors.background, fontSize: 12 }}>
                    {item.chapter_no}
                  </ThemedText>
                </View>
                <View style={styles.rowText}>
                  <ThemedText type="default" numberOfLines={2}>
                    {item.title}
                  </ThemedText>
                  <View style={styles.metaRow}>
                    <IconSymbol name="play-circle" size={14} color={colors.accent} />
                    <ThemedText type="small" themeColor="accent">
                      {formatDuration(item.duration_sec)}
                    </ThemedText>
                  </View>
                </View>
                <DisclosureChevron color={colors.textSecondary} />
              </PressableCard>
            </AnimatedListItem>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              {isLoading ? (
                <ThemedActivityIndicator />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {isError ? t('common.error') : t('audiobooks.empty')}
                </ThemedText>
              )}
            </View>
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
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  langRow: { gap: Spacing.two, paddingBottom: Spacing.two },
  langChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 44,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two },
  numBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
});
