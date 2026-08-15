import { useMemo, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { EmptyState } from '@/components/empty-state';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, IconBadge, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDeviceLocation } from '@/features/location/useDeviceLocation';
import { useNearbyMosques, sortByDistance } from '@/features/mosques/hooks';
import MosquesMapView from '@/features/mosques/MosquesMapView';
import { useSettings } from '@/features/settings/store';
import type { Mosque } from '@/features/mosques/overpass';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const RADIUS_KM = 15;

export default function MosquesScreen() {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { requestLocation, loading: locLoading } = useDeviceLocation();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    settings.location ? { lat: settings.location.lat, lon: settings.location.lon } : null,
  );
  const [view, setView] = useState<'map' | 'list'>('map');

  const { data, isLoading, isError } = useNearbyMosques(coords?.lat, coords?.lon, RADIUS_KM);
  // useMemo statt Neuberechnung pro Render: sortByDistance liefert sonst bei
  // jedem Re-Render ein neues Array/neue Objekte, wodurch die Karte (Web:
  // Effekt-Dep, Nativ: WebView-HTML-Neugenerierung) unnötig neu aufgebaut
  // würde, sobald irgendein anderer State im Screen sich ändert.
  const sorted = useMemo(
    () => (coords && data ? sortByDistance(data, coords.lat, coords.lon) : []),
    [coords, data],
  );

  async function useMyLocation() {
    const pos = await requestLocation();
    if (pos) setCoords(pos);
  }

  function openRoute(m: Mosque) {
    const url = Platform.select({
      ios: `maps://?daddr=${m.lat},${m.lon}`,
      android: `geo:${m.lat},${m.lon}?q=${m.lat},${m.lon}(${encodeURIComponent(m.name)})`,
      default: `https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lon}#map=17/${m.lat}/${m.lon}`,
    });
    Linking.openURL(url).catch(() => {});
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('mosques.title')} />
        <View style={styles.header}>
          <View style={styles.toggleRow}>
            <ToggleButton label={t('mosques.map')} active={view === 'map'} onPress={() => setView('map')} />
            <ToggleButton label={t('mosques.list')} active={view === 'list'} onPress={() => setView('list')} />
          </View>
        </View>

        {!coords && (
          <View style={styles.center}>
            <PressableCard onPress={useMyLocation} type="backgroundSelected" style={styles.locateButton}>
              <View style={styles.locateRow}>
                <IconSymbol name="location" size={16} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {locLoading ? t('common.locating') : t('common.useLocation')}
                </ThemedText>
              </View>
            </PressableCard>
          </View>
        )}

        {coords && isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}

        {coords && isError && !data && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('mosques.loadError')}
            </ThemedText>
          </View>
        )}

        {/* isError bleibt bei einem fehlgeschlagenen Hintergrund-Refetch auch
            dann true, wenn noch gültige gecachte Daten vorhanden sind (siehe
            @tanstack/query-core query.js: die "error"-Reduktion überschreibt
            data NICHT). Ohne diesen Zweig würde oben zusätzlich die
            Fehlermeldung erscheinen, obwohl darunter eine funktionierende,
            nur veraltete Karte/Liste angezeigt wird - verwirrend statt
            hilfreich. Stattdessen ein freundlicher Hinweis über den
            zuletzt geladenen Daten. */}
        {coords && isError && data && (
          <ThemedView type="backgroundElement" style={styles.offlineBanner}>
            <IconSymbol name="cloud-offline-outline" size={14} color={colors.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.offlineBannerText}>
              {t('mosques.offlineCached')}
            </ThemedText>
          </ThemedView>
        )}

        {coords && data && view === 'map' && (
          <MosquesMapView userLat={coords.lat} userLon={coords.lon} mosques={sorted} onRoutePress={openRoute} />
        )}

        {coords && data && view === 'list' && (
          <FlatList
            data={sorted}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="location-outline"
                title={t('mosques.empty').replace('{km}', String(RADIUS_KM))}
                style={styles.empty}
              />
            }
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableCard onPress={() => openRoute(item)} style={styles.row}>
                  <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                    <IconSymbol name="location" size={16} color={colors.accent} />
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{item.name}</ThemedText>
                    {item.address && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.address}
                      </ThemedText>
                    )}
                    {item.openingHours && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.openingHours}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.rowAction}>
                    <ThemedText type="small" themeColor="accent">
                      {t('mosques.kmAway').replace('{km}', item.distanceKm.toFixed(1))}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('mosques.openRoute')}
                    </ThemedText>
                  </View>
                </PressableCard>
              </AnimatedListItem>
            )}
          />
        )}

        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          {t('mosques.osmNote')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

function ToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.toggleChip}>
        <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  header: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, marginBottom: Spacing.two },
  toggleRow: { flexDirection: 'row', gap: Spacing.two },
  toggleChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  offlineBannerText: { textAlign: 'center', flexShrink: 1 },
  locateButton: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.five },
  locateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  iconBadge: {
    width: IconBadge.row,
    height: IconBadge.row,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.one / 2 },
  rowAction: { alignItems: 'flex-end', gap: Spacing.one / 2 },
  attribution: { textAlign: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
});
