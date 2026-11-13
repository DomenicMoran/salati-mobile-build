import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { COLLECTIONS, hadithLangsForCollection, isHadithTranslationFallback } from '@/features/hadith/api';
import { useHadithBooks, useHadithCollection, useHadithSearch } from '@/features/hadith/hooks';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template — der Server kennt
// collection dabei nicht (COLLECTIONS.find(...) -> undefined), der Titel
// bleibt leer. Der Client liest collection danach aus der echten URL und
// rendert den echten Sammlungsnamen — Server- und Client-Markup weichen
// voneinander ab (React #418, gleiches Muster wie study/[course]/index.tsx).
export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ collection: c.id }));
}

export default function HadithCollectionScreen() {
  const { collection } = useLocalSearchParams<{ collection: string }>();
  const { settings, update } = useSettings();
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const [query, setQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const meta = COLLECTIONS.find((c) => c.id === collection);
  // Für diese Sammlung existiert die gewählte Sprache nicht — ehrlich
  // ausweisen statt still auf Englisch umzuschalten (Inhalts-Audit 2026-07-27).
  const langFallback = isHadithTranslationFallback(collection, settings.hadithLanguage);
  const { data, isLoading, isError } = useHadithCollection(collection, settings.hadithLanguage);
  const books = useHadithBooks(data?.hadiths, data?.meta.sections);
  const searched = useHadithSearch(data?.hadiths, query);
  const filtered =
    query.trim() === '' && selectedBook !== null
      ? searched.filter((h) => h.reference.book === selectedBook)
      : searched;
  const showBookList = query.trim() === '' && selectedBook === null && books.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Audit 2026-07-27 (U1): die Sammlungs-Übersicht hatte nur den
            „Zurück zu den Büchern"-Chip INNERHALB der Seite, aber keinen Weg
            aus dem Screen heraus. Der Sprach-Umschalter zieht als
            trailing-Aktion in den gemeinsamen Kopf. */}
        <ScreenHeader
          title={meta?.name ?? collection}
          right={
          <Pressable
            onPress={() => {
              // Nur durch Sprachen schalten, die es für DIESE Sammlung wirklich
              // gibt — vorher rotierte der Chip stur EN/TR/AR, auch wenn die
              // Sammlung in der Sprache gar nicht existiert.
              const langs = hadithLangsForCollection(collection);
              const next = langs[(langs.indexOf(settings.hadithLanguage) + 1) % langs.length];
              update({ hadithLanguage: next });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('settings.hadithLanguage')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
            <ThemedView type="backgroundElement" style={styles.langChip}>
              <ThemedText type="small">
                {settings.hadithLanguage === 'ar' ? 'عربي' : settings.hadithLanguage.toUpperCase()}
              </ThemedText>
            </ThemedView>
          </Pressable>
          }
        />

        {langFallback && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.langFallbackNotice}>
            ⓘ {t('learn.contentFallbackNotice')}
          </ThemedText>
        )}

        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim() !== '') setSelectedBook(null);
          }}
          placeholder={t('common.search')}
          placeholderTextColor={colors.textSecondary}
          style={[styles.search, { color: colors.text }]}
        />

        {selectedBook !== null && query.trim() === '' && (
          <Pressable
            onPress={() => setSelectedBook(null)}
            style={({ pressed }) => [styles.backToBooks, rtl && styles.backToBooksRtl, pressed && styles.chipPressed]}>
            <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={16} color={colors.accent} />
            <ThemedText type="small" themeColor="accent">
              {t('hadith.backToBooks')}
            </ThemedText>
          </Pressable>
        )}

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

        {data && showBookList && (
          <FlatList
            data={books}
            keyExtractor={(b) => String(b.book)}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableCard onPress={() => setSelectedBook(item.book)} style={styles.bookRow}>
                  <ThemedText type="small" numberOfLines={2} style={styles.bookTitle}>
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.count}
                  </ThemedText>
                </PressableCard>
              </AnimatedListItem>
            )}
          />
        )}

        {data && !showBookList && (
          <FlatList
            data={filtered}
            keyExtractor={(h) => String(h.hadithnumber)}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableCard
                  onPress={() =>
                    router.push({
                      pathname: '/hadith/[collection]/[number]',
                      params: { collection, number: String(item.hadithnumber) },
                    })
                  }
                  style={styles.row}>
                  <ThemedText type="small" themeColor="textSecondary">
                    #{item.hadithnumber}
                  </ThemedText>
                  <ThemedText type="small" numberOfLines={2}>
                    {item.translation || item.arabic}
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
  langFallbackNotice: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
    textAlign: 'center',
  },
  langChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  search: {
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: { padding: Spacing.three, gap: Spacing.one },
  bookRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three },
  bookTitle: { flex: 1, marginRight: Spacing.two },
  backToBooks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  backToBooksRtl: { flexDirection: 'row-reverse' },
  chipPressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
