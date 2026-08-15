// Kompakte Suren-Auswahl (114 Einträge) für die Sure+Vers-Bereichsauswahl der
// Abschnitts-Wiedergabe im Sure-Reader ([surah].tsx) — Al-Quran-Parität: ein
// Wiedergabebereich soll über Suren-Grenzen hinweg wählbar sein (z. B. "von
// Al-Fatiha Vers 1 bis Al-Baqara Vers 286"), nicht nur innerhalb der gerade
// offenen Sure. Gleiches Modal-Muster wie EditionPicker.tsx.
import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import type { SurahMeta } from './api';
import { surahNameTranslation } from './surahNames';

interface Props {
  visible: boolean;
  title: string;
  surahs: SurahMeta[];
  selected: number;
  onSelect: (surahNumber: number) => void;
  onClose: () => void;
}

export function SurahRangePicker({ visible, title, surahs, selected, onSelect, onClose }: Props) {
  const { t, locale } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
          <SafeAreaView>
            <View style={styles.header}>
              <ThemedText type="subtitle">{title}</ThemedText>
              <Pressable onPress={onClose} hitSlop={12}>
                <ThemedText type="link" themeColor="accent" style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  {t('common.done')}
                </ThemedText>
              </Pressable>
            </View>
            <FlatList
              data={surahs}
              keyExtractor={(s) => String(s.number)}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.number === selected;
                return (
                  <Pressable
                    onPress={() => onSelect(item.number)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <ThemedText type={isSelected ? 'smallBold' : 'default'}>
                      {item.number}. {surahNameTranslation(item.number, locale, item.englishNameTranslation)}
                    </ThemedText>
                    <View style={styles.rowRight}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.numberOfAyahs}
                      </ThemedText>
                      {isSelected && (
                        <ThemedText type="small" themeColor="accent">
                          ✓
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // Auf breiten Displays (Tablet/Querformat) zentriert begrenzen statt
  // edge-to-edge; auf Phones (< 640dp) unverändert volle Breite.
  sheet: { maxHeight: '75%', width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
  },
  list: { paddingHorizontal: Spacing.four },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,124,116,0.35)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  rowPressed: { opacity: 0.6 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pressableWeb: { cursor: 'pointer' },
});
