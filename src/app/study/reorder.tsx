// Kurs-Reihenfolge im Studium-Hub anpassen: Auf/Ab-Pfeile statt Drag-and-Drop
// (robuster auf Touch, siehe app/study/index.tsx). Die Kategorie-Gruppierung
// selbst bleibt fix - nur die Reihenfolge INNERHALB jeder Kategorie ist
// änderbar, das entspricht der bestehenden Hub-Darstellung besser als eine
// freie globale Sortierung über Kategorie-Grenzen hinweg.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { COURSE_META, type CourseCategory } from '@/features/study/courses';
import { loadCourseOrder, moveId, saveCourseOrder, sortCoursesByOrder } from '@/features/study/courseOrder';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const SECTION_ORDER: CourseCategory[] = ['quranArabic', 'islamicStudies', 'bonus'];
const VISIBLE_COURSES = COURSE_META.filter((c) => c.lessonCount > 0);

function defaultOrderByCategory(): Record<CourseCategory, string[]> {
  const result = {} as Record<CourseCategory, string[]>;
  for (const category of SECTION_ORDER) {
    result[category] = VISIBLE_COURSES.filter((c) => c.category === category).map((c) => c.id);
  }
  return result;
}

function flatten(orderByCategory: Record<CourseCategory, string[]>): string[] {
  return SECTION_ORDER.flatMap((category) => orderByCategory[category]);
}

export default function StudyReorderScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [orderByCategory, setOrderByCategory] = useState<Record<CourseCategory, string[]>>(
    defaultOrderByCategory(),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseOrder().then((saved) => {
        if (cancelled) return;
        const result = {} as Record<CourseCategory, string[]>;
        for (const category of SECTION_ORDER) {
          const categoryCourses = VISIBLE_COURSES.filter((c) => c.category === category);
          result[category] = sortCoursesByOrder(categoryCourses, saved).map((c) => c.id);
        }
        setOrderByCategory(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  function move(category: CourseCategory, index: number, direction: 'up' | 'down') {
    setOrderByCategory((prev) => {
      const next = { ...prev, [category]: moveId(prev[category], index, direction) };
      saveCourseOrder(flatten(next)).catch(() => {});
      return next;
    });
  }

  function reset() {
    const defaults = defaultOrderByCategory();
    setOrderByCategory(defaults);
    saveCourseOrder([]).catch(() => {});
  }

  const sections = SECTION_ORDER.map((category) => ({
    category,
    title: t(`study.sections.${category}`),
    data: orderByCategory[category].map((id) => VISIBLE_COURSES.find((c) => c.id === id)!),
  })).filter((s) => s.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('study.reorder.title')} subtitle={t('study.reorder.subtitle')} />

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
          renderItem={({ item, index, section }) => {
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;
            return (
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name={item.icon} size={18} color={colors.accent} />
                </ThemedView>
                <ThemedText type="default" style={styles.rowText}>
                  {t(`study.courses.${item.id}.title`)}
                </ThemedText>
                <Pressable
                  disabled={isFirst}
                  accessibilityRole="button"
                  accessibilityLabel={t('study.reorder.moveUp')}
                  onPress={() => move(section.category, index, 'up')}
                  style={[styles.arrowButton, isFirst && styles.arrowButtonDisabled]}>
                  <IconSymbol name="chevron-up" size={20} color={isFirst ? colors.textSecondary : colors.accent} />
                </Pressable>
                <Pressable
                  disabled={isLast}
                  accessibilityRole="button"
                  accessibilityLabel={t('study.reorder.moveDown')}
                  onPress={() => move(section.category, index, 'down')}
                  style={[styles.arrowButton, isLast && styles.arrowButtonDisabled]}>
                  <IconSymbol name="chevron-down" size={20} color={isLast ? colors.textSecondary : colors.accent} />
                </Pressable>
              </ThemedView>
            );
          }}
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              onPress={reset}
              style={styles.resetButton}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('study.reorder.reset')}
              </ThemedText>
            </Pressable>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  sectionHeader: { paddingTop: Spacing.three, paddingBottom: Spacing.one, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 20,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  arrowButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: { opacity: 0.35 },
  resetButton: { alignSelf: 'center', marginTop: Spacing.three, padding: Spacing.two },
});
