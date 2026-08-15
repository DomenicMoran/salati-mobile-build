// Abschlussprüfung eines Studien-Kurses: 20 Fragen quer über alle Lektionen,
// bestanden ab 80 %. Ergebnis wird im Kurs-Fortschritt unter der Id 'exam'
// gespeichert (bestes Ergebnis zählt, wie bei Lektionen).
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Spacing } from '@/constants/theme';
import { useCourseProgress } from '@/features/learn/progress';
import { buildQuiz, shuffle, type QuizQuestion } from '@/features/learn/quiz';
import { QuizSession } from '@/features/study/QuizSession';
import { COURSE_META, courseMetaById, loadCourseLessons } from '@/features/study/courses';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

export const EXAM_ID = 'exam';
export const EXAM_PASS_RATIO = 0.8;
export const EXAM_QUESTIONS = 20;

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template (siehe ausführlicher
// Kommentar in study/[course]/index.tsx für die Hydration-Fehler-Analyse
// React #418) — jeder Kurs braucht sein eigenes vorgerendertes HTML.
export function generateStaticParams() {
  return COURSE_META.map((c) => ({ course: c.id }));
}

export default function CourseExamScreen() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();
  const course = courseMetaById(courseId);
  const { t, locale } = useTranslation();
  const { record } = useCourseProgress(course?.storageKey ?? 'salatibox:study-unknown');

  // Fragen erst NACH der Hydration in einem Effect mischen, nicht direkt im
  // Render-Body: Math.random() liefert serverseitig (Static Export) und
  // beim ersten Client-Render zwangsläufig unterschiedliche Reihenfolgen —
  // lief das im Render selbst, weicht das vorgerenderte HTML vom ersten
  // Client-Render ab (React #418, reproduzierbar bei jedem Kurs, seit
  // generateStaticParams echten Prüfungs-Inhalt server-seitig erreichbar
  // macht). Ein Effect läuft nie während SSR — derselbe Ladezustand-Trick
  // wie in study/review.tsx.
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!course) return;
      const lessons = await loadCourseLessons(course.id);
      const all = lessons.flatMap((l) => buildQuiz(l, Math.random, locale));
      const mixed = shuffle(all, Math.random).slice(0, EXAM_QUESTIONS);
      if (!cancelled) setQuestions(mixed);
    })();
    return () => {
      cancelled = true;
    };
    // Fragen einmal beim Öffnen mischen — nicht bei jedem Re-Render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  // Audit 2026-07-28: Fehler- und Ladezweig ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang (Studium-Stack: headerShown:false, Zurueck-Chip
  // Web-only). Der Erfolgsfall bringt seinen Schliessen-Knopf ueber
  // QuizSession/LessonPlayer mit, diese Zweige hatten gar keinen.
  if (!course || (questions !== null && questions.length === 0)) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('exam.title')} onBack={() => backOr('/study')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (questions === null) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('exam.title')} onBack={() => backOr('/study')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <QuizSession
      title={t('exam.title')}
      questions={questions}
      backTo={{ pathname: '/study/[course]', params: { course: course.id } }}
      onFinish={(score, total) => record(EXAM_ID, score, total)}
      resultText={(score, total) =>
        total > 0 && score / total >= EXAM_PASS_RATIO ? t('exam.passed') : t('exam.failed')
      }
      resultEmoji={(score, total) =>
        total > 0 && score / total >= EXAM_PASS_RATIO ? '🎓' : '📚'
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
});
