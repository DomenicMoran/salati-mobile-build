// Verbtyp-Übersicht: nimmt eine WurzelTypKategorie entgegen (sahih, mahmuz,
// mithal, ajwaf, naaqis, lafifMafruq, lafifMaqrun, mudaaf, rubai — siehe
// wurzelTyp() in @/features/quran/grammatik.ts, das aus einer Konsonanten-
// wurzel im Reader GENAU diese Kategorien ableitet) und zeigt ALLE
// Formentabellen der zugehörigen Verbstamm-Familie (Bab) aus dem
// Grammatik-Lexikon — z. B. Sprung von einem hohlen Verb im Reader auf
// "Aǧwaf", ohne dass der Reader selbst wissen muss, WIE das Lexikon seine
// Tabellen organisiert (der Reader müsste dafür nur `router.push({
// pathname: '/lexikon/verbtyp/[typ]', params: { typ: eintrag.kategorie } })`
// mit dem `kategorie`-Feld eines wurzelTyp()-Eintrags aufrufen — diese
// Verlinkung selbst ist noch nicht eingebaut, siehe Bericht).
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

import { useLocaleTerm, type Term } from '@/features/lexikon/grammatikTerm';
import { ParadigmTable } from '@/features/lexikon/ParadigmTable';
import { istGueltigeWurzelTypKategorie, verbFamilieVonWurzelTyp } from '@/features/lexikon/paradigmenKategorien';
import { useParadigmTabellenByVerbFamilie } from '@/features/lexikon/paradigmenLoader';
import { TermLabel } from '@/features/lexikon/TermLabel';

const VERB_FAMILIE_LOCALE_PATH = {
  sahih: 'lexikon.grammar.tables.verbFamilieSahih',
  mahmuz: 'lexikon.grammar.tables.verbFamilieMahmuz',
  mithal: 'lexikon.grammar.tables.verbFamilieMithal',
  ajwaf: 'lexikon.grammar.tables.verbFamilieAjwaf',
  naaqis: 'lexikon.grammar.tables.verbFamilieNaaqis',
  lafif: 'lexikon.grammar.tables.verbFamilieLafif',
  mudaaf: 'lexikon.grammar.tables.verbFamilieMudaaf',
  murakkab: 'lexikon.grammar.tables.verbFamilieMurakkab',
} as const;

export default function VerbtypScreen() {
  const { typ } = useLocalSearchParams<{ typ: string }>();
  const { t } = useTranslation();

  const gueltig = typeof typ === 'string' && istGueltigeWurzelTypKategorie(typ);
  const familie = gueltig ? verbFamilieVonWurzelTyp(typ) : null;

  const familieTerm: Term = useLocaleTerm(familie ? VERB_FAMILIE_LOCALE_PATH[familie] : '') ?? { name: t('lexikon.verbtyp.title'), ar: '' };

  const { data, isLoading } = useParadigmTabellenByVerbFamilie(familie);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={familie ? familieTerm.name : t('lexikon.verbtyp.title')} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {!gueltig || !familie ? (
            <EmptyState icon="alert-circle-outline" title={t('lexikon.verbtyp.notFound')} />
          ) : isLoading ? (
            <View style={styles.center}>
              <ThemedActivityIndicator />
            </View>
          ) : !data || data.length === 0 ? (
            <EmptyState icon="alert-circle-outline" title={t('lexikon.verbtyp.notFound')} />
          ) : (
            <>
              <TermLabel term={familieTerm} nameType="title" layout="inline" style={styles.heading} />
              {data.map((tab) => (
                <ParadigmTable key={tab.id} table={tab} />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.five },
  heading: { marginBottom: Spacing.three },
});
