// Tägliche Wiederholung: fällige Lektionen aller Kurse als gemischte
// Frage-Session (Spaced Repetition, features/study/review.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LEARN_PROGRESS_STORAGE_KEY, parseLearnProgress } from '@/features/learn/progress';
import { buildQuiz, shuffle, type QuizQuestion } from '@/features/learn/quiz';
import { QuizSession } from '@/features/study/QuizSession';
import { COURSE_META, loadAllCourses } from '@/features/study/courses';
import {
  applyReviewResult,
  dueCandidates,
  loadReviewState,
  saveReviewState,
} from '@/features/study/review';
import { useSettings } from '@/features/settings/store';
import { TIME_BUDGETS } from '@/features/settings/types';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

interface Session {
  questions: QuizQuestion[];
  keys: string[];
}

export default function ReviewScreen() {
  const { t, locale } = useTranslation();
  const { settings } = useSettings();
  // Zeitbudget bestimmt den Umfang der Session (10 Min/Tag → 6 Fragen, 4 h → 60)
  const maxQuestions = TIME_BUDGETS[settings.dailyMinutes].reviewQuestions;
  const [session, setSession] = useState<Session | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [learnRaw, review, courses, ...courseRaws] = await Promise.all([
        AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
        loadReviewState(),
        loadAllCourses(),
        ...COURSE_META.map((c) => AsyncStorage.getItem(c.storageKey)),
      ]);
      const progressByCourse: Record<string, ReturnType<typeof parseLearnProgress>> = {
        learn: parseLearnProgress(learnRaw),
      };
      COURSE_META.forEach((c, i) => {
        progressByCourse[c.id] = parseLearnProgress(courseRaws[i]);
      });
      const coursesLessons = Object.fromEntries(courses.map((c) => [c.id, c.lessons]));

      const due = shuffle(dueCandidates(progressByCourse, review, undefined, coursesLessons), Math.random);
      // 2 Fragen je fälliger Lektion, gedeckelt aufs Zeitbudget
      const questions: QuizQuestion[] = [];
      const keys: string[] = [];
      for (const candidate of due) {
        if (questions.length >= maxQuestions) break;
        const qs = buildQuiz(candidate.lesson, Math.random, locale).slice(0, 2);
        if (qs.length === 0) continue;
        questions.push(...qs);
        keys.push(candidate.key);
      }
      if (!cancelled) {
        setSession(questions.length > 0 ? { questions: questions.slice(0, maxQuestions), keys } : null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // locale bewusst nicht als Dep: Session soll sich mitten im Lauf nicht neu mischen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audit 2026-07-28: Lade- UND Leerzustand ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang (Studium-Stack: headerShown:false, Zurueck-Chip
  // Web-only). Gerade der Leerzustand "nichts zu wiederholen" ist der
  // Bildschirm, den ein Nutzer sofort wieder verlassen will.
  if (session === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('review.title')} onBack={() => backOr('/study')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (session === null) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('review.title')} onBack={() => backOr('/study')} />
          <View style={[styles.center, styles.emptyBox]}>
            <ThemedText style={styles.emptyEmoji}>🌙</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              {t('review.emptyTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {t('review.emptyText')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <QuizSession
      title={t('review.title')}
      questions={session.questions}
      backTo="/study"
      onFinish={async (score, total) => {
        const ratio = total > 0 ? score / total : 0;
        const state = await loadReviewState();
        await saveReviewState(applyReviewResult(state, session.keys, ratio));
      }}
      resultText={(score, total) =>
        total > 0 && score / total >= 0.7 ? t('review.passed') : t('review.failed')
      }
      resultEmoji={(score, total) => (total > 0 && score / total >= 0.7 ? '🌟' : '📚')}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.five },
  emptyEmoji: { fontSize: 44, lineHeight: 60 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
});
