import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import {
  parsePdfBridgeInbound,
  serializePdfBridgeOutbound,
  type PdfBridgeInbound,
  type PdfReaderTheme,
} from '@/features/bibliothek/pdfjs/bridge';
import {
  loadPdfReaderPreferences,
  savePdfReaderPreferences,
  type PdfReaderPreferences,
} from '@/features/bibliothek/pdfjs/readerPreferences';
import { resolvePdfReaderShellUri } from '@/features/bibliothek/pdfjs/viewerShell';
import { openBibliothekPdfWithFallback } from '@/features/bibliothek/openBook';
import type { PdfSearchMatch } from '@/features/bibliothek/pdfjs/bridge';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

export type BibliothekPdfJsReaderProps = {
  title: string;
  pdfUrl: string;
  bookId?: string;
  startPage?: number;
  gotoPage?: number;
  compactToolbar?: boolean;
  immersive?: boolean;
  onToggleImmersive?: () => void;
  onPageChange?: (page: number, pageCount: number) => void;
  onReady?: (meta: { page: number; pageCount: number; ttfpMs: number }) => void;
  onError?: (message: string) => void;
  /** Textlayer-Auswahl (R10); bei Scan-PDFs oft leer. */
  onTextSelected?: (page: number, text: string) => void;
};

const THEMES: PdfReaderTheme[] = ['day', 'night', 'sepia'];

export function BibliothekPdfJsReader({
  title,
  pdfUrl,
  bookId,
  startPage,
  gotoPage,
  compactToolbar = false,
  immersive = false,
  onToggleImmersive,
  onPageChange,
  onReady,
  onError,
  onTextSelected,
}: BibliothekPdfJsReaderProps) {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const webRef = useRef<WebView>(null);

  const [shellUri, setShellUri] = useState<string | null>(null);
  const [shellError, setShellError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [page, setPage] = useState(startPage ?? 1);
  const [pageCount, setPageCount] = useState(0);
  const [prefs, setPrefs] = useState<PdfReaderPreferences | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchHits, setSearchHits] = useState<PdfSearchMatch[]>([]);
  const [shellReady, setShellReady] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void resolvePdfReaderShellUri()
      .then((uri) => {
        if (!cancelled) setShellUri(uri);
      })
      .catch(() => {
        if (!cancelled) setShellError(true);
      });
    void loadPdfReaderPreferences(bookId).then((p) => {
      if (!cancelled) setPrefs(p);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const post = useCallback((payload: Parameters<typeof serializePdfBridgeOutbound>[0]) => {
    webRef.current?.postMessage(serializePdfBridgeOutbound(payload));
  }, []);

  const dispatchLoad = useCallback(() => {
    if (!prefs || !pdfUrl.trim() || loadedRef.current) return;
    loadedRef.current = true;
    post({
      type: 'load',
      pdfUrl: pdfUrl.trim(),
      page: startPage,
      theme: prefs.theme,
      zoom: prefs.zoom,
      scrollMode: prefs.scrollMode,
    });
  }, [pdfUrl, post, prefs, startPage]);

  useEffect(() => {
    if (shellReady && prefs) dispatchLoad();
  }, [shellReady, prefs, dispatchLoad]);

  useEffect(() => {
    if (gotoPage != null && gotoPage >= 1 && shellReady && !loading) {
      post({ type: 'goToPage', page: gotoPage });
    }
  }, [gotoPage, loading, post, shellReady]);

  const handleBridge = useCallback(
    (message: PdfBridgeInbound) => {
      switch (message.type) {
        case 'ready':
          if (message.shell) {
            setShellReady(true);
            return;
          }
          setLoading(false);
          setPageCount(message.pageCount);
          setPage(message.page || startPage || 1);
          onReady?.({ page: message.page, pageCount: message.pageCount, ttfpMs: message.ttfpMs });
          break;
        case 'pagechange':
          setPage(message.page);
          setPageCount(message.pageCount);
          onPageChange?.(message.page, message.pageCount);
          break;
        case 'searchHit':
          setSearchHits(message.matches);
          break;
        case 'textSelected':
          onTextSelected?.(message.page, message.text);
          break;
        case 'error':
          setLoading(false);
          setViewerError(message.message || message.code);
          onError?.(message.message || message.code);
          break;
        default:
          break;
      }
    },
    [onError, onPageChange, onReady, onTextSelected, startPage],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const parsed = parsePdfBridgeInbound(event.nativeEvent.data);
      if (parsed) handleBridge(parsed);
    },
    [handleBridge],
  );

  const percentLabel = useMemo(() => {
    if (pageCount < 1 || page < 1) return '';
    const pct = Math.min(100, Math.max(0, Math.round((page / pageCount) * 100)));
    return t('bibliothek.readerPercent').replace('{{percent}}', String(pct));
  }, [page, pageCount, t]);

  const cycleTheme = useCallback(() => {
    if (!prefs) return;
    const idx = THEMES.indexOf(prefs.theme);
    const next = THEMES[(idx + 1) % THEMES.length] ?? 'day';
    const merged = { ...prefs, theme: next };
    setPrefs(merged);
    void savePdfReaderPreferences(merged, bookId);
    post({ type: 'setTheme', theme: next });
  }, [bookId, post, prefs]);

  const cycleDim = useCallback(() => {
    if (!prefs) return;
    const steps = [0, 0.18, 0.32, 0.45] as const;
    const idx = steps.findIndex((s) => Math.abs(s - prefs.dimLevel) < 0.02);
    const next = steps[(Math.max(0, idx) + 1) % steps.length] ?? 0;
    const merged = { ...prefs, dimLevel: next };
    setPrefs(merged);
    void savePdfReaderPreferences(merged, bookId);
  }, [bookId, prefs]);

  const zoomBy = useCallback(
    (delta: number) => {
      if (!prefs) return;
      const nextZoom = Math.min(3.2, Math.max(0.7, Number((prefs.zoom + delta).toFixed(2))));
      const merged = { ...prefs, zoom: nextZoom };
      setPrefs(merged);
      void savePdfReaderPreferences(merged, bookId);
      post({ type: 'setZoom', zoom: nextZoom });
    },
    [bookId, post, prefs],
  );

  const submitJump = useCallback(() => {
    const parsed = Number.parseInt(jumpValue.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    post({ type: 'goToPage', page: parsed });
    setJumpOpen(false);
    setJumpValue('');
  }, [jumpValue, post]);

  const submitSearch = useCallback(() => {
    const q = searchValue.trim();
    if (!q) return;
    setSearchHits([]);
    post({ type: 'search', query: q });
  }, [post, searchValue]);

  const openSearchHit = useCallback(
    (hit: PdfSearchMatch) => {
      post({ type: 'goToPage', page: hit.page });
    },
    [post],
  );

  const retry = useCallback(() => {
    setViewerError(null);
    setLoading(true);
    loadedRef.current = false;
    dispatchLoad();
  }, [dispatchLoad]);

  if (shellError) {
    return (
      <View style={styles.center}>
        <ThemedText type="default" themeColor="textSecondary">
          {t('bibliothek.readerShellError')}
        </ThemedText>
      </View>
    );
  }

  if (!shellUri || !prefs) {
    return (
      <View style={styles.center}>
        <ThemedActivityIndicator />
      </View>
    );
  }

  if (viewerError && !onError) {
    return (
      <View style={styles.center}>
        <IconSymbol name="alert-circle-outline" size={40} color={colors.textSecondary} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.errText}>
          {t('bibliothek.readerLoadError')}
        </ThemedText>
        <PressableCard onPress={retry} type="backgroundElement" style={styles.toolBtn}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('bibliothek.readerRetry')}
          </ThemedText>
        </PressableCard>
        <PressableCard
          onPress={() => openBibliothekPdfWithFallback({ pdfUrl, title }, { forceBrowser: true })}
          type="backgroundElement"
          style={styles.toolBtn}>
          <IconSymbol name="open-outline" size={18} color={colors.accent} />
          <ThemedText type="smallBold" themeColor="accent">
            {t('handouts.openInBrowser')}
          </ThemedText>
        </PressableCard>
      </View>
    );
  }

  const showToolbar = !immersive;

  return (
    <View style={styles.flex}>
      {showToolbar ? (
        <View
          style={[
            styles.toolbar,
            compactToolbar && styles.toolbarCompact,
            rtl ? styles.toolbarRtl : undefined,
          ]}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={[styles.progress, rtl ? styles.textRtl : undefined]}>
            {pageCount > 0
              ? t('bibliothek.readerPageOf')
                  .replace('{{page}}', String(page))
                  .replace('{{total}}', String(pageCount))
              : t('bibliothek.readerLoading')}
            {percentLabel ? ` · ${percentLabel}` : ''}
          </ThemedText>
          <View style={[styles.toolRow, rtl ? styles.toolRowRtl : undefined]}>
            <PressableCard onPress={() => setSearchOpen((v) => !v)} style={styles.toolBtn}>
              <ThemedText type="smallBold">{t('bibliothek.readerSearch')}</ThemedText>
            </PressableCard>
            <PressableCard onPress={() => setJumpOpen((v) => !v)} style={styles.toolBtn}>
              <ThemedText type="smallBold">{t('bibliothek.readerJump')}</ThemedText>
            </PressableCard>
            <PressableCard onPress={() => zoomBy(-0.15)} style={styles.toolBtn}>
              <ThemedText type="smallBold">−</ThemedText>
            </PressableCard>
            <PressableCard onPress={() => zoomBy(0.15)} style={styles.toolBtn}>
              <ThemedText type="smallBold">+</ThemedText>
            </PressableCard>
            <PressableCard onPress={cycleTheme} style={styles.toolBtn}>
              <ThemedText type="smallBold">{t('bibliothek.readerTheme')}</ThemedText>
            </PressableCard>
            <PressableCard onPress={cycleDim} style={styles.toolBtn}>
              <ThemedText type="smallBold">{t('bibliothek.readerDim')}</ThemedText>
            </PressableCard>
            {onToggleImmersive ? (
              <PressableCard onPress={onToggleImmersive} style={styles.toolBtn}>
                <ThemedText type="smallBold">{t('bibliothek.readerImmersive')}</ThemedText>
              </PressableCard>
            ) : null}
          </View>
          {jumpOpen ? (
            <View style={[styles.jumpRow, rtl ? styles.toolRowRtl : undefined]}>
              <TextInput
                value={jumpValue}
                onChangeText={setJumpValue}
                keyboardType="number-pad"
                placeholder={t('bibliothek.readerJumpPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.jumpInput,
                  { color: colors.text, borderColor: colors.textSecondary },
                  rtl ? styles.inputRtl : undefined,
                ]}
              />
              <PressableCard onPress={submitJump} style={styles.toolBtn}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('bibliothek.readerJumpGo')}
                </ThemedText>
              </PressableCard>
            </View>
          ) : null}
          {searchOpen ? (
            <View style={styles.searchBlock}>
              <View style={[styles.jumpRow, rtl ? styles.toolRowRtl : undefined]}>
                <TextInput
                  value={searchValue}
                  onChangeText={setSearchValue}
                  placeholder={t('bibliothek.readerSearchPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.jumpInput,
                    { color: colors.text, borderColor: colors.textSecondary },
                    rtl ? styles.inputRtl : undefined,
                  ]}
                  onSubmitEditing={submitSearch}
                  returnKeyType="search"
                />
                <PressableCard onPress={submitSearch} style={styles.toolBtn}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('bibliothek.readerSearchGo')}
                  </ThemedText>
                </PressableCard>
              </View>
              {searchHits.length === 0 && searchValue.trim() ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('bibliothek.readerSearchEmpty')}
                </ThemedText>
              ) : null}
              {searchHits.map((hit) => (
                <PressableCard key={`${hit.page}-${hit.excerpt.slice(0, 12)}`} onPress={() => openSearchHit(hit)}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('bibliothek.readerPage').replace('{{page}}', String(hit.page))}
                  </ThemedText>
                  <ThemedText type="small">{hit.excerpt}</ThemedText>
                </PressableCard>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.flex}>
        <WebView
          ref={webRef}
          source={{ uri: shellUri }}
          style={styles.webview}
          originWhitelist={['*']}
          onMessage={onMessage}
          onError={() => {
            setViewerError('webview');
            onError?.('webview');
          }}
          onHttpError={() => {
            setViewerError('webview');
            onError?.('webview');
          }}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url.startsWith('http://') || req.url.startsWith('https://')) return true;
            if (req.url.startsWith('file://') || req.url.startsWith('about:')) return true;
            void Linking.openURL(req.url).catch(() => {});
            return false;
          }}
        />
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ThemedActivityIndicator />
            {!compactToolbar ? (
              <ThemedText type="small" themeColor="textSecondary">
                {title}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        {prefs.dimLevel > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.dimOverlay, { backgroundColor: `rgba(0,0,0,${prefs.dimLevel})` }]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
  },
  toolbar: { gap: Spacing.one, paddingHorizontal: Spacing.two, paddingBottom: Spacing.one },
  toolbarRtl: { alignItems: 'flex-end' },
  toolbarCompact: { paddingHorizontal: Spacing.one },
  progress: { paddingTop: Spacing.one },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  toolRowRtl: { flexDirection: 'row-reverse' },
  searchBlock: { gap: Spacing.one },
  inputRtl: { textAlign: 'right', writingDirection: 'rtl' },
  toolBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  jumpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  jumpInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minHeight: 40,
  },
  errText: { textAlign: 'center' },
});
