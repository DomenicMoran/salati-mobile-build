import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import { useLocalSearchParams } from 'expo-router';
import { backOr } from '@/lib/nav';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { speakArabic, stopSpeaking } from '@/features/learn/audio';
import { recordMistake } from '@/features/practice/mistakes';
import { buildPracticeQuiz, PRACTICE_MODES, type PracticeModeId } from '@/features/practice/modes';
import { usePracticeStats } from '@/features/practice/stats';
import { useSettings } from '@/features/settings/store';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template — der Server kennt mode
// dabei nicht (PRACTICE_MODES.find(...) -> undefined), zeigt also die
// Fehler-Fallback-UI ("Etwas ist schiefgelaufen."). Der Client liest mode
// danach aus der echten URL und rendert den echten Titel — Server- und
// Client-Markup weichen voneinander ab (React #418, gleiches Muster wie
// study/[course]/index.tsx).
export function generateStaticParams() {
  return PRACTICE_MODES.map((m) => ({ mode: m.id }));
}

export default function PracticeRunScreen() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const modeId = PRACTICE_MODES.find((m) => m.id === mode)?.id as PracticeModeId | undefined;
  const { t, locale } = useTranslation();
  const { record } = usePracticeStats();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('quizMode');

  const [run, setRun] = useState(0);
  // Hydration-Guard wie in duel.tsx (Math.random im Erstrender = #418).
  const hydrated = useHydrated();
  const questions = useMemo(
    () => (modeId && hydrated ? buildPracticeQuiz(modeId, locale, Math.random, settings.exerciseStyle) : []),
    // run erzwingt frisch gemischte Fragen bei "Nochmal spielen"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modeId, hydrated, locale, run, settings.exerciseStyle],
  );

  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const recitationPlayer = useSsrSafeAudioPlayer(null);
  const playAudio = useCallback(
    (item: { tts?: string; audioUrl?: string }) => {
      stopSpeaking();
      if (item.audioUrl) {
        recitationPlayer.replace(item.audioUrl);
        recitationPlayer.play();
      } else if (item.tts) {
        recitationPlayer.pause();
        speakArabic(item.tts);
      }
    },
    [recitationPlayer],
  );
  useEffect(() => stopSpeaking, []);

  // Hör-Fragen starten ihr Audio automatisch (Gerätefeedback: nicht erst
  // aufs Symbol tippen müssen) — erneutes Tippen wiederholt es.
  const question = questions[questionIndex];
  useEffect(() => {
    if (question && (question.tts || question.audioUrl)) playAudio(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, questions]);

  // Fortschrittsbalken statt nur Text-Zähler (Duolingo/Babbel-Muster), analog
  // zum Balken in learn/index.tsx — ease-out, "kommt an" statt linear.
  const fillWidth = useSharedValue(0);
  useEffect(() => {
    const pct = questions.length > 0 ? (questionIndex / questions.length) * 100 : 0;
    fillWidth.value = withTiming(pct, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [questionIndex, questions.length, fillWidth]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fillWidth.value}%` }));


  // Audit 2026-07-27: Unbekannter Quiz-Modus zeigte nur "Fehler" — ohne Kopf,
  // also auf nativ ohne sichtbaren Ausgang (Quiz-Stack: headerShown:false,
  // Zurueck-Chip Web-only).
  if (!modeId) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('practice.title')} onBack={() => backOr('/quiz')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }


  function answer(optionIndex: number) {
    if (answered !== null || !question) return;
    setAnswered(optionIndex);
    const correct = optionIndex === question.correctIndex;
    // Unterscheidbares Haptik-Feedback statt nur dem generischen Tap der
    // PressableCard - nur nativ, Web hat keine Haptik-API.
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    // Falsche Antworten in die Fehler-Wiederholung legen (Leitner light)
    if (!correct) recordMistake(question).catch(() => {});
    const nextScore = correct ? score + 1 : score;
    const nextStreak = correct ? streak + 1 : 0;
    setScore(nextScore);
    setStreak(nextStreak);
    setBestStreak((b) => Math.max(b, nextStreak));
    if (correct) {
      // Richtig: kurzer Grün-Flash, dann automatisch weiter (Momentum).
      setTimeout(() => advance(nextScore), 900);
    }
    // Falsch: ANHALTEN (Audit 2026-07-19 C1) - korrekte Option bleibt grün
    // markiert stehen, weiter erst per Tap auf "Weiter".
  }

  function advance(nextScore: number) {
    setAnswered(null);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      record(modeId!, nextScore, questions.length);
      setFinished(true);
    }
  }

  function playAgain() {
    setRun((r) => r + 1);
    setQuestionIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAnswered(null);
    setFinished(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => backOr('/quiz')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <IconSymbol name="close" size={20} color={colors.textSecondary} />
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            {t(`practice.modes.${modeId}.title`)}
          </ThemedText>
          <View style={styles.headerRight}>
            <View style={styles.streakRow}>
              {streak > 1 && (
                <>
                  <IconSymbol name="flame" size={14} color={colors.accent} />
                  <ThemedText type="small" themeColor="accent">
                    {streak}
                  </ThemedText>
                </>
              )}
            </View>
            <IntroHelpButton onPress={intro.show} color={colors.textSecondary} />
          </View>
        </View>

        {!finished && question && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedView type="backgroundElement" style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fillStyle]} />
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {questionIndex + 1} / {questions.length} · {score} ✓
            </ThemedText>
            <ThemedText type="default" style={styles.prompt}>
              {question.promptText ?? t(question.promptKey)}
            </ThemedText>
            {(question.display !== '' || question.tts || question.audioUrl) && (
              <PressableCard
                onPress={() => playAudio(question)}
                disabled={!question.tts && !question.audioUrl}
                accessibilityRole="button"
                accessibilityLabel={question.display === '' ? t('a11y.playAudio') : undefined}
                accessibilityHint={
                  question.display !== '' && (question.tts || question.audioUrl)
                    ? t('a11y.playAudio')
                    : undefined
                }
                style={styles.card}>
                {question.display !== '' && (
                  <ThemedText style={question.displayArabic ? styles.cardArabic : styles.cardLatin}>
                    {question.display}
                  </ThemedText>
                )}
                {(question.tts || question.audioUrl) && (
                  <IconSymbol name="volume-high" size={18} color={colors.accent} />
                )}
              </PressableCard>
            )}
            <View style={styles.options}>
              {question.options.map((option, i) => {
                const isCorrect = answered !== null && i === question.correctIndex;
                const isWrong = answered === i && i !== question.correctIndex;
                return (
                  <PressableCard
                    key={`${questionIndex}-${i}`}
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
              <View style={styles.revealBlock}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revealLabel}>
                  {t('practice.correctAnswerLabel')}:{' '}
                  <ThemedText type="smallBold">{question.options[question.correctIndex]}</ThemedText>
                </ThemedText>
                <PressableCard onPress={() => advance(score)} type="backgroundSelected" style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('learn.next')}
                  </ThemedText>
                </PressableCard>
              </View>
            )}
          </ScrollView>
        )}

        {finished && (
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.resultCard]}>
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <IconSymbol
                  name={score === questions.length ? 'trophy' : score / questions.length >= 0.7 ? 'sparkles' : 'book'}
                  size={40}
                  color={colors.accent}
                />
              </Animated.View>
              <ThemedText type="title">
                {score} / {questions.length}
              </ThemedText>
              {bestStreak > 1 && (
                <View style={styles.streakRow}>
                  <IconSymbol name="flame" size={14} color={colors.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('practice.bestStreak')}: {bestStreak}
                  </ThemedText>
                </View>
              )}
            </ThemedView>
            <View style={styles.navRow}>
              <PressableCard onPress={playAgain} type="backgroundSelected" style={styles.navButton}>
                <IconSymbol name="refresh" size={14} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('practice.playAgain')}
                </ThemedText>
              </PressableCard>
              <PressableCard onPress={() => backOr('/quiz')} style={styles.navButton}>
                <ThemedText type="default">{t('practice.backToHub')}</ThemedText>
              </PressableCard>
            </View>
          </View>
        )}
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.quizMode.title')}
        what={t('practice.intro.quizMode.what')}
        why={t('practice.intro.quizMode.why')}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  content: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch', alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  stepLabel: { textAlign: 'center' },
  prompt: { textAlign: 'center' },
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  cardArabic: { fontSize: 56, lineHeight: 90, textAlign: 'center' },
  cardLatin: { fontSize: 32, lineHeight: 44, textAlign: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  options: { gap: Spacing.two },
  option: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  optionCorrect: { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: '#4ade80' },
  optionWrong: { backgroundColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderColor: '#f87171' },
  optionArabic: { fontSize: 24, lineHeight: 40 },
  resultCard: { paddingVertical: Spacing.five },
  revealBlock: { alignItems: 'center', gap: Spacing.two },
  revealLabel: { textAlign: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 18 },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
