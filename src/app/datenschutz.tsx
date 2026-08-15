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

export default function DatenschutzScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('datenschutz.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('datenschutz.subtitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('datenschutz.lastUpdated')}
          </ThemedText>

          <ThemedView type="backgroundSelected" style={styles.introBox}>
            <ThemedText type="small" style={styles.paragraph}>
              {t('datenschutz.intro')}
            </ThemedText>
          </ThemedView>

          <Section label={t('datenschutz.controllerSection')} text={t('datenschutz.controllerText')} />
          <Section label={t('datenschutz.noCollectionSection')} text={t('datenschutz.noCollectionText')} />
          <Section label={t('datenschutz.locationSection')} text={t('datenschutz.locationText')} />
          <Section label={t('datenschutz.notificationsSection')} text={t('datenschutz.notificationsText')} />
          <Section label={t('datenschutz.thirdPartySection')} text={t('datenschutz.thirdPartyText')} />
          <Section label={t('datenschutz.ownInfraSection')} text={t('datenschutz.ownInfraText')} />
          <Section label={t('datenschutz.aiSection')} text={t('datenschutz.aiText')} />
          <Section label={t('datenschutz.storageSection')} text={t('datenschutz.storageText')} />
          <Section label={t('datenschutz.syncSection')} text={t('datenschutz.syncText')} />
          <Section label={t('datenschutz.legalBasisSection')} text={t('datenschutz.legalBasisText')} />
          <Section label={t('datenschutz.retentionSection')} text={t('datenschutz.retentionText')} />
          <Section label={t('datenschutz.transferSection')} text={t('datenschutz.transferText')} />
          <Section label={t('datenschutz.rightsSection')} text={t('datenschutz.rightsText')} />
          <Section label={t('datenschutz.cookiesSection')} text={t('datenschutz.cookiesText')} />
          <Section label={t('datenschutz.changesSection')} text={t('datenschutz.changesText')} />
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
