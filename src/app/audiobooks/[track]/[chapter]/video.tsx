import { audiobookChapterStaticParams } from '@/features/audiobooks/static-params';
// Präsentationsvideo zum Hörbuch-Kapitel (gleiche Locale wie Audio).
import { useLocalSearchParams, type Href } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { chaptersForTrack, fetchAudiobookIndex } from '@/features/audiobooks/data';
import { AUDIOBOOK_HUB_TRACKS, isAudiobookTrackId } from '@/features/audiobooks/tracks';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

export function generateStaticParams({ params }: { params: { track: string } }) {
  return audiobookChapterStaticParams().filter((entry) => entry.track === params.track);
}

export default function AudiobookChapterVideoScreen() {
  const { track: trackParam, chapter: chapterParam, lang: langParam } = useLocalSearchParams<{
    track: string;
    chapter: string;
    lang?: string;
  }>();
  const trackId = typeof trackParam === 'string' ? trackParam : '';
  const chapterNo = Number(chapterParam);
  const { t, locale } = useTranslation();
  const contentLang = typeof langParam === 'string' && langParam.trim() ? langParam : locale;
  const { width } = useWindowDimensions();

  const { data, isPending: isLoading, isError } = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });

  const chapter = useMemo(() => {
    if (!data || !isAudiobookTrackId(trackId)) return undefined;
    return chaptersForTrack(data.entries, trackId, contentLang).find((c) => c.chapter_no === chapterNo);
  }, [data, trackId, contentLang, chapterNo]);

  const trackLabelKey = AUDIOBOOK_HUB_TRACKS.find((x) => x.id === trackId)?.labelKey;
  const title = trackLabelKey ? t(trackLabelKey) : t('audiobooks.title');
  const videoUrl = chapter?.video_url?.trim() || '';

  const player = useVideoPlayer(videoUrl || null, (p) => {
    p.loop = false;
    if (videoUrl) p.play();
  });

  useEffect(() => {
    if (!videoUrl) return;
    player.replace(videoUrl);
    player.play();
  }, [videoUrl, player]);

  const videoWidth = Math.min(width, MaxContentWidth);
  const videoHeight = (videoWidth * 9) / 16;

  if (isLoading) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScreenHeader title={t('audiobooks.title')} onBack={() => backOr('/audiobooks' as Href)} />
          <ThemedActivityIndicator style={styles.loader} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!chapter || isError || !videoUrl) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScreenHeader
            title={title}
            onBack={() =>
              backOr({
                pathname: '/audiobooks/[track]/[chapter]',
                params: { track: trackId, chapter: String(chapterNo) },
              } as Href)
            }
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerMsg}>
            {t(isError ? 'common.error' : 'audiobooks.unavailable')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={title}
          subtitle={`${chapter.chapter_no}. ${chapter.title}`}
          onBack={() =>
            backOr({
              pathname: '/audiobooks/[track]/[chapter]',
              params: { track: trackId, chapter: String(chapterNo) },
            } as Href)
          }
        />
        <View style={styles.body}>
          <View style={[styles.videoWrap, { width: videoWidth, height: videoHeight }]}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {t('audiobooks.watchVideo')}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: Spacing.six },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.three, gap: Spacing.three },
  videoWrap: { maxWidth: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#0b0b0d' },
  video: { width: '100%', height: '100%' },
  hint: { textAlign: 'center' },
  centerMsg: { textAlign: 'center', marginTop: Spacing.four },
});
