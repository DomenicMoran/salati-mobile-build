import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, Spacing } from '@/constants/theme';
import {
  AFTER_SALAH_PHASES,
  AFTER_SALAH_TOTAL,
  INITIAL_AFTER_SALAH_STATE,
  resetAfterSalah,
  tapAfterSalah,
  totalAfterSalahProgress,
} from '@/features/dhikr/afterSalah';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';

const CIRCLE_SIZE = 220;

/**
 * Geführte Post-Salah-Dhikr-Sequenz (33x Subhanallah, 33x Alhamdulillah,
 * 34x Allahu Akbar) mit automatischem Phasen-Übergang — verlinkt von
 * tasbih.tsx aus (siehe dort: gleiche "Dhikr zählen"-Domäne, User kennt den
 * Tap-Zähler von dort bereits, statt eines zweiten Einstiegs über den
 * Gebetszeiten-Screen, der thematisch weiter weg liegt).
 */
export default function DhikrAfterSalahScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [state, setState] = useState(INITIAL_AFTER_SALAH_STATE);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const phase = AFTER_SALAH_PHASES[state.phaseIndex];
  const total = totalAfterSalahProgress(state);

  function tap() {
    const next = tapAfterSalah(state);
    // Deutlich spürbarer Erfolgs-Impuls bei Phasen-Wechsel/Abschluss, sonst
    // nur leichtes Tap-Feedback — gleiche Abstufung wie im Tasbih-Zähler.
    if (next.complete || next.phaseIndex !== state.phaseIndex) {
      hapticSuccess();
    } else {
      hapticLight();
    }
    setState(next);
  }

  function restart() {
    setState(resetAfterSalah());
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('dhikrAfterSalah.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.subtitle]}>
          {t('dhikrAfterSalah.subtitle')}
        </ThemedText>

        {/* ScrollView, damit der Zähler im Querformat/auf kleinen Höhen
            erreichbar bleibt (220px-Kreis + arabischer Text). Im Hochformat
            unverändert: contentContainer wächst auf volle Höhe und zentriert
            vertikal wie zuvor. */}
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}>
        {!state.complete ? (
          <View style={styles.body}>
            <View style={styles.phaseDotsRow}>
              {AFTER_SALAH_PHASES.map((p, i) => (
                <View
                  key={p.id}
                  style={[
                    styles.phaseDot,
                    {
                      backgroundColor:
                        i < state.phaseIndex
                          ? colors.accent
                          : i === state.phaseIndex
                            ? Brand.gold
                            : 'rgba(128,124,116,0.25)',
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.totalBarTrack}>
              <View style={[styles.totalBarFill, { width: `${(total / AFTER_SALAH_TOTAL) * 100}%` }]} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {t('dhikrAfterSalah.totalProgress')
                .replace('{count}', String(total))
                .replace('{total}', String(AFTER_SALAH_TOTAL))}
            </ThemedText>

            <ThemedText style={styles.arabic}>{phase.arabic}</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
              {phase.translit}
            </ThemedText>

            <Pressable
              onPress={tap}
              onPressIn={() => {
                // eslint-disable-next-line react-hooks/immutability
                scale.value = withTiming(0.96, { duration: 90 });
              }}
              onPressOut={() => {
                // eslint-disable-next-line react-hooks/immutability
                scale.value = withTiming(1, { duration: 120 });
              }}
              accessibilityRole="button"
              accessibilityLabel={phase.translit}
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <Animated.View style={[styles.circle, scaleStyle]}>
                <ThemedText style={styles.circleNumber}>{state.count}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  / {phase.target}
                </ThemedText>
              </Animated.View>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {t('dhikrAfterSalah.tapHint')}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.body}>
            <ThemedView type="backgroundElement" style={styles.successCard}>
              <IconSymbol name="sparkles" size={32} color={colors.accent} />
              <ThemedText type="subtitle" style={styles.center}>
                {t('dhikrAfterSalah.completeTitle')}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
                {t('dhikrAfterSalah.completeSubtitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="accent" style={styles.center}>
                {AFTER_SALAH_TOTAL} / {AFTER_SALAH_TOTAL}
              </ThemedText>
              <View style={styles.successActions}>
                <PressableCard onPress={restart} style={styles.successButton}>
                  <ThemedText type="default">{t('dhikrAfterSalah.restartCta')}</ThemedText>
                </PressableCard>
                <PressableCard onPress={() => backOr('/tasbih')} type="backgroundSelected" style={styles.successButton}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('dhikrAfterSalah.doneCta')}
                  </ThemedText>
                </PressableCard>
              </View>
            </ThemedView>
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { textAlign: 'center' },
  subtitle: { marginBottom: Spacing.three, paddingHorizontal: Spacing.four },
  // flexGrow:1 + justifyContent:center reproduziert das bisherige vertikale
  // Zentrieren im Hochformat; im Querformat scrollt der Inhalt bei Bedarf.
  scrollBody: { flexGrow: 1, justifyContent: 'center', paddingBottom: Spacing.four },
  body: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  phaseDotsRow: { flexDirection: 'row', gap: Spacing.two },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  totalBarTrack: {
    width: '100%',
    maxWidth: 260,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(128,124,116,0.18)',
    overflow: 'hidden',
  },
  totalBarFill: { height: '100%', backgroundColor: Brand.gold, borderRadius: 4 },
  arabic: { fontSize: 30, lineHeight: 52, textAlign: 'center' },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 3,
    borderColor: Brand.gold,
  },
  circleNumber: { fontSize: 72, lineHeight: 84, fontWeight: '700' },
  pressableWeb: { cursor: 'pointer' },
  successCard: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five, borderRadius: Spacing.three },
  successActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  successButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
});
