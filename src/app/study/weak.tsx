// "Schwächen üben": Session aus den Lektionen mit den meisten falschen
// Antworten (features/study/mistakes). Nach der Session klingen die Zähler ab.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LESSONS, type Lesson } from '@/features/learn/curriculum';
import { buildQuiz, shuffle, type QuizQuestion } from '@/features/learn/quiz';
import { QuizSession } from '@/features/study/QuizSession';
import { lessonInCourse } from '@/features/study/courses';
import {
  decayMistakes,
  loadMistakeState,
  saveMistakeState,
  weakestKeys,
} from '@/features/study/mistakes';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const MAX_WEAK_LESSONS = 5;
const QUESTIONS_PER_LESSON = 3;

async function lessonByKey(key: string): Promise<Lesson | undefined> {
  const [courseId, lessonId] = key.split(':');
  if (courseId === 'learn') return LESSONS.find((l) => l.id === lessonId);
  return lessonInCourse(courseId, lessonId);
}

interface Session {
  questions: QuizQuestion[];
  keys: string[];
}

export default function WeakSpotsScreen() {
  const { t, locale } = useTranslation();
  const [session, setSession] = useState<Session | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await loadMistakeState();
      const keys = weakestKeys(state, MAX_WEAK_LESSONS);
      const questions: QuizQuestion[] = [];
      const usedKeys: string[] = [];
      for (const key of keys) {
        const lesson = await lessonByKey(key);
        if (!lesson) continue;
        const qs = shuffle(buildQuiz(lesson, Math.random, locale), Math.random).slice(
          0,
          QUESTIONS_PER_LESSON,
        );
        if (qs.length === 0) continue;
        questions.push(...qs);
        usedKeys.push(key);
      }
      if (!cancelled) {
        setSession(questions.length > 0 ? { questions: shuffle(questions, Math.random), keys: usedKeys } : null);
      }
    })();
    return () => {
      cancelled = true;
    };
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
          <ScreenHeader title={t('weak.title')} onBack={() => backOr('/study')} />
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
          <ScreenHeader title={t('weak.title')} onBack={() => backOr('/study')} />
          <View style={[styles.center, styles.emptyBox]}>
            <ThemedText style={styles.emptyEmoji}>💪</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              {t('weak.emptyTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {t('weak.emptyText')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <QuizSession
      title={t('weak.title')}
      questions={session.questions}
      backTo="/study"
      onFinish={async () => {
        const state = await loadMistakeState();
        await saveMistakeState(decayMistakes(state, session.keys));
      }}
      resultText={(score, total) =>
        total > 0 && score / total >= 0.7 ? t('weak.passed') : t('weak.failed')
      }
      resultEmoji={(score, total) => (total > 0 && score / total >= 0.7 ? '💪' : '📚')}
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
