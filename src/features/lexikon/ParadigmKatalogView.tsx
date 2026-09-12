// Tabellenkatalog im Reiter "Grammatik & Ṣarf" — ALLE Paradigmen-/Bab-
// Tabellen (data/paradigmen*.json, zusammengeführt über paradigmenLoader.ts)
// nach Kategorien gegliedert, mit Suche. Bei >100 Tabellen ist eine flache
// Liste unbrauchbar (siehe Auftrag) — deshalb zweistufig aufklappbar
// (Kategorie -> bei "Verbstamm-Familien" zusätzlich Verbfamilie), damit ohne
// Suche höchstens EINE Ebene Tabellen gleichzeitig gerendert wird:
// `Aufklappbar` montiert seine Kinder erst beim Öffnen, eine geschlossene
// Kategorie kostet also keine gerenderten <ParadigmTable>-Instanzen. Beim
// Suchen wird stattdessen flach über ALLE Tabellen gefiltert (Titel + rein
// arabischer Fachbegriff) — wer sucht, will Treffer sofort sehen, nicht erst
// die passende Kategorie aufklappen.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { Aufklappbar } from '@/features/quran/analyse/Aufklappbar';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { normalizeForSearch, searchMatches } from './arabicSearch';
import { useLocaleTerm, type Term } from './grammatikTerm';
import { ParadigmTable } from './ParadigmTable';
import { gruppenNachKategorie, gruppenNachVerbFamilie, useAlleParadigmTabellen } from './paradigmenLoader';
import { PARADIGM_KATEGORIE_ORDER, VERB_FAMILIE_ORDER, type ParadigmKategorie, type ParadigmTabelleEingeordnet, type VerbFamilie } from './paradigmenKategorien';

const FALLBACK_TERM: Term = { name: '', ar: '' };

const KATEGORIE_LOCALE_PATH: Record<ParadigmKategorie, string> = {
  nomenPronomen: 'lexikon.grammar.tables.categoryNomenPronomen',
  verbMatrizen: 'lexikon.grammar.tables.categoryVerbMatrizen',
  verbstammFamilien: 'lexikon.grammar.tables.categoryVerbstammFamilien',
  verbstammAbleitungen: 'lexikon.grammar.tables.categoryVerbstammAbleitungen',
  partikelnZahlenWortschatz: 'lexikon.grammar.tables.categoryPartikelnZahlenWortschatz',
};

const VERB_FAMILIE_LOCALE_PATH: Record<VerbFamilie, string> = {
  sahih: 'lexikon.grammar.tables.verbFamilieSahih',
  mahmuz: 'lexikon.grammar.tables.verbFamilieMahmuz',
  mithal: 'lexikon.grammar.tables.verbFamilieMithal',
  ajwaf: 'lexikon.grammar.tables.verbFamilieAjwaf',
  naaqis: 'lexikon.grammar.tables.verbFamilieNaaqis',
  lafif: 'lexikon.grammar.tables.verbFamilieLafif',
  mudaaf: 'lexikon.grammar.tables.verbFamilieMudaaf',
  murakkab: 'lexikon.grammar.tables.verbFamilieMurakkab',
};

/** "Name" allein, oder "Name — ar" wenn der arabische Fachbegriff nicht
 *  ohnehin (nach Normalisierung) mit dem Namen identisch ist — dieselbe
 *  Redundanzprüfung wie TermLabel.shouldShowAr(), hier für einen
 *  zusammengesetzten Überschrift-STRING gebraucht (Aufklappbar nimmt nur
 *  einen String als Titel, keine eigene Komponente). */
function ueberschrift(term: Term, count: number): string {
  const zeigeAr = term.ar && normalizeForSearch(term.ar) !== normalizeForSearch(term.name);
  const basis = zeigeAr ? `${term.name} — ${term.ar}` : term.name;
  return `${basis} (${count})`;
}

function useKategorieTerm(kategorie: ParadigmKategorie): Term {
  return useLocaleTerm(KATEGORIE_LOCALE_PATH[kategorie]) ?? FALLBACK_TERM;
}

function useVerbFamilieTerm(familie: VerbFamilie): Term {
  return useLocaleTerm(VERB_FAMILIE_LOCALE_PATH[familie]) ?? FALLBACK_TERM;
}

export function ParadigmKatalogView() {
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [query, setQuery] = useState('');
  const { data, isLoading, isError } = useAlleParadigmTabellen();

  const nachKategorie = useMemo(() => gruppenNachKategorie(data ?? []), [data]);
  const gesamtzahl = data?.length ?? 0;

  const treffer = useMemo(() => {
    const q = query.trim();
    if (!q || !data) return null;
    return data.filter((tab) => searchMatches(tab.titleDe, q) || (tab.termAr ? searchMatches(tab.termAr, q) : false));
  }, [data, query]);

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

  if (isError || gesamtzahl === 0) {
    return <EmptyState icon="alert-circle-outline" title={t('lexikon.grammar.loadError')} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedView type="backgroundElement" style={[styles.searchBox, rtl && styles.searchBoxRtl]}>
        <IconSymbol name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('lexikon.grammar.tables.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, rtl && styles.textRtl, { color: colors.text }]}
          accessibilityLabel={t('a11y.search')}
        />
      </ThemedView>

      <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
        {t('lexikon.grammar.tables.tableCount').replace('{n}', String(gesamtzahl))}
      </ThemedText>

      {treffer ? (
        treffer.length === 0 ? (
          <EmptyState icon="search" title={t('lexikon.grammar.tables.noResults')} />
        ) : (
          treffer.map((tab) => <ParadigmTable key={tab.id} table={tab} />)
        )
      ) : (
        PARADIGM_KATEGORIE_ORDER.map((kategorie) => {
          const tabellen = nachKategorie[kategorie];
          if (!tabellen || tabellen.length === 0) return null;
          return <KategorieSektion key={kategorie} kategorie={kategorie} tabellen={tabellen} />;
        })
      )}
    </ScrollView>
  );
}

function KategorieSektion({ kategorie, tabellen }: { kategorie: ParadigmKategorie; tabellen: ParadigmTabelleEingeordnet[] }) {
  const term = useKategorieTerm(kategorie);

  if (kategorie !== 'verbstammFamilien') {
    return (
      <Aufklappbar titel={ueberschrift(term, tabellen.length)}>
        {tabellen.map((tab) => (
          <ParadigmTable key={tab.id} table={tab} />
        ))}
      </Aufklappbar>
    );
  }

  const nachFamilie = gruppenNachVerbFamilie(tabellen);
  return (
    <Aufklappbar titel={ueberschrift(term, tabellen.length)}>
      {VERB_FAMILIE_ORDER.map((familie) => {
        const familientabellen = nachFamilie[familie];
        if (!familientabellen || familientabellen.length === 0) return null;
        return <VerbFamilieSektion key={familie} familie={familie} tabellen={familientabellen} />;
      })}
    </Aufklappbar>
  );
}

function VerbFamilieSektion({ familie, tabellen }: { familie: VerbFamilie; tabellen: ParadigmTabelleEingeordnet[] }) {
  const term = useVerbFamilieTerm(familie);
  return (
    <Aufklappbar titel={ueberschrift(term, tabellen.length)}>
      {tabellen.map((tab) => (
        <ParadigmTable key={tab.id} table={tab} />
      ))}
    </Aufklappbar>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  searchBoxRtl: { flexDirection: 'row-reverse' },
  searchInput: { flex: 1, paddingVertical: Spacing.two, fontSize: 15 },
  textRtl: { textAlign: 'right' },
  count: { marginBottom: Spacing.two },
});
