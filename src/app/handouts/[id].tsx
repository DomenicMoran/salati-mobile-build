// PDF-Viewer fuer eine Handout-Unterlage (NATIV). Robusteste plattform-native
// Methode: iOS WKWebView rendert PDFs direkt (remote ODER heruntergeladene
// file://-Datei -> Offline-Lesen). Android-System-WebView kann PDF-Bytes nicht
// nativ darstellen, daher der Google-Docs-Viewer (gview) mit der oeffentlichen
// R2-URL. Schlaegt das Laden fehl (kein Netz o. ae.), zeigt der Screen einen
// Hinweis + „Im Browser oeffnen" (Linking) statt einer leeren Flaeche.
// Web hat eine eigene Variante ([id].web.tsx) — dort oeffnet die Liste die PDF
// ohnehin direkt im Browser.
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { fetchHandoutIndex, gviewUrl, type Handout } from '@/features/handouts/data';
import { isHandoutDownloaded, localHandoutUri } from '@/features/handouts/downloads';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function HandoutViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading, isError } = useQuery({
    queryKey: ['handouts', 'index'],
    queryFn: fetchHandoutIndex,
    staleTime: 60 * 60 * 1000,
  });

  const handout: Handout | undefined = data?.handouts.find((h) => h.id === id);

  // Bevorzugt die lokal heruntergeladene Datei (nur iOS kann sie im WebView
  // rendern); Android nutzt immer den gview mit der Remote-URL.
  const [localUri, setLocalUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!id || Platform.OS !== 'ios') {
      Promise.resolve().then(() => {
        if (!cancelled) setLocalUri(null);
      });
      return () => {
        cancelled = true;
      };
    }
    isHandoutDownloaded(id).then((yes) => {
      if (!cancelled) setLocalUri(yes ? localHandoutUri(id) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const [failed, setFailed] = useState(false);

  // Audit 2026-07-27: Lade- und Fehlerzweig ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang. Kritisch hier, weil der Index-Fetch keinen Timeout hat
  // (Code-Health 2026-07-27, §0): haengt das Netz, bleibt der Spinner dauerhaft
  // stehen und der Nutzer kommt nur per Wisch-Geste heraus.
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('handouts.title')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isError || !handout) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('handouts.title')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const sourceUri =
    Platform.OS === 'android' ? gviewUrl(handout.pdf_url) : (localUri ?? handout.pdf_url);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={handout.title} />
        {failed ? (
          <View style={styles.center}>
            <IconSymbol name="alert-circle-outline" size={40} color={colors.textSecondary} />
            <ThemedText type="default" themeColor="textSecondary" style={styles.errText}>
              {t('handouts.viewerError')}
            </ThemedText>
            <PressableCard
              onPress={() => void Linking.openURL(handout.pdf_url)}
              type="backgroundElement"
              style={styles.openBtn}>
              <IconSymbol name="open-outline" size={18} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent">
                {t('handouts.openInBrowser')}
              </ThemedText>
            </PressableCard>
          </View>
        ) : (
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
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            // Lokale PDF-Datei lesen (iOS-Offline).
            allowFileAccess
            allowFileAccessFromFileURLs
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
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
