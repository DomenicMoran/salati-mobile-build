// Aufklappbarer Abschnitt fürs Wortanalyse-Sheet: Überschrift + Chevron immer
// sichtbar, Inhalt ein-/ausblendbar — Übersicht zuerst, Tiefe auf Wunsch.
// Eigene kleine Komponente statt eines der list.tsx-Zeilentypen: die dortigen
// Zeilen sind auf Einstellungs-/Navigationszeilen zugeschnitten (fixe
// Zeilenhöhe, Chevron bedeutet dort "öffnet einen Bildschirm"), hier soll der
// Chevron dagegen den Auf-/Zu-Zustand DIESES Abschnitts anzeigen (Apple-Muster
// "Mehr anzeigen").
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { useTheme } from '@/hooks/use-theme';

export interface AufklappbarProps {
  titel: string;
  children: ReactNode;
  /** Standardmäßig aufgeklappt — für Abschnitte, deren Kernaussage sofort
   * sichtbar sein soll (siehe Aufrufer), aber trotzdem einklappbar bleiben. */
  defaultOffen?: boolean;
}

export function Aufklappbar({ titel, children, defaultOffen = false }: AufklappbarProps) {
  const [offen, setOffen] = useState(defaultOffen);
  const theme = useTheme();
  const rtl = useRtl();

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setOffen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: offen }}
        accessibilityLabel={titel}
        style={({ pressed }) => [
          styles.header,
          rtl && styles.headerRtl,
          Platform.OS === 'web' ? styles.pressableWeb : undefined,
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.title, rtl && styles.textRtl]}>
          {titel}
        </ThemedText>
        <View style={[offen && styles.chevronOffen]}>
          <DisclosureChevron size={16} color={theme.textSecondary} />
        </View>
      </Pressable>
      {offen ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: Spacing.four },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 32,
  },
  headerRtl: { flexDirection: 'row-reverse' },
  title: { flex: 1, textTransform: 'uppercase', letterSpacing: 1 },
  textRtl: { textAlign: 'right' },
  // Chevron zeigt eingeklappt vorwärts (RTL-abhängig über DisclosureChevron),
  // aufgeklappt um 90° gedreht = nach unten — unabhängig von der Leserichtung.
  chevronOffen: { transform: [{ rotate: '90deg' }] },
  content: { marginTop: Spacing.two, gap: Spacing.two },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
