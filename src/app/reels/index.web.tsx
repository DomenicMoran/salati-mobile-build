// Web-Variante der Reels-Route. Der native Feed baut auf `expo-video`'s
// `VideoView` (nativ) + vertikalem Vollbild-Paging + Autoplay-Gesten — ein
// Erlebnis, das nur in der App Sinn ergibt. Auf Web wird darum bewusst nur ein
// Hinweis gezeigt (die Route crasht so nie und bleibt bedienbar), statt einen
// halbgaren Swipe-Feed im Browser nachzubauen.
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

export default function ReelsWebFallback() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/lernen'))}
          accessibilityRole="button"
          accessibilityLabel={t('reels.back')}
        >
          <IconSymbol name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.center}>
          <IconSymbol name="film-outline" size={44} color="rgba(255,255,255,0.72)" />
          <ThemedText type="subtitle" style={styles.title}>
            {t('reels.title')}
          </ThemedText>
          <ThemedText type="small" style={styles.note}>
            {t('reels.webOnlyNote')}
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  back: {
    position: 'absolute',
    left: Spacing.three,
    top: Spacing.two,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  title: { color: '#FFFFFF', textAlign: 'center' },
  note: { color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
});
