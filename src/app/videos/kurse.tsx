// Kursmenue: die oberste Ebene von "Koran lernen / Videos".
//
// Vorher fuehrte der Weg direkt in EINE lange Liste mit Reihen-Kopfzeilen.
// Jetzt steht davor die Frage, die ein Lernender zuerst hat: welchen Kurs
// mache ich? Je Kurs zeigt die Kachel, wieviele Lektionen es sind, wieviele
// davon geschaut wurden - und mit einem Tipp geht es genau dort weiter, wo
// man stehengeblieben ist.
//
// Die Einteilung kommt aus dem Index (features/video/courses.ts), nicht aus
// dieser Datei. Bringt der Index keine Kursfelder mit, ist dieser Bildschirm
// leer und die flache Liste bleibt der Weg - deshalb verlinkt er sie unten
// immer mit.
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchVideoIndex } from '@/features/video/data';
import { groupEpisodesByCourse, progressOf, type Course } from '@/features/video/courses';
import { useAllVideoProgress } from '@/features/video/progress';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function CoursesScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data, isLoading } = useQuery({ queryKey: ['video-index'], queryFn: fetchVideoIndex });
  const { progress } = useAllVideoProgress();
  const courses = groupEpisodesByCourse(data?.episodes ?? []);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScreenHeader title={t('video.coursesTitle')} subtitle={t('video.coursesSubtitle')} />
        {isLoading ? (
          <ThemedActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            data={courses}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <CourseCard course={item} progress={progress} />
              </AnimatedListItem>
            )}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {t('video.empty')}
              </ThemedText>
            }
            ListFooterComponent={
              <PressableCard
                onPress={() => router.push('/videos')}
                type="backgroundElement"
                style={styles.allCard}>
                <IconSymbol name="list" size={18} color={Brand.gold} />
                <ThemedText type="subtitle" style={styles.allText}>
                  {t('video.allEpisodes')}
                </ThemedText>
                <DisclosureChevron color={colors.textSecondary} />
              </PressableCard>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function CourseCard({
  course,
  progress,
}: {
  course: Course;
  progress: ReturnType<typeof useAllVideoProgress>['progress'];
}) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const stand = progressOf(course.episodes, progress);
  const prozent = Math.round(stand.ratio * 100);

  return (
    <PressableCard
      onPress={() => router.push({ pathname: '/videos/kurs/[course]', params: { course: course.id } })}
      type="backgroundElement"
      style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitleWrap}>
          <ThemedText type="subtitle" numberOfLines={2}>
            {course.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('video.chapterCount').replace('{n}', String(course.chapters.length))} ·{' '}
            {t('video.lessonCount').replace('{n}', String(course.episodes.length))}
          </ThemedText>
        </View>
        <DisclosureChevron color={colors.textSecondary} />
      </View>

      <View style={[styles.track, { backgroundColor: colors.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${prozent}%`, backgroundColor: Brand.gold }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('video.watchedOf')
          .replace('{done}', String(stand.watched))
          .replace('{total}', String(stand.total))}
        {prozent > 0 ? ` · ${prozent} %` : ''}
      </ThemedText>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: Spacing.five },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: { padding: Spacing.three, gap: Spacing.one },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitleWrap: { flex: 1, gap: 2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  allCard: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  allText: { flex: 1 },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
});
