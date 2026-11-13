// Gemeinsamer Lektions-Player (Karten -> Quiz -> Ergebnis) für den
// "Koran lesen lernen"-Kurs (/learn) UND die Studien-Kurse (/study/<kurs>).
// Extrahiert aus app/learn/[lesson].tsx, parametrisiert über lesson/backTo/record.
import { useSsrSafeAudioPlayer, useSsrSafeAudioPlayerStatus } from '@/lib/ssrSafeAudio';
import { router, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShareCardModal } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { speakArabic, stopSpeaking } from '@/features/learn/audio';
import { buildCards } from '@/features/learn/cards';
import { lessonTitle, type Lesson } from '@/features/learn/curriculum';
import { passedCountIn, PASS_RATIO, type LearnProgress } from '@/features/learn/progress';
import { buildQuiz } from '@/features/learn/quiz';
import { bestTranscript, gradeFromSimilarity, type RecitationGrade } from '@/features/hifz/similarity';
import { recognitionAvailable, recognizeArabicAlternatives } from '@/features/hifz/speech';
import { useHydrated } from '@/hooks/use-hydrated';
import { recordMistake } from '@/features/study/mistakes';
import { useShareCard } from '@/features/share/useShareCard';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { studyCourseDeepLink } from '@/lib/deepLinks';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

type Phase = 'learn' | 'quiz' | 'result';

export interface LessonPlayerProps {
  lesson: Lesson;
  /** Fallback-Ziel für Zurück (Kurs-Übersicht), wenn kein History-Stack existiert */
  backTo: Href;
  record: (lessonId: string, score: number, total: number) => void;
  /** Kurs-Id fürs Fehler-Tracking ("learn" für den Lese-Kurs) */
  courseId?: string;
  /** Direktsprung zur nächsten Lektion im Ergebnis (nur bei Bestehen gezeigt) */
  nextTo?: Href;
  /**
   * Alle Lektionen des Kurses + aktueller Fortschritt (VOR diesem Versuch) —
   * nur von den Studien-Kursen (app/study/[course]/[lesson].tsx) übergeben.
   * Ermöglicht "Kurs gerade komplett abgeschlossen?" zu erkennen: alle
   * ANDEREN Lektionen waren schon bestanden UND diese hier wird jetzt auch
   * bestanden. "Koran lesen lernen" (app/learn/[lesson].tsx) übergibt das
   * bewusst nicht — die Kurs-Abschluss-Teilen-Karte ist auf die Studium-Kurse
   * begrenzt (courseTitle/lessonCount kommen 1:1 aus courses.ts).
   */
  courseCompletion?: {
    courseId: string;
    courseTitle: string;
    allLessons: Lesson[];
    progress: LearnProgress;
  };
}

type PronState = 'idle' | 'listening' | RecitationGrade;

export function LessonPlayer({ lesson, backTo, record, courseId, nextTo, courseCompletion }: LessonPlayerProps) {
  const { t, locale } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { settings } = useSettings();
  const shareCard = useShareCard();
  // Hydration-Guard: SpeechRecognition existiert nur im Browser — direkter
  // Render-Check riss einen #418-Mismatch (Server-HTML ohne Mikro-Button).
  const hydrated = useHydrated();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const cards = useMemo(() => buildCards(lesson, locale), [lesson, locale]);
  const [quizRun, setQuizRun] = useState(0);
  const questions = useMemo(
    () => buildQuiz(lesson, Math.random, locale, settings.exerciseStyle),
    // quizRun erzwingt neue (neu gemischte) Fragen bei "Nochmal versuchen"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, quizRun, locale, settings.exerciseStyle],
  );

  const [phase, setPhase] = useState<Phase>('learn');
  const [cardIndex, setCardIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  // Falsch beantwortete Fragen (Fragen-Index) für die Auflösung im Ergebnis
  // (gleiches Muster wie QuizSession.tsx, Audit 2026-07-19 C1).
  const [wrongIndices, setWrongIndices] = useState<number[]>([]);
  const [easeVerseExpanded, setEaseVerseExpanded] = useState(false);

  // Audio: echte Rezitation (MP3) für Lese-Lektionen, sonst Geräte-TTS.
  const recitationPlayer = useSsrSafeAudioPlayer(null);
  const recitationStatus = useSsrSafeAudioPlayerStatus(recitationPlayer);
  // expo-speech kennt kein echtes Pause/Resume (Speech.pause() ist auf
  // Android No-Op) — deshalb hier nur ein einfacher Play/Stop-Toggle statt
  // Pause-mit-Fortsetzen. `speaking` wird per Poll auf
  // Speech.isSpeakingAsync() zurückgesetzt, sobald die Ausgabe von selbst
  // endet (speakArabic exponiert keine onDone-Callback).
  const [speaking, setSpeaking] = useState(false);
  const isPlaying = recitationStatus.playing || speaking;
  const playAudio = useCallback(
    (item: { tts?: string; audioUrl?: string }) => {
      stopSpeaking();
      setSpeaking(false);
      if (item.audioUrl) {
        recitationPlayer.replace(item.audioUrl);
        recitationPlayer.play();
      } else if (item.tts) {
        recitationPlayer.pause();
        speakArabic(item.tts);
        setSpeaking(true);
      }
    },
    [recitationPlayer],
  );
  const stopAudio = useCallback(() => {
    stopSpeaking();
    recitationPlayer.pause();
    setSpeaking(false);
  }, [recitationPlayer]);
  useEffect(() => {
    if (!speaking) return;
    const id = setInterval(() => {
      Speech.isSpeakingAsync().then((s) => {
        if (!s) setSpeaking(false);
      });
    }, 300);
    return () => clearInterval(id);
  }, [speaking]);
  useEffect(() => stopSpeaking, []);

  // Sprechübung: freiwillig, blockiert nie den Fortschritt ("Weiter" geht
  // immer). Nur auf Web verfügbar (recognitionAvailable() prüft das) — wer
  // z. B. in der Bahn sitzt, lässt es einfach und tippt direkt auf "Weiter"
  // oder übt stattdessen im Schreibtraining (/learn/write). Reset bei
  // Kartenwechsel passiert direkt an den setCardIndex-Aufrufen (kein Effekt).
  const [pronState, setPronState] = useState<PronState>('idle');
  function goToCard(index: number) {
    setPronState('idle');
    setCardIndex(index);
  }

  async function practicePronunciation(targets: string[]) {
    if (!recognitionAvailable() || pronState === 'listening') return;
    setPronState('listening');
    try {
      const alternatives = await recognizeArabicAlternatives();
      // Gegen ALLE akzeptierten Zielformen matchen (z. B. Buchstaben-NAME
      // "باء" UND Glyphe "ب") — eine einzelne Glyphe transkribiert keine
      // Spracherkennung zuverlässig; der Name schon (User: "Sprachübungen
      // zu Buchstaben funktionieren kaum").
      const score = Math.max(
        ...targets.filter(Boolean).map((tgt) => bestTranscript(alternatives, tgt).score),
        0,
      );
      setPronState(gradeFromSimilarity(score));
    } catch {
      setPronState('idle');
      return;
    }
    setTimeout(() => setPronState('idle'), 1800);
  }

  const card = cards[cardIndex];
  const question = questions[questionIndex];

  // Hör-Inhalte automatisch abspielen (Gerätefeedback: nicht erst tippen);
  // erneutes Tippen wiederholt das Audio. AUSNAHME: Story-Lektionen
  // (Hadith/Sīra/…) mappen den kompletten Erzähltext auf card.tts — das las
  // sich beim Öffnen der Karte sonst ungebremst vor, ohne Pause-Möglichkeit
  // vor dem ersten Ton (der Stopp-Button unten erscheint erst, wenn Audio
  // bereits läuft). Dort startet Audio nur noch per Tap auf die Karte
  // (🔊 t('learn.tapToListen')) oder den Stopp-Button während der Wiedergabe.
  useEffect(() => {
    const aktiv = phase === 'quiz' ? question : card;
    if (!aktiv || !(aktiv.tts || aktiv.audioUrl)) return;
    if (phase === 'learn' && lesson.kind === 'story') return;
    // playAudio setzt intern setSpeaking() (React-State) - direkt synchron im
    // Effekt-Body aufgerufen löst react-hooks/set-state-in-effect aus. Per
    // Timeout(0) entkoppeln, wie bei Event-Handler-Aufrufen üblich.
    const id = setTimeout(() => playAudio(aktiv), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex, questionIndex, phase]);

  function answer(optionIndex: number) {
    if (answered !== null || !question) return;
    setAnswered(optionIndex);
    const correct = optionIndex === question.correctIndex;
    if (!correct) {
      setWrongIndices((w) => [...w, questionIndex]);
      if (courseId) {
        // Fire-and-forget: speist "Schwächen üben" (features/study/mistakes)
        recordMistake(courseId, lesson.id);
      }
    }
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    if (correct) {
      // Richtig: kurzer Grün-Flash, dann automatisch weiter (Momentum).
      setTimeout(() => advanceQuiz(nextScore), 900);
    }
    // Falsch: ANHALTEN (Audit 2026-07-19 C1) - korrekte Option bleibt grün
    // markiert stehen, weiter erst per Tap auf "Weiter".
  }

  function advanceQuiz(nextScore: number) {
    setAnswered(null);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      record(lesson.id, nextScore, questions.length);
      setPhase('result');
    }
  }

  function retry() {
    setQuizRun((r) => r + 1);
    setScore(0);
    setQuestionIndex(0);
    setAnswered(null);
    setWrongIndices([]);
    setPhase('quiz');
  }

  const passed = questions.length > 0 && score / questions.length >= PASS_RATIO;

  // Kurs gerade komplett fertig? Alle ANDEREN Lektionen des Kurses waren
  // bereits bestanden (Stand VOR diesem Versuch, s. courseCompletion-Prop-
  // Kommentar oben) und diese hier wird jetzt ebenfalls bestanden — deckt
  // auch Ein-Lektionen-Kurse ab (otherLessons dann leer, jede Bedingung
  // trivial erfüllt).
  const otherLessons = courseCompletion?.allLessons.filter((l) => l.id !== lesson.id) ?? [];
  const courseJustCompleted =
    !!courseCompletion &&
    passed &&
    passedCountIn(otherLessons, courseCompletion.progress) === otherLessons.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Audit 2026-07-27 (P2): rohes ✕-Textzeichen mit ~34pt Trefferflaeche
            durch den gemeinsamen ScreenHeader ersetzt (44pt, IconSymbol,
            RTL-korrekt, gleiche Optik wie alle uebrigen Schliessen-Knoepfe). */}
        <ScreenHeader
          title={lessonTitle(lesson, locale, t)}
          variant="modal"
          closeLabel="x"
          onBack={() => backOr(backTo)}
        />

        {phase === 'learn' && card && (
          <ScrollView contentContainerStyle={styles.content}>
            {/* User-Wunsch: an jedem Lektionsstart des Lesen-lernen-Kurses an
                Sure 54:17 (4x im Koran wiederholt) erinnern - Motivation,
                dass Koran-Lesen-Lernen bewusst leicht gemacht wurde. Nur
                courseId 'learn' (nicht die Studien-Kurse) und nur auf der
                ersten Karte einer Lektion, sonst wirkt es bei jeder Karte
                repetitiv. */}
            {courseId === 'learn' && cardIndex === 0 && (
              <Pressable
                onPress={() => setEaseVerseExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={t('learn.easeVerse.title')}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundElement" style={styles.easeVerseBox}>
                  <ThemedText style={styles.easeVerseArabic}>{t('learn.easeVerse.arabic')}</ThemedText>
                  <ThemedText type="small" style={styles.easeVerseTranslation}>
                    {t('learn.easeVerse.translation')}
                  </ThemedText>
                  <View style={styles.easeVerseFooter}>
                    <ThemedText type="small" themeColor="accent" style={styles.easeVerseReference}>
                      {t('learn.easeVerse.reference')}
                    </ThemedText>
                    <IconSymbol
                      name={easeVerseExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.accent}
                    />
                  </View>
                  {easeVerseExpanded && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.easeVerseExplanation}>
                      {t('learn.easeVerse.explanation')}
                    </ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            )}
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {cardIndex + 1} / {cards.length}
            </ThemedText>
            <Pressable
              onPress={() => playAudio(card)}
              disabled={!card.tts && !card.audioUrl}
              accessibilityRole="button"
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <ThemedView type="backgroundElement" style={styles.card}>
                {!!card.arabic && <ThemedText style={styles.cardArabic}>{card.arabic}</ThemedText>}
                {!!(settings.showIsolatedLetters && card.isolated && card.isolated !== card.arabic) && (
                  <ThemedText style={styles.cardIsolated} themeColor="textSecondary">
                    {card.isolated}
                  </ThemedText>
                )}
                <ThemedText type="subtitle" style={styles.cardLabel}>
                  {card.label}
                </ThemedText>
                {card.sublabel && settings.showTransliteration && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {card.sublabel}
                  </ThemedText>
                )}
                {card.text && (
                  <ThemedText type="small" style={styles.cardText}>
                    {card.text}
                  </ThemedText>
                )}
                {card.contentFallback && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.fallbackNotice}>
                    ⓘ {t('learn.contentFallbackNotice')}
                  </ThemedText>
                )}
                {(card.tts || card.audioUrl) && (
                  <ThemedText type="small" themeColor="accent">
                    🔊 {t('learn.tapToListen')}
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
            {(card.tts || card.audioUrl) && isPlaying && (
              // Stopp-Taste neben dem Wiederholen-Tap auf der Karte (Audit:
              // lange Story-Texte lesen sich sonst ungebremst vor, einziger
              // Audio-Button war "nochmal von vorn" statt "anhalten").
              <Pressable
                onPress={stopAudio}
                accessibilityRole="button"
                accessibilityLabel={t('quran.pause')}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <View style={styles.stopRow}>
                  <IconSymbol name="pause-circle" size={18} color={colors.accent} />
                  <ThemedText type="small" themeColor="accent">
                    {t('quran.pause')}
                  </ThemedText>
                </View>
              </Pressable>
            )}
            {settings.speechExercisesEnabled && hydrated && recognitionAvailable() && !!(card.tts || card.arabic) && (
              <Pressable
                onPress={() => practicePronunciation([card.tts ?? '', card.arabic ?? '', card.label ?? ''])}
                disabled={pronState === 'listening'}
                accessibilityRole="button"
                accessibilityLabel={t('learn.practicePronunciation')}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <View style={styles.pronRow}>
                  <IconSymbol
                    name={pronState === 'listening' ? 'mic' : 'mic-outline'}
                    size={18}
                    color={
                      pronState === 'excellent' || pronState === 'good'
                        ? '#4ade80'
                        : pronState === 'retry'
                          ? '#f87171'
                          : colors.accent
                    }
                  />
                  <ThemedText type="small" themeColor="accent">
                    {pronState === 'listening'
                      ? t('learn.listening')
                      : pronState === 'excellent' || pronState === 'good'
                        ? t('learn.pronunciationGood')
                        : pronState === 'retry'
                          ? t('learn.pronunciationRetry')
                          : t('learn.practicePronunciation')}
                  </ThemedText>
                </View>
              </Pressable>
            )}
            {card.textKey && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.explainer}>
                {t(card.textKey)}
              </ThemedText>
            )}
            {lesson.source && cardIndex === cards.length - 1 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.explainer}>
                {t('study.source')}: {lesson.source}
              </ThemedText>
            )}
            <View style={styles.navRow}>
              {cardIndex > 0 && (
                <Pressable
                  onPress={() => goToCard(cardIndex - 1)}
                  accessibilityRole="button"
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedView type="backgroundElement" style={styles.navButton}>
                    <ThemedText type="default">‹ {t('learn.back')}</ThemedText>
                  </ThemedView>
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  cardIndex + 1 < cards.length ? goToCard(cardIndex + 1) : setPhase('quiz')
                }
                accessibilityRole="button"
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundSelected" style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {cardIndex + 1 < cards.length ? `${t('learn.next')} ›` : `${t('learn.startQuiz')} ▶`}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {phase === 'quiz' && question && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
              {questionIndex + 1} / {questions.length}
            </ThemedText>
            <ThemedText type="default" style={styles.prompt}>
              {question.promptText ?? t(question.promptKey)}
            </ThemedText>
            {question.contentFallback && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.fallbackNotice}>
                ⓘ {t('learn.contentFallbackNotice')}
              </ThemedText>
            )}
            {(question.display !== '' || question.tts || question.audioUrl) && (
              <Pressable
                onPress={() => playAudio(question)}
                disabled={!question.tts && !question.audioUrl}
                accessibilityRole="button"
                accessibilityHint={question.tts || question.audioUrl ? t('a11y.playAudio') : undefined}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText style={question.displayArabic ? styles.cardArabic : styles.cardLatin}>
                    {question.display}
                  </ThemedText>
                  {(question.tts || question.audioUrl) && (
                    <ThemedText type="small" themeColor="accent">
                      🔊
                    </ThemedText>
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
                    accessibilityRole="button"
                    style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}>
                      <ThemedText
                        type="default"
                        style={question.optionsArabic ? styles.optionArabic : undefined}>
                        {option}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
            {answered !== null && answered !== question.correctIndex && (
              <View style={styles.revealBlock}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revealLabel}>
                  {t('practice.correctAnswerLabel')}:{' '}
                  <ThemedText type="smallBold">{question.options[question.correctIndex]}</ThemedText>
                </ThemedText>
                <Pressable
                  onPress={() => advanceQuiz(score)}
                  accessibilityRole="button"
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedView type="backgroundSelected" style={styles.nextButton}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('learn.next')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {phase === 'result' && (
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={styles.card}>
              {/* Kleiner Erfolgsmoment statt statischem Emoji (Audit C3) -
                  Spring-Einzoomen, bei Reduced-Motion ohne Animation. */}
              <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(10)}>
                <ThemedText style={styles.resultEmoji}>{passed ? '🎉' : '📚'}</ThemedText>
              </Animated.View>
              <ThemedText type="title">
                {score} / {questions.length}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.resultText}>
                {passed ? t('learn.passed') : t('learn.failed')}
              </ThemedText>
            </ThemedView>
            {wrongIndices.length > 0 && (
              <ThemedView type="backgroundElement" style={styles.wrongList}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('practice.wrongListTitle').toUpperCase()}
                </ThemedText>
                {wrongIndices.map((qi) => {
                  const q = questions[qi];
                  if (!q) return null;
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
            {courseJustCompleted && courseCompletion && (
              <ThemedView type="backgroundSelected" style={styles.courseCompleteBanner}>
                <ThemedText type="smallBold" themeColor="accent" style={styles.courseCompleteBannerText}>
                  🏆 {t('share.courseComplete.cardTitle')}
                </ThemedText>
                <Pressable
                  onPress={() =>
                    shareCard.open({
                      kind: 'course-complete',
                      courseTitle: courseCompletion.courseTitle,
                      lessonCount: courseCompletion.allLessons.length,
                      deepLink: studyCourseDeepLink(courseCompletion.courseId),
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('share.courseComplete.shareCta')}
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedView type="backgroundElement" style={[styles.navButton, styles.shareCtaRow]}>
                    <IconSymbol name="share-outline" size={16} color={colors.accent} />
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('share.courseComplete.shareCta')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </ThemedView>
            )}
            <View style={styles.navRow}>
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type="backgroundElement" style={styles.navButton}>
                  <ThemedText type="default">↻ {t('learn.retry')}</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => backOr(backTo)}
                accessibilityRole="button"
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView type={passed && nextTo ? 'backgroundElement' : 'backgroundSelected'} style={styles.navButton}>
                  <ThemedText type="smallBold" themeColor={passed && nextTo ? 'text' : 'accent'}>
                    {t('learn.backToCourse')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              {passed && nextTo && (
                <Pressable
                  onPress={() => router.replace(nextTo)}
                  accessibilityRole="button"
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedView type="backgroundSelected" style={styles.navButton}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('learn.nextLesson')} ›
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <ShareCardModal content={shareCard.content} onClose={shareCard.close} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  easeVerseBox: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  easeVerseArabic: { fontSize: 20, lineHeight: 34, textAlign: 'right', writingDirection: 'rtl' },
  easeVerseTranslation: { fontStyle: 'italic' },
  easeVerseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  easeVerseReference: { flex: 1 },
  easeVerseExplanation: { marginTop: Spacing.one },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  stepLabel: { textAlign: 'center' },
  courseCompleteBanner: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  courseCompleteBannerText: { textAlign: 'center' },
  shareCtaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  cardArabic: { fontSize: 56, lineHeight: 90, textAlign: 'center' },
  cardLatin: { fontSize: 32, lineHeight: 44, textAlign: 'center' },
  cardIsolated: { fontSize: 32, lineHeight: 52, textAlign: 'center' },
  cardLabel: { textAlign: 'center' },
  cardText: { textAlign: 'center', lineHeight: 22 },
  fallbackNotice: { textAlign: 'center', fontStyle: 'italic' },
  explainer: { textAlign: 'center', paddingHorizontal: Spacing.three },
  pronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    marginTop: -Spacing.one,
  },
  prompt: { textAlign: 'center' },
  // flexWrap: mit dem dritten Button ("Nächste Lektion", Audit C3) lief die
  // Reihe auf Phone-Breite sonst über den Rand (live gesehen 2026-07-19).
  navRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
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
  revealBlock: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  revealLabel: { textAlign: 'center' },
  wrongList: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  wrongItem: { gap: Spacing.half },
  nextButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  optionCorrect: { backgroundColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderColor: '#4ade80' },
  optionWrong: { backgroundColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderColor: '#f87171' },
  optionArabic: { fontSize: 26, lineHeight: 44 },
  resultEmoji: { fontSize: 48, lineHeight: 64 },
  resultText: { textAlign: 'center' },
  pressableWeb: { cursor: 'pointer' },
});
