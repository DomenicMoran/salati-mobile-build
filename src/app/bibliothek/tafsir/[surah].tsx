import type { Href } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { openTafsirSurah } from '@/features/bibliothek/openBook';
import { TafsirSurahReader } from '@/features/bibliothek/tafsir/TafsirSurahReader';
import { isValidTafsirSurah } from '@/features/bibliothek/tafsir/toc';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';
import { surahNameTranslation } from '@/features/quran/surahNames';

export default function TafsirSurahScreen() {
  const { surah: surahParam, block: blockParam } = useLocalSearchParams<{ surah?: string; block?: string }>();
  const { locale } = useTranslation();
  const surah = Number(surahParam);
  const block = Number(blockParam ?? '0');

  if (!isValidTafsirSurah(surah)) {
    return null;
  }

  const title = surahNameTranslation(surah, locale, `Sure ${surah}`);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={title}
          onBack={() => backOr('/bibliothek/tafsir' as Href)}
        />
        <ThemedView style={styles.readerWrap}>
          <TafsirSurahReader
            surah={surah}
            initialBlock={Number.isFinite(block) && block >= 0 ? Math.floor(block) : 0}
            onNavigateSurah={(nextSurah, nextBlock = 0) => openTafsirSurah(nextSurah, nextBlock)}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  readerWrap: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
});
