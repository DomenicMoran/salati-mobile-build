// Ergebnisse der universellen Kopf-Suche: durchsucht Wurzeln, Lemmata und die
// Fachbegriffe des `grammatik`-Teilbaums der aktiven Sprache, Treffer nach
// Art gruppiert. Wurzel-Treffer springen in die Detailansicht, Wortschatz-
// Treffer wechseln in die Konkordanz mit vorausgefüllter Suche, Fachbegriffe
// werden direkt inline erklärt (kein eigener Zielort vorhanden).
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { searchConcordance } from './concordance';
import { searchGrammatikTerms, useLocaleTerm } from './grammatikTerm';
import { useLemmata, useWurzeln } from './hooks';
import { TermLabel } from './TermLabel';

const MAX_PER_SECTION = 8;

export interface UniversalSearchResultsProps {
  query: string;
  onSelectLemma: (lemma: string) => void;
}

export function UniversalSearchResults({ query, onSelectLemma }: UniversalSearchResultsProps) {
  const { t, locale } = useTranslation();
  const rtl = useRtl();
  const roots = useWurzeln();
  const lemmas = useLemmata();

  const sectionRootsTerm = useLocaleTerm('lexikon.search.sectionRoots') ?? { name: '', ar: '' };
  const sectionVocabularyTerm = useLocaleTerm('lexikon.search.sectionVocabulary') ?? { name: '', ar: '' };
  const sectionTermsTerm = useLocaleTerm('lexikon.search.sectionTerms') ?? { name: '', ar: '' };

  const matches = useMemo(() => {
    if (!roots.data || !lemmas.data) return [];
    return searchConcordance(query, roots.data, lemmas.data);
  }, [query, roots.data, lemmas.data]);

  const grammatikMatches = useMemo(() => searchGrammatikTerms(locale, query), [locale, query]);

  const loading = roots.isLoading || lemmas.isLoading;
  if (loading) {
    return (
      <View style={styles.center}>
        <ThemedActivityIndicator />
        <ThemedText type="small" themeColor="textSecondary">
          {t('lexikon.search.loading')}
        </ThemedText>
      </View>
    );
  }

  const rootMatches = matches.filter((m) => m.kind === 'root').slice(0, MAX_PER_SECTION);
  const lemmaMatches = matches.filter((m) => m.kind === 'lemma').slice(0, MAX_PER_SECTION);
  const termMatches = grammatikMatches.slice(0, MAX_PER_SECTION);
  const truncated =
    matches.filter((m) => m.kind === 'root').length > MAX_PER_SECTION ||
    matches.filter((m) => m.kind === 'lemma').length > MAX_PER_SECTION ||
    grammatikMatches.length > MAX_PER_SECTION;

  if (rootMatches.length === 0 && lemmaMatches.length === 0 && termMatches.length === 0) {
    return <EmptyState icon="search" title={t('lexikon.noResultsFor').replace('{query}', query)} />;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {rootMatches.length > 0 ? (
        <View style={styles.section}>
          <TermLabel term={sectionRootsTerm} nameType="smallBold" nameColor="textSecondary" layout="inline" style={styles.sectionTitle} />
          {rootMatches.map((m) => (
            <Pressable
              key={m.text}
              onPress={() => router.push({ pathname: '/lexikon/wurzel/[wurzel]', params: { wurzel: m.text } })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, rtl && styles.rowRtl, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.rowArabic}>
                {m.text}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('lexikon.roots.occurrences').replace('{n}', m.count.toLocaleString())}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {lemmaMatches.length > 0 ? (
        <View style={styles.section}>
          <TermLabel term={sectionVocabularyTerm} nameType="smallBold" nameColor="textSecondary" layout="inline" style={styles.sectionTitle} />
          {lemmaMatches.map((m) => (
            <Pressable
              key={m.text}
              onPress={() => onSelectLemma(m.text)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, rtl && styles.rowRtl, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.rowArabic}>
                {m.text}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('lexikon.roots.occurrences').replace('{n}', m.count.toLocaleString())}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {termMatches.length > 0 ? (
        <View style={styles.section}>
          <TermLabel term={sectionTermsTerm} nameType="smallBold" nameColor="textSecondary" layout="inline" style={styles.sectionTitle} />
          {termMatches.map(({ path, term }) => (
            <View key={path} style={[styles.termRow, rtl && styles.rowRtl]}>
              <TermLabel term={term} nameType="default" layout="stacked" />
              {term.info ? (
                <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl} numberOfLines={2}>
                  {term.info}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {truncated ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.moreNote}>
          {t('lexikon.search.moreResults')}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  section: { marginBottom: Spacing.three },
  sectionTitle: { marginBottom: Spacing.one, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rowArabic: { fontSize: 20 },
  pressed: { opacity: 0.6 },
  termRow: { paddingVertical: Spacing.two, gap: 2 },
  textRtl: { textAlign: 'right' },
  moreNote: { marginTop: Spacing.one, marginBottom: Spacing.four },
});
