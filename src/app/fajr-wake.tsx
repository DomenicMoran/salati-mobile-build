import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/features/settings/store';

/** Phase 2 — lokale Bestätigung nach Fajr-Wecker (ohne Adhan-Service). */
export default function FajrWakeScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [done, setDone] = useState(false);
  const styles = useMemo(() => makeStyles(), []);

  if (!settings.dailyIbadahExtrasEnabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t('dailyIbadah.fajrWakeTitle')} onBack={() => router.back()} />
        <ThemedText>{t('dailyIbadah.gated')}</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={t('dailyIbadah.fajrWakeTitle')} onBack={() => router.back()} />
      <View style={styles.box}>
        <ThemedText type="title">{t('dailyIbadah.fajrWakeTitle')}</ThemedText>
        <ThemedText>{done ? t('dailyIbadah.fajrWakeDone') : t('dailyIbadah.fajrWakeBody')}</ThemedText>
        {!done ? (
          <Pressable style={styles.btn} onPress={() => setDone(true)}>
            <ThemedText type="smallBold">{t('dailyIbadah.fajrWakeConfirm')}</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    safe: { flex: 1, padding: 16 },
    box: { gap: 16 },
    btn: { padding: 16, borderRadius: 12, backgroundColor: '#c9a227', alignItems: 'center' },
  });
}
