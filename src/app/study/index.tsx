import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { HubBanner } from '@/components/hub-banner';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, IconBadge, MaxContentWidth, Spacing } from '@/constants/theme';
import { COURSE_META, loadAllCourses, type CourseCategory } from '@/features/study/courses';
import { loadCourseOrder, sortCoursesByOrder } from '@/features/study/courseOrder';
import { lessonTitle } from '@/features/learn/curriculum';
import {
  LEARN_PROGRESS_STORAGE_KEY,
  parseLearnProgress,
  passedCountIn,
} from '@/features/learn/progress';
import { requestNotificationPermission } from '@/features/prayer-times/notifications';
import { loadMistakeState, weakestKeys } from '@/features/study/mistakes';
import { dueCandidates, loadDueCandidates, loadReviewState } from '@/features/study/review';
import { rescheduleReviewReminder } from '@/features/study/reviewNotifications';
import { computeLearningStreak } from '@/features/study/streak';
import { useSettings } from '@/features/settings/store';
import { TIME_BUDGETS } from '@/features/settings/types';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { translate, useTranslation } from '@/lib/i18n';

export default function StudyHubScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [passedByCourse, setPassedByCourse] = useState<Record<string, number>>({});
  const [dueCount, setDueCount] = useState(0);
  const [weakCount, setWeakCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [courseOrder, setCourseOrder] = useState<string[] | null>(null);

  // Nutzer-eigene Kurs-Reihenfolge neu laden, sobald der Screen fokussiert
  // wird (z. B. Rückkehr vom Reihenfolge-anpassen-Screen).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseOrder().then((order) => {
        if (!cancelled) setCourseOrder(order);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Wiederholungs-Erinnerung neu planen, sobald sich enabled/hour ändert
  // (bzw. bei jedem Mount, z. B. App-Start/Foreground auf diesem Screen).
  // Web hat keine lokale Notification-Scheduling-API (expo-notifications-
  // Web-Stub wirft UnavailabilityError) — dort bleibt die Einstellung
  // sicht-/umschaltbar, plant aber bewusst nichts.
  //
  // Der Notification-Text wird mit dem Namen der aktuell nächstfälligen
  // Lektion gefüllt (statt generisch) — der expo-notifications DAILY-
  // Trigger legt den Text einmal beim Scheduling fest, daher wird er hier
  // bei jeder Neuplanung frisch aus dueCandidates() nachgeladen, statt
  // dauerhaft zu veralten (siehe Kommentar in reviewNotifications.ts).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      if (!settings.reviewReminderEnabled) {
        await rescheduleReviewReminder(false, settings.reviewReminderHour, settings.language);
        return;
      }
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const due = await loadDueCandidates();
      const topicName = due[0]
        ? lessonTitle(due[0].lesson, settings.language, (key) => translate(settings.language, key))
        : undefined;
      await rescheduleReviewReminder(true, settings.reviewReminderHour, settings.language, topicName);
    })();
  }, [settings.reviewReminderEnabled, settings.reviewReminderHour, settings.language]);

  // Fortschritt aller Kurse + fällige Wiederholungen + Schwächen laden.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [learnRaw, review, mistakes, courses, ...courseRaws] = await Promise.all([
          AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
          loadReviewState(),
          loadMistakeState(),
          // Lädt alle 12 Kurs-JSONs — nur dieser Screen (Studium-Hub) braucht
          // pro Kurs eine echte Fortschritts-Ratio ("3/14 Lektionen") und
          // zahlt diesen Preis daher erst beim Öffnen, statt wie früher jede
          // Route, die COURSES importierte (siehe courses.ts-Kommentar).
          loadAllCourses(),
          ...COURSE_META.map((c) => AsyncStorage.getItem(c.storageKey)),
        ]);
        const progressByCourse: Record<string, ReturnType<typeof parseLearnProgress>> = {
          learn: parseLearnProgress(learnRaw),
        };
        const entries: [string, number][] = [];
        courses.forEach((c, i) => {
          const progress = parseLearnProgress(courseRaws[i]);
          progressByCourse[c.id] = progress;
          entries.push([c.id, passedCountIn(c.lessons, progress)]);
        });
        if (cancelled) return;
        setPassedByCourse(Object.fromEntries(entries));
        const coursesLessons = Object.fromEntries(courses.map((c) => [c.id, c.lessons]));
        setDueCount(dueCandidates(progressByCourse, review, undefined, coursesLessons).length);
        setWeakCount(weakestKeys(mistakes, 5).length);
        // Tagesziel: heute abgeschlossene (bestandene) Lektionen über alle Kurse
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayMs = startOfDay.getTime();
        let today = 0;
        const passedTimestamps: number[] = [];
        for (const progress of Object.values(progressByCourse)) {
          for (const r of Object.values(progress)) {
            if (r.total > 0 && r.score / r.total >= 0.7) {
              passedTimestamps.push(r.completedAt);
              if (r.completedAt >= todayMs) today++;
            }
          }
        }
        setTodayCount(today);
        setStreak(computeLearningStreak(passedTimestamps));
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const visibleCourses = COURSE_META.filter((c) => c.lessonCount > 0);
  const sectionOrder: CourseCategory[] = ['quranArabic', 'islamicStudies', 'bonus'];
  const sections = sectionOrder
    .map((category) => ({
      category,
      title: t(`study.sections.${category}`),
      data: sortCoursesByOrder(visibleCourses.filter((c) => c.category === category), courseOrder),
    }))
    .filter((s) => s.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('study.title')} subtitle={t('study.subtitle')} />
        {/* Streak + Tagesziel kompakt in EINER Zeile (Audit 2026-07-22 P2):
            vorher stapelte der Kopf Titel + Untertitel + Streak-Badge +
            Tagesziel-Zeile untereinander und schob die Kernliste weit nach
            unten. */}
        <View style={styles.metaRow}>
          {streak > 0 && (
            <ThemedView type="backgroundSelected" style={styles.streakBadge}>
              <IconSymbol name="flame" size={14} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent">
                {streak === 1 ? t('study.streakOne') : t('study.streak').replace('{n}', String(streak))}
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText
            type="smallBold"
            themeColor={todayCount >= TIME_BUDGETS[settings.dailyMinutes].lessonsPerDay ? 'accent' : 'textSecondary'}>
            {t('study.todayGoal')
              .replace('{x}', String(todayCount))
              .replace('{y}', String(TIME_BUDGETS[settings.dailyMinutes].lessonsPerDay))}
          </ThemedText>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {section.title}
            </ThemedText>
          )}
          ListHeaderComponent={
            <View style={styles.headerCards}>
              <HubBanner source={require('../../../assets/images/guides/quran.jpg')} noPadding />
              <PressableCard
                onPress={() => router.push('/study/review')}
                type="backgroundSelected"
                style={styles.row}>
                <ThemedView type="backgroundElement" style={styles.iconBadge}>
                  <IconSymbol name="refresh" size={18} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{t('review.title')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {dueCount > 0 ? `${dueCount} ${t('review.due')}` : t('review.emptyTitle')}
                  </ThemedText>
                </View>
                {dueCount > 0 && (
                  <ThemedView type="backgroundElement" style={styles.badge}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {dueCount}
                    </ThemedText>
                  </ThemedView>
                )}
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
              <PressableCard
                onPress={() => router.push('/study/weekly-review')}
                type="backgroundSelected"
                style={styles.row}>
                <ThemedView type="backgroundElement" style={styles.iconBadge}>
                  <IconSymbol name="stats-chart" size={18} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{t('study.weeklyReview.cta')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('study.weeklyReview.ctaDesc')}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
              <PressableCard
                onPress={() => router.push('/study/reorder')}
                type="backgroundSelected"
                style={styles.row}>
                <ThemedView type="backgroundElement" style={styles.iconBadge}>
                  <IconSymbol name="swap-vertical" size={18} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{t('study.reorder.cta')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('study.reorder.ctaDesc')}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
              {weakCount > 0 && (
                <PressableCard
                  onPress={() => router.push('/study/weak')}
                  type="backgroundSelected"
                  style={styles.row}>
                  <ThemedView type="backgroundElement" style={styles.iconBadge}>
                    <IconSymbol name="fitness" size={18} color={colors.accent} />
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{t('weak.title')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('weak.suggest')}
                    </ThemedText>
                  </View>
                  <DisclosureChevron size={18} color={colors.textSecondary} />
                </PressableCard>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const done = passedByCourse[item.id] ?? 0;
            return (
              <AnimatedListItem index={index}>
                <PressableCard
                  onPress={() =>
                    router.push({ pathname: '/study/[course]', params: { course: item.id } })
                  }
                  style={styles.row}>
                  <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                    <IconSymbol name={item.icon} size={18} color={colors.accent} />
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{t(`study.courses.${item.id}.title`)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`study.courses.${item.id}.desc`)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor={done > 0 ? 'accent' : 'textSecondary'}>
                    {done}/{item.lessonCount}
                  </ThemedText>
                  <DisclosureChevron size={18} color={colors.textSecondary} />
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: 3,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
  },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: IconBadge.row,
    height: IconBadge.row,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
  headerCards: { gap: Spacing.two, marginBottom: Spacing.two },
  sectionHeader: { paddingTop: Spacing.three, paddingBottom: Spacing.one, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
