// Web-Stub: die TV-Kopplung (Kamera-QR + lokale TCP-Verbindung) gibt es nur in
// der nativen Handy-App. Der Web-Build lädt daher NICHT react-native-tcp-socket
// (native-only) — sonst bräche der Static-Web-Export (bekannte SSR-Falle).
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function TvConnectWebScreen() {
  const { t } = useTranslation();
  const colors = Colors[useResolvedScheme()];
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.center}>
        <IconSymbol name="tv-outline" size={64} color={colors.accent} />
        <ThemedText type="subtitle" style={styles.title}>
          {t('tvRemote.title')}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.text}>
          {t('tvRemote.webOnly')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center', marginTop: Spacing.two },
  text: { textAlign: 'center', maxWidth: 360 },
});
