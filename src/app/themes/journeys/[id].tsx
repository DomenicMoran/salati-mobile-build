import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { useSurahList } from '@/features/quran/hooks';
import { dayKey } from '@/features/tracker/store';
import {
  completedDays,
  dayIndexForDate,
  daysBehind,
  isJourneyComplete,
  useJourneyProgress,
} from '@/features/themes/journeyProgress';
import { rescheduleJourneyReminder } from '@/features/themes/journeyReminder';
import { JOURNEYS, journeyById, type ThemeVerse } from '@/features/themes/journeys';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template — der Server kennt id
// dabei nicht (journeyById(undefined) -> undefined), der Client rendert die
// echte Reise — Server- und Client-Markup weichen voneinander ab (React
// #418, gleiches Muster wie study/[course]/index.tsx).
export function generateStaticParams() {
  return JOURNEYS.map((j) => ({ id: j.id }));
}

export default function JourneyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data: surahList } = useSurahList();
  const today = dayKey(new Date());

  const journey = journeyById(id ?? '');
  const { progress, loaded, start, toggle } = useJourneyProgress(id ?? '');

  // Erinnerung neu planen, sobald sich der Fortschritt dieser Reise ändert
  // (aktiv + noch offen → Erinnerung an; abgeschlossen/nicht gestartet → aus).
  useFocusEffect(
    useCallback(() => {
      if (!journey || !progress) return;
      const active = !isJourneyComplete(progress, journey.days.length);
      rescheduleJourneyReminder(active, active, locale);
    }, [journey, progress, locale]),
  );

  // `id` fehlt kurz während der Web-Hydration (siehe generateStaticParams-
  // Kommentar oben) - das ist ein Ladezustand, kein ungültiger Plan. Erst
  // wenn id gesetzt ist und trotzdem kein journey gefunden wird, ist die Id
  // wirklich ungültig. `loaded` kommt aus useJourneyProgress und wird jetzt
  // auch bei einem AsyncStorage-Fehler garantiert true (journeyProgress.ts)
  // - ein bare-leeres ThemedView wirkt im Dark-Mode wie ein schwarzer
  // Screen, deshalb hier immer sichtbares Feedback statt Stille.
  // Audit 2026-07-27: Beide Zweige ohne Kopf = auf nativ ohne sichtbaren
  // Ausgang (Themen-Stack: headerShown:false, Zurueck-Chip Web-only).
  if (!id || !loaded) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('journeys.title')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!journey) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('journeys.title')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const surahLabel = (surah: number) =>
    surahList?.find((s) => s.number === surah)?.englishName ?? `${t('quran.surahs')} ${surah}`;

  if (!progress) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t(journey.titleKey)} subtitle={t(journey.subtitleKey)} />
          <View style={styles.startWrap}>
            <PressableCard onPress={() => start(today)} type="backgroundSelected" style={styles.startCard}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('journeys.start')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {journey.days.length} {t('journeys.days')}
              </ThemedText>
            </PressableCard>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const done = completedDays(progress);
  const total = journey.days.length;
  const todayIndex = dayIndexForDate(progress, total, today);
  const behind = daysBehind(progress, total, today);
  const complete = isJourneyComplete(progress, total);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t(journey.titleKey)} />
        <View style={styles.progressWrap}>
          <ThemedView type="backgroundElement" style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(done / total) * 100}%` }]} />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {done}/{total}
          </ThemedText>
        </View>
        {complete ? (
          <View style={styles.behindRow}>
            <IconSymbol name="checkmark-circle" size={13} color={colors.accent} />
            <ThemedText type="small" themeColor="accent">
              {t('journeys.complete')}
            </ThemedText>
          </View>
        ) : (
          behind > 0 && (
            <View style={styles.behindRow}>
              <IconSymbol name="alarm" size={13} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {behind} {behind === 1 ? t('journeys.behindOne') : t('journeys.behind')}
              </ThemedText>
            </View>
          )
        )}

        <FlatList
          data={journey.days}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item: day, index: i }) => {
            const isToday = i === todayIndex;
            const isDone = !!progress.completed[i];
            return (
              <AnimatedListItem index={i}>
                <ThemedView type={isToday ? 'backgroundSelected' : 'backgroundElement'} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Pressable
                      onPress={() => toggle(i)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={isDone ? t('a11y.markNotDone') : t('a11y.markDone')}
                      style={({ pressed }) => [
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedView type="backgroundElement" style={[styles.check, isDone && styles.checkDone]}>
                        {isDone && <IconSymbol name="checkmark" size={14} color={colors.accent} />}
                      </ThemedView>
                    </Pressable>
                    <View style={styles.dayHeaderText}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('journeys.day')} {i + 1}
                        {isToday ? ` · ${t('tracker.today')}` : ''}
                      </ThemedText>
                      <ThemedText type="default">{t(day.titleKey)}</ThemedText>
                    </View>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.dayText}>
                    {t(day.textKey)}
                  </ThemedText>
                  <View style={styles.versesRow}>
                    {day.verses.map((v: ThemeVerse) => (
                      <Pressable
                        key={`${v.surah}:${v.ayah}`}
                        onPress={() =>
                          router.push({ pathname: '/quran/[surah]', params: { surah: v.surah, ayah: v.ayah } })
                        }
                        style={({ pressed }) => [
                          styles.verseChip,
                          Platform.OS === 'web' ? styles.pressableWeb : undefined,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedView type="background" style={styles.verseChipInner}>
                          <IconSymbol name="book-outline" size={12} color={colors.accent} />
                          <ThemedText type="small" themeColor="accent">
                            {surahLabel(v.surah)} {v.ayah}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    ))}
                  </View>
                </ThemedView>
              </AnimatedListItem>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: BackChipInset },
  startWrap: { alignItems: 'center', padding: Spacing.four },
  startCard: {
    minWidth: 200,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginVertical: Spacing.two,
  },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  behindRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginBottom: Spacing.one },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  dayCard: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dayHeaderText: { flex: 1, gap: 2 },
  dayText: { lineHeight: 20 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,124,116,0.35)',
  },
  checkDone: { borderColor: Brand.gold },
  versesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  verseChip: { borderRadius: 999 },
  verseChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
