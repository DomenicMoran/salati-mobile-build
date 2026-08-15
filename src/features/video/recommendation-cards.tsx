// Freiwillige Empfehlungs-Karten im Kopf einer Lernphase/eines Kurses — analog
// zum PhasePodcastCard in app/learn/index.tsx, aber sie oeffnen den Video-Player
// (videos/[episode].tsx) statt den Podcast. Zwei Varianten:
//  - PhaseVideoCard: das passende Lernvideo (Cover + Titel + Dauer).
//  - PhaseTableCard: eine exakt passende Grammatik-Tabelle (kind:'table') als
//    kleine „Tabelle ansehen"-Karte (kompakt, ohne Cover).
// Beide sind rein optional: fehlt der Eintrag im Index (oder ist der Index leer/
// nicht ladbar), wird keine Karte gezeigt — nie ein Crash.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { fetchVideoIndex, formatDuration } from '@/features/video/data';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

function useVideoEpisode(episodeNo: number) {
  // Geteilter, gecachter Index (gleicher queryKey wie die Video-Liste/der
  // Player) — kein zusaetzlicher Fetch, wenn er schon geladen wurde.
  const { data } = useQuery({
    queryKey: ['video', 'index'],
    queryFn: fetchVideoIndex,
    staleTime: 60 * 60 * 1000,
  });
  return {
    // Index geladen, Folge aber nicht vorhanden -> Karte ausblenden.
    hidden: !!data && !data.episodes.some((e) => e.episode_no === episodeNo),
    episode: data?.episodes.find((e) => e.episode_no === episodeNo),
  };
}

function openVideo(episodeNo: number) {
  router.push({ pathname: '/videos/[episode]', params: { episode: episodeNo } });
}

/** Video-Empfehlung: passendes Lernvideo mit Cover, Titel und Dauer. */
export function PhaseVideoCard({ episodeNo }: { episodeNo: number }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { hidden, episode } = useVideoEpisode(episodeNo);
  if (hidden) return null;
  return (
    <PressableCard
      onPress={() => openVideo(episodeNo)}
      type="backgroundElement"
      style={[styles.row, styles.card]}>
      <View style={styles.thumbWrap}>
        {episode?.cover_url ? (
          <Image source={episode.cover_url} style={styles.thumb} contentFit="cover" transition={150} />
        ) : (
          <ThemedView type="backgroundSelected" style={[styles.thumb, styles.thumbFallback]}>
            <IconSymbol name="videocam" size={18} color={colors.accent} />
          </ThemedView>
        )}
        <View style={styles.playOverlay}>
          <IconSymbol name="play" size={16} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('learn.videoIntro')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {episode ? `${episode.title} · ${formatDuration(episode.duration_sec)}` : t('learn.videoOptional')}
        </ThemedText>
      </View>
      <IconSymbol name="play-circle" size={24} color={colors.accent} />
    </PressableCard>
  );
}

/** Tabellen-Empfehlung: kompakte „Tabelle ansehen"-Karte (kind:'table'). */
export function PhaseTableCard({ episodeNo }: { episodeNo: number }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { hidden, episode } = useVideoEpisode(episodeNo);
  if (hidden) return null;
  return (
    <PressableCard
      onPress={() => openVideo(episodeNo)}
      type="backgroundElement"
      style={[styles.row, styles.card]}>
      <ThemedView type="backgroundSelected" style={styles.tableBadge}>
        <IconSymbol name="grid-outline" size={16} color={colors.accent} />
      </ThemedView>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('learn.tableView')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {episode ? `${episode.title} · ${formatDuration(episode.duration_sec)}` : t('learn.tableViewDesc')}
        </ThemedText>
      </View>
      <IconSymbol name="play-circle" size={24} color={colors.accent} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
  },
  // Dezente Akzent-Umrandung: kennzeichnet die Karte als freiwilliges Angebot
  // (gleiche Sprache wie der Podcast-Vorschlag in learn/index.tsx).
  card: { marginBottom: Spacing.two, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  thumbWrap: { width: 72, height: 48 },
  thumb: { width: 72, height: 48, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // minWidth:0 gegen horizontalen Overflow bei langen Titeln auf RN Web.
  rowText: { flex: 1, minWidth: 0, gap: Spacing.half },
});
