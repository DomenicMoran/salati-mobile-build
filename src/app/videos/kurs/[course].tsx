// Ein Kurs: seine Kapitel und darin die Lektionen.
//
// Zweite Ebene des Menues (Kurs -> KAPITEL -> Lektion). Jedes Kapitel traegt
// seinen Fortschritt in der Kopfzeile, jede Lektion ihre Nummer, ihre Dauer
// und einen Haken, sobald sie zu Ende geschaut wurde. Oben fuehrt ein Knopf
// direkt zur naechsten offenen Lektion - das ist der Weg, den man beim
// Weiterlernen wirklich geht.
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchVideoIndex, formatDuration, type VideoEpisode } from '@/features/video/data';
import {
  groupEpisodesByCourse,
  isStarted,
  isWatched,
  progressOf,
} from '@/features/video/courses';
import { useAllVideoProgress } from '@/features/video/progress';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function CourseScreen() {
  const { t } = useTranslation();
  const { course: courseId } = useLocalSearchParams<{ course: string }>();
  const { data, isLoading } = useQuery({ queryKey: ['video-index'], queryFn: fetchVideoIndex });
  const { progress } = useAllVideoProgress();

  const course = groupEpisodesByCourse(data?.episodes ?? []).find((c) => c.id === courseId);
  const stand = course ? progressOf(course.episodes, progress) : undefined;

  const sections =
    course?.chapters.map((chapter) => ({
      title: chapter.title,
      chapterNo: chapter.chapterNo,
      stand: progressOf(chapter.episodes, progress),
      data: chapter.episodes,
    })) ?? [];

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScreenHeader
          title={course?.title ?? t('video.coursesTitle')}
          subtitle={
            stand
              ? t('video.watchedOf')
                  .replace('{done}', String(stand.watched))
                  .replace('{total}', String(stand.total))
              : undefined
          }
          onBack={() => router.back()}
        />
        {isLoading ? (
          <ThemedActivityIndicator style={styles.loader} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(ep) => String(ep.episode_no)}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={
              stand?.next ? (
                <PressableCard
                  onPress={() =>
                    router.push({
                      pathname: '/videos/[episode]',
                      params: { episode: stand.next!.episode_no },
                    })
                  }
                  type="backgroundSelected"
                  style={styles.continueCard}>
                  <IconSymbol name="play" size={18} color={Brand.gold} />
                  <View style={styles.continueTextWrap}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {t('video.continueCourse')}
                    </ThemedText>
                    <ThemedText type="subtitle" numberOfLines={1}>
                      {stand.next.title}
                    </ThemedText>
                  </View>
                </PressableCard>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('video.chapterLabel').replace('{n}', String(section.chapterNo))}
                  {section.title ? ` · ${section.title.toUpperCase()}` : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {section.stand.watched}/{section.stand.total}
                </ThemedText>
              </View>
            )}
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index % 12}>
                <LessonRow
                  episode={item}
                  watched={isWatched(item, progress)}
                  started={isStarted(item, progress)}
                />
              </AnimatedListItem>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function LessonRow({
  episode,
  watched,
  started,
}: {
  episode: VideoEpisode;
  watched: boolean;
  started: boolean;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <PressableCard
      onPress={() =>
        router.push({ pathname: '/videos/[episode]', params: { episode: episode.episode_no } })
      }
      type="backgroundElement"
      style={styles.row}>
      <View style={[styles.marker, { borderColor: watched ? Brand.gold : colors.separator }]}>
        {watched ? (
          <IconSymbol name="checkmark" size={13} color={Brand.gold} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {episode.lesson_no ?? episode.episode_no}
          </ThemedText>
        )}
      </View>
      <View style={styles.rowText}>
        <ThemedText numberOfLines={2}>{episode.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(episode.duration_sec)}
          {started ? ' · …' : ''}
        </ThemedText>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: Spacing.five },
  list: {
    padding: Spacing.three,
    gap: Spacing.one,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  continueCard: {
    padding: Spacing.three,
    marginBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  continueTextWrap: { flex: 1, gap: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: { padding: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
});
