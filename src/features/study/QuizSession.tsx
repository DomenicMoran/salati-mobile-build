// Gemeinsame Frage-Session für Wiederholung (/study/review) und
// Abschlussprüfung (/study/<kurs>/exam): feste Fragenliste -> Ergebnis.
// UI bewusst identisch zur Quiz-Phase des LessonPlayers.
import type { Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';

import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import type { QuizQuestion } from '@/features/learn/quiz';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

export interface QuizSessionProps {
  title: string;
  questions: QuizQuestion[];
  backTo: Href;
  /** Wird genau einmal beim Erreichen des Ergebnisses aufgerufen. */
  onFinish: (score: number, total: number) => void;
  /** Ergebnis-Text unterhalb des Scores (z. B. bestanden/nicht bestanden) */
  resultText: (score: number, total: number) => string;
  resultEmoji?: (score: number, total: number) => string;
}

export function QuizSession({
  title,
  questions,
  backTo,
  onFinish,
  resultText,
  resultEmoji,
}: QuizSessionProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  // Falsch beantwortete Fragen (Fragen-Index) für die Auflösung im Ergebnis.
  const [wrongIndices, setWrongIndices] = useState<number[]>([]);

  const question = questions[index];

  // Fortschrittsbalken statt nur Text-Zähler (Duolingo/Babbel-Muster), analog
  // zum Balken in learn/index.tsx.
  const fillWidth = useSharedValue(0);
  useEffect(() => {
    const pct = questions.length > 0 ? (index / questions.length) * 100 : 0;
    fillWidth.value = withTiming(pct, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [index, questions.length, fillWidth]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fillWidth.value}%` }));

  function advance(nextScore: number) {
    setAnswered(null);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      setFinished(true);
      onFinish(nextScore, questions.length);
    }
  }

  function answer(optionIndex: number) {
    if (answered !== null || !question) return;
    setAnswered(optionIndex);
    const correct = optionIndex === question.correctIndex;
    // Unterscheidbares Haptik-Feedback wie in quiz/[mode].tsx (dieselbe
    // Quiz-UI, aber bisher ohne Haptik) - nur nativ, Web hat keine Haptik-API.
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    if (correct) {
      // Richtig: kurzer Grün-Flash, dann automatisch weiter (Momentum).
      const nextScore = score + 1;
      setScore(nextScore);
      setTimeout(() => advance(nextScore), 900);
    } else {
      // Falsch: ANHALTEN statt nach 900 ms weiterzuspringen (Audit
      // 2026-07-19 C1) - die korrekte Option bleibt grün markiert stehen,
      // weiter geht es erst per Tap auf "Weiter".
      setWrongIndices((w) => [...w, index]);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Audit 2026-07-27 (P2): siehe LessonPlayer — gemeinsamer
            ScreenHeader statt rohem ✕-Textzeichen. */}
        <ScreenHeader title={title} variant="modal" closeLabel="x" onBack={() => backOr(backTo)} />

        {!finished && question && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedView type="backgroundElement" style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fillStyle]} />
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {index + 1} / {questions.length} · {score} ✓
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
                  <PressableCard
                    key={`${index}-${i}`}
                    onPress={() => answer(i)}
                    style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}>
                    <ThemedText
                      type="default"
                      style={question.optionsArabic ? styles.optionArabic : undefined}>
                      {option}
                    </ThemedText>
                  </PressableCard>
                );
              })}
            </View>
            {answered !== null && answered !== question.correctIndex && (
              <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.revealBlock}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revealLabel}>
                  {t('practice.correctAnswerLabel')}:{' '}
                  <ThemedText type="smallBold">{question.options[question.correctIndex]}</ThemedText>
                </ThemedText>
                <PressableCard
                  onPress={() => advance(score)}
                  type="backgroundSelected"
                  style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('learn.next')}
                  </ThemedText>
                </PressableCard>
              </Animated.View>
            )}
          </ScrollView>
        )}

        {finished && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <ThemedText style={styles.resultEmoji}>
                  {resultEmoji ? resultEmoji(score, questions.length) : '📚'}
                </ThemedText>
              </Animated.View>
              <ThemedText type="title">
                {score} / {questions.length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resultText}>
                {resultText(score, questions.length)}
              </ThemedText>
            </ThemedView>
            {wrongIndices.length > 0 && (
              <ThemedView type="backgroundElement" style={styles.wrongList}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('practice.wrongListTitle').toUpperCase()}
                </ThemedText>
                {wrongIndices.map((qi) => {
                  const q = questions[qi];
                  return (
                    <View key={qi} style={styles.wrongItem}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {q.promptText ?? t(q.promptKey)}
                        {q.display !== '' ? ` · ${q.display}` : ''}
                      </ThemedText>
                      <ThemedText type="smallBold">{q.options[q.correctIndex]}</ThemedText>
                    </View>
                  );
                })}
              </ThemedView>
            )}
            <View style={styles.navRow}>
              <PressableCard onPress={() => backOr(backTo)} type="backgroundSelected" style={styles.navButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('learn.backToCourse')}
                </ThemedText>
              </PressableCard>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
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
  revealBlock: { alignItems: 'center', gap: Spacing.two },
  revealLabel: { textAlign: 'center' },
  wrongList: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  wrongItem: { gap: Spacing.half },
});
