import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCardModal } from '@/components/share-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { HADEETHENC_ATTRIBUTION } from '@/features/hadith/hadeethenc';
import { useHadeethencHadith } from '@/features/hadith/hooks';
import { useShareCard } from '@/features/share/useShareCard';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { hadeethencDeepLink } from '@/lib/deepLinks';
import { useTranslation } from '@/lib/i18n';

/**
 * Ein Hadith aus der HadeethEnc-Enzyklopädie mit allem, was die Redaktion
 * mitliefert: Urtext, Übersetzung, Graduierung, Quellenangabe, Erläuterung
 * und die abgeleiteten Lehren.
 *
 * Die Anbieterbedingungen verlangen unveränderte Wiedergabe MIT Quellennennung
 * — darum steht „HadeethEnc.com" sowohl im Screen als auch in jedem Teilen-Text
 * und auf der Teilen-Karte (siehe features/hadith/hadeethenc.ts).
 */
export default function HadeethencHadithScreen() {
  const { category, id } = useLocalSearchParams<{ category: string; id: string }>();
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const shareCard = useShareCard();

  const hadithId = id ?? '';
  const { data: hadith, isLoading, isError } = useHadeethencHadith(locale, hadithId);
  const deepLink = hadeethencDeepLink(category ?? '', hadithId);
  const source = hadith
    ? [hadith.attribution, hadith.grade, HADEETHENC_ATTRIBUTION].filter((p) => p !== '').join(' · ')
    : '';

  function shareText() {
    if (!hadith) return;
    const body = [hadith.arabic, hadith.translation, `— ${source}`, deepLink]
      .filter((p) => p !== '')
      .join('\n\n');
    Share.share({ message: body }).catch(() => {});
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('hadith.topicsTitle')} />

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('hadith.itemLoadError')}
            </ThemedText>
          </View>
        )}

        {hadith && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={shareText}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('hadith.shareText')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.actionPressed,
                ]}>
                <IconSymbol name="share-outline" size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() =>
                  shareCard.open({
                    arabic: hadith.arabic,
                    translation: hadith.translation,
                    source,
                    deepLink,
                  })
                }
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('hadith.shareImage')}
                style={({ pressed }) => [
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.actionPressed,
                ]}>
                <IconSymbol name="image-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ThemedText type="default" style={styles.arabic}>
              {hadith.arabic}
            </ThemedText>

            {hadith.translation !== '' && (
              <ThemedText type="default" style={styles.translation}>
                {hadith.translation}
              </ThemedText>
            )}

            <ThemedText type="small" themeColor="textSecondary">
              {[hadith.attribution, hadith.grade].filter((p) => p !== '').join(' · ')}
            </ThemedText>

            {hadith.explanation !== '' && (
              <View style={styles.block}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('hadith.explanation').toUpperCase()}
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.blockBody}>
                  <ThemedText type="small" style={styles.paragraph}>
                    {hadith.explanation}
                  </ThemedText>
                </ThemedView>
              </View>
            )}

            {hadith.hints.length > 0 && (
              <View style={styles.block}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('hadith.benefits').toUpperCase()}
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.blockBody}>
                  {hadith.hints.map((hint, i) => (
                    <ThemedText key={`${hadith.id}-hint-${i}`} type="small" style={styles.paragraph}>
                      • {hint}
                    </ThemedText>
                  ))}
                </ThemedView>
              </View>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.sourceNote}>
              {t('hadith.topicsSource')}
            </ThemedText>
          </ScrollView>
        )}

        <ShareCardModal content={shareCard.content} onClose={shareCard.close} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  actionPressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
  arabic: { fontSize: 20, textAlign: 'right', lineHeight: 34 },
  translation: { fontSize: 16, lineHeight: 24 },
  block: { gap: Spacing.two },
  blockBody: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two },
  paragraph: { lineHeight: 20 },
  sourceNote: { marginTop: Spacing.two, textAlign: 'center' },
});
