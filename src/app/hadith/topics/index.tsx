import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { hadeethencTotalCount, topLevelCategories } from '@/features/hadith/hadeethenc';
import { useHadeethencCategories } from '@/features/hadith/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

/**
 * Themen-Einstieg der HadeethEnc-Enzyklopädie: die sieben Hauptgebiete
 * (Koran, Hadithwissenschaft, Aqida, Fiqh, Charakter, Da'wah, Sira) in der
 * App-Sprache. Anders als die Sammlungen in `/hadith/[collection]` existiert
 * dieser Bestand in ALLEN 14 App-Sprachen (siehe features/hadith/hadeethenc.ts).
 */
export default function HadeethencTopicsScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data, isLoading, isError } = useHadeethencCategories(locale);

  const topics = data ? topLevelCategories(data) : [];
  const total = data ? hadeethencTotalCount(data) : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('hadith.topicsTitle')} subtitle={t('hadith.topicsSubtitle')} />

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('hadith.loadError')}
            </ThemedText>
          </View>
        )}

        {data && (
          <FlatList
            data={topics}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.countNote}>
                {t('hadith.topicsCount').replace('{n}', String(total))}
              </ThemedText>
            }
            ListFooterComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.sourceNote}>
                {t('hadith.topicsSource')}
              </ThemedText>
            }
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableCard
                  onPress={() =>
                    router.push({ pathname: '/hadith/topics/[category]', params: { category: item.id } })
                  }
                  style={styles.row}>
                  <ThemedText type="default" style={styles.rowTitle} numberOfLines={3}>
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.count}
                  </ThemedText>
                  <DisclosureChevron size={18} color={colors.textSecondary} />
                </PressableCard>
              </AnimatedListItem>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  countNote: { marginBottom: Spacing.two, textAlign: 'center' },
  sourceNote: { marginTop: Spacing.three, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  rowTitle: { flex: 1 },
});
