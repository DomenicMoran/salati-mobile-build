// „Was sagen die Daten?" — die Auswertungs-Karte des Gebets-Trackers.
//
// Zwei Aussagen, die jemand im Alltag wirklich gebrauchen kann:
//  1. Welches Gebet fehlt am häufigsten (das ist die Stelle, an der eine
//     Änderung am Tagesablauf ansetzt — z. B. Weckzeit vor Fajr).
//  2. Wie sich die letzten Wochen entwickelt haben.
//
// Bewusst NICHT enthalten: Ziele, Soll-Werte, Vergleich mit anderen, Rot-
// Markierungen, Ermahnungen, „nur noch X bis …". Gebet ist keine Punktejagd.
// Jede Zahl nennt ihre Grundlage mit; steht zu wenig Erfasstes zur Verfügung,
// zeigt die Karte das offen an, statt eine dünne Datenlage als Erkenntnis
// auszugeben.
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  PATTERN_WINDOW_DAYS,
  completionRatio,
  missedPattern,
  weeklyTrend,
  type TrendWeek,
} from '@/features/tracker/insights';
import { type TrackerData } from '@/features/tracker/store';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

export interface PrayerPatternsProps {
  data: TrackerData;
  today: Date;
}

/** 'YYYY-MM-DD' → 'TT.MM' (kurz genug für eine Balkenbeschriftung). */
function shortDate(day: string): string {
  return `${day.slice(8)}.${day.slice(5, 7)}.`;
}

export function PrayerPatterns({ data, today }: PrayerPatternsProps) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const pattern = missedPattern(data, today);
  const weeks = weeklyTrend(data, today);
  const anyTracked = weeks.some((w) => w.stats.trackedDays > 0);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
        {t('tracker.patterns.title')}
      </ThemedText>

      {!anyTracked && pattern.trackedDays === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
          {t('tracker.patterns.empty')}
        </ThemedText>
      ) : (
        <>
          {pattern.trackedDays > 0 && (
            <View style={styles.block}>
              {pattern.mostMissed ? (
                <>
                  <ThemedText type="default" style={rtl && styles.rtlText}>
                    {t('tracker.patterns.mostMissed').replace(
                      '{prayer}',
                      t(`prayers.${pattern.mostMissed.prayer}`),
                    )}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                    {t('tracker.patterns.mostMissedDetail')
                      .replace('{n}', String(pattern.mostMissed.missed))
                      .replace('{days}', String(pattern.trackedDays))}
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="default" style={rtl && styles.rtlText}>
                  {pattern.rows.every((r) => r.missed === 0)
                    ? t('tracker.patterns.allDone')
                    : t('tracker.patterns.noSingle')}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                {t('tracker.patterns.basis')
                  .replace('{tracked}', String(pattern.trackedDays))
                  .replace('{days}', String(PATTERN_WINDOW_DAYS))}
              </ThemedText>
            </View>
          )}

          <View style={styles.block}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {t('tracker.patterns.weeks')}
            </ThemedText>
            <View style={[styles.weekRow, rtl && styles.weekRowRtl]}>
              {weeks.map((week) => (
                <WeekBar key={week.startDay} week={week} />
              ))}
            </View>
          </View>
        </>
      )}
    </ThemedView>
  );
}

function WeekBar({ week }: { week: TrendWeek }) {
  const { t } = useTranslation();
  const ratio = completionRatio(week.stats);
  const label = shortDate(week.startDay);
  const detail =
    ratio === null
      ? t('tracker.patterns.weekEmpty')
      : t('tracker.patterns.weekDetail')
          .replace('{done}', String(week.stats.prayersDone))
          .replace('{possible}', String(week.stats.prayersPossible))
          .replace('{tracked}', String(week.stats.trackedDays));

  return (
    <View style={styles.weekColumn} accessible accessibilityLabel={`${label} – ${detail}`}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height: `${(ratio ?? 0) * 100}%` }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.weekLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.weekValue}>
        {ratio === null ? '–' : `${week.stats.prayersDone}/${week.stats.prayersPossible}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  cardLabel: { letterSpacing: 0.5 },
  block: { gap: 2 },
  rtlText: { textAlign: 'right' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: Spacing.one },
  weekRowRtl: { flexDirection: 'row-reverse' },
  weekColumn: { alignItems: 'center', gap: 2, flex: 1 },
  barTrack: {
    width: 22,
    height: 56,
    borderRadius: 6,
    backgroundColor: 'rgba(128,124,116,0.18)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: Brand.gold, borderRadius: 6 },
  weekLabel: { fontSize: 11 },
  weekValue: { fontSize: 11 },
});
