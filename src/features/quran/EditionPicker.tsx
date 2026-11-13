import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { editionDisplayName, type Edition } from './api';

// Re-export: alle Call-Sites (settings.tsx, storage.tsx, [surah].tsx,
// mushaf.tsx) importieren editionDisplayName bisher von hier - die
// eigentliche (reine, testbare) Implementierung liegt in api.ts, damit sie
// per Jest testbar ist, ohne den RN/global.css-Importbaum dieser
// Picker-Komponente mitzuziehen (s. EditionPicker.test.ts in api.test.ts).
export { editionDisplayName };

interface SingleSelectProps {
  visible: boolean;
  title: string;
  editions: Edition[];
  recommended: string[];
  selected: string;
  onSelect: (identifier: string) => void;
  onClose: () => void;
  multi?: false;
}

interface MultiSelectProps {
  visible: boolean;
  title: string;
  editions: Edition[];
  recommended: string[];
  selected: string[];
  onSelect: (identifier: string) => void;
  onClose: () => void;
  multi: true;
}

type Props = SingleSelectProps | MultiSelectProps;

function isSelected(props: Props, identifier: string): boolean {
  return props.multi ? props.selected.includes(identifier) : props.selected === identifier;
}

export function EditionPicker(props: Props) {
  const { visible, title, editions, recommended, onSelect, onClose } = props;
  const { t } = useTranslation();
  const ordered = [
    ...editions.filter((e) => recommended.includes(e.identifier)),
    ...editions.filter((e) => !recommended.includes(e.identifier)),
  ];

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
            {props.multi && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {t('quran.tafsirMultiHint')}
              </ThemedText>
            )}
            <FlatList
              data={ordered}
              keyExtractor={(e) => e.identifier}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = isSelected(props, item.identifier);
                return (
                  <Pressable
                    onPress={() => onSelect(item.identifier)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed, selected && styles.rowSelected]}>
                    <ThemedText type={selected ? 'smallBold' : 'default'}>{editionDisplayName(item)}</ThemedText>
                    <View style={styles.rowRight}>
                      {recommended.includes(item.identifier) && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('common.recommended')}
                        </ThemedText>
                      )}
                      {props.multi && selected && (
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
  // width/maxWidth/alignSelf: auf breiten Displays (Tablet/Querformat) das
  // Sheet zentriert begrenzen statt edge-to-edge zu strecken; auf Phones
  // (< 640dp) unverändert volle Breite.
  sheet: { maxHeight: '75%', width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
  },
  hint: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
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
  rowSelected: { opacity: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pressableWeb: { cursor: 'pointer' },
});
