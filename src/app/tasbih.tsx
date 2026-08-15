import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, Spacing } from '@/constants/theme';
import { DHIKR_PRESETS, useTasbih, type DhikrPreset } from '@/features/dhikr/counter';
import { sanitizeTarget, useCustomDhikr } from '@/features/dhikr/custom';
import { crossesGoal, DAILY_GOAL_OPTIONS, sanitizeGoal, useTasbihGoal, useTasbihHistory } from '@/features/dhikr/goal';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Fortschrittsring um den Tipp-Kreis (Audit 2026-07-19 D8): goldener
// SVG-Ring, der sich mit dem Fortschritt zum Ziel füllt. Bewusst ohne
// Animation (diskrete Updates pro Tap) — funktioniert so identisch auf Web.
const RING_SIZE = 220;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function TasbihScreen() {
  const { state, count, reset } = useTasbih();
  const { items: customItems, add: addCustom, remove: removeCustom } = useCustomDhikr();
  const { goal, setGoal } = useTasbihGoal();
  const { days: history } = useTasbihHistory(state.todayTotal);
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [presetId, setPresetId] = useState(DHIKR_PRESETS[0].id);
  const [formOpen, setFormOpen] = useState(false);
  const [formText, setFormText] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalFormText, setGoalFormText] = useState('');
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Dhikr-Zähler ist eine der meistgenutzten täglichen Interaktionen der
  // App (jeder Tap) — Tipp-Feedback bei "Bewegung reduzieren" ohne Animation.
  const reducedMotion = useReducedMotion();
  const goalProgress = Math.min(state.todayTotal / goal, 1);
  const goalReached = state.todayTotal >= goal;

  // Eigene Dhikr als zusätzliche Chips neben den Presets.
  const customPresets: DhikrPreset[] = customItems.map((c) => ({
    id: c.id,
    arabic: c.text,
    translit: c.text,
    target: c.target,
  }));
  const allPresets = [...DHIKR_PRESETS, ...customPresets];
  const preset = allPresets.find((p) => p.id === presetId) ?? DHIKR_PRESETS[0];
  const isCustom = preset.id.startsWith('custom-');
  const current = state.counts[preset.id] ?? 0;
  const progress = Math.min(current / preset.target, 1);

  function tap() {
    const reachesTarget = current + 1 >= preset.target;
    const reachesDailyGoal = crossesGoal(state.todayTotal, state.todayTotal + 1, goal);
    if (Platform.OS !== 'web') {
      if (reachesTarget || reachesDailyGoal) {
        // Runde voll ODER Tagesziel gerade erreicht ⇒ deutlich spürbarer
        // Erfolgs-Impuls statt nur Vibration.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Vibration.vibrate(10);
      }
    }
    count(preset);
  }

  function saveGoal() {
    setGoal(sanitizeGoal(goalFormText));
    setGoalFormOpen(false);
    setGoalFormText('');
  }

  function saveCustom() {
    const text = formText.trim();
    if (text === '') return;
    const item = addCustom(text, sanitizeTarget(formTarget));
    setPresetId(item.id);
    setFormOpen(false);
    setFormText('');
    setFormTarget('');
  }

  function deleteSelectedCustom() {
    removeCustom(preset.id);
    setPresetId(DHIKR_PRESETS[0].id);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('tasbih.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('tasbih.today')}: {state.todayTotal}
        </ThemedText>

        {/* Geführte 33/33/34-Sequenz nach dem Pflichtgebet: eigener Screen
            (dhikr-after-salah.tsx) statt eines weiteren Presets hier, weil
            die Phasen automatisch weiterschalten müssen — von hier aus
            verlinkt, weil der User den Tap-Zähler von diesem Screen schon
            kennt (statt eines zweiten Einstiegs über den Gebetszeiten-Screen). */}
        <Pressable
          onPress={() => router.push('/dhikr-after-salah')}
          accessibilityRole="button"
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <ThemedView type="backgroundElement" style={[styles.afterSalahCard, styles.afterSalahRow]}>
            <IconSymbol name="sparkles-outline" size={16} color={colors.accent} />
            <ThemedText type="smallBold" themeColor="accent">
              {t('tasbih.afterSalahCta')}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <ScrollView style={styles.verticalScroll} contentContainerStyle={styles.verticalScrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView type="backgroundElement" style={styles.goalCard}>
          <View style={styles.goalHeaderRow}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('tasbih.dailyGoal')}
            </ThemedText>
            <View style={styles.goalValueRow}>
              {goalReached && <IconSymbol name="checkmark-circle" size={14} color={colors.accent} />}
              <ThemedText type="small" themeColor={goalReached ? 'accent' : 'textSecondary'}>
                {state.todayTotal} / {goal}
              </ThemedText>
            </View>
          </View>
          <View style={styles.goalBarTrack}>
            <View style={[styles.goalBarFill, { width: `${goalProgress * 100}%` }]} />
          </View>
          <View style={styles.goalChipsRow}>
            {DAILY_GOAL_OPTIONS.map((g) => (
              <Pressable
                key={g}
                onPress={() => {
                  setGoal(g);
                  setGoalFormOpen(false);
                }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView
                  type={goal === g && !goalFormOpen ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.goalChip}>
                  <ThemedText type="small" themeColor={goal === g && !goalFormOpen ? 'accent' : 'text'}>
                    {g}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setGoalFormOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={t('tasbih.customGoal')}
              style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <ThemedView
                type={goalFormOpen || !DAILY_GOAL_OPTIONS.some((g) => g === goal) ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.goalChip}>
                <ThemedText
                  type="small"
                  themeColor={goalFormOpen || !DAILY_GOAL_OPTIONS.some((g) => g === goal) ? 'accent' : 'text'}>
                  {!goalFormOpen && !DAILY_GOAL_OPTIONS.some((g) => g === goal) ? goal : t('tasbih.customGoal')}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
          {goalFormOpen && (
            <View style={styles.customFormRow}>
              <TextInput
                value={goalFormText}
                onChangeText={setGoalFormText}
                placeholder={t('tasbih.customGoalPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                style={[styles.customInput, styles.goalInput, { color: colors.text }]}
              />
              <PressableCard onPress={saveGoal} type="backgroundSelected" style={styles.customFormButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('common.save')}
                </ThemedText>
              </PressableCard>
            </View>
          )}
        </ThemedView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presets}>
          {allPresets.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPresetId(p.id)}
              style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <ThemedView
                type={p.id === presetId ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.presetChip}>
                <ThemedText type="small" themeColor={p.id === presetId ? 'accent' : 'text'}>
                  {p.translit} · {p.target}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setFormOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={t('tasbih.addCustom')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedView type={formOpen ? 'backgroundSelected' : 'backgroundElement'} style={styles.presetChip}>
              <ThemedText type="small" themeColor={formOpen ? 'accent' : 'text'}>
                + {t('tasbih.addCustom')}
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>

        {formOpen && (
          <ThemedView type="backgroundElement" style={styles.customForm}>
            <TextInput
              value={formText}
              onChangeText={setFormText}
              placeholder={t('tasbih.customTextPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.customInput, { color: colors.text }]}
            />
            <TextInput
              value={formTarget}
              onChangeText={setFormTarget}
              placeholder={t('tasbih.customTargetPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[styles.customInput, { color: colors.text }]}
            />
            <View style={styles.customFormRow}>
              <PressableCard
                onPress={saveCustom}
                disabled={formText.trim() === ''}
                type="backgroundSelected"
                style={styles.customFormButton}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('common.save')}
                </ThemedText>
              </PressableCard>
              <PressableCard onPress={() => setFormOpen(false)} style={styles.customFormButton}>
                <ThemedText type="smallBold">{t('common.cancel')}</ThemedText>
              </PressableCard>
            </View>
          </ThemedView>
        )}

        <View style={styles.counterWrap}>
          <ThemedText style={styles.arabic}>{preset.arabic}</ThemedText>
          <Pressable
            onPress={tap}
            onPressIn={() => {
              // Reanimated-SharedValue-Zuweisung, keine React-State-Mutation —
              // React Compiler kennt SharedValue nicht (Fehlalarm).
              // eslint-disable-next-line react-hooks/immutability
              scale.value = reducedMotion ? 0.96 : withTiming(0.96, { duration: 90 });
            }}
            onPressOut={() => {
              // eslint-disable-next-line react-hooks/immutability
              scale.value = reducedMotion ? 1 : withTiming(1, { duration: 120 });
            }}
            style={Platform.OS === 'web' ? [styles.pressableWeb] : undefined}>
            <Animated.View style={[styles.counterCircle, scaleStyle]}>
              <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="rgba(212,175,55,0.28)"
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                {progress > 0 && (
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke={Brand.gold}
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${RING_CIRCUMFERENCE}`}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                    fill="none"
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                )}
              </Svg>
              <ThemedText style={styles.counterNumber}>{current}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                / {preset.target}
              </ThemedText>
            </Animated.View>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {t('tasbih.tapHint')}
          </ThemedText>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => reset(preset.id)}
              style={({ pressed }) => [styles.reset, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <IconSymbol name="refresh" size={13} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('common.reset')}
              </ThemedText>
            </Pressable>
            {isCustom && (
              <Pressable
                onPress={deleteSelectedCustom}
                style={({ pressed }) => [styles.reset, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <IconSymbol name="trash-outline" size={13} color={colors.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('tasbih.deleteCustom')}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <ThemedView type="backgroundElement" style={styles.historyCard}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.historyLabel}>
            {t('tasbih.history')}
          </ThemedText>
          <View style={styles.weekRow}>
            {history.map((d) => (
              <View key={d.day} style={styles.weekDay}>
                <View style={styles.weekBarTrack}>
                  <View style={[styles.weekBarFill, { height: `${Math.min(d.total / goal, 1) * 100}%` }]} />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {d.day.slice(8)}
                </ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.three },
  afterSalahCard: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  afterSalahRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  // flexGrow: 0 — sonst nimmt die horizontale Chip-Leiste den gesamten
  // restlichen Vertikalraum ein und drückt den Zähler ganz nach unten
  // (riesige Leerfläche in der Mitte, live gesehen).
  presetScroll: { flexGrow: 0 },
  presets: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.three },
  presetChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  customForm: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  customInput: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  customFormRow: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
  customFormButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  counterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  arabic: { fontSize: 30, lineHeight: 52, textAlign: 'center', paddingHorizontal: Spacing.four },
  counterCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  counterNumber: { fontSize: 72, lineHeight: 84, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, marginTop: Spacing.two },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  // Vertikaler Scroll-Container um alles unterhalb der Überschrift — vorher
  // fixe Höhe (kein Scroll), das reichte nicht mehr für Tagesziel- +
  // Verlaufs-Karte auf kleinen Bildschirmen. flexGrow:1 + counterWrap-Kind
  // mit flex:1 hält die bisherige Zentrierung, solange alles reinpasst;
  // sonst scrollt der Screen statt zu überlaufen.
  verticalScroll: { flex: 1 },
  verticalScrollContent: { flexGrow: 1 },
  goalCard: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  goalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(128,124,116,0.18)',
    overflow: 'hidden',
  },
  goalBarFill: { height: '100%', backgroundColor: Brand.gold, borderRadius: 4 },
  goalChipsRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  goalChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  goalInput: { flex: 1 },
  historyCard: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  historyLabel: { letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekDay: { alignItems: 'center', gap: Spacing.one },
  weekBarTrack: {
    width: 16,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(128,124,116,0.18)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBarFill: { width: '100%', backgroundColor: Brand.gold, borderRadius: 8 },
});
