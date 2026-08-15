import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import type { Mosque } from './overpass';
import { buildLeafletHtml } from './leafletHtml';

interface Props {
  userLat: number;
  userLon: number;
  mosques: (Mosque & { distanceKm: number })[];
  onRoutePress: (mosque: Mosque) => void;
}

/**
 * Echte interaktive OSM-Karte via react-native-webview + Leaflet.js statt
 * react-native-maps — react-native-maps lädt auf Android IMMER das native
 * Google-Maps-SDK (GitHub #5156/#5245), auch bei reinen OSM-UrlTile-
 * Overlays, und crasht dort ohne kostenpflichtigen Google-Maps-Key (Nutzer-
 * Crash 2026-07-17, siehe Commit d42ea25). Eine WebView initialisiert kein
 * natives Maps-SDK, sondern nur den ohnehin vorhandenen System-WebView/
 * WKWebView — kann also strukturell nicht denselben Crash auslösen. Schlägt
 * das Laden trotzdem fehl (kein Netz für Tiles o. ä.), zeigt diese
 * Komponente einen Hinweis statt abzustürzen; die Listenansicht bleibt in
 * mosques.tsx über den Karte/Liste-Toggle in jedem Fall erreichbar.
 */
export default function MosquesMapView({ userLat, userLon, mosques, onRoutePress }: Props) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const html = useMemo(
    () => buildLeafletHtml(userLat, userLon, mosques, t('mosques.openRoute')),
    [userLat, userLon, mosques, t],
  );

  function handleMessage(event: WebViewMessageEvent) {
    try {
      // id ist seit Audit 2026-07-27 (O2) `"node/123"` — getrennte OSM-ID-Raeume
      // waren als nackte Zahl nicht unterscheidbar.
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (data.type === 'route' && data.id != null) {
        const mosque = mosques.find((m) => m.id === data.id);
        if (mosque) onRoutePress(mosque);
      }
    } catch {
      // unerwartetes Message-Format ignorieren
    }
  }

  function handleError() {
    setFailed(true);
  }

  if (failed) {
    return (
      <View style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {t('mosques.mapError')}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled={false}
        onMessage={handleMessage}
        onLoadEnd={() => setLoaded(true)}
        onError={handleError}
        onHttpError={handleError}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
      />
      {!loaded && (
        <View style={[styles.center, styles.overlay]} pointerEvents="none">
          <ThemedActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 300 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  centerText: { textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
