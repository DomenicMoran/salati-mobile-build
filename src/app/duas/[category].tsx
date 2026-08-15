import { useLocalSearchParams } from 'expo-router';
import { FlatList, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCardModal } from '@/components/share-card';
import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { categoryLabel, DUA_CATEGORIES, duaTranslation, duasForCategory, type Dua } from '@/features/duas/hooks';
import { canShareContentImage, shareContentImage } from '@/features/quran/shareImage';
import { useShareCard } from '@/features/share/useShareCard';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template — category ist dabei
// leer, categoryLabel('') liefert einen anderen Titel als der Client (der
// die echte category aus der URL liest) — Server- und Client-Markup weichen
// voneinander ab (React #418, gleiches Muster wie study/[course]/index.tsx).
export function generateStaticParams() {
  return DUA_CATEGORIES.map((c) => ({ category: c.id }));
}

export default function DuaCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const duas = duasForCategory(category ?? '');
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const shareCard = useShareCard();

  function shareText(dua: Dua) {
    const translation = duaTranslation(dua, locale);
    Share.share({
      message: `${dua.arabic}\n\n${dua.transliteration}${
        translation ? `\n\n${translation}` : ''
      }\n\n— ${dua.source}`,
    }).catch(() => {});
  }

  // Als Bild teilen — Web via Canvas (shareContentImage), nativ über die
  // RN-View-Karte (ShareCardModal); die Umschrift wandert als eigene Zeile in
  // die Karte (nur Duas liefern sie).
  function shareImage(dua: Dua) {
    const translation = duaTranslation(dua, locale) ?? '';
    if (canShareContentImage) {
      shareContentImage({
        arabic: dua.arabic,
        transliteration: dua.transliteration,
        translation,
        source: dua.source,
      }).catch(() => {});
    } else {
      shareCard.open({
        kind: 'dua',
        arabic: dua.arabic,
        transliteration: dua.transliteration,
        translation,
        source: dua.source,
      });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={categoryLabel(category ?? '', locale)} />

        <FlatList
          data={duas}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="default" style={styles.arabic}>
                  {item.arabic}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.transliteration}>
                  {item.transliteration}
                </ThemedText>
                {duaTranslation(item, locale) && (
                  <ThemedText type="default">{duaTranslation(item, locale)}</ThemedText>
                )}
                <View style={styles.footerRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
                    {item.source}
                  </ThemedText>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => shareText(item)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={t('duas.shareText')}
                      style={({ pressed }) => [
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <IconSymbol name="share-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      onPress={() => shareImage(item)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={t('duas.shareImage')}
                      style={({ pressed }) => [
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <IconSymbol name="image-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              </ThemedView>
            </AnimatedListItem>
          )}
        />
        <ShareCardModal content={shareCard.content} onClose={shareCard.close} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(11,11,13,0.06), 0 1px 2px rgba(11,11,13,0.08)' },
      default: {
        shadowColor: '#0b0b0d',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  arabic: { fontSize: 22, textAlign: 'right', lineHeight: 36 },
  transliteration: { fontStyle: 'italic' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
    gap: Spacing.two,
  },
  source: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
