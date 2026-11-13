import { useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { BibliothekPdfJsReader } from '@/features/bibliothek/pdfjs/BibliothekPdfJsReader';
import { splitPdfUrlAndStartPage } from '@/features/bibliothek/pdfjs/pdfUrl';
import { openBibliothekPdfWithFallback } from '@/features/bibliothek/openBook';
import { gviewUrl } from '@/features/handouts/data';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type Props = {
  title: string;
  pdfUrl: string;
  bookId?: string;
};

function GviewPdfFallback({ pdfUrl, title, onHardFail }: { pdfUrl: string; title: string; onHardFail: () => void }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const sourceUri = gviewUrl(pdfUrl);

  return (
    <WebView
      source={{ uri: sourceUri }}
      style={styles.webview}
      originWhitelist={['*']}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loadingOverlay}>
          <ThemedActivityIndicator />
        </View>
      )}
      setSupportMultipleWindows={false}
      onError={onHardFail}
      onHttpError={onHardFail}
      allowFileAccess={Platform.OS !== 'web'}
      allowFileAccessFromFileURLs={Platform.OS !== 'web'}
      onShouldStartLoadWithRequest={(req) => {
        if (Platform.OS === 'web') return true;
        if (req.url.startsWith('http://') || req.url.startsWith('https://')) return true;
        void Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      // Expliziter Fehler-Fallback (docs.google.com/gview) — nicht Normalpfad.
      accessibilityLabel={t('handouts.read')}
      accessibilityHint={title}
    />
  );
}

/**
 * Remote-PDF: Normalfall lokaler pdf.js-Shell (ohne CDN/gview).
 * gview nur nach dokumentiertem Bridge-/Shell-Fehler.
 */
export function HandoutRemotePdfViewer({ title, pdfUrl, bookId }: Props) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [failed, setFailed] = useState(false);
  const [useGviewFallback, setUseGviewFallback] = useState(false);

  const { url: barePdfUrl, startPage } = useMemo(() => splitPdfUrlAndStartPage(pdfUrl), [pdfUrl]);

  const handlePdfJsError = () => {
    setUseGviewFallback(true);
  };

  if (failed) {
    return (
      <View style={styles.center}>
        <IconSymbol name="alert-circle-outline" size={40} color={colors.textSecondary} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.errText}>
          {t('handouts.viewerError')}
        </ThemedText>
        <PressableCard
          onPress={() => openBibliothekPdfWithFallback({ pdfUrl: barePdfUrl, title }, { forceBrowser: true })}
          type="backgroundElement"
          style={styles.openBtn}>
          <IconSymbol name="open-outline" size={18} color={colors.accent} />
          <ThemedText type="smallBold" themeColor="accent">
            {t('handouts.openInBrowser')}
          </ThemedText>
        </PressableCard>
      </View>
    );
  }

  if (useGviewFallback) {
    return <GviewPdfFallback pdfUrl={barePdfUrl} title={title} onHardFail={() => setFailed(true)} />;
  }

  return (
    <BibliothekPdfJsReader
      title={title}
      pdfUrl={barePdfUrl}
      bookId={bookId}
      startPage={startPage}
      compactToolbar
      onError={handlePdfJsError}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errText: { textAlign: 'center' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
});
