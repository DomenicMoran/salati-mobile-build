import { audiobookChapterStaticParams } from '@/features/audiobooks/static-params';
import { setAudioModeAsync } from 'expo-audio';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { chaptersForTrack, fetchAudiobookIndex, formatDuration, type AudiobookChapter } from '@/features/audiobooks/data';
import audiobookFallbackIndex from '@/features/audiobooks/index.fallback.json';
import { openBibliothekPdf } from '@/features/bibliothek/openBook';
import { AUDIOBOOK_HUB_TRACKS, isAudiobookTrackId } from '@/features/audiobooks/tracks';
import { Slider } from '@/features/podcast/slider';
import {
  audiobookProgressId,
  loadAudioProgressEntry,
} from '@/features/progress/audioProgress';
import { useSharedAudioProgress } from '@/features/progress/useSharedAudioProgress';
import { useSharedPlayer, type NowPlayingInfo } from '@/features/quran/usePlayer';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const SKIP_SEC = 15;

export function generateStaticParams({ params }: { params: { track: string } }) {
  return audiobookChapterStaticParams().filter((entry) => entry.track === params.track);
}

export default function AudiobookChapterPlayerScreen() {
  const { track: trackParam, chapter: chapterParam, lang: langParam } = useLocalSearchParams<{
    track: string;
    chapter: string;
    lang?: string;
  }>();
  const trackId = typeof trackParam === 'string' ? trackParam : '';
  const chapterNo = Number(chapterParam);
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { player, status, nowPlaying, setNowPlaying } = useSharedPlayer();

  const { data, isPending: isLoading, isError } = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });

  const contentLang = typeof langParam === 'string' && langParam.trim() ? langParam : locale;
  const indexEntries = useMemo(() => {
    if (data?.entries && data.entries.length > 0) return data.entries;
    return (audiobookFallbackIndex as { entries: AudiobookChapter[] }).entries ?? [];
  }, [data?.entries]);

  const chapters = useMemo(() => {
    if (!isAudiobookTrackId(trackId)) return [];
  return chaptersForTrack(indexEntries, trackId, contentLang, data);
  }, [indexEntries, trackId, contentLang, data]);

  const chapter = chapters.find((c) => c.chapter_no === chapterNo);
  const idx = chapters.findIndex((c) => c.chapter_no === chapterNo);
  const prev = idx > 0 ? chapters[idx - 1] : undefined;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : undefined;

  const trackLabelKey = AUDIOBOOK_HUB_TRACKS.find((x) => x.id === trackId)?.labelKey;
  const artist = trackLabelKey ? t(trackLabelKey) : t('audiobooks.title');

  const nowTitle = chapter ? `${chapter.chapter_no}. ${chapter.title}` : '';
  const activeHref = typeof nowPlaying?.href === 'object' ? nowPlaying.href : null;
  const isThisLoaded = !!chapter && activeHref?.pathname === '/audiobooks/[track]/[chapter]'
    && activeHref.params?.track === trackId && activeHref.params?.chapter === String(chapterNo)
    && nowPlaying?.title === nowTitle && nowPlaying.contentLanguage === contentLang;

  const duration = status.duration || chapter?.duration_sec || 0;
  const position = status.currentTime || 0;

  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [bookOpenError, setBookOpenError] = useState(false);

  const autoplayRef = useRef(true);

  const playChapter = useCallback(
    async function playSelectedChapter(ch: (typeof chapters)[number]) {
      const saved = await loadAudioProgressEntry(audiobookProgressId(trackId, ch.chapter_no, contentLang));
      player.replace(ch.audio_url);
      if (saved && saved.positionSec >= 5) {
        player.seekTo(saved.positionSec);
      }
      player.play();
      if (Platform.OS !== 'web') {
        setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true, interruptionMode: 'doNotMix' }).catch(() => {});
        player.setActiveForLockScreen(true, { title: `${ch.chapter_no}. ${ch.title}`, artist });
      }
      const i = chapters.findIndex((c) => c.chapter_no === ch.chapter_no);
      const p = i > 0 ? chapters[i - 1] : undefined;
      const n = i >= 0 && i < chapters.length - 1 ? chapters[i + 1] : undefined;
      const info: NowPlayingInfo = {
        title: `${ch.chapter_no}. ${ch.title}`,
        contentLanguage: ch.lang,
        subtitle: artist,
        href: {
          pathname: '/audiobooks/[track]/[chapter]',
          params: { track: trackId, chapter: String(ch.chapter_no), lang: contentLang },
        } as Href,
        hasPrev: !!p,
        hasNext: !!n,
        onPrev: p
          ? () => {
              router.replace({
                pathname: '/audiobooks/[track]/[chapter]',
                params: { track: trackId, chapter: String(p.chapter_no), lang: contentLang },
              } as Href);
              playSelectedChapter(p);
            }
          : undefined,
        onNext: n
          ? () => {
              router.replace({
                pathname: '/audiobooks/[track]/[chapter]',
                params: { track: trackId, chapter: String(n.chapter_no), lang: contentLang },
              } as Href);
              void playSelectedChapter(n);
            }
          : undefined,
        onEnded: n
          ? () => {
              if (!autoplayRef.current) return;
              router.replace({
                pathname: '/audiobooks/[track]/[chapter]',
                params: { track: trackId, chapter: String(n.chapter_no), lang: contentLang },
              } as Href);
              void playSelectedChapter(n);
            }
          : undefined,
      };
      setNowPlaying(info);
    },
    [artist, chapters, contentLang, player, setNowPlaying, trackId],
  );

  useSharedAudioProgress({
    active: !!chapter && isThisLoaded,
    kind: 'audiobook',
    status,
    buildEntry: useCallback(
      (positionSec, durationSec) =>
        chapter
          ? {
              kind: 'audiobook',
              id: audiobookProgressId(trackId, chapter.chapter_no, contentLang),
              positionSec,
              durationSec,
              meta: { track: trackId, chapterNo: chapter.chapter_no, lang: contentLang },
            }
          : null,
      [chapter, contentLang, trackId],
    ),
  });

  useFocusEffect(useCallback(() => {
    if (!chapter || isThisLoaded) return;
    playChapter(chapter);
  }, [chapter, isThisLoaded, playChapter]));

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

  if (!chapter || isError) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScreenHeader title={t('audiobooks.title')} onBack={() => backOr('/audiobooks' as Href)} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerMsg}>
            {t(isError ? 'common.error' : 'audiobooks.unavailable')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const displayPos = seekPreview ?? position;
  const progress = duration > 0 ? displayPos / duration : 0;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={artist}
          subtitle={chapter.title}
          onBack={() => backOr({ pathname: '/audiobooks/[track]', params: { track: trackId, lang: contentLang } } as Href)}
        />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText type="title" style={styles.chapterTitle}>
            {chapter.chapter_no}. {chapter.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {displayPos > 0 ? formatDuration(displayPos) : '0:00'} / {formatDuration(duration)}
          </ThemedText>

          {!!chapter.book_pdf_url?.trim() && (
            <>
              <Pressable
                onPress={() => {
                  setBookOpenError(false);
                  try {
                    openBibliothekPdf({
                      pdfUrl: chapter.book_pdf_url!.trim(),
                      title: t('audiobooks.bookOpen'),
                    });
                  } catch {
                    setBookOpenError(true);
                  }
                }}
                accessibilityRole="link"
                accessibilityLabel={t('audiobooks.bookOpen')}
                style={({ pressed }) => [styles.videoBtn, { borderColor: colors.accent }, pressed && styles.pressed]}>
                <IconSymbol name="document-text" size={20} color={colors.accent} />
                <ThemedText type="small" style={{ color: colors.accent }}>
                  {t('audiobooks.bookOpen')}
                </ThemedText>
              </Pressable>
              {bookOpenError && (
                <ThemedText accessibilityRole="alert" type="small" style={styles.centerMsg}>
                  {t('common.error')}
                </ThemedText>
              )}
            </>
          )}

          {!!chapter.video_url?.trim() && (
            <Pressable
              onPress={() => {
                player.pause();
                router.push({
                  pathname: '/audiobooks/[track]/[chapter]/video',
                  params: { track: trackId, chapter: String(chapter.chapter_no), lang: contentLang },
                } as unknown as Href);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('audiobooks.watchVideo')}
              style={({ pressed }) => [
                styles.videoBtn,
                { borderColor: colors.accent },
                pressed && styles.pressed,
              ]}>
              <IconSymbol name="videocam" size={20} color={colors.accent} />
              <ThemedText type="small" style={{ color: colors.accent }}>
                {t('audiobooks.watchVideo')}
              </ThemedText>
            </Pressable>
          )}

          <Slider
            value={progress}
            onChange={(v) => setSeekPreview(v * duration)}
            onCommit={(v) => {
              player.seekTo(v * duration);
              setSeekPreview(null);
            }}
            accessibilityLabel={t('podcast.seek')}
          />

          <View style={styles.controls}>
            <Pressable
              onPress={() =>
                prev &&
                router.replace({
                  pathname: '/audiobooks/[track]/[chapter]',
                  params: { track: trackId, chapter: String(prev.chapter_no), lang: contentLang },
                } as Href)
              }
              disabled={!prev}
              accessibilityRole="button"
              accessibilityLabel={t('podcast.previous')}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, !prev && styles.disabled]}>
              <IconSymbol name="play-skip-back" size={28} color={prev ? colors.text : colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => player.seekTo(Math.max(0, position - SKIP_SEC))}
              accessibilityLabel={t('audiobooks.back15')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <IconSymbol name="play-back" size={32} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => (status.playing ? player.pause() : player.play())}
              accessibilityRole="button"
              accessibilityLabel={status.playing ? t('podcast.pause') : t('podcast.play')}
              style={({ pressed }) => [styles.playBtn, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
              <IconSymbol name={status.playing ? 'pause' : 'play'} size={36} color={colors.background} />
            </Pressable>
            <Pressable
              onPress={() => player.seekTo(Math.min(duration, position + SKIP_SEC))}
              accessibilityLabel={t('audiobooks.forward15')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <IconSymbol name="play-forward" size={32} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() =>
                next &&
                router.replace({
                  pathname: '/audiobooks/[track]/[chapter]',
                  params: { track: trackId, chapter: String(next.chapter_no), lang: contentLang },
                } as Href)
              }
              disabled={!next}
              accessibilityRole="button"
              accessibilityLabel={t('podcast.next')}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, !next && styles.disabled]}>
              <IconSymbol name="play-skip-forward" size={28} color={next ? colors.text : colors.textSecondary} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: Spacing.six },
  centerMsg: { textAlign: 'center', padding: Spacing.four },
  body: {
    flexGrow: 1,
    paddingBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  chapterTitle: { textAlign: 'center' },
  videoBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.35 },
});
