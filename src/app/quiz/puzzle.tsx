import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
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
import { buildPuzzleRun } from '@/features/practice/puzzle';
import { usePracticeStats } from '@/features/practice/stats';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Satz-Puzzle: gemischte Wörter eines bekannten Satzes antippen und in die
// richtige Reihenfolge bringen. Ein Versuch pro Satz, danach Auflösung mit
// Umschrift + Bedeutung.
export default function PuzzleScreen() {
  const { t, locale } = useTranslation();
  const { record } = usePracticeStats();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('puzzle');

  const [run, setRun] = useState(0);
  // Hydration-Guard wie in duel.tsx (Math.random im Erstrender = #418).
  const hydrated = useHydrated();
  const rounds = useMemo(
    () => (hydrated ? buildPuzzleRun() : []),
    // run erzwingt frisch gemischte Sätze bei "Nochmal spielen"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, run],
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [resolved, setResolved] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const round = rounds[roundIndex];

  function placeWord(wordIndex: number) {
    if (resolved !== null || placed.includes(wordIndex) || !round) return;
    const next = [...placed, wordIndex];
    setPlaced(next);
    if (next.length === round.phrase.words.length) {
      const correct = next.every((v, i) => v === i);
      setResolved(correct);
      // Unterscheidbares Haptik-Feedback wie in quiz/[mode].tsx - nur nativ.
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
      }
      if (correct) setScore((s) => s + 1);
    }
  }

  function removeWord(position: number) {
    if (resolved !== null) return;
    setPlaced(placed.filter((_, i) => i !== position));
  }

  function nextRound() {
    if (roundIndex + 1 < rounds.length) {
      setRoundIndex(roundIndex + 1);
      setPlaced([]);
      setResolved(null);
    } else {
      record('puzzle', score, rounds.length);
      setFinished(true);
    }
  }

  function playAgain() {
    setRun((r) => r + 1);
    setRoundIndex(0);
    setPlaced([]);
    setResolved(null);
    setScore(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('practice.puzzle.title')} />
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.resultCard]}>
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <IconSymbol
                  name={score === rounds.length ? 'trophy' : score / rounds.length >= 0.6 ? 'sparkles' : 'book'}
                  size={40}
                  color={colors.accent}
                />
              </Animated.View>
              <ThemedText type="title">
                {score} / {rounds.length}
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
        <ScreenHeader
          title={t('practice.puzzle.title')}
          right={<IntroHelpButton onPress={intro.show} color={colors.textSecondary} />}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {roundIndex + 1} / {rounds.length} · {t('practice.puzzle.hint')}
          </ThemedText>

          {/* Antwortzeile: baut sich rechts beginnend auf (RTL) */}
          <ThemedView
            type="backgroundElement"
            style={[
              styles.answerRow,
              resolved === true && styles.answerCorrect,
              resolved === false && styles.answerWrong,
            ]}>
            {placed.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('practice.puzzle.empty')}
              </ThemedText>
            )}
            {placed.map((wordIndex, position) => (
              <PressableCard
                key={`${roundIndex}-p${wordIndex}`}
                type="backgroundSelected"
                onPress={() => removeWord(position)}
                style={styles.wordChip}>
                <ThemedText style={styles.wordArabic}>{round.phrase.words[wordIndex]}</ThemedText>
              </PressableCard>
            ))}
          </ThemedView>

          {/* Wort-Vorrat */}
          <View style={styles.pool}>
            {round.shuffled.map((wordIndex) => {
              const used = placed.includes(wordIndex);
              return (
                <PressableCard
                  key={`${roundIndex}-w${wordIndex}`}
                  onPress={() => placeWord(wordIndex)}
                  style={[styles.wordChip, used && styles.wordUsed]}>
                  <ThemedText style={styles.wordArabic}>{round.phrase.words[wordIndex]}</ThemedText>
                </PressableCard>
              );
            })}
          </View>

          {resolved !== null && (
            <ThemedView type="backgroundElement" style={styles.solution}>
              <ThemedText style={styles.solutionArabic}>{round.phrase.words.join(' ')}</ThemedText>
              <ThemedText type="smallBold" themeColor="accent">
                {round.phrase.translit}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {round.phrase.meaning[locale] ?? round.phrase.meaning.en}
              </ThemedText>
              <PressableCard onPress={nextRound} type="backgroundSelected" style={styles.navButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('practice.puzzle.next')}
                </ThemedText>
              </PressableCard>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.puzzle.title')}
        what={t('practice.intro.puzzle.what')}
        why={t('practice.intro.puzzle.why')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  center: { textAlign: 'center' },
  answerRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  answerCorrect: { borderWidth: 1, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.15)' },
  answerWrong: { borderWidth: 1, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.15)' },
  pool: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  wordChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  wordUsed: { opacity: 0.25 },
  wordArabic: { fontSize: 26, lineHeight: 44 },
  solution: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  solutionArabic: { fontSize: 28, lineHeight: 48, textAlign: 'center' },
  card: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.three },
  resultCard: { paddingVertical: Spacing.five },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
