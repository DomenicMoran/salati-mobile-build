import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  fastCountdown,
  fastedCount,
  formatDuration,
  useFasting,
} from '@/features/fasting/store';
import { useQadaCount } from '@/features/fasting/qada';
import { useTimings } from '@/features/prayer-times/hooks';
import { dayKey } from '@/features/tracker/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const PHASE_ICON: Record<string, IconName> = {
  suhoor: 'moon',
  iftar: 'sunny',
  done: 'sparkles',
};

export default function FastingScreen() {
  const { data, toggle } = useFasting();
  const { count: qadaOwed, change: changeQada } = useQadaCount();
  const { data: timings } = useTimings();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [now, setNow] = useState(() => new Date());

  // Countdown im Minutentakt aktualisieren
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const today = dayKey(now);
  const countdown = timings ? fastCountdown(timings.today.Fajr, timings.today.Maghrib, now) : null;
  const fastedToday = !!data[today];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('fasting.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('fasting.total')}: {fastedCount(data)}
          </ThemedText>

          {timings && countdown && (
            <AnimatedListItem index={0}>
              <ThemedView type="backgroundSelected" style={styles.card}>
                <View style={styles.phaseRow}>
                  <IconSymbol name={PHASE_ICON[countdown.phase]} size={16} color={colors.accent} />
                  <ThemedText type="smallBold" themeColor="accent">
                    {countdown.phase === 'suhoor'
                      ? t('fasting.untilSuhoorEnd')
                      : countdown.phase === 'iftar'
                        ? t('fasting.untilIftar')
                        : t('fasting.afterIftar')}
                  </ThemedText>
                </View>
                {countdown.phase !== 'done' && (
                  <ThemedText style={styles.countdown}>{formatDuration(countdown.msRemaining)}</ThemedText>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  {t('fasting.suhoor')}: {timings.today.Fajr} · {t('fasting.iftar')}: {timings.today.Maghrib}
                </ThemedText>
              </ThemedView>
            </AnimatedListItem>
          )}

          <AnimatedListItem index={1}>
            <PressableCard
              onPress={() => toggle(today)}
              type={fastedToday ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.card}>
              <View style={styles.phaseRow}>
                {fastedToday && <IconSymbol name="checkmark-circle" size={16} color={colors.accent} />}
                <ThemedText type="default" themeColor={fastedToday ? 'accent' : 'text'}>
                  {fastedToday ? t('fasting.fastedToday') : t('fasting.markToday')}
                </ThemedText>
              </View>
            </PressableCard>
          </AnimatedListItem>

          <AnimatedListItem index={2}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('fasting.qada.title')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.qadaDesc}>
                {t('fasting.qada.desc')}
              </ThemedText>
              <View style={styles.qadaRow}>
                <PressableCard
                  onPress={() => changeQada(-1)}
                  type="backgroundSelected"
                  style={styles.qadaButton}
                  accessibilityLabel={t('fasting.qada.decrease')}>
                  <IconSymbol name="remove" size={20} color={colors.accent} />
                </PressableCard>
                <ThemedText style={styles.qadaCount}>{qadaOwed}</ThemedText>
                <PressableCard
                  onPress={() => changeQada(1)}
                  type="backgroundSelected"
                  style={styles.qadaButton}
                  accessibilityLabel={t('fasting.qada.increase')}>
                  <IconSymbol name="add" size={20} color={colors.accent} />
                </PressableCard>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {qadaOwed === 0 ? t('fasting.qada.doneAll') : t('fasting.qada.owed').replace('{n}', String(qadaOwed))}
              </ThemedText>
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={3}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('fasting.recommended')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('fasting.recommendedText')}
              </ThemedText>
            </ThemedView>
          </AnimatedListItem>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: { paddingTop: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  subtitle: { textAlign: 'center', marginBottom: Spacing.one },
  card: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countdown: { fontSize: 44, lineHeight: 56, fontWeight: '700' },
  qadaDesc: { textAlign: 'center' },
  qadaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  qadaButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 0 },
  qadaCount: { fontSize: 32, lineHeight: 40, fontWeight: '700', minWidth: 48, textAlign: 'center' },
});
