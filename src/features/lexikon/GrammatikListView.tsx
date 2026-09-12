// Reiter "Grammatik & Ṣarf": drei Unteransichten über einen eigenen
// Pill-Umschalter (SegmentedTabs) — "Begriffe" (Lehrtexte aus
// data/erklaerungen/de-{nomen,verb,partikel-syntax}.json, wie bisher),
// "Formentabellen" (ALLE Paradigmen-/Bab-Tabellen aus data/paradigmen*.json,
// kategorisiert + durchsuchbar, siehe ParadigmKatalogView.tsx) und
// "Wortlisten" (Vokabel-/Partikellisten, eine Beispielsatzliste und zwei
// Flussdiagramme aus data/wortlisten.json, die KEINE Flexionsparadigmen sind
// und deshalb nicht in ParadigmTabelle passen, siehe WortlistenKatalogView.tsx
// und data/LUECKEN.md). "Begriffe" bleibt die Vorbelegung: der bestehende
// Nutzungspfad (Begriff antippen -> Detailansicht mit verknüpften
// Formentabellen) ändert sich dadurch nicht. Tippen auf einen Begriff öffnet
// die Detailansicht (app/lexikon/begriff/[bereich]/[id].tsx). Die Lehrtexte
// ("Begriffe") liegen aktuell nur auf Deutsch vor (siehe FORTSETZEN-KORAN-
// LEXIKON.md) — das wird ehrlich als Hinweis angezeigt statt es zu
// verschweigen. Die Wortlisten-Bedeutungen sind dagegen seit dieser Sitzung
// in allen 14 Sprachen vorhanden (data/wortlisten-i18n/, siehe
// WortlistenKatalogView.tsx) — der dortige Hinweis erscheint deshalb nur
// noch für eine Sprache ohne (vollständiges) Übersetzungsbündel.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { useAlleErklaerungen } from './erklaerungenLoader';
import type { ErklaerungenBereich } from './erklaerungenTypes';
import { useGrammatikTerm, useLocaleTerm, type Term } from './grammatikTerm';
import { ParadigmKatalogView } from './ParadigmKatalogView';
import { TermLabel } from './TermLabel';
import { WortlistenKatalogView } from './WortlistenKatalogView';

const BEREICH_ORDER: ErklaerungenBereich[] = ['nomen', 'verb', 'partikel-syntax'];

type GrammatikSubTab = 'begriffe' | 'tabellen' | 'wortlisten';

function useBereichTerm(bereich: ErklaerungenBereich): Term {
  const ism = useGrammatikTerm('wortarten.ism');
  const fiil = useGrammatikTerm('wortarten.fiil');
  const partikelSyntax = useLocaleTerm('lexikon.grammar.bereichPartikelSyntax');
  const fallback: Term = { name: bereich, ar: '' };
  if (bereich === 'nomen') return ism ?? fallback;
  if (bereich === 'verb') return fiil ?? fallback;
  return partikelSyntax ?? fallback;
}

export function GrammatikListView() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<GrammatikSubTab>('begriffe');

  return (
    <View style={styles.wrapper}>
      <SegmentedTabs
        tabs={[
          { key: 'begriffe', label: t('lexikon.grammar.tables.toggleBegriffe') },
          { key: 'tabellen', label: t('lexikon.grammar.tables.toggleTabellen') },
          { key: 'wortlisten', label: t('lexikon.grammar.wortlisten.toggleWortlisten') },
        ]}
        activeKey={subTab}
        onChange={(key) => setSubTab(key as GrammatikSubTab)}
      />
      <View style={styles.subContent}>
        {subTab === 'begriffe' ? <BegriffeListe /> : subTab === 'tabellen' ? <ParadigmKatalogView /> : <WortlistenKatalogView />}
      </View>
    </View>
  );
}

function BegriffeListe() {
  const { t } = useTranslation();
  const rtl = useRtl();
  const { data, isLoading, isError } = useAlleErklaerungen();

  const groups = useMemo(
    () =>
      BEREICH_ORDER.map((bereich) => ({
        bereich,
        entries: data[bereich] ? Object.entries(data[bereich]!.eintraege) : [],
      })).filter((g) => g.entries.length > 0),
    [data],
  );

  const totalCount = groups.reduce((sum, g) => sum + g.entries.length, 0);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ThemedActivityIndicator />
        <ThemedText type="small" themeColor="textSecondary">
          {t('lexikon.grammar.loading')}
        </ThemedText>
      </View>
    );
  }

  if (isError || totalCount === 0) {
    return <EmptyState icon="alert-circle-outline" title={t('lexikon.grammar.loadError')} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {t('lexikon.grammar.germanOnlyNote')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {t('lexikon.grammar.termCount').replace('{n}', String(totalCount))}
      </ThemedText>

      {groups.map((group) => (
        <BereichGroup key={group.bereich} bereich={group.bereich} entries={group.entries} rtl={rtl} />
      ))}
    </ScrollView>
  );
}

function BereichGroup({
  bereich,
  entries,
  rtl,
}: {
  bereich: ErklaerungenBereich;
  entries: [string, { titel: string; ar: string; umschrift: string }][];
  rtl: boolean;
}) {
  const term = useBereichTerm(bereich);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <View style={styles.section}>
      <TermLabel term={term} nameType="heading" layout="inline" style={styles.sectionHeading} />
      {entries.map(([id, entry]) => (
        <Pressable
          key={id}
          onPress={() => router.push({ pathname: '/lexikon/begriff/[bereich]/[id]', params: { bereich, id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, rtl && styles.rowRtl, pressed && styles.pressed, { borderColor: colors.separator }]}>
          <View style={styles.rowText}>
            <ThemedText type="default" style={rtl && styles.textRtl}>
              {entry.umschrift}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
              {entry.titel}
            </ThemedText>
          </View>
          <ThemedText type="default" themeColor="accent">
            {entry.ar}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  subContent: { flex: 1, marginTop: Spacing.two },
  container: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  note: { marginBottom: Spacing.one },
  section: { marginTop: Spacing.four },
  sectionHeading: { marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  textRtl: { textAlign: 'right' },
});
