// PDF-Viewer fuer eine Handout-Unterlage (WEB). Der Browser zeigt eine PDF am
// robustesten in einem eigenen Tab (natives PDF-Plugin, kein natives Modul im
// statischen Web-Export). Dieser Screen wird nur bei einem Deep-Link auf
// /handouts/[id] erreicht — die Liste (index.tsx) oeffnet die PDF auf Web
// ohnehin direkt via Linking. Er oeffnet die PDF einmalig und bietet zusaetzlich
// einen sichtbaren Button (falls der Auto-Open vom Browser blockiert wurde).
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, Spacing } from '@/constants/theme';
import { fetchHandoutIndex, type Handout } from '@/features/handouts/data';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function HandoutViewerWebScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading } = useQuery({
    queryKey: ['handouts', 'index'],
    queryFn: fetchHandoutIndex,
    staleTime: 60 * 60 * 1000,
  });

  const handout: Handout | undefined = data?.handouts.find((h) => h.id === id);

  // Einmalig automatisch oeffnen, sobald die URL bekannt ist.
  const openedRef = useRef(false);
  useEffect(() => {
    if (handout && !openedRef.current) {
      openedRef.current = true;
      void Linking.openURL(handout.pdf_url);
    }
  }, [handout]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, styles.center]} edges={['top', 'left', 'right']}>
        {isLoading ? (
          <ThemedActivityIndicator />
        ) : !handout ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('common.error')}
          </ThemedText>
        ) : (
          <View style={styles.center}>
            <IconSymbol name="document-text" size={40} color={colors.accent} />
            <ThemedText type="default" style={styles.title}>
              {handout.title}
            </ThemedText>
            <PressableCard
              onPress={() => void Linking.openURL(handout.pdf_url)}
              type="backgroundElement"
              style={styles.openBtn}>
              <IconSymbol name="open-outline" size={18} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent">
                {t('handouts.openInBrowser')}
              </ThemedText>
            </PressableCard>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two + BackChipInset },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  title: { textAlign: 'center' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
});
