// Schmales Titelbild für Hub-Screens (Guides/Studium/Duas) — echte Fotos
// (Unsplash-Lizenz, Nachweis in assets/images/guides/CREDITS.md) statt
// reiner Textwüste; User-Wunsch "Titelbilder für die Sortierungen".
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export function HubBanner({ source, noPadding }: { source: number; noPadding?: boolean }) {
  return (
    <View style={[styles.wrap, noPadding && styles.wrapNoPadding]}>
      <Image source={source} style={styles.banner} contentFit="cover" contentPosition="center" alt="" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  // Innerhalb von Listen-Headern hat der Listeninhalt bereits Padding —
  // dort ohne eigenes, sonst doppelter Rand.
  wrapNoPadding: { paddingHorizontal: 0, marginBottom: Spacing.two },
  banner: {
    width: '100%',
    height: 120,
    borderRadius: Spacing.three,
  },
});
