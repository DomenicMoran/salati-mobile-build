import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Spacing } from '@/constants/theme';
import type { Lesson } from '@/features/learn/curriculum';
import { LessonPlayer } from '@/features/learn/LessonPlayer';
import { useCourseProgress } from '@/features/learn/progress';
import { COURSE_META, courseMetaById, loadCourseLessons } from '@/features/study/courses';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template (siehe ausführlicher
// Kommentar in study/[course]/index.tsx für die Hydration-Fehler-Analyse
// React #418). Hier braucht es das kartesische Produkt aus Kurs x Lektion
// (jede Lektion existiert nur innerhalb ihres Kurses), damit jede
// course/lesson-Kombination ihr eigenes vorgerendertes HTML bekommt
// (aktuell 311 Kombinationen über alle 12 Kurse — vertretbar unter der
// 500er-Schwelle für Build-Output-Aufblähung). generateStaticParams läuft
// beim `expo export` NUR zur Build-Zeit in Node (nicht im Client-Bundle) —
// die dynamischen Kurs-Imports hier laufen also nie im Browser mit.
export async function generateStaticParams() {
  const perCourse = await Promise.all(
    COURSE_META.map(async (c) => {
      const lessons = await loadCourseLessons(c.id);
      return lessons.map((l) => ({ course: c.id, lesson: l.id }));
    }),
  );
  return perCourse.flat();
}

export default function StudyLessonScreen() {
  const { course: courseId, lesson: lessonId } = useLocalSearchParams<{
    course: string;
    lesson: string;
  }>();
  const course = courseMetaById(courseId);
  const { t } = useTranslation();
  const { record, progress } = useCourseProgress(course?.storageKey ?? 'salatibox:study-unknown');

  // Lektionsinhalte async pro Kurs laden statt wie früher über den
  // statischen COURSES-Import — siehe courses.ts-Kommentar.
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!course) return;
    loadCourseLessons(course.id).then((loaded) => {
      if (!cancelled) setLessons(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [course]);

  // Audit 2026-07-28: Fehler- und Ladezweig ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang (Studium-Stack: headerShown:false, Zurueck-Chip
  // Web-only). Der Erfolgsfall bringt seinen Schliessen-Knopf ueber
  // QuizSession/LessonPlayer mit, diese Zweige hatten gar keinen.
  if (!course) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('study.title')} onBack={() => backOr('/study')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!lessons) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('study.title')} onBack={() => backOr('/study')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const lessonPos = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessonPos >= 0 ? lessons[lessonPos] : undefined;

  if (!lesson) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('study.title')} onBack={() => backOr('/study')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Direktsprung zur Folge-Lektion im Ergebnis-Screen (Audit 2026-07-19 C3)
  const nextLesson = lessons[lessonPos + 1];

  return (
    <LessonPlayer
      lesson={lesson}
      backTo={{ pathname: '/study/[course]', params: { course: course.id } }}
      record={record}
      courseId={course.id}
      nextTo={
        nextLesson
          ? { pathname: '/study/[course]/[lesson]', params: { course: course.id, lesson: nextLesson.id } }
          : undefined
      }
      courseCompletion={{
        courseId: course.id,
        courseTitle: t(`study.courses.${course.id}.title`),
        allLessons: lessons,
        progress,
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
});
