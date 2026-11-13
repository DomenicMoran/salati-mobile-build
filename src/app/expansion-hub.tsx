import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { EXPANSION_STUBS } from '@/features/expansion/stubs';
import { useSettings } from '@/features/settings/store';
import { useTranslation } from '@/lib/i18n';

export default function ExpansionHubScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t('expansion.title')} variant="modal" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.row}>
            <ThemedText type="default">{t('expansion.masterFlag')}</ThemedText>
            <Switch
              value={settings.expansionExtrasEnabled}
              onValueChange={(v) => update({ expansionExtrasEnabled: v })}
            />
          </View>
          {!settings.expansionExtrasEnabled ? (
            <ThemedText themeColor="textSecondary">{t('expansion.gated')}</ThemedText>
          ) : (
            EXPANSION_STUBS.map((stub) => (
              <Pressable
                key={stub.id}
                style={styles.stub}
                onPress={() => router.push(stub.route as never)}
                accessibilityRole="button">
                <ThemedText type="smallBold">{t(stub.titleKey)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(stub.bodyKey)}
                </ThemedText>
              </Pressable>
            ))
          )}
          <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
            {t('expansion.carplayGap')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('expansion.mushafGap')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  pad: { padding: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stub: { paddingVertical: Spacing.two, gap: 4 },
  gap: { marginTop: Spacing.four },
});
