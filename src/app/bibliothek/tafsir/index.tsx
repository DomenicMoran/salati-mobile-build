import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PressableCard } from '@/components/ui/pressable-card';
import { ContentLanguageBadge } from '@/features/media/content-language-badge';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { openTafsirSurah } from '@/features/bibliothek/openBook';
import { TAFSIR_RASSOUL_CREDIT } from '@/features/bibliothek/tafsir/constants';
import { loadTafsirLesefortschritt } from '@/features/bibliothek/tafsir/TafsirSurahReader';
import { buildTafsirToc } from '@/features/bibliothek/tafsir/toc';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';
import { surahNameTranslation } from '@/features/quran/surahNames';

const TOC = buildTafsirToc();

export default function TafsirBookScreen() {
  const { t, locale } = useTranslation();
  const [fortschritt, setFortschritt] = useState<{ surah: number; block: number } | null>(null);

  useEffect(() => {
    void loadTafsirLesefortschritt().then(setFortschritt);
  }, []);

  const weiterName =
    fortschritt != null
      ? surahNameTranslation(fortschritt.surah, locale, `Sure ${fortschritt.surah}`)
      : '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('bibliothek.rassoul')} onBack={() => backOr('/bibliothek' as Href)} />
        <FlatList
          data={TOC}
          keyExtractor={(item) => String(item.surah)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="small" themeColor="textSecondary">
                {TAFSIR_RASSOUL_CREDIT}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('bibliothek.rassoulGerman')}
              </ThemedText>
              <ContentLanguageBadge lang="de" compact />
              {fortschritt ? (
                <PressableCard
                  onPress={() => openTafsirSurah(fortschritt.surah, fortschritt.block)}
                  style={styles.continueCard}>
                  <ThemedText type="default" themeColor="accent">
                    {t('bibliothek.continueReading')}
                  </ThemedText>
                  <ThemedText type="default">{weiterName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('bibliothek.savedPlace')}
                  </ThemedText>
                </PressableCard>
              ) : null}
              <ThemedText type="smallBold">{t('bibliothek.tafsirToc')}</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <PressableCard onPress={() => openTafsirSurah(item.surah, 0)} style={styles.row}>
              <ThemedText type="default">
                {item.surah}. {surahNameTranslation(item.surah, locale, `Sure ${item.surah}`)}
              </ThemedText>
            </PressableCard>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: { gap: Spacing.two, paddingBottom: Spacing.two },
  continueCard: { padding: Spacing.three },
  row: { padding: Spacing.three },
});
