import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/features/settings/store';
import {
  buildFajrWakeDuaTask,
  buildFajrWakeMathTask,
  MAX_SNOOZE_COUNT,
  scheduleFajrWakeAlarm,
  scheduleFajrWakeSnooze,
  cancelFajrWakeAlarms,
  localDayKey,
} from '@/features/daily-ibadah/fajrWakeAlarm';

/** Fajr-Wecker mit Aufgabe — getrennt vom Adhan-Service. */
export default function FajrWakeScreen() {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [alarmRinging, setAlarmRinging] = useState(true);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [done, setDone] = useState(false);
  const [math] = useState(() => buildFajrWakeMathTask(Date.now() % 997));
  const dua = useMemo(() => buildFajrWakeDuaTask(locale), [locale]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!settings.dailyIbadahExtrasEnabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t('dailyIbadah.fajrWakeTitle')} variant="modal" onBack={() => router.back()} />
        <ThemedText>{t('dailyIbadah.gated')}</ThemedText>
      </SafeAreaView>
    );
  }

  const dismissIfValid = () => {
    const n = Number(answer.trim());
    const okMath = Number.isFinite(n) && n === math.answer;
    const okDua = answer.trim() === dua;
    if (!okMath && !okDua) return;
    setDone(true);
    setAlarmRinging(false);
  };

  const snooze = async () => {
    if (snoozeCount >= MAX_SNOOZE_COUNT) return;
    const next = snoozeCount + 1;
    setSnoozeCount(next);
    setAlarmRinging(false);
    const dayKey = localDayKey(new Date());
    await scheduleFajrWakeSnooze(new Date(), locale, dayKey, next);
  };

  const testIn2Min = async () => {
    await cancelFajrWakeAlarms();
    const at = new Date(Date.now() + 2 * 60_000);
    await scheduleFajrWakeAlarm(at, locale, localDayKey(at));
    setAlarmRinging(true);
    setDone(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={t('dailyIbadah.fajrWakeTitle')} onBack={() => router.back()} />
      <View style={styles.box}>
        <ThemedText type="title">{t('dailyIbadah.fajrWakeTitle')}</ThemedText>
        <ThemedText>
          {done ? t('dailyIbadah.fajrWakeDone') : alarmRinging ? t('dailyIbadah.fajrWakeRinging') : t('dailyIbadah.fajrWakeBody')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {settings.dailyIbadahFajrWakeAlarm ? t('dailyIbadah.fajrWakeAlarmOn') : t('dailyIbadah.fajrWakeAlarmOff')}
        </ThemedText>
        <Pressable
          style={styles.btnSecondary}
          onPress={() => update({ dailyIbadahFajrWakeAlarm: !settings.dailyIbadahFajrWakeAlarm })}>
          <ThemedText type="smallBold">
            {settings.dailyIbadahFajrWakeAlarm ? t('dailyIbadah.fajrWakeDisable') : t('dailyIbadah.fajrWakeEnable')}
          </ThemedText>
        </Pressable>
        {alarmRinging && !done ? (
          <>
            <ThemedText>{t('dailyIbadah.fajrWakeTaskMath').replace('{q}', math.question)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('dailyIbadah.fajrWakeTaskDua').replace('{dua}', dua)}
            </ThemedText>
            <TextInput
              style={styles.input}
              value={answer}
              onChangeText={setAnswer}
              keyboardType="default"
              placeholder={t('dailyIbadah.fajrWakeAnswerPh')}
            />
            <Pressable style={styles.btn} onPress={dismissIfValid}>
              <ThemedText type="smallBold">{t('dailyIbadah.fajrWakeDismiss')}</ThemedText>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => void snooze()} disabled={snoozeCount >= MAX_SNOOZE_COUNT}>
              <ThemedText type="smallBold">
                {t('dailyIbadah.fajrWakeSnooze')
                  .replace('{n}', String(snoozeCount))
                  .replace('{max}', String(MAX_SNOOZE_COUNT))}
              </ThemedText>
            </Pressable>
          </>
        ) : null}
        <Pressable style={styles.btnSecondary} onPress={() => void testIn2Min()}>
          <ThemedText type="smallBold">{t('dailyIbadah.fajrWakeTest2m')}</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, padding: 16 },
    box: { gap: 14 },
    btn: { padding: 16, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center' },
    btnSecondary: { padding: 14, borderRadius: 12, backgroundColor: theme.backgroundElement, alignItems: 'center' },
    input: {
      borderWidth: 1,
      borderColor: theme.separator,
      borderRadius: 10,
      padding: 12,
      color: theme.text,
      backgroundColor: theme.groupedCard,
    },
  });
}