// Podcast-Uebersicht: der deutsche Quran-Arabisch-Podcast. Serien-Header +
// Folgenliste, optional nach Reihen (`series`) gruppiert (Section-Header je
// Reihe, sobald mehr als eine Reihe vorkommt — sonst flache Liste wie bisher).
// Antippen oeffnet den Voll-Player (podcast/[episode].tsx). Pro Folge ein
// Offline-Download-Button + Offline-Kennzeichnung. Daten aus dem oeffentlichen
// Supabase-Bucket (features/podcast/data.ts) via react-query.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
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
  fetchPodcastIndex,
  formatDuration,
  groupEpisodesBySeries,
  hasMultipleSeries,
  type PodcastEpisode,
} from '@/features/podcast/data';
import { ContentLanguageBadge } from '@/features/media/content-language-badge';
import { usePodcastDownload } from '@/features/podcast/downloads';
import { useSharedPlayer } from '@/features/quran/usePlayer';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Offizieller Spotify-Show-Link (der Podcast laeuft auch auf Spotify). Marken-
// Gruen (#1DB954) bleibt in beiden Themes fix — Spotify-Wiedererkennung.
const SPOTIFY_SHOW_URL = 'https://open.spotify.com/show/033U0teP7zMDXYm3zQ3fje';
const SPOTIFY_GREEN = '#1DB954';

type ListRow =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'episode'; key: string; episode: PodcastEpisode; itemIndex: number };

export default function PodcastListScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { nowPlaying } = useSharedPlayer();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['podcast', 'index'],
    queryFn: fetchPodcastIndex,
    staleTime: 60 * 60 * 1000,
  });

  const series = data?.series;
  const episodes = data?.episodes ?? [];

  // Reihen-Gruppierung: Section-Header nur zeigen, wenn tatsaechlich mehrere
  // Reihen vorkommen — mit den aktuellen Folgen ohne series-Feld bleibt es eine
  // flache Liste (rueckwaertskompatibel).
  const multiSeries = hasMultipleSeries(episodes);
  const rows: ListRow[] = [];
  let itemIndex = 0;
  for (const group of groupEpisodesBySeries(episodes)) {
    if (multiSeries) {
      rows.push({ kind: 'section', key: `s:${group.key}`, title: group.title ?? t('podcast.moreEpisodes') });
    }
    for (const ep of group.episodes) {
      rows.push({ kind: 'episode', key: `e:${ep.episode_no}`, episode: ep, itemIndex: itemIndex++ });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={series?.title ?? t('podcast.title')} />
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {series?.cover_url ? (
                <Image
                  source={series.cover_url}
                  style={styles.seriesCover}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={series.title}
                />
              ) : (
                <ThemedView type="backgroundSelected" style={[styles.seriesCover, styles.coverFallback]}>
                  <IconSymbol name="headset" size={44} color={colors.accent} />
                </ThemedView>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.seriesSubtitle}>
                {series?.subtitle ?? t('podcast.subtitle')}
              </ThemedText>
              {series?.description ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.seriesDesc}>
                  {series.description}
                </ThemedText>
              ) : null}
              <Pressable
                onPress={() => {
                  Linking.openURL(SPOTIFY_SHOW_URL).catch(() => {});
                }}
                accessibilityRole="link"
                accessibilityLabel={t('podcast.listenOnSpotify')}
                style={({ pressed }) => [styles.spotifyBtn, pressed && styles.pressed]}>
                {/* Ionicons dieser Version hat kein logo-spotify — musical-notes
                    als passender Ersatz auf dem Spotify-gruenen Button. */}
                <IconSymbol name="musical-notes" size={20} color="#FFFFFF" />
                <ThemedText type="smallBold" style={styles.spotifyLabel}>
                  {t('podcast.listenOnSpotify')}
                </ThemedText>
              </Pressable>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'section' ? (
              <SectionHeader title={item.title} />
            ) : (
              <EpisodeRow
                episode={item.episode}
                index={item.itemIndex}
                active={nowPlaying?.title?.startsWith(`${item.episode.episode_no}.`) ?? false}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.center}>
              {isLoading ? (
                <ThemedActivityIndicator />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {isError ? t('common.error') : t('podcast.empty')}
                </ThemedText>
              )}
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeaderText}>
        {title.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function EpisodeRow({
  episode,
  index,
  active,
}: {
  episode: PodcastEpisode;
  index: number;
  active: boolean;
}) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const dl = usePodcastDownload(episode);
  const downloaded = dl.state === 'done';
  const coverSource = dl.localCoverUri ?? episode.cover_url;

  function confirmDelete() {
    Alert.alert(t('podcast.deleteDownloadConfirmTitle'), t('podcast.deleteDownloadConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('podcast.deleteDownload'), style: 'destructive', onPress: () => void dl.remove() },
    ]);
  }

  return (
    <AnimatedListItem index={index % 12}>
      <PressableCard
        onPress={() =>
          router.push({ pathname: '/podcast/[episode]', params: { episode: episode.episode_no } })
        }
        type={active ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.row}>
        <View style={styles.thumbWrap}>
          {coverSource ? (
            <Image source={coverSource} style={styles.thumb} contentFit="cover" transition={150} />
          ) : (
            <ThemedView type="backgroundSelected" style={[styles.thumb, styles.coverFallback]}>
              <ThemedText type="smallBold" themeColor="accent">
                {episode.episode_no}
              </ThemedText>
            </ThemedView>
          )}
          <View style={[styles.numBadge, { backgroundColor: colors.accent }]}>
            <ThemedText type="small" style={{ color: colors.background, fontSize: 11 }}>
              {episode.episode_no}
            </ThemedText>
          </View>
        </View>

        <View style={styles.rowText}>
          <ThemedText type="default" numberOfLines={2}>
            {episode.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {episode.topics.join(' · ')}
          </ThemedText>
          <View style={styles.metaRow}>
            <IconSymbol name={active ? 'volume-high' : 'play-circle'} size={14} color={colors.accent} />
            <ThemedText type="small" themeColor="accent">
              {formatDuration(episode.duration_sec)}
            </ThemedText>
            {downloaded && (
              <View style={styles.offlineBadge}>
                <IconSymbol name="cloud-done" size={13} color={colors.accent} />
                <ThemedText type="small" themeColor="accent" style={styles.offlineLabel}>
                  {t('podcast.offline')}
                </ThemedText>
              </View>
            )}
            {/* Sprachhinweis VOR dem Antippen: nur sichtbar, wenn die
                Oberflaeche eine andere Sprache spricht als die Folge. */}
            <ContentLanguageBadge lang={episode.lang} compact style={styles.offlineBadge} />
          </View>
        </View>

        {/* Download-Steuerung: none -> laden, downloading -> Fortschritt/abbrechen,
            done -> loeschen. Auf Web (kein Dateisystem) ist dl.supported false
            und die Steuerung bleibt aus (vermeidet zudem verschachtelte Buttons
            im Web-Export). */}
        {dl.supported &&
          (dl.state === 'downloading' ? (
            <Pressable
              onPress={dl.cancel}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('podcast.cancelDownload')}
              style={({ pressed }) => [styles.dlBtn, pressed && styles.pressed]}>
              {dl.progress > 0 ? (
                <ThemedText type="small" themeColor="accent" style={styles.dlPct}>
                  {Math.round(dl.progress * 100)}%
                </ThemedText>
              ) : (
                <ThemedActivityIndicator size="small" />
              )}
            </Pressable>
          ) : dl.state === 'done' ? (
            <Pressable
              onPress={confirmDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('podcast.deleteDownload')}
              style={({ pressed }) => [styles.dlBtn, pressed && styles.pressed]}>
              <IconSymbol name="cloud-done" size={20} color={colors.accent} />
            </Pressable>
          ) : (
            <Pressable
              onPress={dl.download}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('podcast.download')}
              style={({ pressed }) => [styles.dlBtn, pressed && styles.pressed]}>
              <IconSymbol name="download-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          ))}

        <DisclosureChevron size={18} color={colors.textSecondary} />
      </PressableCard>
    </AnimatedListItem>
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
  header: { alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.four, paddingTop: Spacing.two },
  seriesCover: { width: 200, height: 200, borderRadius: 24 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  seriesSubtitle: { textAlign: 'center' },
  seriesDesc: { textAlign: 'center', paddingHorizontal: Spacing.two },
  spotifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    backgroundColor: SPOTIFY_GREEN,
  },
  spotifyLabel: { color: '#FFFFFF' },
  sectionHeader: { paddingTop: Spacing.two, paddingBottom: Spacing.half, paddingHorizontal: Spacing.one },
  sectionHeaderText: { letterSpacing: 0.5 },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two },
  thumbWrap: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  numBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  // minWidth:0 ist auf React Native Web zwingend: ohne das behält der flex:1-
  // Textblock seine intrinsische Breite (CSS min-width:auto) und lange Titel/
  // Themen-Zeilen schieben die Zeile über den rechten Rand hinaus (horizontaler
  // Overflow ohne Begrenzung). Nativ (Yoga) ist min-width ohnehin 0.
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  // flexWrap: der Sprachhinweis kommt bei fremdsprachiger Oberflaeche als
  // dritter Chip dazu — ohne Umbruch schoebe er die Zeile ueber den Rand.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: 2, flexWrap: 'wrap' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: Spacing.one },
  offlineLabel: { fontSize: 11 },
  dlBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dlPct: { fontSize: 11 },
  pressed: { opacity: 0.6 },
});
