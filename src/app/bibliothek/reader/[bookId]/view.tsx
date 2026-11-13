import type { Href } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { BibliothekPdfJsReader } from '@/features/bibliothek/pdfjs/BibliothekPdfJsReader';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { chapterAtPage } from '@/features/bibliothek/allinone/chapterToc';
import type { PdfLesefortschritt } from '@/features/bibliothek/pdfLesefortschritt';
import { resolveBibliothekPdfUrl } from '@/features/bibliothek/bibliothekPdfOffline';
import { addBibliothekPdfHighlight, savePdfLesefortschritt } from '@/features/bibliothek/pdfReaderStorage';
import { resolveReaderBook } from '@/features/bibliothek/readerBook';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

export default function BibliothekReaderViewScreen() {
  const params = useLocalSearchParams<{ bookId?: string; page?: string; pdfUrl?: string }>();
  const bookId = typeof params.bookId === 'string' ? params.bookId : '';
  const pdfOverride = typeof params.pdfUrl === 'string' ? decodeURIComponent(params.pdfUrl) : undefined;
  const pageParam = typeof params.page === 'string' ? Number.parseInt(params.page, 10) : NaN;
  const startPage = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : undefined;
  const { t } = useTranslation();
  const [immersive, setImmersive] = useState(false);
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(null);

  const config = useMemo(() => resolveReaderBook(bookId, pdfOverride), [bookId, pdfOverride]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void resolveBibliothekPdfUrl(config.bookId, config.pdfUrl).then((url) => {
      if (!cancelled) setResolvedPdfUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const onPageChange = useCallback(
    async (page: number) => {
      if (!config) return;
      const chapter = chapterAtPage(config.chapters, page) ?? config.chapters[0];
      if (!chapter) return;
      const entry: PdfLesefortschritt = {
        bookId: config.bookId,
        chapterSlug: chapter.slug,
        chapterTitle: chapter.title,
        page,
        updatedAt: new Date().toISOString(),
      };
      await savePdfLesefortschritt(entry);
    },
    [config],
  );

  if (!config) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('bibliothek.title')} onBack={() => backOr('/bibliothek' as Href)} />
          <View style={styles.empty}>
            <EmptyState icon="document-text" title={t('bibliothek.readerUnavailable')} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={immersive ? [] : ['top', 'left', 'right']}>
        {!immersive ? (
          <ScreenHeader
            title={config.title}
            onBack={() => backOr(`/bibliothek/reader/${config.bookId}` as Href)}
          />
        ) : null}
        {resolvedPdfUrl ? (
          <BibliothekPdfJsReader
            title={config.title}
            pdfUrl={resolvedPdfUrl}
            bookId={config.bookId}
            startPage={startPage}
            immersive={immersive}
            onToggleImmersive={() => setImmersive((v) => !v)}
            onPageChange={(page) => void onPageChange(page)}
            onTextSelected={(page, text) => {
              void addBibliothekPdfHighlight({ bookId: config.bookId, page, text });
            }}
          />
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  empty: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
