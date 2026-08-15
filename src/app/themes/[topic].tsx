import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { THEME_COLLECTIONS, themeCollectionById, type ThemeVerse } from '@/features/themes/collections';
import { useSurahList } from '@/features/quran/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template — der Server kennt topic
// dabei nicht (themeCollectionById(undefined) -> undefined), zeigt also nur
// ein leeres ThemedView. Der Client liest topic danach aus der echten URL
// und rendert den echten Themen-Inhalt — Server- und Client-Markup weichen
// voneinander ab (React #418, gleiches Muster wie study/[course]/index.tsx).
export function generateStaticParams() {
  return THEME_COLLECTIONS.map((c) => ({ topic: c.id }));
}

export default function ThemeDetailScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data: surahList } = useSurahList();

  const collection = themeCollectionById(topic ?? '');

  // `topic` fehlt kurz während der Web-Hydration (Client kennt den echten
  // Routen-Param noch nicht, siehe generateStaticParams-Kommentar oben) - das
  // ist ein Ladezustand, KEIN ungültiges Thema. Erst wenn topic gesetzt ist
  // und trotzdem keine Collection gefunden wird, ist es wirklich ungültig.
  // Ein bare-leeres ThemedView wirkt im Dark-Mode wie ein schwarzer Screen
  // (Colors.dark.background ist fast schwarz) - deshalb immer sichtbares
  // Feedback statt Stille.
  // Audit 2026-07-27: Beide Zweige zeigten zwar Feedback, aber KEINEN Kopf —
  // auf nativ (Themen-Stack: headerShown:false, Zurueck-Chip Web-only) war das
  // eine Sackgasse. Kopf zuerst, Zustand darunter (Muster: reels/index.tsx).
  if (!topic) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('themes.title')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!collection) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('themes.title')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const surahLabel = (surah: number) => surahList?.find((s) => s.number === surah)?.englishName ?? `${t('quran.surahs')} ${surah}`;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t(collection.titleKey)} subtitle={t(collection.introKey)} />

        <FlatList
          data={collection.verses}
          keyExtractor={(v: ThemeVerse) => `${v.surah}:${v.ayah}`}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <PressableCard
                onPress={() =>
                  router.push({ pathname: '/quran/[surah]', params: { surah: item.surah, ayah: item.ayah } })
                }
                style={styles.row}>
                <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                  <IconSymbol name="book-outline" size={16} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{surahLabel(item.surah)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('quran.verse')} {item.ayah}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: BackChipInset },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
});
