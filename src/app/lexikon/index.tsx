// Lexikon: Nachschlagewerk fuer Wurzeln/Wortschatz, Grammatik/Sarf, Tadschwid
// und Konkordanz. "Wurzeln & Wortschatz", "Grammatik & Sarf" und "Konkordanz"
// zeigen echten Inhalt (roots.json/lemmas.json der Morphologie-Pipeline bzw.
// data/erklaerungen/de-*.json, siehe features/lexikon/hooks.ts und
// erklaerungenLoader.ts); "Tajwid" bleibt bewusst ein ehrlicher Leerzustand,
// bis dieser Inhalt gebaut ist. Die Kopf-Suchleiste durchsucht Wurzeln,
// Wortschatz UND die Fachbegriffe des grammatik-Teilbaums der aktiven
// Sprache (UniversalSearchResults).
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { ConcordanceView } from '@/features/lexikon/ConcordanceView';
import { GrammatikListView } from '@/features/lexikon/GrammatikListView';
import { RootsListView } from '@/features/lexikon/RootsListView';
import { UniversalSearchResults } from '@/features/lexikon/UniversalSearchResults';

type LexikonTab = 'roots' | 'grammar' | 'tajwid' | 'concordance';

const TABS: LexikonTab[] = ['roots', 'grammar', 'tajwid', 'concordance'];

const EMPTY_ICON: Record<LexikonTab, IconName> = {
  roots: 'leaf-outline',
  grammar: 'grid-outline',
  tajwid: 'musical-notes-outline',
  concordance: 'list-outline',
};

export default function LexikonScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const rtl = useRtl();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<LexikonTab>('roots');
  // Von der Kopf-Suche in die Konkordanz uebergebene Vorbefuellung (Tippen auf
  // einen Wortschatz-Treffer springt direkt zu dessen Belegstellen).
  const [concordancePrefill, setConcordancePrefill] = useState<string | null>(null);

  const showSearchResults = query.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('lexikon.title')} subtitle={t('lexikon.subtitle')} />

        <ThemedView type="backgroundElement" style={[styles.searchBox, rtl && styles.searchBoxRtl]}>
          <IconSymbol name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('lexikon.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, rtl && styles.textRtl, { color: colors.text }]}
            accessibilityLabel={t('a11y.search')}
          />
        </ThemedView>

        {showSearchResults ? (
          <View style={styles.content}>
            <UniversalSearchResults
              query={query}
              onSelectLemma={(lemma) => {
                setConcordancePrefill(lemma);
                setQuery('');
                setTab('concordance');
              }}
            />
          </View>
        ) : (
          <>
            <SegmentedTabs
              tabs={TABS.map((key) => ({ key, label: t(`lexikon.tabs.${key}`) }))}
              activeKey={tab}
              onChange={(key) => setTab(key as LexikonTab)}
            />

            <View style={styles.content}>
              {tab === 'roots' ? (
                <RootsListView />
              ) : tab === 'grammar' ? (
                <GrammatikListView />
              ) : tab === 'concordance' ? (
                <ConcordanceView
                  initialQuery={concordancePrefill ?? undefined}
                  onConsumedInitialQuery={() => setConcordancePrefill(null)}
                />
              ) : (
                <EmptyState icon={EMPTY_ICON[tab]} title={t(`lexikon.empty.${tab}`)} />
              )}
            </View>
          </>
        )}

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  searchBoxRtl: { flexDirection: 'row-reverse' },
  searchInput: { flex: 1, paddingVertical: Spacing.two, fontSize: 15 },
  textRtl: { textAlign: 'right' },
  content: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
});
