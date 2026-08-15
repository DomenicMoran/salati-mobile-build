// Monatsansicht des Gebets-Trackers: ein Kalenderraster, in dem jeder Tag
// zeigt, wie viele der 5 Gebete erfasst sind — und über das vergangene Tage
// zum Nachtragen ausgewählt werden.
//
// Ausrichtung (Wochenbeginn Montag, Wochentagskürzel aus `calendar.weekdays.*`)
// und Zellenmaße sind bewusst dieselben wie im Hijri-Kalender
// (app/calendar.tsx) — zwei unterschiedlich ausgerichtete Monatsraster in
// derselben App wären eine unnötige Stolperstelle.
//
// Keine Bewertung im Bild: kein Rot für unvollständige Tage, keine Warnfarben,
// keine Symbole für „schlecht". Der Balken zeigt die Menge, mehr nicht.
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, Spacing } from '@/constants/theme';
import { PRAYER_IDS } from '@/features/tracker/store';
import { monthLeadingBlanks, type MonthDay } from '@/features/tracker/insights';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

const WEEKDAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

export interface MonthGridProps {
  days: MonthDay[];
  year: number;
  /** 1-12 */
  month: number;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoNext: boolean;
}

export function MonthGrid({
  days,
  year,
  month,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  canGoNext,
}: MonthGridProps) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const monthName = t(`calendar.months.${month}`);

  return (
    <View>
      <View style={[styles.nav, rtl && styles.rowRtl]}>
        <Pressable
          onPress={onPrevMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.previousMonth')}
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <IconSymbol name="chevron-back" size={20} color={colors.accent} />
        </Pressable>
        <ThemedText type="smallBold">
          {monthName} {year}
        </ThemedText>
        <Pressable
          onPress={canGoNext ? onNextMonth : undefined}
          disabled={!canGoNext}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoNext }}
          accessibilityLabel={t('a11y.nextMonth')}
          style={({ pressed }) => [
            Platform.OS === 'web' ? styles.pressableWeb : undefined,
            pressed && styles.pressed,
            !canGoNext && styles.disabled,
          ]}>
          <IconSymbol name="chevron-forward" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <View style={[styles.weekdayRow, rtl && styles.rowRtl]}>
        {WEEKDAY_KEYS.map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.cell}>
            {t(`calendar.weekdays.${w}`)}
          </ThemedText>
        ))}
      </View>

      <View style={[styles.grid, rtl && styles.gridRtl]}>
        {Array.from({ length: monthLeadingBlanks(year, month) }).map((_, i) => (
          <View key={`blank-${i}`} style={styles.cell} />
        ))}
        {days.map((d) => (
          <DayCell
            key={d.day}
            day={d}
            monthName={monthName}
            selected={d.day === selectedDay}
            onSelect={onSelectDay}
          />
        ))}
      </View>
    </View>
  );
}

function DayCell({
  day,
  monthName,
  selected,
  onSelect,
}: {
  day: MonthDay;
  monthName: string;
  selected: boolean;
  onSelect: (day: string) => void;
}) {
  const { t } = useTranslation();
  const total = PRAYER_IDS.length;
  // Ein Satz, den eine Sprachausgabe am Stück vorliest — Zahl, Datum, Zustand.
  const state = day.exempt
    ? t('tracker.exempt.toggle')
    : day.tracked
      ? `${day.done}/${total}`
      : t('tracker.month.notTracked');
  const label = `${day.date}. ${monthName}: ${state}`;

  // Die Spaltenbreite gehoert an das AEUSSERSTE Element der Zelle. Lag sie am
  // inneren ThemedView, schrumpfte der Pressable/View darum auf seine
  // Inhaltsbreite und die 14,28 % bezogen sich auf diesen bereits geschrumpften
  // Kasten — das Raster fiel zu schmalen Streifen zusammen (am Emulator
  // sichtbar, Audit 2026-07-29).
  const content = (
    <ThemedView
      type={selected ? 'backgroundSelected' : undefined}
      style={[styles.cellInner, styles.dayCell, !day.editable && styles.dimmed]}>
      <ThemedText type={day.isToday ? 'smallBold' : 'small'} themeColor={day.isToday ? 'accent' : 'text'}>
        {day.date}
      </ThemedText>
      <View style={styles.barTrack}>
        {day.exempt ? (
          <View style={styles.exemptMark} />
        ) : (
          <View style={[styles.barFill, { width: `${(day.done / total) * 100}%` }]} />
        )}
      </View>
    </ThemedView>
  );

  if (!day.editable) {
    return (
      <View accessible accessibilityLabel={label} style={styles.cellOuter}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onSelect(day.day)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={t('tracker.day.select')}
      style={({ pressed }) => [
        styles.cellOuter,
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        pressed && styles.pressed,
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.two,
    // 44pt Trefferflaeche der Pfeile ueber hitSlop, s. Audit 2026-07-27 N8.
    minHeight: 32,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  weekdayRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Bei rechtslaeufigen Sprachen laeuft auch das Raster von rechts nach links;
  // die fuehrenden Leerzellen sitzen dann korrekt rechts oben.
  gridRtl: { flexDirection: 'row-reverse' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: Spacing.one },
  // Spaltenbreite aussen, Zellinhalt fuellt sie voll aus (s. DayCell).
  cellOuter: { width: '14.28%' },
  cellInner: { width: '100%', alignItems: 'center', paddingVertical: Spacing.one },
  dayCell: { borderRadius: Spacing.two, gap: 3 },
  dimmed: { opacity: 0.35 },
  barTrack: {
    width: '62%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,124,116,0.22)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: { height: '100%', backgroundColor: Brand.gold, borderRadius: 2 },
  // Befreiter Tag: neutraler Strich statt Fuellstand — weder erfuellt noch
  // versaeumt.
  exemptMark: { width: '100%', height: '100%', backgroundColor: 'rgba(128,124,116,0.55)' },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.3 },
});
