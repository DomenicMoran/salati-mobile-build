// Home-Dashboard-Karten anpassen: Auf/Ab-Pfeile statt Drag-and-Drop (gleiches
// Muster wie die Kurs-Reihenfolge, s. study/reorder.tsx — robuster auf Touch
// als echtes Drag-and-Drop). Anders als dort ist hier zusätzlich die
// Sichtbarkeit einstellbar: Hero-Karte (nächstes Gebet) und Gebetszeiten-
// Tabelle sind Kernfunktion der App (DASHBOARD_LOCKED_CARDS) und daher nur
// umsortierbar, nicht ausblendbar — Ramadan-Countdown-Karte und Reise-Modus-
// Banner sind rein optionale Zusatzinfos und lassen sich zusätzlich
// deaktivieren.
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ThemedSwitch } from '@/components/ui/themed-switch';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DASHBOARD_CARD_IDS,
  DASHBOARD_LOCKED_CARDS,
  moveDashboardCard,
  normalizeDashboardCardOrder,
  toggleDashboardCardHidden,
  type DashboardCardId,
} from '@/features/dashboard/dashboardCards';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const CARD_ICONS: Record<DashboardCardId, IconName> = {
  hero: 'time-outline',
  ramadanCard: 'moon-outline',
  travelBanner: 'airplane-outline',
  prayerTable: 'grid-outline',
};

export default function DashboardReorderScreen() {
  const { settings, update } = useSettings();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const order = normalizeDashboardCardOrder(settings.dashboardCardOrder);

  function move(id: DashboardCardId, direction: 'up' | 'down') {
    update({ dashboardCardOrder: moveDashboardCard(order, id, direction) });
  }

  function toggleHidden(id: DashboardCardId) {
    update({ dashboardHiddenCards: toggleDashboardCardHidden(settings.dashboardHiddenCards, id) });
  }

  function reset() {
    update({ dashboardCardOrder: DASHBOARD_CARD_IDS, dashboardHiddenCards: [] });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('dashboard.reorder.title')} variant="modal" />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('dashboard.reorder.subtitle')}
        </ThemedText>

        <ScrollView contentContainerStyle={styles.list}>
          {order.map((id, index) => {
            const isFirst = index === 0;
            const isLast = index === order.length - 1;
            const locked = DASHBOARD_LOCKED_CARDS.includes(id);
            const hidden = settings.dashboardHiddenCards.includes(id);
            return (
              <ThemedView key={id} type="backgroundElement" style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name={CARD_ICONS[id]} size={18} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default" style={hidden && styles.rowTextHidden}>
                    {t(`dashboard.cards.${id}`)}
                  </ThemedText>
                  {locked && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('dashboard.reorder.locked')}
                    </ThemedText>
                  )}
                </View>
                {locked ? (
                  <View style={styles.lockedSpacer} />
                ) : (
                  <ThemedSwitch value={!hidden} onValueChange={() => toggleHidden(id)} />
                )}
                <Pressable
                  disabled={isFirst}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.reorder.moveUp')}
                  onPress={() => move(id, 'up')}
                  style={[styles.arrowButton, isFirst && styles.arrowButtonDisabled]}>
                  <IconSymbol name="chevron-up" size={20} color={isFirst ? colors.textSecondary : colors.accent} />
                </Pressable>
                <Pressable
                  disabled={isLast}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.reorder.moveDown')}
                  onPress={() => move(id, 'down')}
                  style={[styles.arrowButton, isLast && styles.arrowButtonDisabled]}>
                  <IconSymbol name="chevron-down" size={20} color={isLast ? colors.textSecondary : colors.accent} />
                </Pressable>
              </ThemedView>
            );
          })}

          <Pressable accessibilityRole="button" onPress={reset} style={styles.resetButton}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('dashboard.reorder.reset')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 20,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTextHidden: { opacity: 0.5 },
  lockedSpacer: { width: 4 },
  arrowButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: { opacity: 0.35 },
  resetButton: { alignSelf: 'center', marginTop: Spacing.three, padding: Spacing.two },
});
