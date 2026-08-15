import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { buildGapWords, knownAyahNumbers, type GapWord } from '@/features/hifz/gapTest';
import { useHifzProgress, type HifzProgress } from '@/features/hifz/progress';
import { useSurahReading } from '@/features/quran/hooks';
import { useSettings } from '@/features/settings/store';
import { backOr } from '@/lib/nav';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

/**
 * Auswendiglern-Test OHNE Mikrofon/Ton — für die "in der Bahn, kein Ton"-
 * Situation (Ergänzung zum Aufsage-Check in [surah].tsx, der ein Mikrofon
 * braucht). Testet ausschließlich bereits als "Kann ich" markierte Verse:
 * Wörter werden zufällig verdeckt, Antippen deckt sie einzeln auf, am Ende
 * jedes Verses folgt eine Selbsteinschätzung statt einer automatischen
 * Bewertung (es gibt ja keine Aufnahme, die man auswerten könnte).
 */
export default function HifzGapTestScreen() {
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const surahNumber = Number(surah);
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { progress, mark, loaded: progressLoaded } = useHifzProgress();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading, isError } = useSurahReading(
    surahNumber,
    settings.quranTranslation,
    settings.quranReciter,
  );
  const ayahs = data?.ayahs ?? [];

  // Warteschlange der zu testenden Verse: aus dem Hifz-Fortschritt abgeleitet
  // (Render-Anpassung, kein Effect — sonst ein Frame Verzögerung/Flash bis
  // zum ersten echten Fortschritts-Load). Sobald die Runde läuft (started),
  // NICHT mehr live aus `progress` neu ableiten — sonst würde ein "Nochmal
  // üben" mitten in der Runde (das den Vers aus "known" entfernt) die Liste
  // unter den bereits vergebenen Indizes verschieben.
  const [queue, setQueue] = useState<number[]>([]);
  const [syncedProgress, setSyncedProgress] = useState<HifzProgress | null>(null);
  const [syncedSurah, setSyncedSurah] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  if (!started && (progress !== syncedProgress || surahNumber !== syncedSurah)) {
    setSyncedProgress(progress);
    setSyncedSurah(surahNumber);
    setQueue(knownAyahNumbers(progress, surahNumber));
  }

  const [results, setResults] = useState({ correct: 0, retry: 0 });
  const [sessionTotal, setSessionTotal] = useState(0);

  const currentAyahNumber = queue[0] ?? null;
  const ayah = ayahs.find((a) => a.numberInSurah === currentAyahNumber);

  // Lücken-Wörter + aufgedeckte Indizes: pro Vers frisch gewürfelt. Als
  // Render-Anpassung (nicht per Effect) gesetzt, damit beim Verswechsel kein
  // Frame mit den alten Lücken aufblitzt (gleiches Muster wie der
  // index-Vergleich in [surah].tsx).
  const [gapWordsFor, setGapWordsFor] = useState<number | null>(null);
  const [gapWords, setGapWords] = useState<GapWord[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  if (ayah && gapWordsFor !== ayah.numberInSurah) {
    setGapWordsFor(ayah.numberInSurah);
    setGapWords(buildGapWords(ayah.arabic));
    setRevealed(new Set());
  }

  function revealWord(i: number) {
    setRevealed((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }

  function assess(result: 'correct' | 'retry') {
    if (!ayah) return;
    if (!started) {
      setStarted(true);
      setSessionTotal(queue.length);
    }
    if (result === 'retry') mark(surahNumber, ayah.numberInSurah, 'learning');
    setResults((prev) => ({ ...prev, [result]: prev[result] + 1 }));
    setQueue((q) => q.slice(1));
  }

  function restart() {
    setStarted(false);
    setResults({ correct: 0, retry: 0 });
    setSessionTotal(0);
    setQueue(knownAyahNumbers(progress, surahNumber));
  }

  const finished = started && queue.length === 0;
  const answeredCount = results.correct + results.retry;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {Platform.OS !== 'web' && (
            <Pressable
              onPress={() => backOr({ pathname: '/hifz/[surah]', params: { surah: surahNumber } })}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.close')}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <IconSymbol name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
          <ThemedText type="subtitle">{t('hifz.gapTest.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data?.meta.englishName ?? ''}
          </ThemedText>
        </View>

        {(isLoading || !progressLoaded) && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('quran.loadError')}
            </ThemedText>
          </View>
        )}

        {!isLoading && !isError && progressLoaded && !started && queue.length === 0 && (
          <EmptyState
            icon="eye-off-outline"
            title={t('hifz.gapTest.noKnownVerses')}
            actionLabel={t('hifz.gapTest.backCta')}
            onAction={() => backOr({ pathname: '/hifz/[surah]', params: { surah: surahNumber } })}
          />
        )}

        {!isLoading && !isError && progressLoaded && finished && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedView type="backgroundElement" style={styles.summaryCard}>
              <IconSymbol name="ribbon-outline" size={32} color={colors.accent} />
              <ThemedText type="subtitle" style={styles.center1}>
                {t('hifz.gapTest.summaryTitle')}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.center1}>
                {t('hifz.gapTest.summaryResult')
                  .replace('{correct}', String(results.correct))
                  .replace('{total}', String(answeredCount))}
              </ThemedText>
              <View style={styles.summaryActions}>
                <PressableCard onPress={restart} style={styles.summaryButton}>
                  <ThemedText type="default">{t('hifz.gapTest.restartCta')}</ThemedText>
                </PressableCard>
                <PressableCard
                  onPress={() => backOr({ pathname: '/hifz/[surah]', params: { surah: surahNumber } })}
                  type="backgroundSelected"
                  style={styles.summaryButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('hifz.gapTest.doneCta')}
                  </ThemedText>
                </PressableCard>
              </View>
            </ThemedView>
          </ScrollView>
        )}

        {!isLoading && !isError && progressLoaded && !finished && ayah && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center1}>
              {t('hifz.gapTest.progressLabel')
                .replace('{current}', String(answeredCount + 1))
                .replace('{total}', String(sessionTotal || queue.length + answeredCount))}
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.wordsRow}>
                {gapWords.map((w, i) =>
                  !w.hidden || revealed.has(i) ? (
                    <ThemedText key={i} style={styles.word}>
                      {w.text}
                    </ThemedText>
                  ) : (
                    <Pressable
                      key={i}
                      onPress={() => revealWord(i)}
                      accessibilityRole="button"
                      accessibilityLabel={t('hifz.gapTest.revealWordA11y')}
                      style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                      <ThemedView type="backgroundSelected" style={styles.gapChip}>
                        <ThemedText style={styles.word}>
                          {'▁'.repeat(Math.min(6, Math.max(3, Math.ceil(w.text.length / 2))))}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ),
                )}
              </View>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center1}>
              {t('hifz.gapTest.tapGapHint')}
            </ThemedText>

            <View style={styles.assessRow}>
              <PressableCard
                onPress={() => assess('retry')}
                style={[styles.assessButton, styles.chipRow]}>
                <IconSymbol name="refresh" size={14} color={colors.text} />
                <ThemedText type="default">{t('hifz.gapTest.retryBtn')}</ThemedText>
              </PressableCard>
              <PressableCard
                onPress={() => assess('correct')}
                type="backgroundSelected"
                style={[styles.assessButton, styles.chipRow]}>
                <IconSymbol name="checkmark" size={14} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('hifz.gapTest.correctBtn')}
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
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  center1: { textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  card: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    minHeight: 140,
    justifyContent: 'center',
  },
  wordsRow: {
    flexDirection: 'row-reverse', // RTL: erstes Vers-Wort rechts
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  word: { fontSize: 26, lineHeight: 46 },
  gapChip: { paddingHorizontal: 6, borderRadius: 6 },
  assessRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  assessButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryCard: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
    borderRadius: Spacing.three,
  },
  summaryActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  summaryButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
