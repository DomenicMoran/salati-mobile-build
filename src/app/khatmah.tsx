import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  PLAN_OPTIONS,
  completedDays,
  dayIndexForDate,
  daysBehind,
  juzRangeForDay,
  useKhatmah,
} from '@/features/khatmah/plan';
import { JUZ_STARTS } from '@/features/quran/juz';
import { dayKey } from '@/features/tracker/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function KhatmahScreen() {
  const { plan, loaded, start, toggle, reset } = useKhatmah();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const today = dayKey(new Date());
  // Freie Tageszahl zusätzlich zu den 4 Presets (Audit 2026-07-19 D7).
  const [customDays, setCustomDays] = useState('');
  const customParsed = Number.parseInt(customDays, 10);
  const customValid = Number.isFinite(customParsed) && customParsed >= 1 && customParsed <= 365;

  // Audit 2026-07-27 (M23): „Neuer Plan" warf den kompletten Fortschritt
  // sofort weg — ein Fehlgriff auf dem Fuss-Element kostete bis zu 60 Tage
  // abgehakte Lesetage, ohne Rueckweg (der Plan wird ueberschrieben, es gibt
  // keine Historie). Jede andere loeschende Aktion der App fragt nach
  // (storage.tsx, settings.tsx Backup-Import) — hier jetzt genauso, mit
  // `destructive` und dem Fortschritt als Zahl im Text, damit klar ist, was
  // verloren geht.
  function confirmReset(doneDays: number, totalDays: number) {
    Alert.alert(
      t('khatmah.resetConfirmTitle'),
      t('khatmah.resetConfirmBody')
        .replace('{done}', String(doneDays))
        .replace('{total}', String(totalDays)),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('khatmah.resetConfirmAction'), style: 'destructive', onPress: reset },
      ],
    );
  }

  if (!loaded) return <ThemedView style={styles.container} />;

  if (!plan) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('khatmah.title')} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('khatmah.subtitle')}
          </ThemedText>
          <View style={styles.options}>
            {PLAN_OPTIONS.map((days, index) => (
              <AnimatedListItem key={days} index={index}>
                <PressableCard onPress={() => start(days, today)} style={styles.optionCard}>
                  <ThemedText type="title">{days}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('khatmah.days')}
                  </ThemedText>
                </PressableCard>
              </AnimatedListItem>
            ))}
          </View>
          <AnimatedListItem index={PLAN_OPTIONS.length}>
            <View style={styles.customRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('khatmah.customLabel')}
              </ThemedText>
              <View style={styles.customControls}>
                <ThemedView type="backgroundElement" style={styles.customInputBox}>
                  <TextInput
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="number-pad"
                    placeholder="90"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.customInput, { color: colors.text }]}
                  />
                </ThemedView>
                <PressableCard
                  onPress={() => customValid && start(customParsed, today)}
                  disabled={!customValid}
                  type="backgroundSelected"
                  style={[styles.customStart, !customValid && styles.customStartDisabled]}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('learn.start')}
                  </ThemedText>
                </PressableCard>
              </View>
            </View>
          </AnimatedListItem>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const done = completedDays(plan);
  const todayIndex = dayIndexForDate(plan, today);
  const behind = daysBehind(plan, today);
  const dayIndexes = Array.from({ length: plan.days }, (_, i) => i);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Audit 2026-07-27: Der Zweig MIT laufendem Plan rendert nur einen
            nackten Titel — der Root-Stack hat headerShown:false und der
            schwebende Zurueck-Chip ist Web-only, also war dieser Screen auf
            nativ ohne sichtbaren Ausgang, sobald ein Plan gestartet war.
            Derselbe ScreenHeader wie im Auswahl-Zweig darueber. */}
        <ScreenHeader title={t('khatmah.title')} />
        <View style={styles.progressWrap}>
          <ThemedView type="backgroundElement" style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(done / plan.days) * 100}%` }]} />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {done}/{plan.days}
          </ThemedText>
        </View>
        {behind > 0 && (
          <View style={styles.behindRow}>
            <IconSymbol name="alarm" size={13} color={colors.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {behind} {behind === 1 ? t('khatmah.behindOne') : t('khatmah.behind')}
            </ThemedText>
          </View>
        )}

        <FlatList
          data={dayIndexes}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <Pressable
              onPress={() => confirmReset(done, plan.days)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.reset,
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && styles.pressed,
              ]}>
              <IconSymbol name="refresh" size={13} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('khatmah.newPlan')}
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item: i, index }) => {
            const range = juzRangeForDay(plan, i);
            const startJuz = JUZ_STARTS[range.from - 1];
            const isToday = i === todayIndex;
            const isDone = !!plan.completed[i];
            return (
              <AnimatedListItem index={index}>
                <ThemedView
                  type={isToday ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.dayRow}>
                  <Pressable
                    onPress={() => toggle(i)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={isDone ? t('a11y.markNotDone') : t('a11y.markDone')}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                    <ThemedView type="backgroundElement" style={[styles.check, isDone && styles.checkDone]}>
                      {isDone && <IconSymbol name="checkmark" size={14} color={colors.accent} />}
                    </ThemedView>
                  </Pressable>
                  <View style={styles.dayText}>
                    <ThemedText type="default">
                      {t('khatmah.day')} {i + 1}
                      {isToday ? ` · ${t('tracker.today')}` : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('quran.juzItem')} {range.from}
                      {range.to > range.from ? `–${range.to}` : ''}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/quran/[surah]',
                        params: { surah: startJuz.surah, ayah: startJuz.ayah },
                      })
                    }
                    style={({ pressed }) => [
                      styles.readRow,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="small" themeColor="accent">
                      {t('khatmah.read')}
                    </ThemedText>
                    <DisclosureChevron size={14} color={colors.accent} />
                  </Pressable>
                </ThemedView>
              </AnimatedListItem>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  subtitle: { textAlign: 'center', marginBottom: Spacing.three, paddingHorizontal: Spacing.four },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  optionCard: {
    width: 120,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginVertical: Spacing.two,
  },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  behindRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginBottom: Spacing.one },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.one, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,124,116,0.35)',
  },
  checkDone: { borderColor: Brand.gold },
  dayText: { flex: 1 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reset: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginVertical: Spacing.three,
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  customRow: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  customControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  customInputBox: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  customInput: { fontSize: 18, minWidth: 64, textAlign: 'center' },
  customStart: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  customStartDisabled: { opacity: 0.5 },
});
