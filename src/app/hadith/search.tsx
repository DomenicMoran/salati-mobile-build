// Hadith-Suche. Sucht an zwei Stellen zugleich:
//
//   1. im VOLLTEXT von An-Nawawi 40 (liegt im App-Paket, also auch offline),
//   2. in den THEMEN der HadeethEnc-Enzyklopädie.
//
// Warum nicht im Volltext der Enzyklopädie: sie ist nach Kategorien geordnet
// und liefert Hadithe nur kategorieweise. Ein Volltext-Durchlauf über den
// deutschen Bestand wären 274 Seitenabrufe — bei JEDER Suche, gegen einen
// Anbieter, der uns seine Daten unentgeltlich überlässt. Die Themensuche führt
// mit einem einzigen Abruf zur passenden Kategorie; von dort ist der Weg zum
// Hadith kurz.
//
// (Bis zum Lizenz-Audit am 30.07.2026 lief die Suche über zehn Sammlungen aus
// einem Fremd-Datensatz. Der ist entfallen, weil sich bei seinen Übersetzungen
// die Rechtekette nicht belegen ließ — s. docs/LIZENZ-AUDIT-2026-07-30.md.)
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { COLLECTIONS, fetchHadithCollection, type HadithWithTranslation } from '@/features/hadith/api';
import { fetchHadeethencCategories, type HadeethencCategory } from '@/features/hadith/hadeethenc';
import { filterHadiths } from '@/features/hadith/hooks';
import { useSettings } from '@/features/settings/store';
import { queryClient } from '@/lib/queryClient';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;
/** Obergrenze je Sammlung, damit häufige Wörter die Liste nicht fluten. */
const MAX_PER_COLLECTION = 15;

interface CrossResult {
  collectionId: string;
  collectionName: string;
  hadith: HadithWithTranslation;
}

/** Treffer in den Themen der Enzyklopädie — führt zur Kategorie, nicht zum Hadith. */
interface ThemenTreffer {
  id: string;
  titel: string;
  anzahl: number;
}

export default function HadithCrossSearchScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CrossResult[]>([]);
  const [themen, setThemen] = useState<ThemenTreffer[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const runIdRef = useRef(0);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    const run = ++runIdRef.current;
    setResults([]);
    setThemen([]);
    setProgress(0);

    // Themen zuerst: ein Abruf, sofort da, und bei der Enzyklopädie der
    // eigentliche Weg zum Bestand.
    try {
      const kategorien = await queryClient.fetchQuery({
        queryKey: ['hadeethenc', 'categories', settings.hadithLanguage],
        queryFn: () => fetchHadeethencCategories(settings.hadithLanguage),
        staleTime: STATIC_STALE_TIME,
      });
      const norm = q.toLocaleLowerCase();
      const treffer = (kategorien as HadeethencCategory[])
        .filter((k) => k.title.toLocaleLowerCase().includes(norm))
        .slice(0, MAX_PER_COLLECTION)
        .map((k) => ({ id: k.id, titel: k.title, anzahl: k.count }));
      if (runIdRef.current === run) setThemen(treffer);
    } catch {
      // Ohne Netz bleibt die Volltextsuche in An-Nawawi 40 — die ist lokal.
    }

    const acc: CrossResult[] = [];
    for (let i = 0; i < COLLECTIONS.length; i++) {
      if (runIdRef.current !== run) return; // neue Suche gestartet
      const c = COLLECTIONS[i];
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ['hadith', 'collection', c.id, settings.hadithLanguage],
          queryFn: () => fetchHadithCollection(c.id, settings.hadithLanguage),
          staleTime: STATIC_STALE_TIME,
        });
        const hits = filterHadiths(data.hadiths, q).slice(0, MAX_PER_COLLECTION);
        acc.push(...hits.map((h) => ({ collectionId: c.id, collectionName: c.name, hadith: h })));
        if (runIdRef.current === run) setResults([...acc]);
      } catch {
        // Einzelne Sammlung nicht erreichbar — Suche läuft weiter.
      }
      if (runIdRef.current === run) setProgress(i + 1);
    }
    if (runIdRef.current === run) setProgress(COLLECTIONS.length);
  }

  // Ausweg aus dem Null-Treffer-Zustand (Audit 2026-07-27, N10): Suchfeld und
  // Ergebnisliste zurücksetzen, statt den Nutzer vor einer leeren Seite ohne
  // Handlungsangebot stehen zu lassen.
  function clearSearch() {
    runIdRef.current++;
    setQuery('');
    setResults([]);
    setThemen([]);
    setProgress(null);
  }

  const searching = progress !== null && progress < COLLECTIONS.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('hadith.searchTitle')} subtitle={t('hadith.searchAllHint')} />

        <View style={styles.searchRow}>
          <ThemedView type="backgroundElement" style={styles.inputWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              placeholder={t('hadith.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text }]}
              returnKeyType="search"
              accessibilityLabel={t('a11y.search')}
            />
          </ThemedView>
          <Pressable
            onPress={runSearch}
            disabled={query.trim().length < 3 || searching}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.search')}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <ThemedView type="backgroundSelected" style={styles.searchBtn}>
              <IconSymbol name="search" size={18} color={colors.accent} />
            </ThemedView>
          </Pressable>
        </View>

        {progress !== null && (
          <View style={styles.progressRow}>
            {searching && <ThemedActivityIndicator size="small" />}
            <ThemedText type="small" themeColor="textSecondary">
              {t('hadith.searchedProgress')
                .replace('{x}', String(progress))
                .replace('{y}', String(COLLECTIONS.length))}
              {' · '}
              {t('hadith.resultsCount').replace('{n}', String(results.length))}
            </ThemedText>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(r) => `${r.collectionId}-${r.hadith.hadithnumber}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            themen.length > 0 ? (
              <View style={styles.themenBlock}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('hadith.topicsTitle')}
                </ThemedText>
                {themen.map((th) => (
                  <PressableCard
                    key={th.id}
                    onPress={() =>
                      router.push({ pathname: '/hadith/topics/[category]', params: { category: th.id } })
                    }
                    style={styles.resultCard}>
                    <ThemedText type="small">{th.titel}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {th.anzahl}
                    </ThemedText>
                  </PressableCard>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            progress === COLLECTIONS.length && themen.length === 0 ? (
              <EmptyState
                icon="search-outline"
                title={t('hadith.noResults')}
                actionLabel={t('common.clearSearch')}
                onAction={clearSearch}
                style={styles.empty}
              />
            ) : null
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <PressableCard
                onPress={() =>
                  router.push({
                    pathname: '/hadith/[collection]/[number]',
                    params: { collection: item.collectionId, number: String(item.hadith.hadithnumber) },
                  })
                }
                style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {item.collectionName} · {item.hadith.hadithnumber}
                  </ThemedText>
                </View>
                <ThemedText type="small" numberOfLines={3}>
                  {item.hadith.translation}
                </ThemedText>
              </PressableCard>
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  themenBlock: { gap: Spacing.two, marginBottom: Spacing.three },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  inputWrap: { flex: 1, borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  input: { paddingVertical: Spacing.two, fontSize: 15 },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.five,
  },
  resultCard: { padding: Spacing.three, gap: Spacing.one },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
