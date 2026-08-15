import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import type { Mosque } from './overpass';
import { LEAFLET_CSS_URL, LEAFLET_JS_URL, OSM_ATTRIBUTION, OSM_TILE_URL } from './leafletHtml';

interface Props {
  userLat: number;
  userLon: number;
  mosques: (Mosque & { distanceKm: number })[];
  onRoutePress: (mosque: Mosque) => void;
}

// Minimale Typisierung für das per CDN global geladene Leaflet-Objekt (kein
// @types/leaflet als Abhängigkeit nötig — dieselbe CDN-statt-npm-Strategie
// wie public/ki.html für WebLLM/Transformers.js, siehe loadLeaflet() unten).
interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer;
  bindPopup(content: HTMLElement | string): LeafletLayer;
}
interface LeafletBounds {
  extend(point: [number, number]): LeafletBounds;
}
interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap;
  fitBounds(bounds: LeafletBounds, opts?: Record<string, unknown>): LeafletMap;
  remove(): void;
}
interface LeafletNamespace {
  map(el: HTMLElement, opts?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, opts: Record<string, unknown>): LeafletLayer;
  marker(latlng: [number, number], opts?: Record<string, unknown>): LeafletLayer;
  divIcon(opts: Record<string, unknown>): unknown;
  latLngBounds(points: [number, number][]): LeafletBounds;
}
declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

let leafletLoadPromise: Promise<void> | null = null;

/** Lädt Leaflet.js/-css einmalig per CDN-<script>/<link>-Tag (window.L danach global verfügbar). */
function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('no_dom'));
  }
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    const existingLink = document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`);
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('leaflet_load_failed'));
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

/**
 * Web-Variante: react-native-webview ist auf RN-Web meist nur ein iframe-
 * Workaround — hier rendern wir Leaflet stattdessen direkt ins DOM (leichter,
 * keine iframe-Indirektion). Marker-Popups bekommen echte DOM-Elemente mit
 * addEventListener statt HTML-Strings, damit der Route-Klick zuverlässig
 * onRoutePress auslöst (kein postMessage-Umweg nötig, alles läuft im selben
 * Fenster).
 */
export default function MosquesMapView({ userLat, userLon, mosques, onRoutePress }: Props) {
  const { t } = useTranslation();
  // react-native-web forwardet den ref eines View auf den echten DOM-Node
  // (hier ein <div>) - so bleibt die Komponente auf dieselbe RN-API gestützt
  // statt ein natives 'div'-JSX-Element zu benötigen.
  const containerRef = useRef<View | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.L) return;
    const L = window.L;
    const map = L.map(containerRef.current as unknown as HTMLElement, { zoomControl: true });
    L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);

    L.marker([userLat, userLon], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:7px;background:#1a73e8;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>',
        iconSize: [14, 14],
      }),
      keyboard: false,
    }).addTo(map);

    const mosqueIcon = L.divIcon({
      className: '',
      html: '<div style="font-size:22px;line-height:22px;">🕌</div>',
      iconSize: [24, 24],
      popupAnchor: [0, -10],
    });

    const routeLabel = t('mosques.openRoute');
    const bounds = L.latLngBounds([[userLat, userLon]]);
    mosques.forEach((m) => {
      const marker = L.marker([m.lat, m.lon], { icon: mosqueIcon }).addTo(map);
      bounds.extend([m.lat, m.lon]);

      const popup = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = m.name;
      popup.appendChild(title);
      if (m.address) {
        popup.appendChild(document.createElement('br'));
        popup.appendChild(document.createTextNode(m.address));
      }
      popup.appendChild(document.createElement('br'));
      popup.appendChild(document.createTextNode(`${m.distanceKm.toFixed(1)} km`));
      popup.appendChild(document.createElement('br'));
      const btn = document.createElement('a');
      btn.href = '#';
      btn.textContent = routeLabel;
      btn.style.cssText =
        'display:inline-block;margin-top:6px;padding:6px 10px;background:#0b6b53;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;font-size:12.5px;';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        onRoutePress(m);
      });
      popup.appendChild(btn);

      marker.bindPopup(popup);
    });

    if (mosques.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([userLat, userLon], 13);
    }

    return () => {
      map.remove();
    };
  }, [ready, userLat, userLon, mosques, onRoutePress, t]);

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
      <View ref={containerRef} style={styles.mapContainer} />
      {!ready && (
        <View style={[styles.center, styles.overlay]} pointerEvents="none">
          <ThemedActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 300 },
  mapContainer: { flex: 1, minHeight: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  centerText: { textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
