// Tabellarische Wochenübersicht: alle 5 Pflichtgebete für die nächsten 7 Tage
// auf einen Blick (Zeilen = Tage, Spalten = Fajr/Dhuhr/Asr/Maghrib/Isha).
// Nutzt dasselbe 7-Tage-Fenster wie die Notification-Planung im
// Gebetszeiten-Screen (fetchUpcomingTimings, s. features/prayer-times/api.ts)
// über einen eigenen react-query-Hook (useWeekTimings) — reine In-App-Tabelle,
// bewusst ohne Export/PDF (Erstwurf, s. Task-Auftrag).
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatHHMM, PRAYERS } from '@/features/prayer-times/next-prayer';
import { useWeekTimings } from '@/features/prayer-times/hooks';
import { buildWeekRows } from '@/features/prayer-times/week';
import { useSettings } from '@/features/settings/store';
import { useTranslation } from '@/lib/i18n';

const WEEKDAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const LABEL_COL_WIDTH = 84;
const PRAYER_COL_WIDTH = 76;

export default function PrayerTimesWeekScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { data, isLoading, isError } = useWeekTimings();

  const rows = buildWeekRows(data ?? []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AnimatedListItem index={0}>
          <ScreenHeader title={t('prayerWeek.title')} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('prayerWeek.subtitle')}
          </ThemedText>
        </AnimatedListItem>

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
              {t('prayerWeek.loading')}
            </ThemedText>
          </View>
        )}

        {isError && !isLoading && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('prayerWeek.unavailable')}
            </ThemedText>
          </View>
        )}

        {rows.length > 0 && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ThemedView type="backgroundElement" style={styles.table}>
                <View style={styles.row}>
                  <View style={[styles.cell, styles.labelCell]} />
                  {PRAYERS.map((p) => (
                    <View key={p} style={[styles.cell, styles.prayerCell]}>
                      <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
                        {t(`prayers.${p.toLowerCase()}`)}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {rows.map((row, i) => (
                  <AnimatedListItem key={row.date.toISOString()} index={i + 1}>
                    <View style={[styles.row, row.isToday && styles.rowToday]}>
                      <View style={[styles.cell, styles.labelCell]}>
                        <ThemedText type={row.isToday ? 'smallBold' : 'small'} themeColor={row.isToday ? 'accent' : 'text'}>
                          {t(`calendar.weekdays.${WEEKDAY_KEYS[row.weekdayIdx]}`)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {row.date.getDate()}.{row.date.getMonth() + 1}.
                        </ThemedText>
                      </View>
                      {PRAYERS.map((p) => (
                        <View key={p} style={[styles.cell, styles.prayerCell]}>
                          <ThemedText
                            type={row.isToday ? 'smallBold' : 'small'}
                            themeColor={row.isToday ? 'accent' : 'text'}>
                            {formatHHMM(row.timings[p], settings.timeFormat)}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </AnimatedListItem>
                ))}
              </ThemedView>
            </ScrollView>

            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {t('prayerWeek.locationHint').replace('{location}', settings.location.label)}
            </ThemedText>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: Spacing.one, marginBottom: Spacing.three, paddingHorizontal: Spacing.four },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  table: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,124,116,0.35)',
  },
  rowToday: { backgroundColor: 'rgba(212,175,55,0.14)' },
  cell: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.one, alignItems: 'center', justifyContent: 'center' },
  labelCell: { width: LABEL_COL_WIDTH, alignItems: 'flex-start', paddingLeft: Spacing.three },
  prayerCell: { width: PRAYER_COL_WIDTH },
  hint: { textAlign: 'center', marginTop: Spacing.three, paddingHorizontal: Spacing.three },
});
