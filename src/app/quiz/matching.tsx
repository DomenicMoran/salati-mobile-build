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
import { buildMatchingRun, matchingMistakeQuestion } from '@/features/practice/matching';
import { recordMistake } from '@/features/practice/mistakes';
import { usePracticeStats } from '@/features/practice/stats';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Matching: arabisches Wort mit seiner Umschrift verbinden. Punkte gibt es
// für Paare, die im ersten Versuch sitzen.
export default function MatchingScreen() {
  const { t } = useTranslation();
  const { record } = usePracticeStats();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('matching');

  const [run, setRun] = useState(0);
  // Hydration-Guard wie in duel.tsx (Math.random im Erstrender = #418).
  const hydrated = useHydrated();
  const rounds = useMemo(
    () => (hydrated ? buildMatchingRun() : []),
    // run erzwingt frische Paare bei "Nochmal spielen"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, run],
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const round = rounds[roundIndex];
  const totalPairs = rounds.reduce((a, r) => a + r.pairs.length, 0);

  function pickRight(pairIndex: number) {
    if (!round || solved.has(pairIndex) || selectedLeft === null) return;
    // Unterscheidbares Haptik-Feedback wie in quiz/[mode].tsx (PressableCard
    // gibt nur denselben leichten Tap-Impuls für richtig wie falsch) - nur nativ.
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        pairIndex === selectedLeft
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    if (pairIndex === selectedLeft) {
      const nextSolved = new Set(solved).add(pairIndex);
      const gained = missed.has(pairIndex) ? 0 : 1;
      setSolved(nextSolved);
      setSelectedLeft(null);
      if (gained) setScore((s) => s + 1);
      if (nextSolved.size === round.pairs.length) {
        setTimeout(() => {
          if (roundIndex + 1 < rounds.length) {
            setRoundIndex(roundIndex + 1);
            setSolved(new Set());
            setMissed(new Set());
            setSelectedLeft(null);
          } else {
            record('matching', score + gained, totalPairs);
            setFinished(true);
          }
        }, 700);
      }
    } else {
      // Falsche Zuordnung: linkes Wort verliert seinen Erstversuch-Punkt
      // und geht in die Fehler-Wiederholung (Leitner light, wie in [mode].tsx)
      setMissed((m) => new Set(m).add(selectedLeft));
      setWrongFlash(pairIndex);
      recordMistake(matchingMistakeQuestion(round.pairs[selectedLeft], round.pairs)).catch(() => {});
      setTimeout(() => setWrongFlash(null), 500);
    }
  }

  function playAgain() {
    setRun((r) => r + 1);
    setRoundIndex(0);
    setSelectedLeft(null);
    setSolved(new Set());
    setMissed(new Set());
    setScore(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('practice.matchingGame.title')} />
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.resultCard]}>
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <IconSymbol
                  name={score === totalPairs ? 'trophy' : score / totalPairs >= 0.6 ? 'sparkles' : 'book'}
                  size={40}
                  color={colors.accent}
                />
              </Animated.View>
              <ThemedText type="title">
                {score} / {totalPairs}
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
          title={t('practice.matchingGame.title')}
          right={<IntroHelpButton onPress={intro.show} color={colors.textSecondary} />}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {roundIndex + 1} / {rounds.length} · {t('practice.matchingGame.hint')}
          </ThemedText>

          <View style={styles.columns}>
            <View style={styles.column}>
              {round.pairs.map((pair, i) => (
                <PressableCard
                  key={`${roundIndex}-l${i}`}
                  type={selectedLeft === i ? 'backgroundSelected' : 'backgroundElement'}
                  onPress={() => !solved.has(i) && setSelectedLeft(i)}
                  style={[styles.cell, solved.has(i) && styles.cellSolved]}>
                  <ThemedText style={styles.cellArabic}>{pair.arabic}</ThemedText>
                </PressableCard>
              ))}
            </View>
            <View style={styles.column}>
              {round.rightOrder.map((pairIndex) => (
                <PressableCard
                  key={`${roundIndex}-r${pairIndex}`}
                  type="backgroundElement"
                  onPress={() => pickRight(pairIndex)}
                  style={[
                    styles.cell,
                    solved.has(pairIndex) && styles.cellSolved,
                    wrongFlash === pairIndex && styles.cellWrong,
                  ]}>
                  <ThemedText type="default">{round.pairs[pairIndex].translit}</ThemedText>
                </PressableCard>
              ))}
            </View>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {score} {t('practice.matchingGame.points')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.matching.title')}
        what={t('practice.intro.matching.what')}
        why={t('practice.intro.matching.why')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  center: { textAlign: 'center' },
  columns: { flexDirection: 'row', gap: Spacing.two },
  column: { flex: 1, gap: Spacing.two },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  cellSolved: { opacity: 0.3 },
  cellWrong: { borderWidth: 1, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.2)' },
  cellArabic: { fontSize: 24, lineHeight: 40 },
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
