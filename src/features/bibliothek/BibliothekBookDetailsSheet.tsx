import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BibliothekHubCover } from '@/features/bibliothek/hub/BibliothekHubCover';
import type { BibliothekBookDetails } from '@/features/bibliothek/bookManifestDetails';
import { ThemedText } from '@/components/themed-text';
import { PressableCard } from '@/components/ui/pressable-card';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type Props = {
  visible: boolean;
  details: BibliothekBookDetails | null;
  onClose: () => void;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

export function BibliothekBookDetailsSheet({ visible, details, onClose }: Props) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  if (!details) return null;

  const openLink = (url?: string) => {
    if (!url?.trim()) return;
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
      importantForAccessibility="yes">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('a11y.close')} />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <BibliothekHubCover title={details.title} />
            <View style={styles.headerText}>
              <ThemedText type="subtitle">{details.title}</ThemedText>
              {details.description ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {details.description}
                </ThemedText>
              ) : null}
            </View>
          </View>
          {details.author ? <MetaRow label={t('bibliothek.detailsAuthor')} value={details.author} /> : null}
          {details.translator ? (
            <MetaRow label={t('bibliothek.detailsTranslator')} value={details.translator} />
          ) : null}
          {details.lang ? <MetaRow label={t('bibliothek.detailsLang')} value={details.lang.toUpperCase()} /> : null}
          {details.pages != null ? (
            <MetaRow
              label={t('bibliothek.detailsPages')}
              value={t('bibliothek.hub.pagesMeta').replace('{{pages}}', String(details.pages))}
            />
          ) : null}
          {details.category ? <MetaRow label={t('bibliothek.detailsCategory')} value={details.category} /> : null}
          {details.edition ? <MetaRow label={t('bibliothek.detailsEdition')} value={details.edition} /> : null}
          {details.license ? <MetaRow label={t('bibliothek.detailsLicense')} value={details.license} /> : null}
          {details.sourceLink ? (
            <PressableCard onPress={() => openLink(details.sourceLink)} style={styles.linkCard}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('bibliothek.detailsSource')}
              </ThemedText>
            </PressableCard>
          ) : null}
          {details.licenseLink && details.licenseLink !== details.sourceLink ? (
            <PressableCard onPress={() => openLink(details.licenseLink)} style={styles.linkCard}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('bibliothek.detailsLicenseDoc')}
              </ThemedText>
            </PressableCard>
          ) : null}
        </ScrollView>
        <PressableCard onPress={onClose} style={styles.closeBtn}>
          <ThemedText type="smallBold">{t('a11y.close')}</ThemedText>
        </PressableCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two },
  header: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  headerText: { flex: 1, gap: Spacing.one },
  row: { gap: Spacing.half },
  label: { textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { flexShrink: 1 },
  linkCard: { padding: Spacing.two },
  closeBtn: { marginHorizontal: Spacing.three, padding: Spacing.two, alignItems: 'center' },
});
