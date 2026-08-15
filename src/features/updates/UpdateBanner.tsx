// Dezenter Hinweis, wenn ein OTA-Update geladen und startbereit ist.
//
// Wird an genau EINER Stelle gerendert: dem nativen Startbildschirm
// (app/(tabs)/index.tsx). Bewusst dort und nicht im Root-Layout — der Hinweis
// soll beim Ankommen in der App auftauchen, nicht mitten in einer Sure oder
// einer Lektion. Der Check selbst läuft höchstens einmal pro Tag
// (features/updates/otaUpdate.ts).
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { checkForOtaUpdate, restartWithUpdate } from '@/features/updates/otaUpdate';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';

export function UpdateBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    checkForOtaUpdate().then((ergebnis) => {
      if (!abgebrochen && ergebnis === 'ready') setReady(true);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  if (!ready || dismissed) return null;

  return (
    // pointerEvents="box-none": der Streifen fängt nur seine eigenen Flächen ab,
    // der Rest des Startbildschirms bleibt bedienbar.
    <View style={styles.wrap} pointerEvents="box-none">
      <ThemedView type="backgroundSelected" style={styles.bar}>
        <IconSymbol name="cloud-download-outline" size={18} color={theme.accent} />
        <ThemedText type="small" style={styles.label} numberOfLines={2}>
          {t('settings.updates.ready')}
        </ThemedText>
        <Pressable
          onPress={() => {
            // Fehler bewusst schlucken: schlägt der Neustart fehl, greift das
            // Update spätestens beim nächsten regulären App-Start.
            restartWithUpdate().catch(() => setDismissed(true));
          }}
          accessibilityRole="button"
          accessibilityLabel={t('settings.updates.restart')}
          hitSlop={8}
          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('settings.updates.restart')}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          hitSlop={8}
          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
          <IconSymbol name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Gleiche Höhe wie der globale Mini-Player: knapp über der Tab-Leiste.
    bottom: Platform.OS === 'web' ? Spacing.three : BottomTabInset + Spacing.one,
    alignItems: 'center',
    // Unter dem Mini-Player (zIndex 60): läuft gerade Audio, hat dessen
    // Steuerung Vorrang — beide gleichzeitig ist ohnehin die Ausnahme.
    zIndex: 55,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    width: '92%',
    maxWidth: MaxContentWidth,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(11,11,13,0.25)' },
      default: {
        shadowColor: '#0b0b0d',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  label: { flex: 1, minWidth: 0 },
  pressableWeb: { cursor: 'pointer' },
});
