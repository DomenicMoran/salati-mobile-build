// Begriff-Detailansicht (Reiter "Grammatik & Ṣarf"): vollständiger Lehrtext
// aus data/erklaerungen/de-*.json — Erklärung, Erkennungsmerkmale,
// antippbare Koranbelege (Sprung in den Reader), Lernhinweise, verknüpfte
// Formentabellen (paradigmen.json/paradigmen-verben.json) und
// Querverweise ("siehe") auf andere Begriffe desselben Bereichs.
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { Aufklappbar } from '@/features/quran/analyse/Aufklappbar';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { useErklaerungen } from '@/features/lexikon/erklaerungenLoader';
import type { ErklaerungBeleg, ErklaerungenBereich } from '@/features/lexikon/erklaerungenTypes';
import { ParadigmTable } from '@/features/lexikon/ParadigmTable';
import { useParadigmTabelle } from '@/features/lexikon/paradigmenLoader';

export default function BegriffDetailScreen() {
  const { bereich, id } = useLocalSearchParams<{ bereich: ErklaerungenBereich; id: string }>();
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading, isError } = useErklaerungen(bereich);
  const entry = data?.eintraege[id ?? ''];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={entry?.titel ?? ''} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {isLoading ? (
            <View style={styles.center}>
              <ThemedActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : isError ? (
            <EmptyState icon="alert-circle-outline" title={t('lexikon.grammar.loadError')} />
          ) : !entry ? (
            <EmptyState icon="alert-circle-outline" title={t('lexikon.grammar.notFound')} />
          ) : (
            <>
              <View style={styles.headRow}>
                <ThemedText type="title" style={styles.arabicBig}>
                  {entry.ar}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.umschrift}
                </ThemedText>
              </View>

              {entry.erklaerung.map((absatz, i) => (
                <ThemedText key={i} type="default" style={[styles.paragraph, rtl && styles.textRtl]}>
                  {absatz}
                </ThemedText>
              ))}

              {entry.erkennung.length > 0 ? (
                <Aufklappbar titel={t('lexikon.grammar.sectionErkennung')} defaultOffen>
                  {entry.erkennung.map((punkt, i) => (
                    <BulletLine key={i} text={punkt} rtl={rtl} />
                  ))}
                </Aufklappbar>
              ) : null}

              {entry.belege.length > 0 ? (
                <Aufklappbar titel={t('lexikon.grammar.sectionBelege')} defaultOffen>
                  {entry.belege.map((beleg, i) => (
                    <BelegRow key={i} beleg={beleg} rtl={rtl} borderColor={colors.separator} />
                  ))}
                </Aufklappbar>
              ) : null}

              {entry.lernen.length > 0 ? (
                <Aufklappbar titel={t('lexikon.grammar.sectionLernen')} defaultOffen>
                  {entry.lernen.map((punkt, i) => (
                    <BulletLine key={i} text={punkt} rtl={rtl} />
                  ))}
                </Aufklappbar>
              ) : null}

              {entry.tabellen.length > 0 ? (
                <Aufklappbar titel={t('lexikon.grammar.sectionTabellen')} defaultOffen>
                  {entry.tabellen.map((tableId) => (
                    <ParadigmTableLoader key={tableId} tableId={tableId} />
                  ))}
                </Aufklappbar>
              ) : null}

              {entry.siehe.length > 0 ? (
                <Aufklappbar titel={t('lexikon.grammar.sectionSiehe')} defaultOffen>
                  <View style={[styles.siehRow, rtl && styles.siehRowRtl]}>
                    {entry.siehe.map((verweisId) => {
                      const verweisEntry = data?.eintraege[verweisId];
                      if (!verweisEntry) return null;
                      return (
                        <Pressable
                          key={verweisId}
                          onPress={() => router.push({ pathname: '/lexikon/begriff/[bereich]/[id]', params: { bereich, id: verweisId } })}
                          accessibilityRole="button">
                          <ThemedView type="backgroundElement" style={styles.siehChip}>
                            <ThemedText type="small" themeColor="accent">
                              {verweisEntry.umschrift}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      );
                    })}
                  </View>
                </Aufklappbar>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function BulletLine({ text, rtl }: { text: string; rtl: boolean }) {
  return (
    <View style={[styles.bulletRow, rtl && styles.bulletRowRtl]}>
      <ThemedText type="small" themeColor="textSecondary">
        •
      </ThemedText>
      <ThemedText type="small" style={[styles.bulletText, rtl && styles.textRtl]}>
        {text}
      </ThemedText>
    </View>
  );
}

function BelegRow({ beleg, rtl, borderColor }: { beleg: ErklaerungBeleg; rtl: boolean; borderColor: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/quran/[surah]', params: { surah: beleg.sure, ayah: beleg.vers } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.belegRow, { borderColor }, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor="accent">
        {beleg.sure}:{beleg.vers}
      </ThemedText>
      <ThemedText type="small" style={rtl && styles.textRtl}>
        {beleg.zeigt}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
        {beleg.warum}
      </ThemedText>
    </Pressable>
  );
}

function ParadigmTableLoader({ tableId }: { tableId: string }) {
  const { data, isLoading } = useParadigmTabelle(tableId);
  if (isLoading) return <ThemedActivityIndicator />;
  if (!data) return null;
  return <ParadigmTable table={data} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, marginBottom: Spacing.three },
  arabicBig: { fontSize: 32 },
  paragraph: { marginBottom: Spacing.two, lineHeight: 24 },
  textRtl: { textAlign: 'right' },
  bulletRow: { flexDirection: 'row', gap: Spacing.one, marginBottom: Spacing.one },
  bulletRowRtl: { flexDirection: 'row-reverse' },
  bulletText: { flex: 1 },
  belegRow: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
    marginBottom: Spacing.three,
    gap: 2,
  },
  pressed: { opacity: 0.6 },
  siehRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  siehRowRtl: { flexDirection: 'row-reverse' },
  siehChip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 999 },
});
