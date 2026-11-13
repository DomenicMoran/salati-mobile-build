import type { Href } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PressableCard } from '@/components/ui/pressable-card';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { isHandoutDownloaded } from '@/features/handouts/downloads';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import type { BibliothekPdfBookmark } from '@/features/bibliothek/bookmarks';
import type { BibliothekPdfHighlight } from '@/features/bibliothek/pdfHighlights';
import { filterChaptersByQuery } from '@/features/bibliothek/chapterTocSearch';
import { resolveBibliothekPdfUrl } from '@/features/bibliothek/bibliothekPdfOffline';
import type { PdfLesefortschritt } from '@/features/bibliothek/pdfLesefortschritt';
import { BibliothekBookDetailsSheet } from '@/features/bibliothek/BibliothekBookDetailsSheet';
import { BibliothekReaderSelectionBar } from '@/features/bibliothek/BibliothekReaderSelectionBar';
import { resolveBibliothekBookDetails } from '@/features/bibliothek/bookManifestDetails';
import { buildBibliothekHighlightsMarkdown } from '@/features/bibliothek/exportBibliothekMarkdown';
import { formatBibliothekQuoteShare } from '@/features/bibliothek/formatBibliothekQuote';
import {
  resolveDictionaryLookupTarget,
  systemDictionarySearchUrl,
} from '@/features/bibliothek/dictionaryLookup';
import { bibliothekPagesToday, bibliothekReadingStreak, loadBibliothekReadingStats } from '@/features/bibliothek/readingStats';
import { useBibliothekReadingSession } from '@/features/bibliothek/useBibliothekReadingSession';
import { BibliothekPdfJsReader } from '@/features/bibliothek/pdfjs/BibliothekPdfJsReader';
import { chapterForPage } from '@/features/bibliothek/pdfjs/chapterForPage';
import {
  addBibliothekPdfBookmark,
  addBibliothekPdfHighlight,
  loadBibliothekPdfBookmarks,
  loadBibliothekPdfHighlights,
  loadPdfLesefortschritt,
  savePdfLesefortschritt,
} from '@/features/bibliothek/pdfReaderStorage';
import { resolveReaderBook } from '@/features/bibliothek/readerBook';
import type { ReaderChapterTocEntry } from '@/features/bibliothek/allinone/types';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

export default function BibliothekReaderScreen() {
  const params = useLocalSearchParams<{ bookId?: string; pdfUrl?: string }>();
  const bookId = typeof params.bookId === 'string' ? params.bookId : '';
  const pdfOverride = typeof params.pdfUrl === 'string' ? decodeURIComponent(params.pdfUrl) : undefined;
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const config = useMemo(() => resolveReaderBook(bookId, pdfOverride), [bookId, pdfOverride]);

  const [fortschritt, setFortschritt] = useState<PdfLesefortschritt | null>(null);
  const [bookmarks, setBookmarks] = useState<BibliothekPdfBookmark[]>([]);
  const [reading, setReading] = useState(false);
  const [gotoPage, setGotoPage] = useState<number | undefined>(undefined);
  const [initialStartPage, setInitialStartPage] = useState<number>(1);
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(null);
  const [chapterQuery, setChapterQuery] = useState('');
  const [highlights, setHighlights] = useState<BibliothekPdfHighlight[]>([]);
  const [offlineReady, setOfflineReady] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selection, setSelection] = useState<{ page: number; text: string } | null>(null);
  const [readerPage, setReaderPage] = useState(1);
  const [statsTodayPages, setStatsTodayPages] = useState(0);
  const [statsStreak, setStatsStreak] = useState(0);

  const bookDetails = useMemo(
    () => (config ? resolveBibliothekBookDetails(config.bookId) : null),
    [config],
  );

  useBibliothekReadingSession(reading && resolvedPdfUrl != null, readerPage);

  useEffect(() => {
    let cancelled = false;
    void loadBibliothekReadingStats().then((stats) => {
      if (cancelled) return;
      setStatsTodayPages(bibliothekPagesToday(stats));
      setStatsStreak(bibliothekReadingStreak(stats));
    });
    return () => {
      cancelled = true;
    };
  }, [reading, readerPage]);

  const reloadMeta = useCallback(async () => {
    if (!bookId.trim()) return;
    const [prog, bms, hls] = await Promise.all([
      loadPdfLesefortschritt(bookId),
      loadBibliothekPdfBookmarks(bookId),
      loadBibliothekPdfHighlights(bookId),
    ]);
    setFortschritt(prog);
    setBookmarks(bms);
    setHighlights(hls);
  }, [bookId]);

  useEffect(() => {
    if (!bookId.trim()) return;
    let cancelled = false;
    void (async () => {
      const [prog, bms, hls] = await Promise.all([
        loadPdfLesefortschritt(bookId),
        loadBibliothekPdfBookmarks(bookId),
        loadBibliothekPdfHighlights(bookId),
      ]);
      if (cancelled) return;
      setFortschritt(prog);
      setBookmarks(bms);
      setHighlights(hls);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void resolveBibliothekPdfUrl(config.bookId, config.pdfUrl).then((url) => {
      if (!cancelled) setResolvedPdfUrl(url);
    });
    void isHandoutDownloaded(config.bookId).then((ok) => {
      if (!cancelled) setOfflineReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const filteredChapters = useMemo(
    () => (config ? filterChaptersByQuery(config.chapters, chapterQuery) : []),
    [chapterQuery, config],
  );

  const persistPage = useCallback(
    async (page: number) => {
      if (!config) return;
      const chapter = chapterForPage(config.chapters, page);
      if (!chapter) return;
      const entry: PdfLesefortschritt = {
        bookId: config.bookId,
        chapterSlug: chapter.slug,
        chapterTitle: chapter.title,
        page,
        updatedAt: new Date().toISOString(),
      };
      await savePdfLesefortschritt(entry);
      setFortschritt(entry);
    },
    [config],
  );

  const beginReading = useCallback(
    async (chapter: ReaderChapterTocEntry) => {
      if (!config) return;
      const entry: PdfLesefortschritt = {
        bookId: config.bookId,
        chapterSlug: chapter.slug,
        chapterTitle: chapter.title,
        page: chapter.startPage,
        updatedAt: new Date().toISOString(),
      };
      await savePdfLesefortschritt(entry);
      setFortschritt(entry);
      setInitialStartPage(chapter.startPage);
      setGotoPage(chapter.startPage);
      setReading(true);
    },
    [config],
  );

  const jumpToChapter = useCallback(
    (chapter: ReaderChapterTocEntry) => {
      if (!reading) {
        void beginReading(chapter);
        return;
      }
      void persistPage(chapter.startPage);
      setGotoPage(chapter.startPage);
    },
    [beginReading, persistPage, reading],
  );

  const onAddBookmark = useCallback(async () => {
    if (!config) return;
    const chapter =
      fortschritt != null
        ? config.chapters.find((c) => c.slug === fortschritt.chapterSlug)
        : config.chapters[0];
    const title = chapter
      ? fortschritt?.chapterTitle ?? chapter.title
      : config.title;
    const bm = await addBibliothekPdfBookmark({
      bookId: config.bookId,
      title,
      chapterSlug: chapter?.slug ?? fortschritt?.chapterSlug,
      page: fortschritt?.page ?? chapter?.startPage,
    });
    setBookmarks((prev) => [bm, ...prev]);
  }, [config, fortschritt]);

  const onOpenBookmark = useCallback(
    (bm: BibliothekPdfBookmark) => {
      if (!config) return;
      const page = bm.page ?? config.chapters.find((c) => c.slug === bm.chapterSlug)?.startPage;
      if (page == null) return;
      setReading(true);
      setInitialStartPage(page);
      setGotoPage(page);
    },
    [config],
  );

  const onPageChange = useCallback(
    (page: number, _total?: number) => {
      setReaderPage(page);
      void persistPage(page);
    },
    [persistPage],
  );

  const onExportMarkdown = useCallback(async () => {
    if (!config) return;
    const md = buildBibliothekHighlightsMarkdown({
      bookTitle: config.title,
      bookId: config.bookId,
      highlights,
    });
    await Share.share({
      title: t('bibliothek.readerExportTitle'),
      message: md,
    }).catch(() => {});
  }, [config, highlights, t]);

  const onShareQuote = useCallback(async () => {
    if (!config || !selection || !bookDetails) return;
    const message = formatBibliothekQuoteShare({
      quote: selection.text,
      page: selection.page,
      book: bookDetails,
    });
    await Share.share({ message }).catch(() => {});
  }, [bookDetails, config, selection]);

  const onDictionary = useCallback(async () => {
    if (!selection) return;
    const target = resolveDictionaryLookupTarget(selection.text);
    if (!target) return;
    if (target.kind === 'lexicon') {
      router.push({
        pathname: '/lexikon',
        params: { prefill: target.query },
      });
      return;
    }
    const url = systemDictionarySearchUrl(target.query, locale);
    await Linking.openURL(url).catch(() => {});
  }, [locale, selection]);

  if (!config) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('bibliothek.title')} onBack={() => backOr('/bibliothek' as Href)} />
          <View style={styles.emptyWrap}>
            <EmptyState icon="document-text" title={t('bibliothek.readerUnavailable')} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={config.title} onBack={() => backOr('/bibliothek' as Href)}>
          <PressableCard onPress={() => setDetailsOpen(true)} style={styles.aboutBook}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('bibliothek.readerAboutBook')}
            </ThemedText>
          </PressableCard>
        </ScreenHeader>
        {reading && resolvedPdfUrl ? (
          <View style={styles.readerPane}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statsLine}>
              {t('bibliothek.readerStatsToday')
                .replace('{{pages}}', String(statsTodayPages))
                .replace('{{streak}}', String(statsStreak))}
            </ThemedText>
            {selection ? (
              <BibliothekReaderSelectionBar
                onShareQuote={() => void onShareQuote()}
                onLookup={() => void onDictionary()}
                onDismiss={() => setSelection(null)}
              />
            ) : null}
            <BibliothekPdfJsReader
              title={config.title}
              pdfUrl={resolvedPdfUrl}
              bookId={config.bookId}
              startPage={initialStartPage}
              gotoPage={gotoPage}
              onPageChange={onPageChange}
              onTextSelected={(page, text) => {
                setSelection({ page, text });
                void addBibliothekPdfHighlight({ bookId: config.bookId, page, text }).then(() => reloadMeta());
              }}
            />
            <PressableCard onPress={() => setReading(false)} style={styles.tocToggle}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('bibliothek.readerToc')}
              </ThemedText>
            </PressableCard>
          </View>
        ) : (
          <FlatList
            data={filteredChapters}
            keyExtractor={(item) => item.slug}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.header}>
                {fortschritt ? (
                  <PressableCard
                    onPress={() => {
                      setReading(true);
                      setInitialStartPage(fortschritt.page);
                      setGotoPage(fortschritt.page);
                    }}
                    style={styles.continueCard}>
                    <ThemedText type="default" themeColor="accent">
                      {t('bibliothek.continueReading')}
                    </ThemedText>
                    <ThemedText type="default">{fortschritt.chapterTitle}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('bibliothek.savedPlace')} ·{' '}
                      {t('bibliothek.readerPage').replace('{{page}}', String(fortschritt.page))}
                    </ThemedText>
                  </PressableCard>
                ) : null}
                {offlineReady ? (
                  <View style={styles.offlineCard}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('bibliothek.readerOfflineReady')}
                    </ThemedText>
                  </View>
                ) : null}
                <ThemedText type="smallBold">{t('bibliothek.readerToc')}</ThemedText>
                <TextInput
                  value={chapterQuery}
                  onChangeText={setChapterQuery}
                  placeholder={t('bibliothek.readerChapterSearchPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.chapterSearch, { color: colors.text, borderColor: colors.textSecondary }]}
                />
                <View style={styles.bookmarkRow}>
                  <ThemedText type="smallBold">{t('bibliothek.readerBookmarks')}</ThemedText>
                  <PressableCard onPress={() => void onAddBookmark()} style={styles.addBookmark}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('bibliothek.readerAddBookmark')}
                    </ThemedText>
                  </PressableCard>
                </View>
                {bookmarks.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('bibliothek.readerNoBookmarks')}
                  </ThemedText>
                ) : (
                  bookmarks.map((bm) => (
                    <PressableCard key={bm.id} onPress={() => onOpenBookmark(bm)} style={styles.bookmarkItem}>
                      <ThemedText type="default">{bm.title}</ThemedText>
                      {bm.page != null ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('bibliothek.readerPage').replace('{{page}}', String(bm.page))}
                        </ThemedText>
                      ) : null}
                    </PressableCard>
                  ))
                )}
                <View style={styles.bookmarkRow}>
                  <ThemedText type="smallBold">{t('bibliothek.readerHighlights')}</ThemedText>
                  {highlights.length > 0 ? (
                    <PressableCard onPress={() => void onExportMarkdown()} style={styles.addBookmark}>
                      <ThemedText type="smallBold" themeColor="accent">
                        {t('bibliothek.readerExportMd')}
                      </ThemedText>
                    </PressableCard>
                  ) : null}
                </View>
                {highlights.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('bibliothek.readerNoHighlights')}
                  </ThemedText>
                ) : (
                  highlights.slice(0, 8).map((hl) => (
                    <PressableCard
                      key={hl.id}
                      onPress={() => {
                        setReading(true);
                        setInitialStartPage(hl.page);
                        setGotoPage(hl.page);
                      }}
                      style={styles.bookmarkItem}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('bibliothek.readerPage').replace('{{page}}', String(hl.page))}
                      </ThemedText>
                      <ThemedText type="default" numberOfLines={2}>
                        {hl.text}
                      </ThemedText>
                      {hl.note ? (
                        <ThemedText type="small" themeColor="accent">
                          {t('bibliothek.readerHighlightNote')}: {hl.note}
                        </ThemedText>
                      ) : null}
                    </PressableCard>
                  ))
                )}
              </View>
            }
            renderItem={({ item }) => (
              <PressableCard onPress={() => jumpToChapter(item)} style={styles.row}>
                <ThemedText type="default">{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('bibliothek.readerPageRange')
                    .replace('{{from}}', String(item.startPage))
                    .replace('{{to}}', String(item.endPage))}
                </ThemedText>
              </PressableCard>
            )}
          />
        )}
        <BibliothekBookDetailsSheet
          visible={detailsOpen}
          details={bookDetails}
          onClose={() => setDetailsOpen(false)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  readerPane: { flex: 1, minHeight: 280 },
  statsLine: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
  aboutBook: { alignSelf: 'flex-start', paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  tocToggle: {
    alignSelf: 'center',
    marginVertical: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: { gap: Spacing.two, paddingBottom: Spacing.two },
  continueCard: { padding: Spacing.three },
  row: { padding: Spacing.three },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  addBookmark: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  bookmarkItem: { padding: Spacing.two },
  offlineCard: { padding: Spacing.two },
  chapterSearch: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minHeight: 40,
  },
  emptyWrap: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
