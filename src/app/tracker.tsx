import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { ThemedSwitch } from '@/components/ui/themed-switch';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { MonthGrid } from '@/components/tracker/month-grid';
import { PrayerPatterns } from '@/components/tracker/prayer-patterns';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  EDITABLE_PAST_DAYS,
  PRAYER_IDS,
  canEditDay,
  completedCount,
  currentStreak,
  dayKey,
  isExemptDay,
  lastDays,
  shiftDayKey,
  useTracker,
} from '@/features/tracker/store';
import { monthDays, monthStats } from '@/features/tracker/insights';
import { QADA_STEPS, usePrayerQadaCount } from '@/features/tracker/qada';
import { TARAWEEH_STEP, taraweehNightsCount, taraweehTotal, useTaraweehTracker } from '@/features/tracker/taraweeh';
import { canShareStatsImage, shareStatsImage } from '@/features/tracker/statsImage';
import { isRamadanMonth } from '@/features/fasting/store';
import { useTimings } from '@/features/prayer-times/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { hapticLight } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

export default function TrackerScreen() {
  const { data, toggle, toggleExempt } = useTracker();
  const {
    data: qadaData,
    done: qadaDone,
    total: qadaTotal,
    totalDone: qadaTotalDone,
    canMakeUpDay,
    change: changeQada,
    makeUp: makeUpQada,
    makeUpDay: makeUpQadaDay,
  } = usePrayerQadaCount();
  const { data: taraweehData, change: changeTaraweeh } = useTaraweehTracker();
  const { data: timings } = useTimings();
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const now = new Date();
  const today = dayKey(now);
  const streak = currentStreak(data, now);
  const week = lastDays(data, now, 7);

  // Ausgewählter Tag: standardmäßig heute, über die Pfeile oder die
  // Monatsansicht bis EDITABLE_PAST_DAYS zurück. Die Monatsansicht folgt der
  // Auswahl, lässt sich aber auch unabhängig durchblättern (Nur-Lesen für
  // ältere Monate).
  const [selectedDay, setSelectedDay] = useState(today);
  const [historyView, setHistoryView] = useState<'week' | 'month'>('week');
  const [viewMonth, setViewMonth] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() + 1 }));

  const [qadaStep, setQadaStep] = useState<number>(QADA_STEPS[0]);

  const selectedExempt = isExemptDay(data, selectedDay);
  const isToday = selectedDay === today;
  const prevDay = shiftDayKey(selectedDay, -1);
  const nextDay = shiftDayKey(selectedDay, 1);
  const canGoPrev = canEditDay(prevDay, now);
  const canGoNext = canEditDay(nextDay, now);

  function selectDay(day: string) {
    setSelectedDay(day);
    const [y, m] = day.split('-').map(Number);
    setViewMonth({ year: y, month: m });
  }

  const monthCells = monthDays(data, viewMonth.year, viewMonth.month, now, EDITABLE_PAST_DAYS);
  const stats = monthStats(data, viewMonth.year, viewMonth.month, now);
  const monthIsFuture =
    viewMonth.year > now.getFullYear() ||
    (viewMonth.year === now.getFullYear() && viewMonth.month >= now.getMonth() + 1);

  function stepMonth(delta: number) {
    setViewMonth(({ year, month }) => {
      const next = month + delta;
      if (next < 1) return { year: year - 1, month: 12 };
      if (next > 12) return { year: year + 1, month: 1 };
      return { year, month: next };
    });
  }

  // Datumsbeschriftung des ausgewählten Tages. Kein eigener Übersetzungs-Key:
  // toLocaleDateString liefert in jeder der 14 Sprachen die dort übliche
  // Schreibweise (inkl. Wochentag), was keine Wortliste leisten könnte.
  // Aus den Bestandteilen gebaut, NICHT aus dem ISO-String: `new Date('…Z')`
  // läge in Zeitzonen jenseits von UTC+12 bereits auf dem Folgetag.
  const [selY, selM, selD] = selectedDay.split('-').map(Number);
  const selectedLabel = isToday
    ? t('tracker.today')
    : new Date(selY, selM - 1, selD).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('tracker.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.subtitleRow}>
            {streak > 0 && <IconSymbol name="flame" size={14} color={colors.accent} />}
            <ThemedText type="small" themeColor={streak > 0 ? 'accent' : 'textSecondary'}>
              {streak > 0
                ? `${streak} ${streak === 1 ? t('tracker.streakDayOne') : t('tracker.streakDays')}`
                : t('tracker.subtitle')}
            </ThemedText>
            {canShareStatsImage && (
              <Pressable
                onPress={() =>
                  shareStatsImage({
                    title: t('tracker.title'),
                    streakLabel: `${streak} ${streak === 1 ? t('tracker.streakDayOne') : t('tracker.streakDays')}`,
                    todayLabel: `${t('tracker.today')}: ${completedCount(data, today)}/5`,
                    week: week.map((d) => ({ label: d.day.slice(8), done: d.done })),
                  }).catch(() => {})
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('tracker.shareStats')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <IconSymbol name="share-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={[styles.dayNav, rtl && styles.rowRtl]}>
              <Pressable
                onPress={canGoPrev ? () => selectDay(prevDay) : undefined}
                disabled={!canGoPrev}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canGoPrev }}
                accessibilityLabel={t('tracker.day.previous')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                  !canGoPrev && styles.disabled,
                ]}>
                <IconSymbol name="chevron-back" size={20} color={colors.accent} />
              </Pressable>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                {selectedLabel} · {completedCount(data, selectedDay)}/5
              </ThemedText>
              <Pressable
                onPress={canGoNext ? () => selectDay(nextDay) : undefined}
                disabled={!canGoNext}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canGoNext }}
                accessibilityLabel={t('tracker.day.next')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                  !canGoNext && styles.disabled,
                ]}>
                <IconSymbol name="chevron-forward" size={20} color={colors.accent} />
              </Pressable>
            </View>

            {!isToday && (
              <Pressable
                onPress={() => selectDay(today)}
                accessibilityRole="button"
                accessibilityLabel={t('tracker.day.backToToday')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <ThemedView type="backgroundSelected" style={styles.todayChip}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('tracker.day.backToToday')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}

            {PRAYER_IDS.map((p, index) => {
              const done = !!data[selectedDay]?.[p];
              return (
                <AnimatedListItem key={p} index={index}>
                  <Pressable
                    onPress={() => {
                      if (selectedExempt) return;
                      // Nur beim Setzen (nicht beim Entfernen) des Häkchens -
                      // leichtes Feedback für den positiven Moment.
                      if (!done) hapticLight();
                      toggle(selectedDay, p);
                    }}
                    disabled={selectedExempt}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done, disabled: selectedExempt }}
                    accessibilityLabel={t(`prayers.${p}`)}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                      selectedExempt && styles.disabled,
                    ]}>
                    <View style={[styles.prayerRow, rtl && styles.prayerRowRtl]}>
                      <ThemedText type="default" style={rtl && styles.rtlText}>
                        {t(`prayers.${p}`)}
                      </ThemedText>
                      <ThemedView
                        type={done ? 'backgroundSelected' : 'backgroundElement'}
                        style={[styles.checkCircle, done && styles.checkDone]}>
                        {done && <IconSymbol name="checkmark" size={16} color={colors.accent} />}
                      </ThemedView>
                    </View>
                  </Pressable>
                </AnimatedListItem>
              );
            })}

            {/* Befreite Tage: rein manueller Vermerk. Es wird nichts
                vorhergesagt, nichts berechnet und kein Zyklus geführt — die App
                weiß nur, was hier gesetzt wurde. */}
            <View style={[styles.exemptRow, rtl && styles.rowRtl]}>
              <ThemedText type="default" style={[styles.exemptLabel, rtl && styles.rtlText]}>
                {t('tracker.exempt.toggle')}
              </ThemedText>
              <ThemedSwitch
                value={selectedExempt}
                onValueChange={() => toggleExempt(selectedDay)}
                accessibilityLabel={t('tracker.exempt.toggle')}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {selectedExempt ? t('tracker.exempt.marked') : t('tracker.exempt.desc')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {t('tracker.day.limitHint').replace('{n}', String(EDITABLE_PAST_DAYS))}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={[styles.qadaHeaderRow, rtl && styles.qadaHeaderRowRtl]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                {t('tracker.qada.title')}
              </ThemedText>
              <ThemedText type="smallBold" themeColor={qadaTotal > 0 ? 'accent' : 'textSecondary'}>
                {t('tracker.qada.total').replace('{n}', String(qadaTotal))}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {t('tracker.qada.desc')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {t('tracker.qada.adjustHint')}
            </ThemedText>

            <View style={[styles.stepRow, rtl && styles.rowRtl]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('tracker.qada.step')}
              </ThemedText>
              {QADA_STEPS.map((step) => (
                <Pressable
                  key={step}
                  onPress={() => setQadaStep(step)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: qadaStep === step }}
                  accessibilityLabel={`${t('tracker.qada.step')} ${step}`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedView
                    type={qadaStep === step ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.stepChip}>
                    <ThemedText type="smallBold" themeColor={qadaStep === step ? 'accent' : 'textSecondary'}>
                      ±{step}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </View>

            {PRAYER_IDS.map((p) => (
              <View key={p} style={styles.qadaBlock}>
                <View style={[styles.qadaPrayerRow, rtl && styles.qadaPrayerRowRtl]}>
                  <ThemedText type="default" style={[styles.qadaPrayerLabel, rtl && styles.rtlText]}>
                    {t(`prayers.${p}`)}
                  </ThemedText>
                  <View style={styles.qadaRow}>
                    <Pressable
                      onPress={() => changeQada(p, -qadaStep)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('tracker.qada.decrease')} – ${t(`prayers.${p}`)}`}
                      hitSlop={6}
                      style={({ pressed }) => [
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedView type="backgroundSelected" style={styles.qadaButtonSmall}>
                        <IconSymbol name="remove" size={16} color={colors.accent} />
                      </ThemedView>
                    </Pressable>
                    <ThemedText style={styles.qadaCountSmall}>{qadaData[p]}</ThemedText>
                    <Pressable
                      onPress={() => changeQada(p, qadaStep)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('tracker.qada.increase')} – ${t(`prayers.${p}`)}`}
                      hitSlop={6}
                      style={({ pressed }) => [
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedView type="backgroundSelected" style={styles.qadaButtonSmall}>
                        <IconSymbol name="add" size={16} color={colors.accent} />
                      </ThemedView>
                    </Pressable>
                  </View>
                </View>
                {qadaData[p] > 0 && (
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      makeUpQada(p, 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('tracker.qada.makeUpOne').replace('{prayer}', t(`prayers.${p}`))}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedView type="backgroundSelected" style={styles.makeUpChip}>
                      <IconSymbol name="checkmark" size={14} color={colors.accent} />
                      <ThemedText type="smallBold" themeColor="accent">
                        {t('tracker.qada.makeUp')}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                )}
              </View>
            ))}

            {canMakeUpDay && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  makeUpQadaDay();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('tracker.qada.makeUpDay')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <ThemedView type="backgroundSelected" style={styles.makeUpDayButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('tracker.qada.makeUpDay')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}

            {qadaTotalDone > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                {t('tracker.qada.doneTotal').replace('{n}', String(qadaTotalDone))} (
                {PRAYER_IDS.filter((p) => qadaDone[p] > 0)
                  .map((p) => `${t(`prayers.${p}`)} ${qadaDone[p]}`)
                  .join(' · ')}
                )
              </ThemedText>
            )}
            {qadaTotal === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.qadaEmpty}>
                {t('tracker.qada.none')}
              </ThemedText>
            )}
          </ThemedView>

          {/* Taraweeh-Karte nur während Ramadan sichtbar — dieselbe Erkennung
              wie die Home-Dashboard-Karte (fasting/store.ts). */}
          {!!timings?.hijri && isRamadanMonth(timings.hijri.month.number) && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                {t('tracker.taraweeh.title')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                {t('tracker.taraweeh.desc')}
              </ThemedText>
              <View style={[styles.qadaPrayerRow, rtl && styles.qadaPrayerRowRtl]}>
                <ThemedText type="default" style={[styles.qadaPrayerLabel, rtl && styles.rtlText]}>
                  {t('tracker.taraweeh.tonight')}
                </ThemedText>
                <View style={styles.qadaRow}>
                  <Pressable
                    onPress={() => changeTaraweeh(today, -TARAWEEH_STEP)}
                    accessibilityRole="button"
                    accessibilityLabel={t('tracker.taraweeh.decrease')}
                    hitSlop={6}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedView type="backgroundSelected" style={styles.qadaButtonSmall}>
                      <IconSymbol name="remove" size={16} color={colors.accent} />
                    </ThemedView>
                  </Pressable>
                  <ThemedText style={styles.qadaCountSmall}>{taraweehData[today] ?? 0}</ThemedText>
                  <Pressable
                    onPress={() => changeTaraweeh(today, TARAWEEH_STEP)}
                    accessibilityRole="button"
                    accessibilityLabel={t('tracker.taraweeh.increase')}
                    hitSlop={6}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedView type="backgroundSelected" style={styles.qadaButtonSmall}>
                      <IconSymbol name="add" size={16} color={colors.accent} />
                    </ThemedView>
                  </Pressable>
                </View>
              </View>
              {taraweehNightsCount(taraweehData) > 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.qadaEmpty}>
                  {t('tracker.taraweeh.summary')
                    .replace('{nights}', String(taraweehNightsCount(taraweehData)))
                    .replace('{total}', String(taraweehTotal(taraweehData)))}
                </ThemedText>
              )}
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
              {t('tracker.history.title')}
            </ThemedText>
            <SegmentedTabs
              tabs={[
                { key: 'week', label: t('tracker.history.week') },
                { key: 'month', label: t('tracker.history.month') },
              ]}
              activeKey={historyView}
              onChange={(key) => setHistoryView(key === 'month' ? 'month' : 'week')}
            />
            {historyView === 'week' ? (
              <View style={[styles.weekRow, rtl && styles.weekRowRtl]}>
                {week.map((d) => (
                  <Pressable
                    key={d.day}
                    onPress={() => selectDay(d.day)}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.day} · ${d.exempt ? t('tracker.exempt.toggle') : `${d.done}/5`}`}
                    accessibilityHint={t('tracker.day.select')}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.weekDay}>
                      <View style={styles.weekBarTrack}>
                        {d.exempt ? (
                          <View style={styles.weekBarExempt} />
                        ) : (
                          <View style={[styles.weekBarFill, { height: `${(d.done / 5) * 100}%` }]} />
                        )}
                      </View>
                      <ThemedText
                        type={d.day === selectedDay ? 'smallBold' : 'small'}
                        themeColor={d.day === selectedDay ? 'accent' : 'textSecondary'}>
                        {d.day.slice(8)}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <>
                <MonthGrid
                  days={monthCells}
                  year={viewMonth.year}
                  month={viewMonth.month}
                  selectedDay={selectedDay}
                  onSelectDay={selectDay}
                  onPrevMonth={() => stepMonth(-1)}
                  onNextMonth={() => stepMonth(1)}
                  canGoNext={!monthIsFuture}
                />
                {stats.trackedDays === 0 && stats.exemptDays === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                    {t('tracker.month.empty')}
                  </ThemedText>
                ) : (
                  <View style={styles.monthStats}>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                      {t('tracker.month.days')
                        .replace('{tracked}', String(stats.trackedDays))
                        .replace('{days}', String(stats.elapsedDays))}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                      {t('tracker.month.prayers')
                        .replace('{done}', String(stats.prayersDone))
                        .replace('{possible}', String(stats.prayersPossible))}
                      {' · '}
                      {t('tracker.month.full').replace('{n}', String(stats.fullDays))}
                    </ThemedText>
                    {stats.exemptDays > 0 && (
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                        {t('tracker.month.exempt').replace('{n}', String(stats.exemptDays))}
                      </ThemedText>
                    )}
                  </View>
                )}
              </>
            )}
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {t('tracker.history.tapHint')}
            </ThemedText>
          </ThemedView>

          <PrayerPatterns data={data} today={now} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.one,
  },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  cardLabel: { letterSpacing: 0.5 },
  dayNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  rowRtl: { flexDirection: 'row-reverse' },
  todayChip: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  prayerRowRtl: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right' },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,124,116,0.35)',
  },
  checkDone: { borderColor: Brand.gold },
  exemptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  exemptLabel: { flex: 1 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekRowRtl: { flexDirection: 'row-reverse' },
  weekDay: { alignItems: 'center', gap: Spacing.one },
  weekBarTrack: {
    width: 16,
    height: 64,
    borderRadius: 8,
    backgroundColor: 'rgba(128,124,116,0.18)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBarFill: { width: '100%', backgroundColor: Brand.gold, borderRadius: 8 },
  // Befreiter Tag: neutraler Balken statt Fuellstand — weder erfuellt noch
  // versaeumt.
  weekBarExempt: { width: '100%', height: 4, backgroundColor: 'rgba(128,124,116,0.55)' },
  monthStats: { gap: 2, marginTop: Spacing.two },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  qadaHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qadaHeaderRowRtl: { flexDirection: 'row-reverse' },
  qadaBlock: { gap: Spacing.one },
  qadaPrayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  qadaPrayerRowRtl: { flexDirection: 'row-reverse' },
  qadaPrayerLabel: { flex: 1 },
  qadaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  // 32pt Optik, 44pt Trefferflaeche ueber hitSlop={6} an den Pressables
  // (Audit 2026-07-27, N8).
  qadaButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qadaCountSmall: { fontSize: 18, lineHeight: 22, fontWeight: '600', minWidth: 28, textAlign: 'center' },
  qadaEmpty: { textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepChip: { paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: 999, minWidth: 44, alignItems: 'center' },
  makeUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    minHeight: 44,
  },
  makeUpDayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
});
