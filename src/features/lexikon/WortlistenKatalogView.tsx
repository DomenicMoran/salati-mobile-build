// Katalog für data/wortlisten.json im Reiter "Grammatik & Ṣarf" (dritter
// Unterreiter "Wortlisten", neben "Begriffe" und "Formentabellen" — siehe
// GrammatikListView.tsx). Nach Handout-Kapitel gegliedert (Wortliste.kapitel),
// mit Suche über Titel + alle enthaltenen arabischen/deutschen Einträge —
// analog zu ParadigmKatalogView.tsx, aber für den eigenen Listen-Datentyp
// statt des {columns,rows,cells}-Rasters (siehe wortlistenTypes.ts).
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
import { AblaufschemaCard, BeispielsatzlisteCard, VergleichstabelleCard, WortlisteCard } from './WortlisteView';
import { hatWortlistenUebersetzung, useWortlistenUebersetzung } from './wortlistenI18nLoader';
import { useWortlistenBestand } from './wortlistenLoader';
import type { Wortliste } from './wortlistenTypes';

function wortlisteTreffer(liste: Wortliste, q: string): boolean {
  if (searchMatches(liste.titleDe, q)) return true;
  return liste.entries.some((e) => searchMatches(e.ar, q) || searchMatches(e.umschrift, q) || searchMatches(e.de, q));
}

export function WortlistenKatalogView() {
  const { t, locale } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [query, setQuery] = useState('');
  const { data, isLoading, isError } = useWortlistenBestand();

  // Übersetzungsbündel für die aktive Sprache (siehe wortlistenI18nLoader.ts)
  // — `de` und (noch) nicht übersetzte Sprachen liefern `null`, dann rendern
  // die Karten unten die deutschen Felder direkt (Fallback in WortlisteView.tsx).
  const brauchtUebersetzung = locale !== 'de' && hatWortlistenUebersetzung(locale);
  const uebersetzungQuery = useWortlistenUebersetzung(locale);
  const uebersetzung = brauchtUebersetzung ? (uebersetzungQuery.data ?? null) : null;
  // Der Hinweis "nur auf Deutsch" gilt nur, solange für die aktive Sprache
  // keine vollständige Übersetzung vorliegt — sobald `uebersetzung` geladen
  // ist, entfällt er (Sprachparität wird per Test erzwungen, siehe
  // wortlisten-sprachparitaet.test.ts, ein unvollständiges Bündel kann also
  // nicht unbemerkt ausgeliefert werden). Für `de` selbst und für Sprachen
  // ohne (noch) vorhandenes Bündel bleibt `uebersetzung` `null` -> Hinweis
  // bleibt sichtbar.
  const zeigeGermanOnlyHinweis = uebersetzung === null;

  const kapitelOrder = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const order: string[] = [];
    for (const liste of data.wortlisten) {
      if (!seen.has(liste.kapitel)) {
        seen.add(liste.kapitel);
        order.push(liste.kapitel);
      }
    }
    for (const liste of data.beispielsatzlisten) {
      if (!seen.has(liste.kapitel)) {
        seen.add(liste.kapitel);
        order.push(liste.kapitel);
      }
    }
    for (const schema of data.ablaufschemata) {
      if (!seen.has(schema.kapitel)) {
        seen.add(schema.kapitel);
        order.push(schema.kapitel);
      }
    }
    for (const tabelle of data.vergleichstabellen) {
      if (!seen.has(tabelle.kapitel)) {
        seen.add(tabelle.kapitel);
        order.push(tabelle.kapitel);
      }
    }
    return order.sort((a, b) => normalizeForSearch(a).localeCompare(normalizeForSearch(b)));
  }, [data]);

  const gesamtzahl =
    (data?.wortlisten.length ?? 0) +
    (data?.beispielsatzlisten.length ?? 0) +
    (data?.ablaufschemata.length ?? 0) +
    (data?.vergleichstabellen.length ?? 0);

  const treffer = useMemo(() => {
    const q = query.trim();
    if (!q || !data) return null;
    return data.wortlisten.filter((liste) => wortlisteTreffer(liste, q));
  }, [data, query]);

  if (isLoading || (brauchtUebersetzung && uebersetzungQuery.isLoading)) {
    return (
      <View style={styles.center}>
        <ThemedActivityIndicator />
        <ThemedText type="small" themeColor="textSecondary">
          {t('lexikon.grammar.loading')}
        </ThemedText>
      </View>
    );
  }

  if (isError || !data || gesamtzahl === 0) {
    return <EmptyState icon="alert-circle-outline" title={t('lexikon.grammar.loadError')} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {zeigeGermanOnlyHinweis ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('lexikon.grammar.wortlisten.germanOnlyMeaningNote')}
        </ThemedText>
      ) : null}

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
        {t('lexikon.grammar.wortlisten.listCount').replace('{n}', String(gesamtzahl))}
      </ThemedText>

      {treffer ? (
        treffer.length === 0 ? (
          <EmptyState icon="search" title={t('lexikon.grammar.tables.noResults')} />
        ) : (
          treffer.map((liste) => (
            <WortlisteCard key={liste.id} liste={liste} uebersetzung={uebersetzung?.wortlisten[liste.id]} />
          ))
        )
      ) : (
        kapitelOrder.map((kapitel) => (
          <Aufklappbar key={kapitel} titel={uebersetzung?.kapitel[kapitel] ?? kapitel}>
            {(data.wortlisten ?? []).filter((l) => l.kapitel === kapitel).map((liste) => (
              <WortlisteCard key={liste.id} liste={liste} uebersetzung={uebersetzung?.wortlisten[liste.id]} />
            ))}
            {(data.beispielsatzlisten ?? []).filter((l) => l.kapitel === kapitel).map((liste) => (
              <BeispielsatzlisteCard
                key={liste.id}
                liste={liste}
                uebersetzung={uebersetzung?.beispielsatzlisten[liste.id]}
              />
            ))}
            {(data.ablaufschemata ?? []).filter((s) => s.kapitel === kapitel).map((schema) => (
              <AblaufschemaCard key={schema.id} schema={schema} uebersetzung={uebersetzung?.ablaufschemata[schema.id]} />
            ))}
            {(data.vergleichstabellen ?? []).filter((v) => v.kapitel === kapitel).map((tabelle) => (
              <VergleichstabelleCard
                key={tabelle.id}
                tabelle={tabelle}
                uebersetzung={uebersetzung?.vergleichstabellen[tabelle.id]}
              />
            ))}
          </Aufklappbar>
        ))
      )}
    </ScrollView>
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
  note: { marginBottom: Spacing.two },
  count: { marginBottom: Spacing.two },
});
