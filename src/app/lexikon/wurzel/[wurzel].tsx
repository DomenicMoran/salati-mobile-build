// Wurzel-Detailansicht: alle abgeleiteten Wortformen (gruppiert nach
// Wortart, je mit Häufigkeit) und die Belegstellen (Sure:Vers, tippbar zum
// Sprung in den Reader). Belegliste bei sehr häufigen Wurzeln begrenzt statt
// tausende Zeilen zu rendern — siehe MAX_OCCURRENCE_CHIPS.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { Wortart } from '@/features/quran/grammatik';
import type { MorphVorkommen } from '@/features/quran/morphologieTypen';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { useGrammatikTerm, useLocaleTerm } from '@/features/lexikon/grammatikTerm';
import { useLemmata, useRootWordforms, useWurzeln } from '@/features/lexikon/hooks';
import { groupWordformsByWortart, type RootOccurrence } from '@/features/lexikon/rootIndex';
import { TermLabel } from '@/features/lexikon/TermLabel';

const MAX_OCCURRENCE_CHIPS = 200;

export default function WurzelDetailScreen() {
  const { wurzel } = useLocalSearchParams<{ wurzel: string }>();
  const { t } = useTranslation();
  const rtl = useRtl();

  const roots = useWurzeln();
  const lemmas = useLemmata();

  const rootEntry = wurzel ? roots.data?.[wurzel] : undefined;

  const lemmaEntries = useMemo(() => {
    if (!rootEntry || !lemmas.data) return [];
    return rootEntry.lemmas
      .map((lemma) => {
        const entry = lemmas.data?.[lemma];
        if (!entry || entry.occurrences.length === 0) return null;
        return { lemma, count: entry.count, firstOccurrence: entry.occurrences[0] };
      })
      .filter((v): v is { lemma: string; count: number; firstOccurrence: MorphVorkommen } => v !== null);
  }, [rootEntry, lemmas.data]);

  const {
    forms,
    isLoading: formsLoading,
    isError: formsError,
    loadedCount: formsLoadedCount,
    totalCount: formsTotalCount,
    retry: retryForms,
  } = useRootWordforms(lemmaEntries);
  const groups = useMemo(() => groupWordformsByWortart(forms), [forms]);
  const occurrences: RootOccurrence[] = useMemo(
    () => (rootEntry ? rootEntry.occurrences.map(([surah, ayah, position]) => ({ surah, ayah, position })) : []),
    [rootEntry],
  );
  const shownOccurrences = occurrences.slice(0, MAX_OCCURRENCE_CHIPS);

  const sectionFormsTerm = useLocaleTerm('lexikon.wurzel.sectionForms') ?? { name: '', ar: '' };
  const sectionOccurrencesTerm = useLocaleTerm('lexikon.wurzel.sectionOccurrences') ?? { name: '', ar: '' };
  const formsUnclassifiedTerm = useLocaleTerm('lexikon.wurzel.formsUnclassified') ?? { name: '', ar: '' };

  const loading = roots.isLoading || lemmas.isLoading;
  const failed = roots.isError || lemmas.isError;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={wurzel ?? ''} />

        <View style={styles.content}>
          {loading ? (
            <View style={styles.center}>
              <ThemedActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                {t('common.loading')}
              </ThemedText>
            </View>
          ) : failed ? (
            <EmptyState icon="alert-circle-outline" title={t('lexikon.wurzel.loadError')} />
          ) : !rootEntry ? (
            <EmptyState icon="alert-circle-outline" title={t('lexikon.wurzel.notFound')} />
          ) : (
            <FlatList
              data={shownOccurrences}
              keyExtractor={(o) => `${o.surah}:${o.ayah}:${o.position}`}
              ListHeaderComponent={
                <View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                    {t('lexikon.wurzel.occurrencesInQuran').replace('{n}', rootEntry.count.toLocaleString())}
                  </ThemedText>

                  <TermLabel term={sectionFormsTerm} nameType="heading" style={styles.sectionHeading} />
                  {formsLoading ? (
                    <View style={styles.formsStatusRow}>
                      <ThemedActivityIndicator size="small" />
                      <ThemedText type="small" themeColor="textSecondary">
                        {formsTotalCount > 1
                          ? t('lexikon.wurzel.formsLoadingProgress')
                              .replace('{loaded}', String(formsLoadedCount))
                              .replace('{total}', String(formsTotalCount))
                          : t('lexikon.wurzel.formsLoading')}
                      </ThemedText>
                    </View>
                  ) : (
                    <>
                      {groups.map((group) => (
                        <WortartGroup
                          key={group.wortart ?? 'unbekannt'}
                          wortart={group.wortart}
                          forms={group.forms}
                          rtl={rtl}
                          fallbackTerm={formsUnclassifiedTerm}
                        />
                      ))}
                      {formsError ? (
                        <View style={styles.formsStatusRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {t('lexikon.wurzel.formsLoadError')}
                          </ThemedText>
                          <Pressable onPress={retryForms} accessibilityRole="button">
                            <ThemedText type="smallBold" themeColor="accent">
                              {t('common.retry')}
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : null}
                    </>
                  )}

                  <TermLabel term={sectionOccurrencesTerm} nameType="heading" style={styles.sectionHeading} />
                  {occurrences.length > MAX_OCCURRENCE_CHIPS ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.truncatedNote}>
                      {t('lexikon.occurrencesTruncated')
                        .replace('{shown}', String(shownOccurrences.length))
                        .replace('{total}', String(occurrences.length))}
                    </ThemedText>
                  ) : null}
                </View>
              }
              renderItem={renderOccurrenceChip}
              numColumns={4}
              columnWrapperStyle={styles.chipRow}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );

  function renderOccurrenceChip({ item }: ListRenderItemInfo<RootOccurrence>) {
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/quran/[surah]', params: { surah: item.surah, ayah: item.ayah } })}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.chip}>
          <ThemedText type="small">
            {item.surah}:{item.ayah}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }
}

function WortartGroup({
  wortart,
  forms,
  rtl,
  fallbackTerm,
}: {
  wortart: Wortart | null;
  forms: { lemma: string; count: number }[];
  rtl: boolean;
  fallbackTerm: { name: string; ar: string };
}) {
  const { t } = useTranslation();
  const term = useGrammatikTerm(wortart ? `wortarten.${wortart}` : '') ?? (wortart ? null : fallbackTerm);

  return (
    <View style={styles.wortartGroup}>
      {term ? <TermLabel term={term} nameType="smallBold" nameColor="accent" layout="inline" /> : null}
      {forms.map((f) => (
        <View key={f.lemma} style={[styles.formRow, rtl && styles.formRowRtl]}>
          <ThemedText type="default" style={styles.formLemma}>
            {f.lemma}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('lexikon.roots.occurrences').replace('{n}', f.count.toLocaleString())}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  content: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  subtitle: { marginBottom: Spacing.three },
  sectionHeading: { marginTop: Spacing.three, marginBottom: Spacing.two },
  wortartGroup: { marginBottom: Spacing.three, gap: Spacing.one },
  formsStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  formRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 4 },
  formRowRtl: { flexDirection: 'row-reverse' },
  formLemma: { fontSize: 20 },
  truncatedNote: { marginBottom: Spacing.two },
  listContent: { paddingBottom: Spacing.six },
  chipRow: { gap: Spacing.one, marginBottom: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    flex: 1,
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
});
