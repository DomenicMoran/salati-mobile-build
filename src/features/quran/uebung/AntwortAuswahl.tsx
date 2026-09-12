// Eine Frage-Zeile der Analyse-Übung: Titel (Fachbegriff) + antippbare
// Schaltflächen für die Optionen. Vor dem Aufdecken zeigt Antippen nur die
// eigene Auswahl (kein Hinweis auf richtig/falsch — s. WortFokusKarte.tsx);
// `gesperrt` friert die Auswahl nach dem Aufdecken ein.
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';

import { Fachbegriff } from '../analyse/Fachbegriff';

export interface AntwortOption {
  wert: string;
  name: string;
  ar: string;
}

export interface AntwortAuswahlProps {
  titel: string;
  titelAr?: string;
  optionen: AntwortOption[];
  ausgewaehlt: string | undefined;
  onWahl: (wert: string) => void;
  gesperrt?: boolean;
}

export function AntwortAuswahl({ titel, titelAr, optionen, ausgewaehlt, onWahl, gesperrt }: AntwortAuswahlProps) {
  const rtl = useRtl();
  return (
    <View style={styles.block}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={rtl && styles.textRtl}>
        <Fachbegriff text={titel} ar={titelAr} />
      </ThemedText>
      <View style={[styles.row, rtl && styles.rowRtl]}>
        {optionen.map((option) => {
          const aktiv = ausgewaehlt === option.wert;
          return (
            <Pressable
              key={option.wert}
              disabled={gesperrt}
              onPress={() => onWahl(option.wert)}
              accessibilityRole="button"
              accessibilityState={{ selected: aktiv, disabled: !!gesperrt }}
              style={({ pressed }) => [
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && !gesperrt && styles.pressed,
              ]}>
              <ThemedView
                type={aktiv ? 'backgroundSelected' : 'backgroundElement'}
                style={[styles.chip, aktiv && styles.chipAktiv]}>
                <ThemedText type="default" themeColor={aktiv ? 'accent' : 'text'}>
                  <Fachbegriff text={option.name} ar={option.ar} />
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  rowRtl: { flexDirection: 'row-reverse' },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipAktiv: { borderColor: 'rgba(120,90,0,0.35)' },
  textRtl: { textAlign: 'right' },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
