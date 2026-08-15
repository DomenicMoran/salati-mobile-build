// App-weite Suche: EINE Eingabe, Top-Treffer aus Koran/Hadith/Duas/Kursen
// gleichzeitig. Baut KEINEN eigenen Suchindex — nutzt parallel die bereits
// vorhandenen Endpunkte/Loader der einzelnen Bereiche (Quran-API,
// Hadith-Sammlungen, lokale Duas-/Kurs-Daten) und kappt sie auf Top-N je
// Kategorie (siehe features/search/aggregate.ts für die reine Aggregations-
// Logik). Tippen auf einen Treffer navigiert zur jeweils bestehenden
// Detail-Route (Quran-Reader, Hadith-Detail, Duas-Kategorie, Kurs).
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { ALL_DUAS, categoryLabel, duaTranslation } from '@/features/duas/hooks';
import { COLLECTIONS, fetchHadithCollection } from '@/features/hadith/api';
import { parseHighlightedText, searchQuran } from '@/features/quran/api';
import { useSurahList } from '@/features/quran/hooks';
import {
  capQuranResults,
  EMPTY_SEARCH_RESULTS,
  filterCourses,
  filterDuas,
  hadithHitsForCollection,
  hasAnyResults,
  mergeHadithHits,
  MIN_QUERY_LENGTH,
  type GlobalSearchResults,
} from '@/features/search/aggregate';
import { useSettings } from '@/features/settings/store';
import { COURSE_META } from '@/features/study/courses';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';
import { queryClient } from '@/lib/queryClient';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface Section {
  key: keyof GlobalSearchResults;
  icon: IconName;
  labelKey: string;
  count: number;
}

export default function GlobalSearchScreen() {
  const { t, locale } = useTranslation();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data: surahs } = useSurahList();
  const rtl = isRtlLocale(locale);

  const [query, setQuery] = useState('');
  // 400ms Debounce (gleiches Muster wie Stadtsuche in onboarding.tsx/
  // settings.tsx und Koran-Suche): ohne Bremse würde jeder Tastendruck sofort
  // Requests an quran.com + bis zu 13 Hadith-Sammlungen auslösen.
  const debouncedQuery = useDebounced(query, 400);

  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_SEARCH_RESULTS);
  const [loading, setLoading] = useState(false);
  const runIdRef = useRef(0);

  // Kurs-Metadaten liegen ohne Texte vor (siehe study/courses.ts) — Titel/
  // Beschreibung kommen synchron aus i18n, kein JSON-Nachladen für die Suche.
  const courseItems = useMemo(
    () =>
      COURSE_META.filter((c) => c.lessonCount > 0).map((c) => ({
        id: c.id,
        title: t(`study.courses.${c.id}.title`),
        desc: t(`study.courses.${c.id}.desc`),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t() hängt nur an locale, nicht an der (jedes Render neuen) Funktionsreferenz
    [locale],
  );

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    const run = ++runIdRef.current;
    (async () => {
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults(EMPTY_SEARCH_RESULTS);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [quranResponse, hadithPerCollection] = await Promise.all([
        searchQuran(trimmed, locale, 1).catch(() => null),
        // Alle Sammlungen parallel statt sequentiell (anders als die
        // dedizierte Hadith-Suche mit Fortschrittsbalken) — hier reicht ein
        // kompakter Top-N-Überblick, kein vollständiges Durchblättern.
        Promise.all(
          COLLECTIONS.map(async (c) => {
            try {
              const data = await queryClient.fetchQuery({
                queryKey: ['hadith', 'collection', c.id, settings.hadithLanguage],
                queryFn: () => fetchHadithCollection(c.id, settings.hadithLanguage),
                staleTime: STATIC_STALE_TIME,
              });
              return hadithHitsForCollection(data.hadiths, c.id, c.name, trimmed);
            } catch {
              return []; // einzelne Sammlung nicht erreichbar — Rest läuft weiter
            }
          }),
        ),
      ]);
      if (runIdRef.current !== run) return; // neue Suche inzwischen gestartet
      setResults({
        quran: quranResponse ? capQuranResults(quranResponse.results) : [],
        hadith: mergeHadithHits(hadithPerCollection),
        duas: filterDuas(ALL_DUAS, trimmed, locale),
        courses: filterCourses(courseItems, trimmed),
      });
      setLoading(false);
    })();
  }, [debouncedQuery, locale, settings.hadithLanguage, courseItems]);

  const allSections: Section[] = [
    { key: 'quran', icon: 'book', labelKey: 'search.sectionQuran', count: results.quran.length },
    { key: 'hadith', icon: 'library', labelKey: 'search.sectionHadith', count: results.hadith.length },
    { key: 'duas', icon: 'hand-left', labelKey: 'search.sectionDuas', count: results.duas.length },
    { key: 'courses', icon: 'school', labelKey: 'search.sectionCourses', count: results.courses.length },
  ];
  const sections = allSections.filter((s) => s.count > 0);

  const trimmedQuery = debouncedQuery.trim();
  const showHint = trimmedQuery.length < MIN_QUERY_LENGTH;
  const showEmpty = !showHint && !loading && !hasAnyResults(results);

  let itemIndex = 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('search.title')} />

        <ThemedView type="backgroundElement" style={[styles.searchBox, rtl && styles.searchBoxRtl]}>
          <IconSymbol name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
            autoFocus
            accessibilityLabel={t('a11y.search')}
          />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {showHint && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {t('search.hint')}
            </ThemedText>
          )}

          {loading && (
            <View style={styles.center}>
              <ThemedActivityIndicator />
            </View>
          )}

          {showEmpty && (
            <EmptyState icon="search-outline" title={t('search.noResults').replace('{query}', trimmedQuery)} />
          )}

          {!loading &&
            sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <IconSymbol name={section.icon} size={16} color={colors.accent} />
                  <ThemedText type="smallBold" themeColor="accent" style={styles.sectionTitle}>
                    {t(section.labelKey)}
                  </ThemedText>
                </View>

                {section.key === 'quran' &&
                  results.quran.map((item) => {
                    const meta = surahs?.find((s) => s.number === item.surah);
                    const index = itemIndex++;
                    return (
                      <AnimatedListItem key={item.verseKey} index={index}>
                        <PressableCard
                          onPress={() =>
                            router.push({ pathname: '/quran/[surah]', params: { surah: item.surah, ayah: item.ayah } })
                          }
                          style={styles.resultCard}>
                          <ThemedText type="small" themeColor="accent">
                            {meta?.englishName ?? t('quran.surahN').replace('{n}', String(item.surah))} · {t('quran.verse')} {item.ayah}
                          </ThemedText>
                          <ThemedText type="default" numberOfLines={1} style={styles.arabicSmall}>
                            {item.arabicText}
                          </ThemedText>
                          {item.translationHtml && (
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                              {parseHighlightedText(item.translationHtml).map((seg, i) => (
                                <ThemedText
                                  key={i}
                                  type="small"
                                  themeColor={seg.bold ? 'accent' : 'textSecondary'}
                                  style={seg.bold ? styles.bold : undefined}>
                                  {seg.text}
                                </ThemedText>
                              ))}
                            </ThemedText>
                          )}
                        </PressableCard>
                      </AnimatedListItem>
                    );
                  })}

                {section.key === 'hadith' &&
                  results.hadith.map((item) => {
                    const index = itemIndex++;
                    return (
                      <AnimatedListItem key={`${item.collectionId}-${item.hadith.hadithnumber}`} index={index}>
                        <PressableCard
                          onPress={() =>
                            router.push({
                              pathname: '/hadith/[collection]/[number]',
                              params: { collection: item.collectionId, number: String(item.hadith.hadithnumber) },
                            })
                          }
                          style={styles.resultCard}>
                          <ThemedText type="smallBold" themeColor="accent">
                            {item.collectionName} · {item.hadith.hadithnumber}
                          </ThemedText>
                          <ThemedText type="small" numberOfLines={2}>
                            {item.hadith.translation}
                          </ThemedText>
                        </PressableCard>
                      </AnimatedListItem>
                    );
                  })}

                {section.key === 'duas' &&
                  results.duas.map((item) => {
                    const index = itemIndex++;
                    const translation = duaTranslation(item, locale);
                    return (
                      <AnimatedListItem key={item.id} index={index}>
                        <PressableCard
                          onPress={() => router.push({ pathname: '/duas/[category]', params: { category: item.category } })}
                          style={styles.resultCard}>
                          <ThemedText type="small" themeColor="accent">
                            {categoryLabel(item.category, locale)}
                          </ThemedText>
                          <ThemedText type="default" numberOfLines={1} style={styles.arabicSmall}>
                            {item.arabic}
                          </ThemedText>
                          {translation && (
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                              {translation}
                            </ThemedText>
                          )}
                        </PressableCard>
                      </AnimatedListItem>
                    );
                  })}

                {section.key === 'courses' &&
                  results.courses.map((item) => {
                    const index = itemIndex++;
                    return (
                      <AnimatedListItem key={item.id} index={index}>
                        <PressableCard
                          onPress={() => router.push({ pathname: '/study/[course]', params: { course: item.id } })}
                          style={styles.resultCard}>
                          <ThemedText type="default">{item.title}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                            {item.desc}
                          </ThemedText>
                        </PressableCard>
                      </AnimatedListItem>
                    );
                  })}
              </View>
            ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
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
  hint: { textAlign: 'center', marginTop: Spacing.four, marginHorizontal: Spacing.four },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.half },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  resultCard: { padding: Spacing.three, gap: Spacing.one, marginBottom: Spacing.two },
  arabicSmall: { fontSize: 18, textAlign: 'right', lineHeight: 28 },
  bold: { fontWeight: '700' },
});
