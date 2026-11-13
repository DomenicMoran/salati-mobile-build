import { router, useLocalSearchParams } from 'expo-router';
import { Switch, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ExpansionFeatureBody } from '@/features/expansion/ExpansionFeatureBody';
import { EXPANSION_STUBS } from '@/features/expansion/stubs';
import { useSettings } from '@/features/settings/store';
import { useTranslation } from '@/lib/i18n';

export default function ExpansionFeatureScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const stub = EXPANSION_STUBS.find((s) => s.route.endsWith(`/${feature}`));

  if (!stub || !settings.expansionExtrasEnabled) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title={t('expansion.title')} variant="modal" onBack={() => router.back()} />
        <ThemedText style={styles.pad}>{t('expansion.gated')}</ThemedText>
      </ThemedView>
    );
  }

  const flagOn = settings[stub.settingKey] === true;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t(stub.titleKey)} variant="modal" onBack={() => router.back()} />
        <View style={styles.pad}>
          <View style={styles.row}>
            <ThemedText>{t('expansion.enableBlock')}</ThemedText>
            <Switch value={flagOn} onValueChange={(v) => update({ [stub.settingKey]: v })} />
          </View>
          {flagOn ? <ExpansionFeatureBody stub={stub} settings={settings} update={update} /> : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('expansion.blockOffHint')}
            </ThemedText>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  pad: { padding: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
