import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { shareVerseOfDayAsImage } from '@/features/daily-ibadah/shareVerseOfDay';
import type { HadithLang } from '@/features/hadith/api';
import { useSettings } from '@/features/settings/store';
import { useTranslation } from '@/lib/i18n';

function FlagRow({
  label,
  value,
  onValueChange,
  hint,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText type="default">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function DailyIbadahSettingsScreen() {
  const { t, locale } = useTranslation();
  const { settings, update } = useSettings();

  if (!settings.dailyIbadahExtrasEnabled) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title={t('dailyIbadah.settingsTitle')} variant="modal" onBack={() => router.back()} />
        <ThemedText style={styles.pad}>{t('dailyIbadah.gated')}</ThemedText>
        <Pressable
          style={styles.pad}
          onPress={() => update({ dailyIbadahExtrasEnabled: true })}
          accessibilityRole="button">
          <ThemedText type="smallBold" themeColor="accent">
            {t('dailyIbadah.enableExperimental')}
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const hadithLang = settings.hadithLanguage as HadithLang;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t('dailyIbadah.settingsTitle')} variant="modal" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.pad}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {t('dailyIbadah.settingsIntro')}
          </ThemedText>
          <FlagRow
            label={t('dailyIbadah.ongoingNextPrayer')}
            hint={t('dailyIbadah.ongoingHint')}
            value={settings.dailyIbadahOngoingNextPrayer}
            onValueChange={(v) => update({ dailyIbadahOngoingNextPrayer: v })}
          />
          <FlagRow
            label={t('dailyIbadah.fridayKahf')}
            value={settings.dailyIbadahFridayKahf}
            onValueChange={(v) => update({ dailyIbadahFridayKahf: v })}
          />
          <FlagRow
            label={t('dailyIbadah.tahajjudReminder')}
            value={settings.dailyIbadahTahajjudReminder}
            onValueChange={(v) => update({ dailyIbadahTahajjudReminder: v })}
          />
          <FlagRow
            label={t('dailyIbadah.verseWidget')}
            value={settings.dailyIbadahVerseWidget}
            onValueChange={(v) => update({ dailyIbadahVerseWidget: v })}
          />
          <FlagRow
            label={t('dailyIbadah.fajrWakeTitle')}
            hint={t('dailyIbadah.fajrWakeAlarmOn')}
            value={settings.dailyIbadahFajrWakeAlarm}
            onValueChange={(v) => update({ dailyIbadahFajrWakeAlarm: v })}
          />
          <Pressable
            onPress={() => router.push('/fajr-wake' as never)}
            style={styles.link}
            accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="accent">
              {t('dailyIbadah.fajrWakeTitle')} →
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => shareVerseOfDayAsImage(locale, hadithLang).catch(() => {})}
            style={styles.link}
            accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="accent">
              {t('dailyIbadah.shareVerseImage')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => update({ dailyIbadahExtrasEnabled: false })}
            style={styles.link}
            accessibilityRole="button">
            <ThemedText type="small" themeColor="textSecondary">
              {t('dailyIbadah.disableExperimental')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  pad: { padding: Spacing.four, gap: Spacing.three },
  intro: { marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: { flex: 1, gap: 4 },
  link: { paddingVertical: Spacing.two },
});
