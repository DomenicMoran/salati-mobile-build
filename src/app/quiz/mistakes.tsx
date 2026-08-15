import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { clearMistake, loadMistakes } from '@/features/practice/mistakes';
import type { QuizQuestion } from '@/features/learn/quiz';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Fehler-Wiederholung: gesammelte falsch beantwortete Fragen erneut stellen.
// Richtig beantwortete fliegen aus der Sammlung (Leitner light).
export default function MistakesScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('mistakes');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [cleared, setCleared] = useState(0);
  const [finished, setFinished] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadMistakes().then((list) => {
        if (cancelled) return;
        setQuestions(list);
        setIndex(0);
        setAnswered(null);
        setCleared(0);
        setFinished(list.length === 0);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const question = questions[index];

  function answer(i: number) {
    if (answered !== null || !question) return;
    setAnswered(i);
    const correct = i === question.correctIndex;
    // Unterscheidbares Haptik-Feedback wie in quiz/[mode].tsx - nur nativ.
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    if (correct) {
      setCleared((c) => c + 1);
      clearMistake(question).catch(() => {});
    }
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        setAnswered(null);
      } else {
        setFinished(true);
      }
    }, 900);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('practice.mistakes.title')} />
        {finished ? (
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.resultCard]}>
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <IconSymbol
                  name={questions.length === 0 ? 'sparkles' : cleared === questions.length ? 'trophy' : 'book'}
                  size={40}
                  color={colors.accent}
                />
              </Animated.View>
              <ThemedText type="title" style={styles.center}>
                {questions.length === 0
                  ? t('practice.mistakes.empty')
                  : `${cleared} / ${questions.length}`}
              </ThemedText>
              {questions.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {t('practice.mistakes.clearedHint')}
                </ThemedText>
              )}
            </ThemedView>
            <View style={styles.navRow}>
              <PressableCard onPress={() => backOr('/quiz')} style={styles.navButton}>
                <ThemedText type="default">{t('practice.backToHub')}</ThemedText>
              </PressableCard>
            </View>
          </View>
        ) : question ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.titleRow}>
              <View style={styles.titleSpacer} />
              <ThemedText type="title" style={styles.titleText}>
                {t('practice.mistakes.title')}
              </ThemedText>
              <IntroHelpButton onPress={intro.show} color={colors.textSecondary} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {index + 1} / {questions.length}
            </ThemedText>

            <ThemedText type="subtitle" style={styles.center}>
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
                    <ThemedText type="default" style={question.optionsArabic ? styles.optionArabic : undefined}>
                      {option}
                    </ThemedText>
                  </PressableCard>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.content} />
        )}
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.mistakes.title')}
        what={t('practice.intro.mistakes.what')}
        why={t('practice.intro.mistakes.why')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  center: { textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titleSpacer: { width: 22 },
  titleText: { flex: 1, textAlign: 'center' },
  card: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.three },
  cardArabic: { fontSize: 56, lineHeight: 90, textAlign: 'center' },
  cardLatin: { fontSize: 32, lineHeight: 44, textAlign: 'center' },
  options: { gap: Spacing.two },
  option: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center', minHeight: 44 },
  optionCorrect: { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: '#4ade80' },
  optionWrong: { backgroundColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderColor: '#f87171' },
  optionArabic: { fontSize: 24, lineHeight: 40 },
  resultCard: { paddingVertical: Spacing.five },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
