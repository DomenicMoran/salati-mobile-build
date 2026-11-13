import type { Href } from 'expo-router';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { booksForLocale, fetchAudiobookIndex } from '@/features/audiobooks/data';
import {
  audiobookBooksForBibliothekHub,
  handoutsForBibliothekHub,
  isBibliothekReaderHubHandout,
} from '@/features/bibliothek/catalog';
import { AUDIOBOOK_HUB_TRACKS } from '@/features/audiobooks/tracks';
import { BibliothekHubCover } from '@/features/bibliothek/hub/BibliothekHubCover';
import {
  buildHubCatalogItems,
  filterHubCatalogItems,
  groupHubCatalogByCategory,
  hubCatalogCategories,
  hubCatalogLanguages,
  hubHasOfflineItems,
  hubHasReadProgress,
  hubShelfOfflineItems,
  hubShelfRecentlyAdded,
  sortHubCatalogItems,
  type HubCatalogItem,
  type HubReadFilter,
  type HubSortKey,
} from '@/features/bibliothek/hub/hubCatalog';
import {
  openBibliothekHandout,
  openBibliothekPdf,
  openBibliothekReader,
  openBibliothekReaderView,
  openTafsirBook,
  openTafsirSurah,
} from '@/features/bibliothek/openBook';
import { manifestReviewedAtByHandoutId } from '@/features/bibliothek/hub/manifestReviewedAt';
import { loadHubContinueReading, type HubContinueReading } from '@/features/bibliothek/hubLesefortschritt';
import {
  PDF_LESEFORTSCHRITT_STORAGE_KEY,
  parsePdfLesefortschrittStore,
  type PdfLesefortschrittStore,
} from '@/features/bibliothek/pdfLesefortschritt';
import { fetchHandoutIndex } from '@/features/handouts/data';
import { listHandoutDownloadIds } from '@/features/handouts/downloads';
import { ContentLanguageBadge } from '@/features/media/content-language-badge';
import { handoutsForLocale } from '@/features/media/content-language';
import { TAFSIR_RASSOUL_CREDIT } from '@/features/bibliothek/tafsir/constants';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const TRACK_LABEL_KEYS = Object.fromEntries(AUDIOBOOK_HUB_TRACKS.map((eintrag) => [eintrag.id, eintrag.labelKey]));

export default function BibliothekScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [weiter, setWeiter] = useState<HubContinueReading | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PdfLesefortschrittStore>({});
  const [downloadedIds, setDownloadedIds] = useState<ReadonlySet<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<HubSortKey>('title');
  const [activeLang, setActiveLang] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [readFilter, setReadFilter] = useState<HubReadFilter>('all');

  const index = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });
  const handouts = useQuery({
    queryKey: ['handouts', 'index'],
    queryFn: fetchHandoutIndex,
    staleTime: 60 * 60 * 1000,
  });

  const reloadLocalMeta = useCallback(() => {
    void loadHubContinueReading().then(setWeiter);
    void (async () => {
      const [raw, ids] = await Promise.all([
        AsyncStorage.getItem(PDF_LESEFORTSCHRITT_STORAGE_KEY).catch(() => null),
        listHandoutDownloadIds(),
      ]);
      setPdfProgress(parsePdfLesefortschrittStore(raw));
      setDownloadedIds(new Set(ids));
    })();
  }, []);

  useEffect(() => {
    reloadLocalMeta();
  }, [reloadLocalMeta]);

  useFocusEffect(
    useCallback(() => {
      reloadLocalMeta();
    }, [reloadLocalMeta]),
  );

  const buecherRaw = index.data ? booksForLocale(index.data.entries, locale, TRACK_LABEL_KEYS) : [];
  const buecher = audiobookBooksForBibliothekHub(buecherRaw);
  const unterlagenAll = handoutsForLocale(handouts.data?.handouts ?? [], locale);
  const unterlagen = handoutsForBibliothekHub(unterlagenAll);

  const audiobookLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const b of buecher) labels[b.track] = t(b.trackLabelKey);
    return labels;
  }, [buecher, t]);

  const manifestReviewedAt = useMemo(() => manifestReviewedAtByHandoutId(), []);

  const allCatalogItems = useMemo(
    () =>
      buildHubCatalogItems({
        handouts: unterlagen,
        audiobooks: buecher,
        pdfProgress,
        downloadedIds,
        manifestReviewedAt,
        shortcuts: {
          sectionTitle: t('bibliothek.hub.sectionShortcuts'),
          quranTitle: t('bibliothek.quran'),
          quranNote: t('bibliothek.quranNote'),
          hadithTitle: t('bibliothek.hadith'),
          hadithNote: t('bibliothek.hadithNote'),
          audioTitle: t('bibliothek.audioVideo'),
          audioNote: t('audiobooks.subtitle'),
          tafsirTitle: t('bibliothek.rassoul'),
          tafsirNote: t('bibliothek.rassoulGerman'),
          tafsirAuthor: TAFSIR_RASSOUL_CREDIT,
          allHandoutsTitle: t('bibliothek.allHandouts'),
          allHandoutsNote: t('bibliothek.allHandoutsNote'),
        },
        audiobookSectionTitle: t('bibliothek.hub.sectionAudiobooks'),
        audiobookLabels,
      }),
    [unterlagen, buecher, pdfProgress, downloadedIds, manifestReviewedAt, t, audiobookLabels],
  );

  const categoryOrder = useMemo(() => hubCatalogCategories(allCatalogItems), [allCatalogItems]);
  const languages = useMemo(() => hubCatalogLanguages(allCatalogItems), [allCatalogItems]);
  const showLangFilter = languages.length > 1;
  const showOfflineFilter = hubHasOfflineItems(allCatalogItems);
  const showReadFilter = hubHasReadProgress(allCatalogItems);
  const showCategoryFilter = categoryOrder.length > 1;

  const filteredItems = useMemo(() => {
    const filtered = filterHubCatalogItems(allCatalogItems, {
      lang: activeLang,
      categoryKey: activeCategory,
      offlineOnly,
      read: readFilter,
      query: searchQuery,
    });
  return sortHubCatalogItems(filtered, sortKey);
  }, [allCatalogItems, activeLang, activeCategory, offlineOnly, readFilter, searchQuery, sortKey]);

  const sections = useMemo(
    () => groupHubCatalogByCategory(filteredItems, categoryOrder),
    [filteredItems, categoryOrder],
  );

  const shelfOffline = useMemo(() => hubShelfOfflineItems(allCatalogItems), [allCatalogItems]);
  const shelfRecentAdded = useMemo(() => hubShelfRecentlyAdded(allCatalogItems), [allCatalogItems]);
  const showShelves =
    !searchQuery.trim() &&
    activeLang === null &&
    activeCategory === null &&
    !offlineOnly &&
    readFilter === 'all';

  const weiterSureName =
    weiter?.kind === 'tafsir'
      ? surahNameTranslation(weiter.surah, locale, `Sure ${weiter.surah}`)
      : '';

  const loading = index.isPending || handouts.isPending;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('bibliothek.title')} onBack={() => backOr('/media' as Href)} />
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {weiter ? (
            <PressableCard
              onPress={() => {
                if (weiter.kind === 'tafsir') {
                  openTafsirSurah(weiter.surah, weiter.block);
                } else if (weiter.kind === 'pdf') {
                  openBibliothekReaderView({ bookId: weiter.bookId, page: weiter.page });
                } else {
                  router.push(weiter.href as Href);
                }
              }}
              style={styles.continueCard}
              accessibilityRole="button"
              accessibilityLabel={t(weiter.labelKey)}>
              <View style={styles.continueRow}>
                <BibliothekHubCover
                  title={weiter.kind === 'tafsir' ? weiterSureName : weiter.title}
                />
                <View style={styles.continueText}>
                  <ThemedText type="smallBold" style={{ color: colors.accent }}>
                    {t(weiter.labelKey)}
                  </ThemedText>
                  {weiter.kind === 'tafsir' ? (
                    <>
                      <ThemedText type="default">{weiterSureName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('bibliothek.savedPlace')}
                      </ThemedText>
                    </>
                  ) : weiter.kind === 'pdf' ? (
                    <>
                      <ThemedText type="default">{weiter.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {weiter.chapterTitle} · {t('bibliothek.readerPage').replace('{{page}}', String(weiter.page))}{' '}
                        · {t('bibliothek.readerPercent').replace('{{percent}}', String(weiter.percent))}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText type="default">{weiter.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('bibliothek.readerPercent').replace('{{percent}}', String(weiter.percent))}
                      </ThemedText>
                    </>
                  )}
                </View>
              </View>
            </PressableCard>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            {t('bibliothek.subtitle')}
          </ThemedText>

          <View style={[styles.searchWrap, { backgroundColor: colors.backgroundElement, borderColor: colors.separator }]}>
            <IconSymbol name="search" size={18} color={colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('bibliothek.hub.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.text }]}
              accessibilityLabel={t('bibliothek.hub.searchPlaceholder')}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          <HubSortRow sortKey={sortKey} onChange={setSortKey} />

          {showShelves && shelfOffline.length > 0 ? (
            <HubShelf
              title={t('bibliothek.hub.sectionMyBooks')}
              items={shelfOffline}
              locale={locale}
              horizontal
            />
          ) : null}

          {showShelves && shelfRecentAdded.length > 0 ? (
            <HubShelf
              title={t('bibliothek.hub.sectionRecentlyAdded')}
              items={shelfRecentAdded}
              locale={locale}
              horizontal
            />
          ) : null}

          {(showLangFilter || showCategoryFilter || showOfflineFilter || showReadFilter) && (
            <HubFilterChips
              languages={languages}
              categories={categoryOrder}
              activeLang={activeLang}
              activeCategory={activeCategory}
              offlineOnly={offlineOnly}
              readFilter={readFilter}
              showLang={showLangFilter}
              showCategory={showCategoryFilter}
              showOffline={showOfflineFilter}
              showRead={showReadFilter}
              onLang={setActiveLang}
              onCategory={setActiveCategory}
              onOffline={setOfflineOnly}
              onRead={setReadFilter}
            />
          )}

          {loading ? <ThemedActivityIndicator style={styles.loader} /> : null}

          {!loading && sections.length === 0 ? (
            <EmptyState icon="document-text" title={t('bibliothek.hub.emptyFiltered')} />
          ) : null}

          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="folder-outline" size={15} color={colors.textSecondary} />
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeaderText}>
                  {section.title.toUpperCase()}
                </ThemedText>
              </View>
              {section.items.map((item) => (
                <HubItemCard key={item.id} item={item} locale={locale} />
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HubSortRow({ sortKey, onChange }: { sortKey: HubSortKey; onChange: (k: HubSortKey) => void }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const options: { key: HubSortKey; label: string }[] = [
    { key: 'title', label: t('bibliothek.hub.sortTitle') },
    { key: 'author', label: t('bibliothek.hub.sortAuthor') },
    { key: 'recent', label: t('bibliothek.hub.sortRecent') },
    { key: 'added', label: t('bibliothek.hub.sortAdded') },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((opt) => {
        const active = sortKey === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.filterChip, { backgroundColor: active ? colors.accent : colors.backgroundElement }]}>
            <ThemedText type="small" style={{ color: active ? colors.background : colors.text }}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type FilterChipsProps = {
  languages: readonly string[];
  categories: readonly { key: string; title: string }[];
  activeLang: string | null;
  activeCategory: string | null;
  offlineOnly: boolean;
  readFilter: HubReadFilter;
  showLang: boolean;
  showCategory: boolean;
  showOffline: boolean;
  showRead: boolean;
  onLang: (lang: string | null) => void;
  onCategory: (key: string | null) => void;
  onOffline: (v: boolean) => void;
  onRead: (v: HubReadFilter) => void;
};

function HubFilterChips(props: FilterChipsProps) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {props.showLang ? (
        <>
          <FilterChip
            label={t('bibliothek.hub.filterAll')}
            active={props.activeLang === null}
            onPress={() => props.onLang(null)}
          />
          {props.languages.map((lang) => (
            <FilterChip
              key={lang}
              label={lang.toUpperCase()}
              active={props.activeLang === lang}
              onPress={() => props.onLang(props.activeLang === lang ? null : lang)}
            />
          ))}
        </>
      ) : null}
      {props.showCategory ? (
        <>
          <FilterChip
            label={t('bibliothek.hub.filterAllCategories')}
            active={props.activeCategory === null}
            onPress={() => props.onCategory(null)}
          />
          {props.categories
            .filter((c) => c.key !== '__shortcuts__')
            .map((cat) => (
              <FilterChip
                key={cat.key}
                label={cat.title}
                active={props.activeCategory === cat.key}
                onPress={() => props.onCategory(props.activeCategory === cat.key ? null : cat.key)}
              />
            ))}
        </>
      ) : null}
      {props.showOffline ? (
        <FilterChip
          label={t('bibliothek.hub.filterOffline')}
          active={props.offlineOnly}
          onPress={() => props.onOffline(!props.offlineOnly)}
        />
      ) : null}
      {props.showRead ? (
        <>
          <FilterChip
            label={t('bibliothek.hub.filterAll')}
            active={props.readFilter === 'all'}
            onPress={() => props.onRead('all')}
          />
          <FilterChip
            label={t('bibliothek.hub.filterInProgress')}
            active={props.readFilter === 'in_progress'}
            onPress={() => props.onRead('in_progress')}
          />
          <FilterChip
            label={t('bibliothek.hub.filterRead')}
            active={props.readFilter === 'finished'}
            onPress={() => props.onRead('finished')}
          />
        </>
      ) : null}
    </ScrollView>
  );

  function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[styles.filterChip, { backgroundColor: active ? colors.accent : colors.backgroundElement }]}>
        <ThemedText type="small" style={{ color: active ? colors.background : colors.text }} numberOfLines={1}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }
}

function HubShelf({
  title,
  items,
  locale,
  horizontal,
}: {
  title: string;
  items: HubCatalogItem[];
  locale: string;
  horizontal?: boolean;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const body = items.map((item) => (
    <View key={item.id} style={horizontal ? styles.shelfCard : undefined}>
      <HubItemCard item={item} locale={locale} compact={horizontal} />
    </View>
  ));
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <IconSymbol name="bookmark-outline" size={15} color={colors.textSecondary} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeaderText}>
          {title.toUpperCase()}
        </ThemedText>
      </View>
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

function HubItemCard({
  item,
  locale,
  compact,
}: {
  item: HubCatalogItem;
  locale: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const onPress = () => {
    switch (item.openKind) {
      case 'handout':
        if (item.handoutId) {
          if (isBibliothekReaderHubHandout(item.handoutId)) {
            openBibliothekReader({ bookId: item.handoutId });
          } else {
            openBibliothekHandout({ id: item.handoutId });
          }
        }
        break;
      case 'audiobook-pdf':
        if (item.audiobookPdf) {
          openBibliothekPdf({
            pdfUrl: item.audiobookPdf.pdfUrl,
            title: item.audiobookPdf.displayTitle,
          });
        }
        break;
      case 'route-quran':
        router.push('/quran' as Href);
        break;
      case 'route-hadith':
        router.push('/hadith' as Href);
        break;
      case 'route-audiobooks':
        router.push('/audiobooks' as Href);
        break;
      case 'route-tafsir':
        openTafsirBook();
        break;
      case 'route-all-handouts':
        router.push('/handouts' as Href);
        break;
      default:
        break;
    }
  };

  return (
    <PressableCard onPress={onPress} style={[styles.row, compact ? styles.shelfTile : null]} type="backgroundElement">
      <View style={styles.rowInner}>
        <BibliothekHubCover title={item.title} compact={compact} />
        <View style={styles.rowText}>
          <ThemedText type="default" numberOfLines={2}>
            {item.title}
          </ThemedText>
          {item.subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {item.subtitle}
            </ThemedText>
          ) : null}
          {item.author ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {item.author}
            </ThemedText>
          ) : null}
          <View style={styles.metaRow}>
            {item.pages && item.pages > 0 ? (
              <ThemedText type="small" themeColor="accent">
                {t('bibliothek.hub.pagesMeta').replace('{{pages}}', String(item.pages))}
              </ThemedText>
            ) : null}
            {typeof item.readPercent === 'number' && item.readPercent > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('bibliothek.hub.percentRead').replace('{{percent}}', String(item.readPercent))}
              </ThemedText>
            ) : null}
            {item.offline ? (
              <View accessibilityLabel={t('handouts.offline')} accessibilityRole="image">
                <IconSymbol name="cloud-done" size={14} color={colors.accent} />
              </View>
            ) : null}
            {item.lang ? <ContentLanguageBadge lang={item.lang} compact /> : null}
            {item.openKind === 'route-tafsir' && locale !== 'de' ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('bibliothek.tafsirGermanOnly')}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <DisclosureChevron color={colors.textSecondary} />
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  continueCard: { padding: Spacing.three },
  continueRow: { flexDirection: 'row', alignItems: 'center' },
  continueText: { flex: 1, gap: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.one },
  chipRow: { gap: Spacing.one, paddingVertical: Spacing.one },
  filterChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  section: { gap: Spacing.one },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.one },
  sectionHeaderText: { letterSpacing: 0.6 },
  row: { padding: Spacing.two },
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  loader: { marginTop: Spacing.three },
  shelfRow: { gap: Spacing.two, paddingVertical: Spacing.one },
  shelfCard: { width: 280 },
  shelfTile: { minHeight: 88 },
});
