// Web-Variante der Route: absichtlich OHNE jeden Import aus llama.rn/model.ts
// (llama.rn hat keine Web-Implementierung — ein Top-Level-Import würde beim
// Modul-Laden crashen). Diese Datei wird nur erreicht, wenn jemand die
// native-only-Route direkt per URL aufruft; der reguläre Web-Pfad aus
// app/(tabs)/more.tsx zeigt ohnehin direkt auf /ki (public/ki.html).
//
// Bekannter Trade-off (per Bundle-Grep verifiziert, 2026-07-18): der native
// ki-native.tsx-Modulbaum (inkl. llama.rn) landet trotz dieses .web.tsx-
// Splits als TOTER Code mit im gemeinsamen Web-JS-Bundle — Expo Routers
// output:"static" bündelt hier alle Screens in EINE JS-Datei statt pro Route
// zu splitten (dasselbe gilt schon heute z. B. für src/components/
// prayer-times-screen.tsx, das nur von app/(tabs)/index.tsx, NICHT von
// index.web.tsx, verwendet wird). Kein Crash-Risiko: Metro-Module werden nur
// bei tatsächlichem require() ausgeführt, und die Web-Route rendert
// nachweislich (siehe dist/ki-native.html) ausschließlich diese Datei hier -
// aber es ist zusätzliches, ungenutztes Bundle-Gewicht. Echte Behebung würde
// eine App-weite Umstellung auf Lazy/Async-Route-Chunks brauchen (out of
// scope für diese Aufgabe).
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

export default function KiNativeWebFallback() {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t('ki.title')}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.note}>
          {t('ki.webOnlyNote')}
        </ThemedText>
        {/* /ki ist die statische public/ki.html, kein Router-Ziel — echte
            Browser-Navigation statt router.push (der 404en würde). */}
        <PressableCard onPress={() => { window.location.href = '/ki'; }} style={styles.button}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('ki.openWebVersion')}
          </ThemedText>
        </PressableCard>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
  note: { textAlign: 'center' },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
