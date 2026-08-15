// Handout-Uebersicht: die gesammelten PDF-Lernunterlagen, nach `category`
// gruppiert (Section-Header je Kategorie). Pro Unterlage eine Karte mit Titel,
// Beschreibung, Seitenzahl + Groesse und einem Offline-Download-Button.
// Antippen oeffnet den PDF-Viewer (handouts/[id].tsx) — auf Web direkt im
// Browser (Linking). Daten aus dem oeffentlichen R2-Bucket (features/handouts/
// data.ts) via react-query. Einstieg (per Merge zu verdrahten): Deep-Link
// `salatibox://handouts` bzw. router.push('/handouts') — vorgesehen als Kachel
// im „Studium"-Bereich (LERNEN_NAV in src/lib/lernenNav.ts), NICHT hier editiert.
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, FlatList, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import {
  fetchHandoutIndex,
  formatSizeKb,
  groupHandoutsByCategory,
  type Handout,
} from '@/features/handouts/data';
import { useHandoutDownload } from '@/features/handouts/downloads';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type ListRow =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'handout'; key: string; handout: Handout; itemIndex: number };

// Oeffnet eine Unterlage: nativ im In-App-Viewer, im Web direkt im Browser-Tab.
function openHandout(handout: Handout): void {
  if (Platform.OS === 'web') {
    void Linking.openURL(handout.pdf_url);
    return;
  }
  router.push({ pathname: '/handouts/[id]', params: { id: handout.id } });
}

export default function HandoutListScreen() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['handouts', 'index'],
    queryFn: fetchHandoutIndex,
    staleTime: 60 * 60 * 1000,
  });

  const handouts = data?.handouts ?? [];
  const groups = groupHandoutsByCategory(handouts);
  const multiCategory = groups.length > 1;
  const rows: ListRow[] = [];
  let itemIndex = 0;
  for (const group of groups) {
    if (multiCategory) {
      rows.push({ kind: 'section', key: `s:${group.key}`, title: group.title });
    }
    for (const h of group.handouts) {
      rows.push({ kind: 'handout', key: `h:${h.id}`, handout: h, itemIndex: itemIndex++ });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('handouts.title')} />
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<HandoutHeader />}
          renderItem={({ item }) =>
            item.kind === 'section' ? (
              <SectionHeader title={item.title} />
            ) : (
              <HandoutRow handout={item.handout} index={item.itemIndex} />
            )
          }
          ListEmptyComponent={
            <View style={styles.center}>
              {isLoading ? (
                <ThemedActivityIndicator />
              ) : (
                <EmptyState
                  icon="document-text-outline"
                  title={isError ? t('common.error') : t('handouts.empty')}
                />
              )}
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function HandoutHeader() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
        <IconSymbol name="document-text" size={40} color={colors.background} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
        {t('handouts.subtitle')}
      </ThemedText>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <View style={styles.sectionHeader}>
      <IconSymbol name="folder-outline" size={15} color={colors.textSecondary} />
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeaderText}>
        {title.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function HandoutRow({ handout, index }: { handout: Handout; index: number }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const dl = useHandoutDownload(handout);
  const downloaded = dl.state === 'done';
  const sizeLabel = formatSizeKb(handout.size_kb);

  function confirmDelete() {
    Alert.alert(t('handouts.deleteDownloadConfirmTitle'), t('handouts.deleteDownloadConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('handouts.deleteDownload'), style: 'destructive', onPress: () => void dl.remove() },
    ]);
  }

  return (
    <AnimatedListItem index={index % 12}>
      <PressableCard
        onPress={() => openHandout(handout)}
        type="backgroundElement"
        style={styles.row}>
        <View style={[styles.pdfBadge, { backgroundColor: colors.backgroundSelected }]}>
          <IconSymbol name="document-text" size={24} color={colors.accent} />
        </View>

        <View style={styles.rowText}>
          <ThemedText type="default" numberOfLines={2}>
            {handout.title}
          </ThemedText>
          {handout.description ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {handout.description}
            </ThemedText>
          ) : null}
          <View style={styles.metaRow}>
            {handout.pages && handout.pages > 0 ? (
              <View style={styles.metaBadge}>
                <IconSymbol name="reader-outline" size={13} color={colors.accent} />
                <ThemedText type="small" themeColor="accent" style={styles.metaBadgeLabel}>
                  {handout.pages} {t('handouts.pages')}
                </ThemedText>
              </View>
            ) : null}
            {sizeLabel ? (
              <View style={styles.metaBadge}>
                <IconSymbol name="cloud-download-outline" size={13} color={colors.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.metaBadgeLabel}>
                  {sizeLabel}
                </ThemedText>
              </View>
            ) : null}
            {downloaded && (
              <View style={styles.metaBadge}>
                <IconSymbol name="cloud-done" size={13} color={colors.accent} />
                <ThemedText type="small" themeColor="accent" style={styles.metaBadgeLabel}>
                  {t('handouts.offline')}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        {/* Download-Steuerung: none -> laden, downloading -> Fortschritt/abbrechen,
            done -> loeschen. Auf Web (kein Dateisystem) ist dl.supported false. */}
        {dl.supported &&
          (dl.state === 'downloading' ? (
            <Pressable
              onPress={dl.cancel}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('handouts.cancelDownload')}
              style={({ pressed }) => [styles.dlBtn, pressed && styles.pressed]}>
              {dl.progress > 0 ? (
                <ThemedText type="small" themeColor="accent" style={styles.dlPct}>
                  {Math.round(dl.progress * 100)}%
                </ThemedText>
              ) : (
                <ThemedActivityIndicator size="small" />
              )}
            </Pressable>
          ) : dl.state === 'done' ? (
            <Pressable
              onPress={confirmDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('handouts.deleteDownload')}
              style={({ pressed }) => [styles.dlBtn, pressed && styles.pressed]}>
              <IconSymbol name="cloud-done" size={20} color={colors.accent} />
            </Pressable>
          ) : (
            <Pressable
              onPress={dl.download}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('handouts.download')}
              style={({ pressed }) => [styles.dlBtn, pressed && styles.pressed]}>
              <IconSymbol name="download-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          ))}

        <DisclosureChevron size={18} color={colors.textSecondary} />
      </PressableCard>
    </AnimatedListItem>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: { alignItems: 'center', gap: Spacing.one, paddingBottom: Spacing.three, paddingTop: Spacing.two },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  headerSubtitle: { textAlign: 'center', paddingHorizontal: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.half,
    paddingHorizontal: Spacing.one,
  },
  sectionHeaderText: { letterSpacing: 0.5 },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two },
  pdfBadge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // minWidth:0 ist auf React Native Web zwingend (sonst horizontaler Overflow
  // bei langen Titeln); nativ (Yoga) ist min-width ohnehin 0.
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: 2, flexWrap: 'wrap' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaBadgeLabel: { fontSize: 11 },
  dlBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dlPct: { fontSize: 11 },
  pressed: { opacity: 0.6 },
});
