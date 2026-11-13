import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HandoutRemotePdfViewer } from '@/components/handout-remote-pdf-viewer';
import { pdfUrlWithStartPage } from '@/features/handouts/pdfSource';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { useTranslation } from '@/lib/i18n';

export default function HandoutRemotePdfScreen() {
  const { url, title, page } = useLocalSearchParams<{ url?: string; title?: string; page?: string }>();
  const { t } = useTranslation();
  const rawUrl = typeof url === 'string' ? decodeURIComponent(url) : '';
  const pageNum = typeof page === 'string' ? Number.parseInt(page, 10) : NaN;
  const pdfUrl = pdfUrlWithStartPage(rawUrl, Number.isFinite(pageNum) ? pageNum : undefined);
  const screenTitle = typeof title === 'string' ? decodeURIComponent(title) : t('handouts.read');

  if (!pdfUrl.trim()) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('handouts.title')} />
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={screenTitle} />
        <HandoutRemotePdfViewer title={screenTitle} pdfUrl={pdfUrl} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
