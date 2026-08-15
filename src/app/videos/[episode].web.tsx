// Video-Voll-Player — WEB-Fallback. expo-video/VideoView laeuft zwar auch im
// Browser, doch fuer den statischen Web-Export ist ein schlichtes HTML5-
// <video controls>-Element robuster (kein natives Modul im SSR-Prerender) und
// bringt Scrubber, Play/Pause, Geschwindigkeit, Bild-in-Bild und Vollbild
// bereits mit. Offline-Downloads gibt es im Web nicht (kein Dateisystem) — hier
// wird nur gestreamt. Auto-Play der naechsten Folge (Reihe/Playlist), „zu
// Playlist hinzufuegen", Titel/Beschreibung/Themen und Folge vor/zurueck sind
// wie in der nativen Ansicht ([episode].tsx). Die Wiedergabe-Position wird ueber
// dieselbe progress.ts (AsyncStorage) gemerkt und wiederhergestellt.
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { AddToPlaylistSheet } from '@/features/video/add-to-playlist-sheet';
import { fetchVideoIndex, formatDuration, seriesNeighbors, type VideoEpisode } from '@/features/video/data';
import { useVideoPlaylists } from '@/features/video/playlists';
import { useVideoPrefs } from '@/features/video/prefs';
import { loadVideoProgress, saveVideoProgress } from '@/features/video/progress';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function VideoPlayerWebScreen() {
  const { episode: episodeParam, list: listParam } = useLocalSearchParams<{ episode: string; list?: string }>();
  const episodeNo = Number(episodeParam);
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading, isError } = useQuery({
    queryKey: ['video', 'index'],
    queryFn: fetchVideoIndex,
    staleTime: 60 * 60 * 1000,
  });

  const { prefs } = useVideoPrefs();
  const { playlists } = useVideoPlaylists();

  const episodes = useMemo(() => data?.episodes ?? [], [data]);
  const episode = episodes.find((e) => e.episode_no === episodeNo);

  const { prev, next } = useMemo(() => {
    const playlist = listParam ? playlists.find((p) => p.id === listParam) : undefined;
    if (playlist) {
      const ordered = playlist.episodeNos
        .map((n) => episodes.find((e) => e.episode_no === n))
        .filter((e): e is VideoEpisode => !!e);
      const i = ordered.findIndex((e) => e.episode_no === episodeNo);
      return {
        prev: i > 0 ? ordered[i - 1] : undefined,
        next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : undefined,
      };
    }
    return seriesNeighbors(episodes, episodeNo);
  }, [episodes, episodeNo, listParam, playlists]);

  const [showPlaylistSheet, setShowPlaylistSheet] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekedRef = useRef(false);
  const lastSaveRef = useRef(0);

  // Refs, damit der onEnded-Listener frische Werte sieht.
  const autoplayRef = useRef(prefs.autoplay);
  const nextRef = useRef<VideoEpisode | undefined>(next);
  const listRef = useRef<string | undefined>(listParam);
  useEffect(() => {
    autoplayRef.current = prefs.autoplay;
    nextRef.current = next;
    listRef.current = listParam;
  });

  // Gemerkte Position anwenden, fortlaufend (throttled) sichern; am Folgenende
  // bei aktivem Autoplay die naechste Folge oeffnen.
  useEffect(() => {
    seekedRef.current = false;
    lastSaveRef.current = 0;
    const el = videoRef.current;
    if (!el || episode == null) return;

    const onLoaded = () => {
      if (seekedRef.current) return;
      seekedRef.current = true;
      loadVideoProgress(episodeNo).then((saved) => {
        if (saved > 1 && el.duration && saved < el.duration - 2) el.currentTime = saved;
      });
    };
    const onTime = () => {
      if (!seekedRef.current) return;
      const now = Date.now();
      if (now - lastSaveRef.current < 4000) return;
      lastSaveRef.current = now;
      void saveVideoProgress(episodeNo, el.currentTime, el.duration || 0);
    };
    const onEnded = () => {
      void saveVideoProgress(episodeNo, el.currentTime, el.duration || 0);
      const n = nextRef.current;
      if (autoplayRef.current && n) {
        router.replace({
          pathname: '/videos/[episode]',
          params: listRef.current ? { episode: n.episode_no, list: listRef.current } : { episode: n.episode_no },
        });
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      if (seekedRef.current) void saveVideoProgress(episodeNo, el.currentTime, el.duration || 0);
    };
  }, [episodeNo, episode]);

  function goTo(ep?: VideoEpisode) {
    if (ep)
      router.replace({
        pathname: '/videos/[episode]',
        params: listParam ? { episode: ep.episode_no, list: listParam } : { episode: ep.episode_no },
      });
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.center]}>
          <ThemedActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isError || !episode) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.center]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('common.error')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const topics = episode.topics.filter((s) => s && s.trim().length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.videoWrap}>
            {/* key auf die Folge: bei Folge vor/zurueck bekommt das Element eine
                neue Quelle und die Effekte (Position) laufen sauber neu. */}
            <video
              key={episode.episode_no}
              ref={videoRef}
              src={episode.video_url}
              poster={episode.cover_url || undefined}
              controls
              playsInline
              autoPlay
              style={webVideoStyle}
            />
          </View>

          <View style={styles.info}>
            <View style={styles.navRow}>
              <Pressable
                onPress={() => goTo(prev)}
                disabled={!prev}
                accessibilityRole="button"
                accessibilityLabel={t('video.previous')}
                style={({ pressed }) => [styles.navBtn, !prev && styles.navDisabled, pressed && styles.pressed]}>
                <IconSymbol name="play-skip-back" size={18} color={prev ? colors.accent : colors.textSecondary} />
                <ThemedText type="small" themeColor={prev ? 'accent' : 'textSecondary'}>
                  {t('video.previous')}
                </ThemedText>
              </Pressable>
              <PressableCard onPress={() => setShowPlaylistSheet(true)} type="backgroundElement" style={styles.playlistBtn}>
                <IconSymbol name="albums-outline" size={16} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('video.playlist')}
                </ThemedText>
              </PressableCard>
              <Pressable
                onPress={() => goTo(next)}
                disabled={!next}
                accessibilityRole="button"
                accessibilityLabel={t('video.next')}
                style={({ pressed }) => [styles.navBtn, !next && styles.navDisabled, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor={next ? 'accent' : 'textSecondary'}>
                  {t('video.next')}
                </ThemedText>
                <IconSymbol name="play-skip-forward" size={18} color={next ? colors.accent : colors.textSecondary} />
              </Pressable>
            </View>

            <ThemedText type="small" themeColor="accent" style={styles.epNo}>
              {episode.series_title ? `${episode.series_title} · ` : ''}
              {t('video.episodeLabel')} {episode.episode_no} · {formatDuration(episode.duration_sec)}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.title}>
              {episode.title}
            </ThemedText>
            {episode.description ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.desc}>
                {episode.description}
              </ThemedText>
            ) : null}

            {topics.length > 0 && (
              <>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.topicsLabel}>
                  {t('video.topics').toUpperCase()}
                </ThemedText>
                <View style={styles.topicsWrap}>
                  {topics.map((topic, i) => (
                    <View key={i} style={[styles.topicChip, { backgroundColor: colors.backgroundElement }]}>
                      <ThemedText type="small" themeColor="text">
                        {topic}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <AddToPlaylistSheet visible={showPlaylistSheet} onClose={() => setShowPlaylistSheet(false)} episodeNo={episode.episode_no} />
    </ThemedView>
  );
}

// Plain-DOM-Style fuer das <video>-Element (kein RN-StyleSheet).
const webVideoStyle = {
  width: '100%',
  aspectRatio: '16 / 9',
  backgroundColor: '#000',
  display: 'block',
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two + BackChipInset },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: Spacing.six, alignItems: 'center' },
  videoWrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  info: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, marginTop: Spacing.three, gap: Spacing.one },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one },
  navDisabled: { opacity: 0.4 },
  playlistBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  epNo: { textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 22, lineHeight: 28, marginTop: Spacing.half },
  desc: { marginTop: Spacing.one, lineHeight: 22 },
  topicsLabel: { letterSpacing: 1, marginTop: Spacing.three },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  topicChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: 999 },
  pressed: { opacity: 0.6 },
});
