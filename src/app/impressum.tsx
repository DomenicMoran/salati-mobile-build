import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.sectionBody}>
        {children}
      </ThemedView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function ImpressumScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('impressum.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('impressum.subtitle')}
          </ThemedText>

          <Section label={t('impressum.providerSection')}>
            <Row label={t('impressum.company')} value={t('impressum.companyValue')} />
            <Row label={t('impressum.owner')} value={t('impressum.ownerValue')} />
            <Row label={t('impressum.address')} value={t('impressum.addressValue')} />
          </Section>

          {/* Eine einheitliche Identitaet fuer Salati (Audit 2026-07-27): Firmierung,
              E-Mail und Website muessen in Impressum, App-Feedback, Play- und
              App-Store-Eintrag identisch sein. menucloud-berlin.de ist ein anderes
              Projekt und darf hier nicht auftauchen. */}
          <Section label={t('impressum.contactSection')}>
            <Row label={t('impressum.phone')} value="+49 30 767 645 46" />
            <Row label={t('impressum.email')} value="info@menucloud-berlin.de" />
            <Row label={t('impressum.website')} value="salati.pro" />
          </Section>

          <Section label={t('impressum.taxSection')}>
            <Row label={t('impressum.smallBusiness')} value={t('impressum.smallBusinessValue')} />
            <Row label={t('impressum.vatId')} value="DE461628017" />
          </Section>

          <Section label={t('impressum.responsibleSection')}>
            <ThemedText type="small" style={styles.paragraph}>
              {t('impressum.responsibleText')}
            </ThemedText>
          </Section>

          {/* Der frueher hier stehende Verweis auf die EU-Online-Streitbeilegungs-
              plattform (ec.europa.eu/consumers/odr) ist entfallen: die Plattform
              wurde von der EU-Kommission eingestellt, ein Hinweis darauf ist eine
              ueberholte Pflichtangabe. Der VSBG-Satz bleibt. */}
          <Section label={t('impressum.disputeSection')}>
            <ThemedText type="small" style={styles.paragraph}>
              {t('impressum.disputeVsbgText')}
            </ThemedText>
          </Section>

          <Section label={t('impressum.liabilitySection')}>
            <ThemedText type="smallBold" style={styles.paragraphTitle}>
              {t('impressum.liabilityContentTitle')}
            </ThemedText>
            <ThemedText type="small" style={styles.paragraph}>
              {t('impressum.liabilityContentText')}
            </ThemedText>
            <ThemedText type="smallBold" style={[styles.paragraphTitle, styles.paragraphSpaced]}>
              {t('impressum.liabilityLinksTitle')}
            </ThemedText>
            <ThemedText type="small" style={styles.paragraph}>
              {t('impressum.liabilityLinksText')}
            </ThemedText>
            <ThemedText type="smallBold" style={[styles.paragraphTitle, styles.paragraphSpaced]}>
              {t('impressum.copyrightTitle')}
            </ThemedText>
            <ThemedText type="small" style={styles.paragraph}>
              {t('impressum.copyrightText')}
            </ThemedText>
          </Section>
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
  subtitle: { marginBottom: Spacing.three },
  section: { gap: Spacing.two },
  sectionLabel: { marginLeft: Spacing.one },
  sectionBody: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three },
  row: { gap: Spacing.half },
  rowValue: { lineHeight: 22 },
  paragraph: { lineHeight: 20 },
  paragraphTitle: {},
  paragraphSpaced: { marginTop: Spacing.two },
});
