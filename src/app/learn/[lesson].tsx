import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { backOr } from '@/lib/nav';
import { BackChipInset, Spacing } from '@/constants/theme';
import { LessonPlayer } from '@/features/learn/LessonPlayer';
import { LESSONS, lessonById } from '@/features/learn/curriculum';
import { useLearnProgress } from '@/features/learn/progress';
import { useTranslation } from '@/lib/i18n';

export default function LessonScreen() {
  const { lesson: lessonId } = useLocalSearchParams<{ lesson: string }>();
  const lesson = lessonById(lessonId);
  const { t } = useTranslation();
  const { record } = useLearnProgress();

  // Audit 2026-07-28: Unbekannte Lektions-Id (alter Deep-Link, geloeschte
  // Lektion) zeigte nur "Fehler" — ohne Kopf und damit auf nativ ohne
  // sichtbaren Ausgang. Der Erfolgsfall unten bringt seinen Schliessen-Knopf
  // ueber den LessonPlayer mit, dieser Zweig hatte gar keinen.
  if (!lesson) {
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

  // Direktsprung zur Folge-Lektion im Ergebnis-Screen (Audit 2026-07-19 C3)
  const pos = LESSONS.findIndex((l) => l.id === lesson.id);
  const nextLesson = pos >= 0 ? LESSONS[pos + 1] : undefined;

  return (
    <LessonPlayer
      lesson={lesson}
      backTo="/learn"
      record={record}
      courseId="learn"
      nextTo={nextLesson ? { pathname: '/learn/[lesson]', params: { lesson: nextLesson.id } } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
});
