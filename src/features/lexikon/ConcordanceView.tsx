// Reiter "Konkordanz" — Sucheingabe für ein arabisches Wort oder eine Wurzel,
// Ergebnis: alle Fundstellen mit Vers-Vorschau und hervorgehobenem Treffer.
// Zweistufig: erst die passenden Wurzeln/Wortformen (Treffer), dann — nach
// Antippen eines Treffers — dessen Belegstellen mit Vers-Vorschau. Das hält
// die Liste übersichtlich, statt sofort hunderte Belegzeilen zu rendern.
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View, type ListRenderItemInfo } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';
import type { MorphVorkommen } from '@/features/quran/morphologieTypen';

import { searchConcordance, type ConcordanceMatch } from './concordance';
import { useLocaleTerm, type Term } from './grammatikTerm';
import { useLemmata, useVersePreview, useWurzeln } from './hooks';
import { TermLabel } from './TermLabel';

const MAX_MATCHES = 30;
const MAX_OCCURRENCES = 50;

export interface ConcordanceViewProps {
  /** Vorbefüllte Suche — z. B. wenn die Kopf-Suche einen Wortschatz-Treffer
   *  hierher übergibt. */
  initialQuery?: string;
  /** Wird einmalig aufgerufen, nachdem `initialQuery` übernommen wurde, damit
   *  der Aufrufer seinen Zwischenspeicher leeren kann (sonst würde ein
   *  erneutes Öffnen des Reiters die Suche ungewollt wiederholen). */
  onConsumedInitialQuery?: () => void;
}

export function ConcordanceView({ initialQuery, onConsumedInitialQuery }: ConcordanceViewProps) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [query, setQuery] = useState(initialQuery ?? '');
  const [selected, setSelected] = useState<ConcordanceMatch | null>(null);

  useEffect(() => {
    if (!initialQuery) return;
    // setQuery/setSelected/onConsumedInitialQuery setzen synchron im
    // Effekt-Body ausgefuehrt loest react-hooks/set-state-in-effect aus
    // (kaskadierende Re-Renders) — per Timeout(0) entkoppelt, wie bei
    // LessonPlayer.tsx ueblich.
    const id = setTimeout(() => {
      setQuery(initialQuery);
      setSelected(null);
      onConsumedInitialQuery?.();
    }, 0);
    return () => clearTimeout(id);
    // onConsumedInitialQuery ist absichtlich nicht in den Dependencies: soll
    // nur bei einer NEUEN initialQuery erneut laufen, nicht bei jedem Render
    // des Aufrufers (dessen Callback typischerweise nicht memoisiert ist).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const roots = useWurzeln();
  const lemmas = useLemmata();

  const matches = useMemo(() => {
    if (!roots.data || !lemmas.data) return [];
    return searchConcordance(query, roots.data, lemmas.data);
  }, [query, roots.data, lemmas.data]);

  const rootLabelTerm = useLocaleTerm('lexikon.concordance.rootLabel') ?? { name: '', ar: '' };
  const lemmaLabelTerm = useLocaleTerm('lexikon.concordance.lemmaLabel') ?? { name: '', ar: '' };

  if (selected) {
    return (
      <SelectedMatchView
        match={selected}
        onBack={() => setSelected(null)}
        rootLabelTerm={rootLabelTerm}
        lemmaLabelTerm={lemmaLabelTerm}
      />
    );
  }

  const loading = roots.isLoading || lemmas.isLoading;
  const failed = roots.isError || lemmas.isError;

  return (
    <View style={styles.container}>
      <ThemedView type="backgroundElement" style={[styles.searchBox, rtl && styles.searchBoxRtl]}>
        <IconSymbol name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('lexikon.concordance.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, rtl && styles.textRtl, { color: colors.text }]}
        />
      </ThemedView>

      {loading ? (
        <View style={styles.center}>
          <ThemedActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            {t('lexikon.search.loading')}
          </ThemedText>
        </View>
      ) : failed ? (
        <EmptyState icon="alert-circle-outline" title={t('lexikon.roots.loadError')} />
      ) : query.trim() === '' ? (
        <EmptyState icon="search" title={t('lexikon.concordance.prompt')} />
      ) : matches.length === 0 ? (
        <EmptyState icon="search" title={t('lexikon.noResultsFor').replace('{query}', query)} />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.matchesHeading}>
            {t('lexikon.concordance.matchesHeading')}
          </ThemedText>
          {matches.length > MAX_MATCHES ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.moreNote}>
              {t('lexikon.search.moreResults')}
            </ThemedText>
          ) : null}
          <FlatList
            data={matches.slice(0, MAX_MATCHES)}
            keyExtractor={(m) => `${m.kind}:${m.text}`}
            renderItem={({ item }: ListRenderItemInfo<ConcordanceMatch>) => (
              <MatchRow
                item={item}
                rootLabelTerm={rootLabelTerm}
                lemmaLabelTerm={lemmaLabelTerm}
                onPress={() => setSelected(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
}

function MatchRow({
  item,
  rootLabelTerm,
  lemmaLabelTerm,
  onPress,
}: {
  item: ConcordanceMatch;
  rootLabelTerm: Term;
  lemmaLabelTerm: Term;
  onPress: () => void;
}) {
  const rtl = useRtl();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.matchRow, rtl && styles.matchRowRtl, pressed && styles.pressed, { borderColor: colors.separator }]}>
      <View style={styles.matchTextCol}>
        <ThemedText type="title" style={styles.matchArabic}>
          {item.text}
        </ThemedText>
        <TermLabel term={item.kind === 'root' ? rootLabelTerm : lemmaLabelTerm} layout="inline" nameType="small" nameColor="textSecondary" arType="small" />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('lexikon.concordance.totalOccurrences').replace('{n}', item.count.toLocaleString())}
      </ThemedText>
    </Pressable>
  );
}

function SelectedMatchView({
  match,
  onBack,
  rootLabelTerm,
  lemmaLabelTerm,
}: {
  match: ConcordanceMatch;
  onBack: () => void;
  rootLabelTerm: Term;
  lemmaLabelTerm: Term;
}) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const shown = match.occurrences.slice(0, MAX_OCCURRENCES);

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} accessibilityRole="button" style={[styles.backRow, rtl && styles.backRowRtl]}>
        <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.accent} />
        <ThemedText type="smallBold" themeColor="accent">
          {t('lexikon.concordance.matchesHeading')}
        </ThemedText>
      </Pressable>

      <View style={styles.selectedHeader}>
        <ThemedText type="title" style={styles.matchArabic}>
          {match.text}
        </ThemedText>
        <TermLabel term={match.kind === 'root' ? rootLabelTerm : lemmaLabelTerm} layout="inline" nameType="small" nameColor="textSecondary" arType="small" />
        <ThemedText type="small" themeColor="textSecondary">
          {t('lexikon.concordance.totalOccurrences').replace('{n}', match.count.toLocaleString())}
        </ThemedText>
      </View>

      {match.occurrences.length > MAX_OCCURRENCES ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.moreNote}>
          {t('lexikon.occurrencesTruncated')
            .replace('{shown}', String(shown.length))
            .replace('{total}', String(match.occurrences.length))}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.matchesHeading}>
        {t('lexikon.concordance.occurrencesHeading')}
      </ThemedText>

      <FlatList
        data={shown}
        keyExtractor={([surah, ayah, position]) => `${surah}:${ayah}:${position}`}
        renderItem={({ item }: ListRenderItemInfo<MorphVorkommen>) => <OccurrenceRow occurrence={item} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function OccurrenceRow({ occurrence }: { occurrence: MorphVorkommen }) {
  const [surah, ayah, position] = occurrence;
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data, isLoading } = useVersePreview(surah, ayah, position);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/quran/[surah]', params: { surah, ayah } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.occRow, pressed && styles.pressed, { borderColor: colors.separator }]}>
      <ThemedText type="smallBold" themeColor="accent" style={styles.occRef}>
        {surah}:{ayah}
      </ThemedText>
      {isLoading || !data ? (
        <ThemedActivityIndicator size="small" />
      ) : (
        <ThemedText type="small" style={[styles.occPreview, rtl && styles.textRtl]} numberOfLines={2}>
          {data.words.map((word, i) => {
            const wordPos = i + 1;
            const isHit = data.highlightPosition === wordPos;
            return (
              <ThemedText key={i} type={isHit ? 'smallBold' : 'small'} themeColor={isHit ? 'accent' : 'text'}>
                {word}
                {i < data.words.length - 1 ? ' ' : ''}
              </ThemedText>
            );
          })}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchBoxRtl: { flexDirection: 'row-reverse' },
  searchInput: { flex: 1, fontSize: 15 },
  textRtl: { textAlign: 'right' },
  matchesHeading: { marginBottom: Spacing.one, textTransform: 'uppercase' },
  moreNote: { marginBottom: Spacing.two },
  listContent: { paddingBottom: Spacing.five },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  matchRowRtl: { flexDirection: 'row-reverse' },
  matchTextCol: { gap: 2 },
  matchArabic: { fontSize: 26 },
  pressed: { opacity: 0.6 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  backRowRtl: { flexDirection: 'row-reverse' },
  selectedHeader: { marginBottom: Spacing.three, gap: 2 },
  occRow: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  occRef: { marginBottom: 2 },
  occPreview: { lineHeight: 22 },
});
