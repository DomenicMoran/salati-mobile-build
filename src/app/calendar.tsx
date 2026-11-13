import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHijriMonth } from '@/features/calendar/hooks';
import { islamicDayKeys, kommendeIslamischeTage } from '@/features/calendar/islamicDays';
import { gregorianToHijriOffline, HIJRI_MONTHS } from '@/features/calendar/offline';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { LayoutBreakpoints, useLayout } from '@/hooks/use-layout';
import { useTranslation } from '@/lib/i18n';

const WEEKDAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

interface DayCell {
  date: number;
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  holidays: string[];
  isToday: boolean;
}

export default function CalendarScreen() {
  const { t, locale } = useTranslation();
  // Breitbild: die sechs Wochenzeilen wachsen mit der Fensterhoehe, damit das
  // Monatsraster die Seite fuellt statt als Telefonblock oben zu kleben
  // (Geraetebefund 2026-07-29, 1600x2560: Inhalt endete bei 38 % der Hoehe).
  const { tablet, width: winWidth, height: winHeight, contentWidth } = useLayout();
  // Zwei Spalten erst, wenn beide sinnvoll breit bleiben: das Monatsraster
  // braucht sieben lesbare Tagesspalten, die Seitenspalte eine Textzeile.
  const zweispaltig = winWidth >= LayoutBreakpoints.expanded;
  // Zweispaltig steht neben dem Raster kein Text mehr, der Platz braucht —
  // die sechs Wochenzeilen dürfen deshalb höher werden und die Seite füllen.
  // Der Deckel verhindert nur, dass ein sehr hohes Fenster Zellen erzeugt, in
  // denen die Zahl verloren wirkt.
  const zellenHoehe = tablet
    ? Math.round(Math.min(zweispaltig ? 170 : 120, Math.max(56, (winHeight - (zweispaltig ? 230 : 460)) / 6)))
    : undefined;
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const hijriMonths = HIJRI_MONTHS[locale];
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const { data, isLoading, isError } = useHijriMonth(viewMonth, viewYear);

  const days: DayCell[] = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

    if (data) {
      return data.map((d) => ({
        date: Number(d.gregorian.day),
        hijriDay: Number(d.hijri.day),
        hijriMonth: d.hijri.month.number,
        hijriYear: Number(d.hijri.year),
        // Eigene kuratierte Tage statt d.hijri.holidays (nur Englisch +
        // tradition-spezifische Urs-Einträge, siehe islamicDays.ts).
        holidays: islamicDayKeys(d.hijri.month.number, Number(d.hijri.day)),
        isToday:
          Number(d.gregorian.day) === today.getDate() &&
          viewMonth === today.getMonth() + 1 &&
          viewYear === today.getFullYear(),
      }));
    }

    // Offline-Fallback: lokal berechnen (siehe Disclaimer in der UI)
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const h = gregorianToHijriOffline(new Date(viewYear, viewMonth - 1, d));
      return {
        date: d,
        hijriDay: h.day,
        hijriMonth: h.month,
        hijriYear: h.year,
        holidays: islamicDayKeys(h.month, h.day),
        isToday: d === today.getDate() && viewMonth === today.getMonth() + 1 && viewYear === today.getFullYear(),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, viewMonth, viewYear]);

  const leadingBlanks = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // Mo=0
  const holidaysThisMonth = days.filter((d) => d.holidays.length > 0);
  // Fuellt die Seitenspalte auf breiten Fenstern. Bewusst aus der lokalen
  // Umrechnung statt aus der API: die liefert nur den angezeigten Monat, die
  // Liste soll aber ueber den Monatswechsel hinaus schauen. Nur einmal je
  // Kalendertag berechnet.
  const heuteSchluessel = today.toDateString();
  const kommende = useMemo(
    () => kommendeIslamischeTage(new Date(heuteSchluessel), (d) => gregorianToHijriOffline(d), 6),
    // Nur beim Tageswechsel neu: die Liste haengt an "heute", nicht am
    // angezeigten Monat.
    [heuteSchluessel],
  );

  function goPrev() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goNext() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AnimatedListItem index={0}>
          <ScreenHeader title={t('nav.calendar')} />
        </AnimatedListItem>

        {isError && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
            {t('calendar.offlineNotice')}
          </ThemedText>
        )}

        <AnimatedListItem index={1} style={styles.nav}>
          <Pressable
            onPress={goPrev}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.previousMonth')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <IconSymbol name="chevron-back" size={22} color={colors.accent} />
          </Pressable>
          <ThemedText type="default">
            {t(`calendar.months.${viewMonth}`)} {viewYear}
          </ThemedText>
          <Pressable
            onPress={goNext}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.nextMonth')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <IconSymbol name="chevron-forward" size={22} color={colors.accent} />
          </Pressable>
        </AnimatedListItem>

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}

        <ScrollView contentContainerStyle={[styles.scroll, { maxWidth: contentWidth }]}>
          <View style={zweispaltig ? styles.spalten : undefined}>
          <AnimatedListItem index={2} style={zweispaltig ? styles.spalteRaster : undefined}>
            <View style={styles.weekdayRow}>
              {WEEKDAY_KEYS.map((w) => (
                <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.cell}>
                  {t(`calendar.weekdays.${w}`)}
                </ThemedText>
              ))}
            </View>
            <View style={styles.grid}>
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <View key={`blank-${i}`} style={styles.cell} />
              ))}
              {days.map((d) => (
                <ThemedView
                  key={d.date}
                  type={d.isToday ? 'backgroundSelected' : undefined}
                  style={[styles.cell, styles.dayCell, zellenHoehe ? { minHeight: zellenHoehe, justifyContent: 'center' } : null]}>
                  <ThemedText type={d.isToday ? 'smallBold' : 'small'} themeColor={d.isToday ? 'accent' : 'text'}>
                    {d.date}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.hijriDay}>
                    {d.hijriDay}
                  </ThemedText>
                </ThemedView>
              ))}
            </View>
          </AnimatedListItem>

          {/* Auf breiten Fenstern steht rechts neben dem Monatsraster eine
              zweite Spalte. Ohne sie endete der Inhalt bei rund 36 % der Höhe
              (nachgemessen 30.07.2026, 1026x1366) — und die Lücke lässt sich
              nicht sinnvoll durch noch höhere Tageszellen füllen, weil sechs
              Zeilen à 120 dp die Seite auch nicht ausfüllen. Also echter
              Inhalt statt gestreckter Zellen. */}
          <View style={zweispaltig ? styles.spalteSeite : undefined}>
          <View style={[styles.legend, zweispaltig && styles.legendSeite]}>
            <ThemedText type="small" themeColor="textSecondary">
              {/* Ein Gregorianischer Monat überspannt fast immer zwei
                  Hijri-Monate - beide nennen statt nur den ersten
                  (Audit 2026-07-19 B9). */}
              {(() => {
                const first = days[0];
                const last = days[days.length - 1];
                if (!first) return '';
                const firstName = hijriMonths[first.hijriMonth - 1] ?? '';
                const lastName = hijriMonths[(last?.hijriMonth ?? first.hijriMonth) - 1] ?? '';
                const months = firstName === lastName ? firstName : `${firstName} / ${lastName}`;
                const years =
                  first.hijriYear === (last?.hijriYear ?? first.hijriYear)
                    ? String(first.hijriYear)
                    : `${first.hijriYear}/${last?.hijriYear}`;
                return `${months} ${years}`;
              })()}{' '}
              {t('calendar.hijriSuffix')}
            </ThemedText>
          </View>

          {holidaysThisMonth.length > 0 && (
            <AnimatedListItem index={3}>
              <ThemedView type="backgroundElement" style={styles.holidays}>
                <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
                  {t('calendar.holidaysThisMonth')}
                </ThemedText>
                {holidaysThisMonth.map((d) => (
                  <ThemedText key={d.date} type="small" themeColor="textSecondary">
                    {d.date}. {t(`calendar.months.${viewMonth}`)} —{' '}
                    {d.holidays.map((k) => t(`calendar.days.${k}`)).join(', ')}
                  </ThemedText>
                ))}
              </ThemedView>
            </AnimatedListItem>
          )}

          {zweispaltig && kommende.length > 0 && (
            <AnimatedListItem index={4}>
              <ThemedView type="backgroundElement" style={styles.holidays}>
                <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
                  {t('calendar.upcoming')}
                </ThemedText>
                {kommende.map((k) => (
                  <View key={k.key} style={styles.kommendeZeile}>
                    <ThemedText type="small">{t(`calendar.days.${k.key}`)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {k.datum.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>
            </AnimatedListItem>
          )}

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={[styles.disclaimer, zweispaltig && styles.disclaimerSeite]}>
            {t('calendar.sightingNotice')}
          </ThemedText>
          </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  title: { textAlign: 'center', marginBottom: Spacing.two },
  notice: { textAlign: 'center', paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  center: { alignItems: 'center', paddingVertical: Spacing.four },
  nav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.five,
    marginBottom: Spacing.three,
  },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  // Ab 840 dp nebeneinander: Raster links, Erläuterungen rechts. `flex` statt
  // fester Breiten, damit beide Spalten beim Drehen mitwachsen.
  spalten: { flexDirection: 'row', gap: Spacing.four, alignItems: 'flex-start' },
  spalteRaster: { flex: 3, minWidth: 0 },
  spalteSeite: { flex: 2, minWidth: 0 },
  weekdayRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: Spacing.one },
  dayCell: { borderRadius: Spacing.two },
  hijriDay: { fontSize: 11 },
  legend: { alignItems: 'center', marginTop: Spacing.three },
  // In der Seitenspalte linksbuendig: zentrierter Text neben einem linken
  // Raster liest sich als versehentlich verrutscht.
  legendSeite: { alignItems: 'flex-start', marginTop: 0 },
  disclaimerSeite: { textAlign: 'left', paddingHorizontal: 0 },
  holidays: { borderRadius: Spacing.three, padding: Spacing.three, marginTop: Spacing.four },
  kommendeZeile: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.half },
  disclaimer: { textAlign: 'center', marginTop: Spacing.four, paddingHorizontal: Spacing.three },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
