// Einstufungstest: prüft Meilenstein für Meilenstein (Buchstaben →
// Verbindungsformen → Harakat → Sonderregeln → Wörter). Bei einem bestandenen
// Meilenstein geht's zum nächsten; beim ersten nicht bestandenen Meilenstein
// endet der Test mit einer Empfehlung, wo man einsteigen sollte.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { lessonTitle } from '@/features/learn/curriculum';
import {
  applyPlacement,
  buildPlacementCheckpoints,
  checkpointPassed,
  recommendedNextLesson,
  type PlacementCheckpoint,
} from '@/features/learn/placement';
import { useLearnProgress } from '@/features/learn/progress';
import { speakArabic, stopSpeaking } from '@/features/learn/audio';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import { useTranslation } from '@/lib/i18n';

export default function PlacementScreen() {
  const { t, locale } = useTranslation();
  const { progress, record } = useLearnProgress();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('placement');

  // Checkpoints erst NACH der Hydration in einem Effect mischen, nicht
  // direkt im Render-Body: Math.random() liefert serverseitig (Static
  // Export) und beim ersten Client-Render zwangsläufig unterschiedliche
  // Fragen-Reihenfolgen -> React #418 (gleicher Fehler wie bei
  // study/[course]/placement.tsx, siehe dortiger Kommentar). Ein Effect
  // läuft nie während SSR — derselbe Ladezustand-Trick.
  const [checkpoints, setCheckpoints] = useState<PlacementCheckpoint[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const built = buildPlacementCheckpoints(locale, Math.random);
      if (!cancelled) setCheckpoints(built);
    })();
    return () => {
      cancelled = true;
    };
    // Checkpoints einmal beim Öffnen mischen, nicht bei jedem Re-Render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [lastPassedId, setLastPassedId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [applied, setApplied] = useState(false);

  const checkpoint = checkpoints?.[checkpointIndex];
  const question = checkpoint?.questions[questionIndex];

  // Hör-Fragen (display: '🔊', requiresAudio) haben KEINE sichtbare Antwort —
  // ohne Wiedergabe unlösbar. Gleiches Auto-Play-Muster wie im Lektions-Quiz
  // (quiz/[mode].tsx): echtes Rezitations-Audio, wenn audioUrl vorhanden, sonst
  // Geräte-TTS; Tippen auf die Karte wiederholt es. Vorher fehlte das komplett
  // im Einstufungstest — die Frage tauchte stumm auf.
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
  useEffect(() => {
    if (question && (question.tts || question.audioUrl)) playAudio(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpointIndex, questionIndex, checkpoints]);

  function answer(optionIndex: number) {
    if (answered !== null || !checkpoints || !checkpoint || !question) return;
    setAnswered(optionIndex);
    const correct = optionIndex === question.correctIndex;
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    setTimeout(() => {
      setAnswered(null);
      if (questionIndex + 1 < checkpoint.questions.length) {
        setQuestionIndex(questionIndex + 1);
        return;
      }
      // Checkpoint zu Ende: bestanden -> nächster Checkpoint, sonst Test beenden.
      const passed = checkpointPassed(nextScore, checkpoint.questions.length);
      if (passed) {
        const newLastPassed = checkpoint.lessonId;
        if (checkpointIndex + 1 < checkpoints.length) {
          setLastPassedId(newLastPassed);
          setCheckpointIndex(checkpointIndex + 1);
          setQuestionIndex(0);
          setScore(0);
        } else {
          setLastPassedId(newLastPassed);
          setFinished(true);
        }
      } else {
        setFinished(true);
      }
    }, 900);
  }

  function confirmPlacement() {
    if (applied) {
      router.replace({ pathname: '/learn/[lesson]', params: { lesson: recommended.id } });
      return;
    }
    const next = applyPlacement(progress, lastPassedId);
    for (const [id, result] of Object.entries(next)) {
      if (!progress[id]) record(id, result.score, result.total);
    }
    setApplied(true);
    router.replace({ pathname: '/learn/[lesson]', params: { lesson: recommended.id } });
  }

  const recommended = recommendedNextLesson(lastPassedId);

  // Audit 2026-07-27: Lade- und Fehlerzweig ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang (Lern-Stack: headerShown:false, Zurueck-Chip Web-only).
  if (checkpoints === null) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('learn.title')} onBack={() => backOr('/learn')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!checkpoint) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('learn.title')} onBack={() => backOr('/learn')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => backOr('/learn')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
            <ThemedText type="default" themeColor="textSecondary">
              ✕
            </ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle} numberOfLines={2}>
            {t('placement.title')}
          </ThemedText>
          <IntroHelpButton onPress={intro.show} color={colors.textSecondary} />
        </View>

        {!finished && question && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {t('placement.step').replace('{n}', String(checkpointIndex + 1)).replace('{total}', String(checkpoints.length))}
              {' · '}
              {questionIndex + 1} / {checkpoint.questions.length}
            </ThemedText>
            <ThemedText type="default" style={styles.prompt}>
              {question.promptText ?? t(question.promptKey)}
            </ThemedText>
            {(question.display !== '' || question.tts || question.audioUrl) && (
              <Pressable
                onPress={() => playAudio(question)}
                disabled={!question.tts && !question.audioUrl}
                accessibilityRole="button"
                accessibilityLabel={question.display === '' ? t('a11y.playAudio') : undefined}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {question.display !== '' && (
                    <ThemedText style={question.displayArabic ? styles.cardArabic : styles.cardLatin}>
                      {question.display}
                    </ThemedText>
                  )}
                  {(question.tts || question.audioUrl) && (
                    <IconSymbol name="volume-high" size={18} color={colors.accent} />
                  )}
                </ThemedView>
              </Pressable>
            )}
            <View style={styles.options}>
              {question.options.map((option, i) => {
                const isCorrect = answered !== null && i === question.correctIndex;
                const isWrong = answered === i && i !== question.correctIndex;
                return (
                  <Pressable
                    key={`${questionIndex}-${i}`}
                    onPress={() => answer(i)}
                    style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}>
                      <ThemedText type="default" style={question.optionsArabic ? styles.optionArabic : undefined}>
                        {option}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {finished && (
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText style={styles.resultEmoji}>🎯</ThemedText>
              <ThemedText type="title">{lessonTitle(recommended, locale, t)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resultText}>
                {t('placement.recommendation')}
              </ThemedText>
            </ThemedView>
            <View style={styles.navRow}>
              <Pressable onPress={confirmPlacement} style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundSelected" style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('placement.confirm')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.placement.title')}
        what={t('practice.intro.placement.what')}
        why={t('practice.intro.placement.why')}
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
  content: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch', alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
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
  pressableWeb: { cursor: 'pointer' },
});
