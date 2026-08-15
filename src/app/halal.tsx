import { useQuery } from '@tanstack/react-query';
import { FlatList, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { distanceKm, fetchNearbyHalal } from '@/features/mosques/overpass';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const RADIUS_METERS = 5000;

export default function HalalScreen() {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { lat, lon } = settings.location;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['halal', lat, lon, RADIUS_METERS],
    queryFn: () => fetchNearbyHalal(lat, lon, RADIUS_METERS),
    staleTime: 60 * 60 * 1000,
  });

  const sorted = (data ?? [])
    .map((p) => ({ ...p, distance: distanceKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('halal.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {settings.location.label} · {t('halal.osmNote')}
        </ThemedText>

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        )}
        {sorted.length === 0 && !isLoading && !isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('halal.empty')}
            </ThemedText>
          </View>
        )}

        <FlatList
          data={sorted}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <PressableCard
                onPress={() =>
                  Linking.openURL(
                    `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=18/${item.lat}/${item.lon}`,
                  ).catch(() => {})
                }
                style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name="restaurant" size={16} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[item.cuisine, item.address].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="accent">
                  {item.distance.toFixed(1)} km
                </ThemedText>
              </PressableCard>
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two, paddingHorizontal: Spacing.four },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
});
