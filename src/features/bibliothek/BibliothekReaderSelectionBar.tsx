import { StyleSheet, View } from 'react-native';

import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

type Props = {
  onShareQuote: () => void;
  onLookup: () => void;
  onDismiss?: () => void;
};

export function BibliothekReaderSelectionBar({ onShareQuote, onLookup, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <PressableCard onPress={onShareQuote} style={styles.btn}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('bibliothek.readerShareQuote')}
        </ThemedText>
      </PressableCard>
      <PressableCard onPress={onLookup} style={styles.btn}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('bibliothek.readerDictionary')}
        </ThemedText>
      </PressableCard>
      {onDismiss ? (
        <PressableCard onPress={onDismiss} style={styles.btn}>
          <ThemedText type="smallBold">{t('a11y.close')}</ThemedText>
        </PressableCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  btn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
});
