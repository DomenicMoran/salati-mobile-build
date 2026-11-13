import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCardModal } from '@/components/share-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { COLLECTIONS, isHadithTranslationFallback } from '@/features/hadith/api';
import { useHadithCollection } from '@/features/hadith/hooks';
import { useSettings } from '@/features/settings/store';
import { useShareCard } from '@/features/share/useShareCard';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { hadithDeepLink } from '@/lib/deepLinks';
import { useTranslation } from '@/lib/i18n';

export default function HadithDetailScreen() {
  const { collection, number } = useLocalSearchParams<{ collection: string; number: string }>();
  const { settings } = useSettings();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const shareCard = useShareCard();
  const meta = COLLECTIONS.find((c) => c.id === collection);
  const langFallback = isHadithTranslationFallback(collection, settings.hadithLanguage);
  const { data, isLoading, isError } = useHadithCollection(collection, settings.hadithLanguage);

  const hadith = data?.hadiths.find((h) => h.hadithnumber === Number(number));
  const hadithSource = hadith
    ? `${meta?.name ?? ''} · ${t('hadith.reference')
        .replace('{book}', String(hadith.reference.book))
        .replace('{hadith}', String(hadith.reference.hadith))}`
    : '';
  // Collection+Nummer identifizieren bereits genau diesen Hadith, kein
  // zusätzlicher Query-Param nötig (anders als beim Quran-?ayah=, s. deepLinks.ts).
  const deepLink = hadithDeepLink(collection, Number(number));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={meta?.name ?? t('nav.hadith')} />
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
            <ThemedText type="small" themeColor="textSecondary" style={styles.header}>
              {meta?.name} · #{hadith.hadithnumber}
            </ThemedText>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => {
                  Share.share({
                    message:
                      settings.hadithLanguage !== 'ar'
                        ? `${hadith.arabic}\n\n${hadith.translation}\n\n— ${hadithSource}\n\n${deepLink}`
                        : `${hadith.arabic}\n\n— ${hadithSource}\n\n${deepLink}`,
                  }).catch(() => {});
                }}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('hadith.shareText')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.actionPressed]}>
                <IconSymbol name="share-outline" size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() =>
                  shareCard.open({
                    arabic: hadith.arabic,
                    translation: settings.hadithLanguage !== 'ar' ? hadith.translation : '',
                    source: hadithSource,
                    deepLink,
                  })
                }
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('hadith.shareImage')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.actionPressed]}>
                <IconSymbol name="image-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ThemedText type="default" style={styles.arabic}>
              {hadith.arabic}
            </ThemedText>

            {settings.hadithLanguage !== 'ar' && (
              <ThemedText type="default" style={styles.translation}>
                {hadith.translation}
              </ThemedText>
            )}

            {langFallback && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.reference}>
                ⓘ {t('learn.contentFallbackNotice')}
              </ThemedText>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.reference}>
              {t('hadith.reference')
                .replace('{book}', String(hadith.reference.book))
                .replace('{hadith}', String(hadith.reference.hadith))}
              {hadith.grades.length > 0
                ? ` · ${hadith.grades.map((g) => (g.grade ? `${g.name}: ${g.grade}` : g.name)).join(', ')}`
                : ''}
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
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  header: { textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  actionPressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
  arabic: { fontSize: 20, textAlign: 'right', lineHeight: 34 },
  translation: { fontSize: 16, lineHeight: 24 },
  reference: { marginTop: Spacing.two },
});
