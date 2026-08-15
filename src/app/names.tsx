import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { speakArabic } from '@/features/learn/audio';
import { shuffle } from '@/features/learn/quiz';
import { DIVINE_NAMES, nameMeaning, type DivineName } from '@/features/names/names';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useGrid } from '@/hooks/use-layout';
import { useTranslation } from '@/lib/i18n';

const QUIZ_LENGTH = 10;

interface NameQuizQuestion {
  name: DivineName;
  options: string[];
  correctIndex: number;
}

// Arabische UI hat keine eigenen Bedeutungstexte (nameMeaning liefert '') —
// fürs Quiz fällt sie wie es/fr auf Englisch zurück.
function meaningFor(name: DivineName, locale: string): string {
  return nameMeaning(name, locale) || name.en;
}

function buildQuiz(locale: string): NameQuizQuestion[] {
  return shuffle(DIVINE_NAMES, Math.random)
    .slice(0, QUIZ_LENGTH)
    .map((name) => {
      const correct = meaningFor(name, locale);
      const distractors = shuffle(
        [...new Set(DIVINE_NAMES.map((n) => meaningFor(n, locale)))].filter((m) => m !== correct),
        Math.random,
      ).slice(0, 3);
      const options = shuffle([correct, ...distractors], Math.random);
      return { name, options, correctIndex: options.indexOf(correct) };
    });
}

export default function NamesScreen() {
  const { t, locale } = useTranslation();
  // Breitbild: auf Tablets mehrspaltig statt einer 800-dp-Telefonspalte
  // (Geraetebefund 2026-07-29, 1600x2560).
  const grid = useGrid();
  const [query, setQuery] = useState('');
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  // Quiz-Modus im selben Screen (Audit 2026-07-19 C4): 10 Zufallsfragen
  // "Was bedeutet dieser Name?" nach dem Muster der QuizSession-UI.
  const [quiz, setQuiz] = useState<NameQuizQuestion[] | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const reducedMotion = useReducedMotion();

  const fillWidth = useSharedValue(0);
  useEffect(() => {
    const pct = quiz ? (qIndex / quiz.length) * 100 : 0;
    fillWidth.value = reducedMotion ? pct : withTiming(pct, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [qIndex, quiz, reducedMotion, fillWidth]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fillWidth.value}%` }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIVINE_NAMES;
    return DIVINE_NAMES.filter(
      (n) =>
        n.translit.toLowerCase().includes(q) ||
        nameMeaning(n, locale).toLowerCase().includes(q) ||
        n.arabic.includes(query.trim()) ||
        String(n.n) === q,
    );
  }, [query, locale]);

  function startQuiz() {
    setQuiz(buildQuiz(locale));
    setQIndex(0);
    setScore(0);
    setAnswered(null);
    setFinished(false);
  }

  function closeQuiz() {
    setQuiz(null);
  }

  function advance() {
    if (!quiz) return;
    setAnswered(null);
    if (qIndex + 1 < quiz.length) {
      setQIndex(qIndex + 1);
    } else {
      setFinished(true);
    }
  }

  function answer(optionIndex: number) {
    const question = quiz?.[qIndex];
    if (answered !== null || !question) return;
    setAnswered(optionIndex);
    if (optionIndex === question.correctIndex) {
      // Richtig: kurzer Grün-Flash, dann automatisch weiter (Momentum).
      setScore(score + 1);
      setTimeout(() => advance(), 900);
    }
    // Falsch: ANHALTEN — korrekte Option bleibt grün markiert, weiter
    // geht es erst per Tap auf "Weiter" (Muster aus QuizSession).
  }

  const question = quiz?.[qIndex];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('names.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('names.subtitle')}
        </ThemedText>

        {quiz === null && (
          <>
            <View style={styles.learnRow}>
              <PressableCard onPress={startQuiz} type="backgroundSelected" style={styles.learnButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('names.learn')}
                </ThemedText>
              </PressableCard>
            </View>

            <ThemedView type="backgroundElement" style={styles.searchBox}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('common.search')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </ThemedView>

            <FlatList
              data={grid.pad(filtered)}
              key={grid.listKey}
              numColumns={grid.numColumns}
              columnWrapperStyle={grid.columnWrapperStyle}
              keyExtractor={(n, i) => (n ? String(n.n) : `luecke-${i}`)}
              contentContainerStyle={[styles.list, { maxWidth: grid.contentWidth }]}
              renderItem={({ item, index }) =>
                !item ? (
                  <View style={grid.cellStyle} />
                ) : (
                <AnimatedListItem index={index} style={grid.cellStyle}>
                  <PressableCard
                    onPress={() => speakArabic(item.arabic)}
                    accessibilityRole="button"
                    accessibilityHint={t('a11y.playAudio')}
                    style={styles.row}>
                    <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                      <ThemedText type="small">{item.n}</ThemedText>
                    </ThemedView>
                    <View style={styles.rowText}>
                      <ThemedText type="default">{item.translit}</ThemedText>
                      {nameMeaning(item, locale) !== '' && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {nameMeaning(item, locale)}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText style={styles.arabic}>{item.arabic}</ThemedText>
                  </PressableCard>
                </AnimatedListItem>
                )
              }
            />
          </>
        )}

        {quiz !== null && !finished && question && (
          <ScrollView contentContainerStyle={styles.quizContent}>
            <View style={styles.quizHeader}>
              <Pressable
                onPress={closeQuiz}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.close')}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedText type="default" themeColor="textSecondary">
                  ✕
                </ThemedText>
              </Pressable>
              <View style={styles.quizHeaderSpacer} />
            </View>
            <ThemedView type="backgroundElement" style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fillStyle]} />
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {qIndex + 1} / {quiz.length} · {score} ✓
            </ThemedText>
            <ThemedText type="default" style={styles.prompt}>
              {t('names.quizPrompt')}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.quizCard}>
              <ThemedText style={styles.quizArabic}>{question.name.arabic}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {question.name.translit}
              </ThemedText>
            </ThemedView>
            <View style={styles.options}>
              {question.options.map((option, i) => {
                const isCorrect = answered !== null && i === question.correctIndex;
                const isWrong = answered === i && i !== question.correctIndex;
                return (
                  <PressableCard
                    key={`${qIndex}-${i}`}
                    onPress={() => answer(i)}
                    style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}>
                    <ThemedText type="default">{option}</ThemedText>
                  </PressableCard>
                );
              })}
            </View>
            {answered !== null && answered !== question.correctIndex && (
              <Animated.View
                entering={reducedMotion ? undefined : ZoomIn.springify().damping(14)}
                style={styles.revealBlock}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revealLabel}>
                  {t('practice.correctAnswerLabel')}:{' '}
                  <ThemedText type="smallBold">{question.options[question.correctIndex]}</ThemedText>
                </ThemedText>
                <PressableCard onPress={() => advance()} type="backgroundSelected" style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('learn.next')}
                  </ThemedText>
                </PressableCard>
              </Animated.View>
            )}
          </ScrollView>
        )}

        {quiz !== null && finished && (
          <ScrollView contentContainerStyle={styles.quizContent}>
            <ThemedView type="backgroundElement" style={styles.quizCard}>
              <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}>
                <ThemedText style={styles.resultEmoji}>{score === quiz.length ? '🌟' : '📿'}</ThemedText>
              </Animated.View>
              <ThemedText type="title">
                {score} / {quiz.length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resultText}>
                {t('names.quizResult')}
              </ThemedText>
            </ThemedView>
            <View style={styles.navRow}>
              <PressableCard onPress={startQuiz} type="backgroundSelected" style={styles.navButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('practice.playAgain')}
                </ThemedText>
              </PressableCard>
              <PressableCard onPress={closeQuiz} style={styles.navButton}>
                <ThemedText type="smallBold">{t('common.done')}</ThemedText>
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
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two, paddingHorizontal: Spacing.four },
  learnRow: { alignItems: 'center', marginBottom: Spacing.two },
  learnButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  searchBox: { marginHorizontal: Spacing.three, marginBottom: Spacing.two, borderRadius: Spacing.two },
  searchInput: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 15 },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
  arabic: { fontSize: 22, lineHeight: 36 },
  // Quiz-Modus (UI-Muster aus features/study/QuizSession.tsx)
  quizContent: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  quizHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quizHeaderSpacer: { width: 16 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  stepLabel: { textAlign: 'center' },
  prompt: { textAlign: 'center' },
  quizCard: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  quizArabic: { fontSize: 44, lineHeight: 72, textAlign: 'center' },
  options: { gap: Spacing.two },
  option: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  optionCorrect: { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: '#4ade80' },
  optionWrong: { backgroundColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderColor: '#f87171' },
  revealBlock: { alignItems: 'center', gap: Spacing.two },
  revealLabel: { textAlign: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  navButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  resultEmoji: { fontSize: 48, lineHeight: 64 },
  resultText: { textAlign: 'center' },
  pressableWeb: { cursor: 'pointer' },
});
