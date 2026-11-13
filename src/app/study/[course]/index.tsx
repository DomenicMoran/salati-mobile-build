import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { isLocalizedFallback, lessonTitle, type Lesson } from '@/features/learn/curriculum';
import {
  isPassed,
  isUnlockedIn,
  passedCountIn,
  useCourseProgress,
} from '@/features/learn/progress';
import { COURSE_META, courseMetaById, loadCourseLessons } from '@/features/study/courses';
import { PHASE_INTRO_VIDEO, PHASE_TABLE_VIDEO } from '@/features/video/data';
import { PhaseTableCard, PhaseVideoCard } from '@/features/video/recommendation-cards';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const EXAM_PASS_RATIO = 0.8;

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses `study/[course].html`-Template —
// der Server kennt courseId dabei nicht (courseMetaById(undefined) →
// undefined), zeigt also die Fehler-Fallback-UI. Der Client liest courseId
// danach aus der echten URL, findet den Kurs und rendert den echten Titel —
// Server- und Client-Markup weichen voneinander ab (reproduzierbarer
// Hydration-Fehler, minified React error #418, per Playwright bestätigt:
// Server-Text "Etwas ist schiefgelaufen." vs. Client-Text "Tajwid - Regeln
// der Rezitation"). Mit generateStaticParams bekommt jeder Kurs sein
// eigenes, korrekt vorgerendertes HTML (z. B. study/tajwid.html) — kein
// Mismatch mehr.
export function generateStaticParams() {
  return COURSE_META.map((c) => ({ course: c.id }));
}

export default function CourseLessonsScreen() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();
  const course = courseMetaById(courseId);
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { settings } = useSettings();
  const { progress } = useCourseProgress(course?.storageKey ?? 'salatibox:study-unknown');

  // Lektionsinhalte des Kurses erst NACH generateStaticParams/Metadaten async
  // nachladen (siehe courses.ts-Kommentar) — eigenes Chunk pro Kurs, statt
  // wie früher alle 12 Kurs-JSONs im Root-Bundle.
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!course) return;
    loadCourseLessons(course.id).then((loaded) => {
      if (!cancelled) setLessons(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [course]);

  // Dialekte-Kurs zeigt seine Lektionen einfach in natürlicher Datei-
  // Reihenfolge (nonSequential, siehe courses.ts) - die frühere manuelle
  // Gruppen-Reorder-UI wurde entfernt (unnötiges Bedienelement, User-Feedback
  // Audit 2026-07-20); sortDialectLessons/moveDialectGroup bleiben nur noch
  // als getestete Utilities in dialectOrder.ts erhalten.
  const displayLessons: Lesson[] = lessons ?? [];

  // Content-Audit 2026-07-21: nikah/dialects haben lesson.title selbst
  // (nicht nur story/quiz-Inhalte) für 8 der 14 Sprachen nicht übersetzt —
  // ein Hinweis PRO Zeile wäre bei 28 Dialekt-Lektionen reine Listen-Unruhe,
  // deshalb ein einziger Kurs-Banner statt Zeilen-Wiederholung.
  const anyLessonTitleFallback = displayLessons.some(
    (l) => l.title && isLocalizedFallback(l.title, locale),
  );

  const allPassed = lessons ? passedCountIn(lessons, progress) === lessons.length : false;
  const examResult = progress['exam'];
  const examPassed =
    !!examResult && examResult.total > 0 && examResult.score / examResult.total >= EXAM_PASS_RATIO;

  // Audit 2026-07-27: Lade- und Fehlerzweig hatten KEINEN sichtbaren Ausgang.
  // Der Studium-Stack setzt headerShown:false und der schwebende Zurueck-Chip
  // ist Web-only — ein Deep-Link auf eine unbekannte Kurs-Id landete auf nativ
  // in einer Sackgasse mit nur dem Wort "Fehler". Muster wie in reels/index.tsx,
  // wo jeder Zustand seinen Zurueck-Button rendert.
  if (!course) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('study.title')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!lessons) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t(`study.courses.${course.id}.title`)} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t(`study.courses.${course.id}.title`)} subtitle={t(`study.courses.${course.id}.desc`)} />
        {anyLessonTitleFallback && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.fallbackBanner}>
            ⓘ {t('learn.contentFallbackNotice')}
          </ThemedText>
        )}

        <FlatList
          data={displayLessons}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {/* Optionale Video-/Tabellen-Empfehlung zum Kurs (gleiches Muster
                  wie im Lern-Pfad). Beide Karten blenden sich selbst aus, wenn
                  der Kurs kein passendes Video/keine Tabelle hat oder der Index
                  den Eintrag nicht kennt. */}
              {PHASE_INTRO_VIDEO[course.id] ? (
                <PhaseVideoCard episodeNo={PHASE_INTRO_VIDEO[course.id]} />
              ) : null}
              {PHASE_TABLE_VIDEO[course.id] ? (
                <PhaseTableCard episodeNo={PHASE_TABLE_VIDEO[course.id]} />
              ) : null}
              {lessons.length > 1 ? (
              // Immer verfügbar (User-Wunsch): Einstufung für Neue, danach
              // wiederholbarer Wissens-Test — recordResult behält stets das
              // beste Ergebnis, Wiederholen kann nichts zurücksetzen.
              <PressableCard
                onPress={() =>
                  router.push({ pathname: '/study/[course]/placement', params: { course: course.id } })
                }
                type={passedCountIn(lessons, progress) === 0 ? 'backgroundSelected' : 'backgroundElement'}
                style={[styles.row, styles.placementRow]}>
                <ThemedView type="backgroundElement" style={styles.numberBadge}>
                  <IconSymbol name="rocket" size={16} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">
                    {t(
                      passedCountIn(lessons, progress) === 0
                        ? 'learn.placementCta'
                        : 'learn.placementRepeatCta',
                    )}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(
                      passedCountIn(lessons, progress) === 0
                        ? 'study.placementCtaDesc'
                        : 'learn.placementRepeatDesc',
                    )}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
              ) : null}
            </>
          }
          ListFooterComponent={
            <PressableCard
              disabled={!allPassed}
              onPress={() =>
                router.push({ pathname: '/study/[course]/exam', params: { course: course.id } })
              }
              type={examPassed ? 'backgroundSelected' : 'backgroundElement'}
              style={[styles.row, styles.examRow]}>
              <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                <ThemedText type="small">🎓</ThemedText>
              </ThemedView>
              <View style={styles.rowText}>
                <ThemedText type="default">{t('exam.title')}</ThemedText>
                <View style={styles.statusRow}>
                  {!allPassed && (
                    <IconSymbol name="lock-closed" size={12} color={colors.textSecondary} />
                  )}
                  <ThemedText type="small" themeColor={examPassed ? 'accent' : 'textSecondary'}>
                    {examPassed
                      ? `${t('exam.done')} · ${examResult.score}/${examResult.total}`
                      : allPassed
                        ? t('exam.start')
                        : t('exam.locked')}
                  </ThemedText>
                </View>
              </View>
              <DisclosureChevron size={18} color={examPassed ? colors.accent : colors.textSecondary} />
            </PressableCard>
          }
          renderItem={({ item, index }) => {
            const unlocked =
              settings.freeUnlock || course.nonSequential || isUnlockedIn(lessons, progress, item.id);
            const passed = isPassed(progress, item.id);
            const result = progress[item.id];
            return (
              <AnimatedListItem index={index}>
                <PressableCard
                  disabled={!unlocked}
                  onPress={() =>
                    router.push({
                      pathname: '/study/[course]/[lesson]',
                      params: { course: course.id, lesson: item.id },
                    })
                  }
                  type={passed ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.row}>
                  <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                    {passed ? (
                      <IconSymbol name="checkmark" size={16} color={colors.accent} />
                    ) : (
                      <ThemedText type="small">{index + 1}</ThemedText>
                    )}
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{lessonTitle(item, locale, t)}</ThemedText>
                    <View style={styles.statusRow}>
                      {!unlocked && (
                        <IconSymbol name="lock-closed" size={12} color={colors.textSecondary} />
                      )}
                      <ThemedText type="small" themeColor="textSecondary">
                        {!unlocked
                          ? t('learn.locked')
                          : result
                            ? `${result.score}/${result.total}`
                            : t('learn.start')}
                      </ThemedText>
                    </View>
                  </View>
                  <DisclosureChevron size={18} color={passed ? colors.accent : colors.textSecondary} />
                </PressableCard>
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
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  fallbackBanner: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examRow: { marginTop: Spacing.two },
  placementRow: { marginBottom: Spacing.two },
});
