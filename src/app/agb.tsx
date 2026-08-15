import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

function Section({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.sectionBody}>
        <ThemedText type="small" style={styles.paragraph}>
          {text}
        </ThemedText>
      </ThemedView>
    </View>
  );
}

export default function AgbScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('agb.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('agb.subtitle')}
          </ThemedText>

          <ThemedView type="backgroundSelected" style={styles.introBox}>
            <ThemedText type="small" style={styles.paragraph}>
              {t('agb.intro')}
            </ThemedText>
          </ThemedView>

          <Section label={t('agb.scopeSection')} text={t('agb.scopeText')} />
          <Section label={t('agb.freeUseSection')} text={t('agb.freeUseText')} />
          <Section label={t('agb.religiousContentSection')} text={t('agb.religiousContentText')} />
          <Section label={t('agb.aiSection')} text={t('agb.aiText')} />
          <Section label={t('agb.externalSourcesSection')} text={t('agb.externalSourcesText')} />
          <Section label={t('agb.personalUseSection')} text={t('agb.personalUseText')} />
          <Section label={t('agb.sourcesSection')} text={t('agb.sourcesText')} />
          <Section label={t('agb.liabilitySection')} text={t('agb.liabilityText')} />
          <Section label={t('agb.changesSection')} text={t('agb.changesText')} />
          <Section label={t('agb.lawSection')} text={t('agb.lawText')} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { marginBottom: Spacing.two },
  introBox: { padding: Spacing.four, borderRadius: Spacing.three, marginBottom: Spacing.two },
  section: { gap: Spacing.two },
  sectionLabel: { marginLeft: Spacing.one },
  sectionBody: { padding: Spacing.four, borderRadius: Spacing.three },
  paragraph: { lineHeight: 20 },
});
