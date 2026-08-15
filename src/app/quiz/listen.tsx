import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { speakArabic, stopSpeaking } from '@/features/learn/audio';
import { buildListeningOptions, buildListeningRun, listeningMistakeQuestion } from '@/features/practice/listening';
import { recordMistake } from '@/features/practice/mistakes';
import { usePracticeStats } from '@/features/practice/stats';
import { useSettings } from '@/features/settings/store';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Hören-erkennen: Silbe/Wort anhören und das richtige ARABISCHE Wort aus
// 3-4 Optionen auswählen (statt die Umschrift zu tippen — testet
// Schrifterkennung statt reinem Abhören+Abtippen, siehe listening.ts).
export default function ListenScreen() {
  const { t } = useTranslation();
  const { record } = usePracticeStats();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('listen');

  const [run, setRun] = useState(0);
  // Hydration-Guard wie in duel.tsx (Math.random im Erstrender = #418).
  const hydrated = useHydrated();
  // Diese Übung ist strukturell audio-first (siehe listening.ts) - die Hub-
  // Kachel ist bei exerciseStyle 'reading' schon ausgeblendet (quiz/index.tsx),
  // dieser Guard fängt nur einen direkten Deep-Link/Zurück-Navigations-Fall ab.
  const readingOnly = settings.exerciseStyle === 'reading';
  const items = useMemo(
    () => (hydrated && !readingOnly ? buildListeningRun() : []),
    // run erzwingt frische Aufgaben bei "Nochmal spielen"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, run, readingOnly],
  );
  // Auswahlmöglichkeiten je Runde einmal vorberechnen (nicht bei jedem
  // Render neu mischen) - Distraktoren kommen aus dem gesamten Runden-Pool.
  const rounds = useMemo(
    () => items.map((item) => ({ item, ...buildListeningOptions(item, items) })),
    [items],
  );

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const round = rounds[index];

  // Echtes Rezitations-Audio (Fatiha-Wortaudios, siehe listening.ts) statt
  // TTS, wenn die Aufgabe eine audioUrl mitbringt — sonst wie bisher TTS.
  const recitationPlayer = useSsrSafeAudioPlayer(null);

  useEffect(() => stopSpeaking, []);

  function play() {
    if (!round) return;
    if (round.item.audioUrl) {
      stopSpeaking();
      recitationPlayer.replace(round.item.audioUrl);
      recitationPlayer.play();
    } else {
      recitationPlayer.pause();
      speakArabic(round.item.arabic);
    }
  }

  function answer(optionIndex: number) {
    if (!round || answered !== null) return;
    setAnswered(optionIndex);
    const correct = optionIndex === round.correctIndex;
    // Unterscheidbares Haptik-Feedback wie in quiz/[mode].tsx - nur nativ.
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    // nextScore explizit reichen (nicht das geschlossene `score` in next()
    // lesen) - setScore ist async, next() läuft sonst mit dem Stand VOR
    // diesem Treffer (gleiches Muster wie quiz/[mode].tsx: advance(nextScore)).
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    if (correct) {
      // Richtig: kurzer Grün-Flash, dann automatisch weiter (Momentum,
      // gleiches Muster wie quiz/[mode].tsx und LessonPlayer).
      setTimeout(() => next(nextScore), 900);
    } else {
      // Falsch beantwortete Fragen in die Fehler-Wiederholung legen (Leitner
      // light, wie in [mode].tsx) - ANHALTEN, weiter erst per Tap.
      recordMistake(listeningMistakeQuestion(round.item, items)).catch(() => {});
    }
  }

  function next(nextScore: number) {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setAnswered(null);
    } else {
      record('listening', nextScore, items.length);
      setFinished(true);
    }
  }

  function playAgain() {
    setRun((r) => r + 1);
    setIndex(0);
    setAnswered(null);
    setScore(0);
    setFinished(false);
  }

  if (hydrated && readingOnly) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.resultCard]}>
              <IconSymbol name="ear" size={40} color={colors.textSecondary} />
              <ThemedText type="default" style={styles.center}>
                {t('practice.listen.unavailableReading')}
              </ThemedText>
            </ThemedView>
            <View style={styles.navRow}>
              <PressableCard onPress={() => backOr('/quiz')} type="backgroundSelected" style={styles.navButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('practice.backToHub')}
                </ThemedText>
              </PressableCard>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (finished) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.resultCard]}>
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <IconSymbol
                  name={score === items.length ? 'trophy' : score / items.length >= 0.6 ? 'sparkles' : 'book'}
                  size={40}
                  color={colors.accent}
                />
              </Animated.View>
              <ThemedText type="title">
                {score} / {items.length}
              </ThemedText>
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
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!round) return <ThemedView style={styles.container} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <View style={styles.titleSpacer} />
            <ThemedText type="title" style={styles.titleText}>
              {t('practice.listen.title')}
            </ThemedText>
            <IntroHelpButton onPress={intro.show} color={colors.textSecondary} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {index + 1} / {items.length}
          </ThemedText>

          <PressableCard onPress={play} type="backgroundSelected" style={styles.playCard}>
            <IconSymbol name="volume-high" size={40} color={colors.accent} />
            <ThemedText type="smallBold" themeColor="accent">
              {t('practice.listen.play')}
            </ThemedText>
          </PressableCard>

          <View style={styles.options}>
            {round.options.map((option, i) => {
              const isCorrect = answered !== null && i === round.correctIndex;
              const isWrong = answered === i && i !== round.correctIndex;
              return (
                <PressableCard
                  key={`${index}-${i}`}
                  onPress={() => answer(i)}
                  disabled={answered !== null}
                  style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}>
                  <ThemedText style={styles.optionArabic}>{option}</ThemedText>
                </PressableCard>
              );
            })}
          </View>

          {answered !== null && answered !== round.correctIndex && (
            <View style={styles.revealBlock}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.revealLabel}>
                {t('practice.correctAnswerLabel')}:{' '}
                <ThemedText type="smallBold" style={styles.revealArabic}>
                  {round.item.arabic}
                </ThemedText>{' '}
                ({round.item.translit})
              </ThemedText>
              <PressableCard onPress={() => next(score)} type="backgroundSelected" style={styles.navButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('practice.puzzle.next')}
                </ThemedText>
              </PressableCard>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.listen.title')}
        what={t('practice.intro.listen.what')}
        why={t('practice.intro.listen.why')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  center: { textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titleSpacer: { width: 22 },
  titleText: { flex: 1, textAlign: 'center' },
  playCard: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  options: { gap: Spacing.two },
  option: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  optionCorrect: { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: '#4ade80' },
  optionWrong: { backgroundColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderColor: '#f87171' },
  optionArabic: { fontSize: 32, lineHeight: 52 },
  revealBlock: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  revealLabel: { textAlign: 'center' },
  revealArabic: { fontSize: 18 },
  card: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.three },
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
