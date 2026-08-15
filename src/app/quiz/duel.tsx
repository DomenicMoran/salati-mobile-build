import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import {
  InvalidDuelCodeError,
  buildDuelChallenge,
  buildDuelQuestions,
  decodeDuelChallenge,
  encodeDuelChallenge,
  randomDuelSeed,
  type DuelChallenge,
} from '@/features/practice/asyncDuel';
import { recordMistake } from '@/features/practice/mistakes';
import { buildPracticeQuiz } from '@/features/practice/modes';
import type { QuizQuestion } from '@/features/learn/quiz';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type DuelMode = 'local' | 'async';

// Quiz-Duell in 2 Varianten:
// - "local": 2 Spieler an EINEM Gerät (Pass-and-Play, unverändert).
// - "async": 2 Geräte, OHNE Server — Spieler A spielt, exportiert Fragen-Seed
//   + Score als Sync-Code (siehe features/practice/asyncDuel.ts), schickt ihn
//   selbst an Spieler B (Chat/Mail, wie beim Fortschritts-Sync). B importiert
//   den Code, bekommt dasselbe Fragen-Set (deterministisch aus dem Seed) und
//   sieht danach den Score-Vergleich. Kein Echtzeit-Multiplayer — das bräuchte
//   einen Relay-Server, den es im server-losen Architekturprinzip der App
//   nicht gibt.
export default function QuizDuelScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('duel');
  const [mode, setMode] = useState<DuelMode>('local');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title={t('duel.title')}
          right={<IntroHelpButton onPress={intro.show} color={colors.textSecondary} />}
        />
        <View style={styles.modeRow}>
          <View style={styles.modeRowChips}>
            <Pressable
              onPress={() => setMode('local')}
              accessibilityRole="button"
              style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <ThemedView type={mode === 'local' ? 'backgroundSelected' : 'backgroundElement'} style={styles.modeChip}>
                <ThemedText type="smallBold" themeColor={mode === 'local' ? 'accent' : 'textSecondary'}>
                  {t('duel.modeLocal')}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => setMode('async')}
              accessibilityRole="button"
              style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <ThemedView type={mode === 'async' ? 'backgroundSelected' : 'backgroundElement'} style={styles.modeChip}>
                <ThemedText type="smallBold" themeColor={mode === 'async' ? 'accent' : 'textSecondary'}>
                  {t('duel.modeAsync')}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </View>
        {mode === 'local' ? <LocalDuel /> : <AsyncDuel />}
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.duel.title')}
        what={t('practice.intro.duel.what')}
        why={t('practice.intro.duel.why')}
      />
    </ThemedView>
  );
}

/** Unverändertes lokales Pass-and-Play-Duell (2 Spieler, 1 Gerät). */
function LocalDuel() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const [run, setRun] = useState(0);
  // Hydration-Guard: Fragen entstehen mit Math.random — im Static-Export-HTML
  // stünde sonst eine ANDERE Frage als im ersten Client-Render (#418).
  const hydrated = useHydrated();
  const questions = useMemo(
    () => (hydrated ? buildPracticeQuiz('mix', locale) : []),
    // run erzwingt frisch gemischte Fragen bei Revanche
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, locale, run],
  );

  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [answered, setAnswered] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const player = (index % 2) as 0 | 1;
  const question = questions[index];

  function answer(i: number) {
    if (answered !== null || !question) return;
    setAnswered(i);
    const correct = i === question.correctIndex;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    // Falsche Antworten in die Fehler-Wiederholung legen (Leitner light, wie in quiz/[mode].tsx)
    if (!correct) recordMistake(question).catch(() => {});
    const nextScores: [number, number] = [...scores] as [number, number];
    if (correct) nextScores[player] += 1;
    setScores(nextScores);
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        setAnswered(null);
      } else {
        setFinished(true);
      }
    }, 900);
  }

  function rematch() {
    setRun((r) => r + 1);
    setIndex(0);
    setScores([0, 0]);
    setAnswered(null);
    setFinished(false);
  }

  const playerColor = player === 0 ? Brand.gold : colors.text;

  if (finished) {
    const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
    return (
      <View style={styles.resultWrap}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <IconSymbol name={winner === null ? 'people' : 'trophy'} size={44} color={colors.accent} />
        </Animated.View>
        <ThemedText type="title" style={styles.center}>
          {winner === null
            ? t('duel.tie')
            : t('duel.winner').replace('{p}', t(winner === 0 ? 'duel.player1' : 'duel.player2'))}
        </ThemedText>
        <ThemedText type="subtitle" themeColor="textSecondary">
          {scores[0]} : {scores[1]}
        </ThemedText>
        <Pressable
          onPress={rematch}
          accessibilityRole="button"
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <ThemedView type="backgroundSelected" style={styles.rematchBtn}>
            <IconSymbol name="refresh" size={15} color={colors.accent} />
            <ThemedText type="smallBold" themeColor="accent">
              {t('duel.rematch')}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>
    );
  }

  if (!question) return null;

  return (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll}>
      <ThemedText type="title" style={styles.center}>
        {t('duel.title')}
      </ThemedText>
      <View style={styles.scoreRow}>
        <ThemedView type={player === 0 ? 'backgroundSelected' : 'backgroundElement'} style={styles.scoreChip}>
          <ThemedText type="smallBold" themeColor={player === 0 ? 'accent' : 'textSecondary'}>
            {t('duel.player1')} · {scores[0]}
          </ThemedText>
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          {index + 1} / {questions.length}
        </ThemedText>
        <ThemedView type={player === 1 ? 'backgroundSelected' : 'backgroundElement'} style={styles.scoreChip}>
          <ThemedText type="smallBold" themeColor={player === 1 ? 'accent' : 'textSecondary'}>
            {t('duel.player2')} · {scores[1]}
          </ThemedText>
        </ThemedView>
      </View>

      <ThemedText type="smallBold" style={[styles.center, { color: playerColor }]}>
        {t('duel.turn').replace('{p}', t(player === 0 ? 'duel.player1' : 'duel.player2'))}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.questionCard}>
        <ThemedText type="default" style={styles.center}>
          {question.promptText || t(question.promptKey)}
        </ThemedText>
        {!!question.display && (
          <ThemedText style={[styles.display, question.displayArabic && styles.arabic]}>
            {question.display}
          </ThemedText>
        )}
      </ThemedView>

      <View style={styles.options}>
        {question.options.map((o, i) => {
          const isCorrect = answered !== null && i === question.correctIndex;
          const isWrong = answered === i && i !== question.correctIndex;
          return (
            <PressableCard
              key={`${index}-${i}`}
              onPress={() => answer(i)}
              type={isCorrect ? 'backgroundSelected' : 'backgroundElement'}
              style={[styles.option, isWrong && styles.optionWrong]}>
              <ThemedText
                type="default"
                style={question.optionsArabic ? styles.arabicOption : undefined}
                themeColor={isCorrect ? 'accent' : 'text'}>
                {o}
              </ThemedText>
            </PressableCard>
          );
        })}
      </View>
    </ScrollView>
  );
}

type AsyncStage = 'menu' | 'import' | 'playing' | 'result';

/** Asynchrones Duell per Sync-Code — Details siehe Header-Kommentar der Datei. */
function AsyncDuel() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const [stage, setStage] = useState<AsyncStage>('menu');
  const [seed, setSeed] = useState<number | null>(null);
  const [opponent, setOpponent] = useState<DuelChallenge | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(false);

  const [exportCode, setExportCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function startNew() {
    const newSeed = randomDuelSeed();
    setSeed(newSeed);
    setOpponent(null);
    setQuestions(buildDuelQuestions(newSeed, locale));
    setIndex(0);
    setScore(0);
    setAnswered(null);
    setExportCode(null);
    setCopied(false);
    setStage('playing');
  }

  function tryImport() {
    try {
      const challenge = decodeDuelChallenge(importText);
      setOpponent(challenge);
      setSeed(challenge.seed);
      setQuestions(buildDuelQuestions(challenge.seed, locale));
      setIndex(0);
      setScore(0);
      setAnswered(null);
      setImportError(false);
      setStage('playing');
    } catch (e) {
      if (e instanceof InvalidDuelCodeError) setImportError(true);
      else throw e;
    }
  }

  function answer(i: number) {
    const question = questions[index];
    if (answered !== null || !question) return;
    setAnswered(i);
    const correct = i === question.correctIndex;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    }
    if (!correct) recordMistake(question).catch(() => {});
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        setAnswered(null);
      } else {
        // Nur die eigene NEUE Runde (kein Import) exportiert einen Code —
        // beim Import wurde der Vergleichs-Score bereits mitgeliefert.
        if (!opponent && seed !== null) {
          setExportCode(encodeDuelChallenge(buildDuelChallenge(seed, nextScore, questions.length)));
        }
        setStage('result');
      }
    }, 900);
  }

  async function copyCode() {
    if (!exportCode) return;
    await Clipboard.setStringAsync(exportCode);
    setCopied(true);
  }

  function backToMenu() {
    setStage('menu');
    setImportText('');
    setImportError(false);
  }

  if (stage === 'menu') {
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll}>
        <ThemedText type="title" style={styles.center}>
          {t('duel.title')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {t('duel.asyncIntro')}
        </ThemedText>
        <PressableCard onPress={startNew} type="backgroundSelected" style={styles.menuButton}>
          <IconSymbol name="add-circle-outline" size={18} color={colors.accent} />
          <ThemedText type="smallBold" themeColor="accent">
            {t('duel.asyncStart')}
          </ThemedText>
        </PressableCard>
        <PressableCard onPress={() => setStage('import')} style={styles.menuButton}>
          <IconSymbol name="arrow-down" size={18} color={colors.text} />
          <ThemedText type="smallBold">{t('duel.asyncImport')}</ThemedText>
        </PressableCard>
      </ScrollView>
    );
  }

  if (stage === 'import') {
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.center}>
          {t('duel.asyncImport')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.inputBox}>
          <TextInput
            value={importText}
            onChangeText={(v) => {
              setImportText(v);
              setImportError(false);
            }}
            placeholder={t('duel.asyncImportPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.textInput, { color: colors.text }]}
          />
        </ThemedView>
        <PressableCard
          onPress={tryImport}
          type="backgroundSelected"
          disabled={importText.trim() === ''}
          style={styles.menuButton}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('duel.asyncImportButton')}
          </ThemedText>
        </PressableCard>
        {importError && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('sync.importError')}
          </ThemedText>
        )}
        <PressableCard onPress={backToMenu} style={styles.menuButton}>
          <ThemedText type="default">{t('duel.asyncBack')}</ThemedText>
        </PressableCard>
      </ScrollView>
    );
  }

  if (stage === 'result') {
    const total = questions.length;
    return (
      <View style={styles.resultWrap}>
        {opponent ? (
          <>
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <IconSymbol
                name={score === opponent.score ? 'people' : score > opponent.score ? 'trophy' : 'book'}
                size={44}
                color={colors.accent}
              />
            </Animated.View>
            <ThemedText type="title" style={styles.center}>
              {score === opponent.score
                ? t('duel.tie')
                : score > opponent.score
                  ? t('duel.asyncYouWin')
                  : t('duel.asyncOpponentWin')}
            </ThemedText>
            <View style={styles.scoreRow}>
              <ThemedView type="backgroundSelected" style={styles.scoreChip}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('duel.you')} · {score}
                </ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={styles.scoreChip}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('duel.opponent')} · {opponent.score}
                </ThemedText>
              </ThemedView>
            </View>
          </>
        ) : (
          <>
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <IconSymbol name="trophy" size={44} color={colors.accent} />
            </Animated.View>
            <ThemedText type="title" style={styles.center}>
              {t('duel.asyncYourScore')}
            </ThemedText>
            <ThemedText type="subtitle" themeColor="textSecondary">
              {score} / {total}
            </ThemedText>
            {exportCode && (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.codeHint]}>
                  {t('duel.asyncCodeHint')}
                </ThemedText>
                <ThemedView type="backgroundSelected" style={styles.codeBox}>
                  <ThemedText type="small" selectable style={styles.codeText}>
                    {exportCode}
                  </ThemedText>
                </ThemedView>
                <Pressable onPress={copyCode} style={styles.copyButton}>
                  <IconSymbol name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.accent} />
                  <ThemedText type="small" themeColor="accent">
                    {copied ? t('sync.copied') : t('sync.copyButton')}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </>
        )}
        <Pressable
          onPress={backToMenu}
          accessibilityRole="button"
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <ThemedView type="backgroundSelected" style={styles.rematchBtn}>
            <IconSymbol name="refresh" size={15} color={colors.accent} />
            <ThemedText type="smallBold" themeColor="accent">
              {t('duel.asyncNewDuel')}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>
    );
  }

  // stage === 'playing'
  const question = questions[index];
  if (!question) return null;

  return (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll}>
      <ThemedText type="title" style={styles.center}>
        {t('duel.title')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {index + 1} / {questions.length} · {score} ✓
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.questionCard}>
        <ThemedText type="default" style={styles.center}>
          {question.promptText || t(question.promptKey)}
        </ThemedText>
        {!!question.display && (
          <ThemedText style={[styles.display, question.displayArabic && styles.arabic]}>
            {question.display}
          </ThemedText>
        )}
      </ThemedView>

      <View style={styles.options}>
        {question.options.map((o, i) => {
          const isCorrect = answered !== null && i === question.correctIndex;
          const isWrong = answered === i && i !== question.correctIndex;
          return (
            <PressableCard
              key={`${index}-${i}`}
              onPress={() => answer(i)}
              type={isCorrect ? 'backgroundSelected' : 'backgroundElement'}
              style={[styles.option, isWrong && styles.optionWrong]}>
              <ThemedText
                type="default"
                style={question.optionsArabic ? styles.arabicOption : undefined}
                themeColor={isCorrect ? 'accent' : 'text'}>
                {o}
              </ThemedText>
            </PressableCard>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  flex1: { flex: 1 },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  modeRowChips: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  modeChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.four, borderRadius: 999 },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  center: { textAlign: 'center' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scoreChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  questionCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  display: { fontSize: 40, lineHeight: 56, textAlign: 'center' },
  arabic: { fontSize: 44, lineHeight: 64 },
  options: { gap: Spacing.two },
  option: { padding: Spacing.three, alignItems: 'center' },
  optionWrong: { opacity: 0.45 },
  arabicOption: { fontSize: 22, lineHeight: 34 },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  inputBox: { borderRadius: Spacing.three, padding: Spacing.three, minHeight: 100 },
  textInput: { fontSize: 14, fontFamily: 'monospace', minHeight: 84 },
  codeHint: { lineHeight: 18 },
  codeBox: { padding: Spacing.three, borderRadius: Spacing.two, alignSelf: 'stretch' },
  codeText: { fontFamily: 'monospace', lineHeight: 18 },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  rematchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    marginTop: Spacing.two,
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.7 },
});
