// Einstufungstest für einen Studium-Kurs (generische Variante von
// app/learn/placement.tsx): prüft Meilenstein für Meilenstein, verteilt
// dynamisch über die tatsächliche Kurslänge (siehe features/study/placement.ts).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { lessonTitle, type Lesson } from '@/features/learn/curriculum';
import { useCourseProgress } from '@/features/learn/progress';
import {
  buildCourseCheckpoints,
  checkpointPassed,
  applyCoursePlacement,
  recommendedNextLessonIn,
  type CourseCheckpoint,
} from '@/features/study/placement';
import { COURSE_META, courseMetaById, loadCourseLessons } from '@/features/study/courses';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template (siehe ausführlicher
// Kommentar in study/[course]/index.tsx für die Hydration-Fehler-Analyse
// React #418) — jeder Kurs braucht sein eigenes vorgerendertes HTML.
export function generateStaticParams() {
  return COURSE_META.map((c) => ({ course: c.id }));
}

export default function CoursePlacementScreen() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();
  const course = courseMetaById(courseId);
  const { t, locale } = useTranslation();
  const { progress, record } = useCourseProgress(course?.storageKey ?? 'salatibox:study-unknown');
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Teilt sich denselben "gesehen"-Status wie app/learn/placement.tsx —
  // gleiche Übungsmechanik, siehe Kommentar in use-exercise-intro.ts.
  const intro = useExerciseIntro('placement');

  // Checkpoints erst NACH der Hydration in einem Effect mischen, nicht
  // direkt im Render-Body: Math.random() liefert serverseitig (Static
  // Export) und beim ersten Client-Render zwangsläufig unterschiedliche
  // Fragen-Reihenfolgen — lief das im Render selbst, weicht das
  // vorgerenderte HTML vom ersten Client-Render ab (React #418,
  // reproduzierbar bei jedem Kurs, seit generateStaticParams echten
  // Einstufungstest-Inhalt server-seitig erreichbar macht). Ein Effect
  // läuft nie während SSR — derselbe Ladezustand-Trick wie in
  // study/review.tsx.
  const [checkpoints, setCheckpoints] = useState<CourseCheckpoint[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!course) return;
      const courseLessons = await loadCourseLessons(course.id);
      const built = buildCourseCheckpoints(courseLessons, locale, Math.random);
      if (!cancelled) {
        setLessons(courseLessons);
        setCheckpoints(built);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Checkpoints einmal beim Öffnen mischen, nicht bei jedem Re-Render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [lastPassedId, setLastPassedId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [applied, setApplied] = useState(false);

  const checkpoint = checkpoints?.[checkpointIndex];
  const question = checkpoint?.questions[questionIndex];

  function answer(optionIndex: number) {
    if (answered !== null || !question) return;
    setAnswered(optionIndex);
    const correct = optionIndex === question.correctIndex;
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    setTimeout(() => {
      setAnswered(null);
      if (questionIndex + 1 < checkpoint.questions.length) {
        setQuestionIndex(questionIndex + 1);
        return;
      }
      // Checkpoint zu Ende: bestanden -> nächster Checkpoint, sonst Test beenden.
      const passed = checkpointPassed(nextScore, checkpoint.questions.length);
      if (passed) {
        const newLastPassed = checkpoint.lessonId;
        if (checkpointIndex + 1 < (checkpoints?.length ?? 0)) {
          setLastPassedId(newLastPassed);
          setCheckpointIndex(checkpointIndex + 1);
          setQuestionIndex(0);
          setScore(0);
        } else {
          setLastPassedId(newLastPassed);
          setFinished(true);
        }
      } else {
        setFinished(true);
      }
    }, 900);
  }

  function confirmPlacement() {
    if (!course || !lessons || !recommended) return;
    if (applied) {
      router.replace({
        pathname: '/study/[course]/[lesson]',
        params: { course: course.id, lesson: recommended.id },
      });
      return;
    }
    const next = applyCoursePlacement(lessons, progress, lastPassedId);
    for (const [id, result] of Object.entries(next)) {
      if (!progress[id]) record(id, result.score, result.total);
    }
    setApplied(true);
    router.replace({
      pathname: '/study/[course]/[lesson]',
      params: { course: course.id, lesson: recommended.id },
    });
  }

  const recommended = course && lessons ? recommendedNextLessonIn(lessons, lastPassedId) : null;

  // Audit 2026-07-27: Alle drei Frueh-Zweige rendern nur "Fehler" bzw. einen
  // Spinner — ohne Kopf und damit auf nativ ohne sichtbaren Ausgang
  // (Studium-Stack: headerShown:false, Zurueck-Chip Web-only). Der Einstufungs-
  // test ist genau der Screen, den ein Nutzer wieder verlassen koennen muss.
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

  const backToCourse = () => backOr({ pathname: '/study/[course]', params: { course: course.id } });

  if (checkpoints === null) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t(`study.courses.${course.id}.title`)} onBack={backToCourse} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!checkpoint || !recommended) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t(`study.courses.${course.id}.title`)} onBack={backToCourse} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => backOr({ pathname: '/study/[course]', params: { course: course.id } })}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
            <ThemedText type="default" themeColor="textSecondary">
              ✕
            </ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle} numberOfLines={2}>
            {t('placement.title')}
          </ThemedText>
          <IntroHelpButton onPress={intro.show} color={colors.textSecondary} />
        </View>

        {!finished && question && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {t('placement.step').replace('{n}', String(checkpointIndex + 1)).replace('{total}', String(checkpoints.length))}
              {' · '}
              {questionIndex + 1} / {checkpoint.questions.length}
            </ThemedText>
            <ThemedText type="default" style={styles.prompt}>
              {question.promptText ?? t(question.promptKey)}
            </ThemedText>
            {question.display !== '' && (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText style={question.displayArabic ? styles.cardArabic : styles.cardLatin}>
                  {question.display}
                </ThemedText>
              </ThemedView>
            )}
            <View style={styles.options}>
              {question.options.map((option, i) => {
                const isCorrect = answered !== null && i === question.correctIndex;
                const isWrong = answered === i && i !== question.correctIndex;
                return (
                  <Pressable
                    key={`${questionIndex}-${i}`}
                    onPress={() => answer(i)}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                    style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}>
                      <ThemedText type="default" style={question.optionsArabic ? styles.optionArabic : undefined}>
                        {option}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {finished && (
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText style={styles.resultEmoji}>🎯</ThemedText>
              <ThemedText type="title">{lessonTitle(recommended, locale, t)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resultText}>
                {t('placement.recommendation')}
              </ThemedText>
            </ThemedView>
            <View style={styles.navRow}>
              <Pressable
                onPress={confirmPlacement}
                accessibilityRole="button"
                accessibilityLabel={t('placement.confirm')}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundSelected" style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('placement.confirm')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.placement.title')}
        what={t('practice.intro.placement.what')}
        why={t('practice.intro.placement.why')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch', alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  stepLabel: { textAlign: 'center' },
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  cardArabic: { fontSize: 56, lineHeight: 90, textAlign: 'center' },
  cardLatin: { fontSize: 32, lineHeight: 44, textAlign: 'center' },
  prompt: { textAlign: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  navButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  options: { gap: Spacing.two },
  option: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  optionCorrect: { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: '#4ade80' },
  optionWrong: { backgroundColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderColor: '#f87171' },
  optionArabic: { fontSize: 26, lineHeight: 44 },
  resultEmoji: { fontSize: 48, lineHeight: 64 },
  resultText: { textAlign: 'center' },
  pressableWeb: { cursor: 'pointer' },
});
