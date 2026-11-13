import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { DocumentHeadTitle } from '@/lib/document-head-title';
import { useTranslation } from '@/lib/i18n';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <DocumentHeadTitle title={t('notFound.pageTitle')} />
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('notFound.title')} subtitle={t('notFound.subtitle')} />
          <View style={styles.links}>
            <Link href="/" asChild>
              <PressableCard type="backgroundSelected" style={styles.card}>
                <ThemedText type="default">{t('nav.home')}</ThemedText>
              </PressableCard>
            </Link>
            <Link href="/quran" asChild>
              <PressableCard type="backgroundElement" style={styles.card}>
                <ThemedText type="default">{t('nav.quran')}</ThemedText>
              </PressableCard>
            </Link>
            <Link href="/learn" asChild>
              <PressableCard type="backgroundElement" style={styles.card}>
                <ThemedText type="default">{t('nav.learn')}</ThemedText>
              </PressableCard>
            </Link>
          </View>
        </SafeAreaView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.three, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  links: { gap: Spacing.two, marginTop: Spacing.four },
  card: { padding: Spacing.three },
});
