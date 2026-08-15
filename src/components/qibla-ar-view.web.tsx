import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

// Web-Variante der AR-Qibla-Ansicht. Die Kamera-AR gibt es auf Web bewusst
// nicht (kein verlässliches, kalibriertes Kamera-/Sensor-Zusammenspiel im
// Browser) — deshalb importiert diese Datei absichtlich KEIN expo-camera und
// hält das Web-Bundle frei davon. Der Qibla-Screen blendet den AR-Umschalter
// auf Web ohnehin aus (Platform.OS-Guard); diese Komponente ist nur ein
// sicherer Fallback, falls sie doch je gerendert würde.
export interface QiblaArViewProps {
  heading: number;
  bearing: number;
  available: boolean | null;
  needsCalibration: boolean;
  onClose: () => void;
}

export default function QiblaArView({ onClose }: QiblaArViewProps) {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.body}>
        <IconSymbol name="camera-outline" size={40} color={Brand.gold} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {t('qibla.ar.notAvailableWeb')}
        </ThemedText>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('qibla.ar.backToCompass')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  button: { cursor: 'pointer', paddingVertical: 8, paddingHorizontal: 16 },
  pressed: { opacity: 0.6 },
});
