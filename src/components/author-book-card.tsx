import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  AUTHOR_MEMOIR_AMAZON_URL,
  AUTHOR_MEMOIR_BOD_URL,
  AUTHOR_MEMOIR_EBOOK_PRICE_EUR,
  AUTHOR_MEMOIR_ISBN,
  AUTHOR_MEMOIR_PRINT_PRICE_EUR,
  AUTHOR_MEMOIR_RELEASE_DATE,
  AUTHOR_MEMOIR_TITLE,
} from '@/features/author-book/constants';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

const COVER = require('../../assets/images/author-book/cover.png');

type Variant = 'settings' | 'landing';

export function AuthorBookCard({ variant = 'settings', style }: { variant?: Variant; style?: ViewStyle }) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const landing = variant === 'landing';

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ThemedView type={landing ? 'backgroundElement' : 'groupedCard'} style={[styles.card, landing && styles.cardLanding, style]}>
      <View style={[styles.row, rtl && styles.rowRtl]}>
        <Image source={COVER} style={styles.cover} contentFit="cover" accessibilityLabel={AUTHOR_MEMOIR_TITLE} />
        <View style={styles.textCol}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('authorBook.eyebrow')}
          </ThemedText>
          <ThemedText type={landing ? 'subtitle' : 'smallBold'} style={styles.title}>
            {AUTHOR_MEMOIR_TITLE}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            {t('authorBook.body')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('authorBook.meta')
              .replace('{{printPrice}}', AUTHOR_MEMOIR_PRINT_PRICE_EUR)
              .replace('{{releaseDate}}', AUTHOR_MEMOIR_RELEASE_DATE.split('-').reverse().join('.'))
              .replace('{{isbn}}', AUTHOR_MEMOIR_ISBN)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('authorBook.ebookNote').replace('{{ebookPrice}}', AUTHOR_MEMOIR_EBOOK_PRICE_EUR)}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.actions, rtl && styles.actionsRtl]}>
        <Pressable
          accessibilityRole="link"
          onPress={() => open(AUTHOR_MEMOIR_BOD_URL)}
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.ctaPrimaryText}>
            {t('authorBook.ctaBod')}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => open(AUTHOR_MEMOIR_AMAZON_URL)}
          style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('authorBook.ctaAmazon')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderRadius: 12,
  },
  cardLanding: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowRtl: { flexDirection: 'row-reverse' },
  cover: { width: 88, height: 132, borderRadius: 6 },
  textCol: { flex: 1, gap: 6 },
  title: { marginTop: 2 },
  body: { lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actionsRtl: { flexDirection: 'row-reverse' },
  ctaPrimary: {
    backgroundColor: '#b8860b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaPrimaryText: { color: '#1a1a1a' },
  ctaSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(184, 134, 11, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pressed: { opacity: 0.85 },
});
