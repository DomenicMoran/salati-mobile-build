import { useLocalSearchParams, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Spacing } from '@/constants/theme';
import {
  ABC_FIRST_CORE_LESSON,
  ABC_LESSONS,
  ABC_PROGRESS_STORAGE_KEY,
  abcLessonById,
} from '@/features/learn/abc/curriculum';
import { LessonPlayer } from '@/features/learn/LessonPlayer';
import { useCourseProgress } from '@/features/learn/progress';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

export function generateStaticParams() {
  return ABC_LESSONS.map((lesson) => ({ lesson: lesson.id }));
}

export default function AbcLessonScreen() {
  const { lesson: lessonId } = useLocalSearchParams<{ lesson: string }>();
  const lesson = abcLessonById(lessonId);
  const { t, locale } = useTranslation();
  const { record } = useCourseProgress(ABC_PROGRESS_STORAGE_KEY);

  if (!lesson) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('learn.abc.title')} onBack={() => backOr('/learn')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const pos = ABC_LESSONS.findIndex((l) => l.id === lesson.id);
  const nextLesson = ABC_LESSONS[pos + 1];
  const bridgeNext: Href | undefined =
    pos === ABC_LESSONS.length - 1
      ? ({ pathname: '/learn/[lesson]', params: { lesson: ABC_FIRST_CORE_LESSON } } as Href)
      : nextLesson
        ? (`/learn/abc/${nextLesson.id}` as unknown as Href)
        : undefined;

  return (
    <LessonPlayer
      lesson={lesson}
      backTo="/learn"
      record={record}
      courseId="abc"
      nextTo={bridgeNext}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
});
