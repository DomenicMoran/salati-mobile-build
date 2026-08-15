import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { childCategories } from '@/features/hadith/hadeethenc';
import {
  flattenHadeethencPages,
  useHadeethencCategories,
  useHadeethencHadiths,
} from '@/features/hadith/hooks';
import { useTranslation } from '@/lib/i18n';

/**
 * Hadithe eines Themas. Die Unterthemen stehen als Chips über der Liste und
 * führen auf dieselbe Route mit anderer Kategorie-ID — die Enzyklopädie hat
 * bis zu 493 Kategorien in bis zu vier Ebenen, ein eigener Screen je Ebene
 * wäre reine Wiederholung.
 *
 * Bewusst OHNE generateStaticParams: die Kategorie-IDs kommen zur Laufzeit aus
 * der API und lassen sich beim Web-Export nicht aufzählen. Die Route rendert
 * darum (wie podcast/[episode].tsx) als generisches Template und liest die ID
 * client-seitig aus der URL; die passende Rewrite steht in vercel.json.
 */
export default function HadeethencCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const { t, locale } = useTranslation();

  const categoryId = category ?? '';
  const { data: categories } = useHadeethencCategories(locale);
  const current = categories?.find((c) => c.id === categoryId);
  const children = categories ? childCategories(categories, categoryId) : [];

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useHadeethencHadiths(locale, categoryId);
  const items = flattenHadeethencPages(data?.pages);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={current?.title ?? t('hadith.topicsTitle')} />

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
            data={items}
            keyExtractor={(h) => h.id}
            contentContainerStyle={styles.list}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            ListHeaderComponent={
              children.length > 0 ? (
                <View style={styles.chips}>
                  {children.map((child) => (
                    <Pressable
                      key={child.id}
                      onPress={() =>
                        router.push({
                          pathname: '/hadith/topics/[category]',
                          params: { category: child.id },
                        })
                      }
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.chipPressed,
                      ]}>
                      <ThemedView type="backgroundElement" style={styles.chip}>
                        <ThemedText type="small">
                          {child.title} · {child.count}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {t('hadith.topicsEmpty')}
              </ThemedText>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.center}>
                  <ThemedActivityIndicator />
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableCard
                  onPress={() =>
                    router.push({
                      pathname: '/hadith/topics/[category]/[id]',
                      params: { category: categoryId, id: item.id },
                    })
                  }
                  style={styles.row}>
                  <ThemedText type="small" numberOfLines={3}>
                    {item.title}
                  </ThemedText>
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
  center: { alignItems: 'center', paddingVertical: Spacing.four },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  chipPressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
  row: { padding: Spacing.three, gap: Spacing.one },
});
