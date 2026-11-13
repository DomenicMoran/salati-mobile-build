import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { PressableCard } from '@/components/ui/pressable-card';
import { Spacing } from '@/constants/theme';
import {
  LESEFORTSCHRITT_STORAGE_KEY,
  TAFSIR_LESEFORTSCHRITT_UPDATED_KEY,
  parseLesefortschritt,
  serializeLesefortschritt,
  type Lesefortschritt,
} from '@/features/bibliothek/lesefortschritt';
import { fetchRassoulTafsirSurah } from '@/features/bibliothek/tafsir/api';
import { TAFSIR_RASSOUL_CREDIT } from '@/features/bibliothek/tafsir/constants';
import { quranSurahDeepLinkForTafsir } from '@/features/bibliothek/tafsir/links';
import { adjacentTafsirSurah } from '@/features/bibliothek/tafsir/toc';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { useTranslation } from '@/lib/i18n';

type Props = {
  surah: number;
  initialBlock?: number;
  onNavigateSurah: (surah: number, block?: number) => void;
};

export function TafsirSurahReader({ surah, initialBlock = 0, onNavigateSurah }: Props) {
  const { t, locale } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const blockOffsetsRef = useRef<number[]>([]);
  const zuletztGespeicherterBlock = useRef<number | null>(null);
  const scrollZielBlockRef = useRef(initialBlock);
  const scrollZielErledigtRef = useRef(false);

  const {
    data: bloecke,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['tafsir', 'bibliothek', 'de-rassoul', surah],
    queryFn: () => fetchRassoulTafsirSurah(surah),
    staleTime: 60 * 60 * 1000,
  });

  const speichereFortschritt = useCallback((wert: Lesefortschritt) => {
    const payload = serializeLesefortschritt(wert);
    const ts = new Date().toISOString();
    void AsyncStorage.multiSet([
      [LESEFORTSCHRITT_STORAGE_KEY, payload],
      [TAFSIR_LESEFORTSCHRITT_UPDATED_KEY, ts],
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    blockOffsetsRef.current = [];
    zuletztGespeicherterBlock.current = null;
    scrollZielBlockRef.current = initialBlock;
    scrollZielErledigtRef.current = false;
    speichereFortschritt({ surah, block: initialBlock });
  }, [initialBlock, speichereFortschritt, surah]);

  const scrollZuBlock = useCallback((blockIndex: number) => {
    const y = blockOffsetsRef.current[blockIndex];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.two), animated: false });
      zuletztGespeicherterBlock.current = blockIndex;
      scrollZielErledigtRef.current = true;
      return true;
    }
    return false;
  }, []);

  const onScrollLeser = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!bloecke?.length) return;
      const y = event.nativeEvent.contentOffset.y;
      let sichtbarerBlock = 0;
      for (let i = 0; i < blockOffsetsRef.current.length; i += 1) {
        const offset = blockOffsetsRef.current[i];
        if (typeof offset === 'number' && offset <= y + Spacing.four) sichtbarerBlock = i;
      }
      if (sichtbarerBlock === zuletztGespeicherterBlock.current) return;
      zuletztGespeicherterBlock.current = sichtbarerBlock;
      speichereFortschritt({ surah, block: sichtbarerBlock });
    },
    [bloecke, speichereFortschritt, surah],
  );

  const { prev, next } = adjacentTafsirSurah(surah);

  const openQuran = useCallback(
    (ayah?: number) => {
      void Linking.openURL(quranSurahDeepLinkForTafsir(surah, ayah)).catch(() => {});
    },
    [surah],
  );

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      scrollEventThrottle={32}
      onScroll={onScrollLeser}>
      <ThemedText type="small" themeColor="textSecondary">
        {TAFSIR_RASSOUL_CREDIT}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('bibliothek.rassoulGerman')}
      </ThemedText>
      {locale !== 'de' ? (
        <ThemedText type="small" themeColor="textSecondary">
          ⓘ {t('bibliothek.tafsirGermanOnly')}
        </ThemedText>
      ) : null}
      <View style={styles.navRow}>
        {prev != null ? (
          <PressableCard onPress={() => onNavigateSurah(prev, 0)} style={styles.navBtn}>
            <ThemedText type="smallBold" themeColor="accent">
              ← {prev}. {surahNameTranslation(prev, locale, `Sure ${prev}`)}
            </ThemedText>
          </PressableCard>
        ) : (
          <View style={styles.navSpacer} />
        )}
        {next != null ? (
          <PressableCard onPress={() => onNavigateSurah(next, 0)} style={styles.navBtn}>
            <ThemedText type="smallBold" themeColor="accent">
              {next}. {surahNameTranslation(next, locale, `Sure ${next}`)} →
            </ThemedText>
          </PressableCard>
        ) : null}
      </View>
      <PressableCard onPress={() => openQuran()} style={styles.quranLink}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('bibliothek.openInQuran')}
        </ThemedText>
      </PressableCard>
      {isError ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('bibliothek.loadError')}
        </ThemedText>
      ) : null}
      {isPending ? <ThemedActivityIndicator style={styles.loader} /> : null}
      {bloecke?.map((block, blockIndex) => (
        <View
          key={`${block.from}-${block.to}-${blockIndex}`}
          style={styles.block}
          onLayout={(event) => {
            blockOffsetsRef.current[blockIndex] = event.nativeEvent.layout.y;
            if (!scrollZielErledigtRef.current && bloecke) {
              const ziel = Math.min(scrollZielBlockRef.current, bloecke.length - 1);
              if (blockIndex === ziel) scrollZuBlock(ziel);
            }
          }}>
          <Pressable
            onPress={() => openQuran(block.from)}
            accessibilityRole="link"
            accessibilityLabel={`${t('bibliothek.openInQuran')} ${block.from}`}>
            <ThemedText type="smallBold" themeColor="accent">
              {block.from === block.to ? String(block.from) : `${block.from}–${block.to}`}
            </ThemedText>
          </Pressable>
          <ThemedText type="default">{block.text}</ThemedText>
        </View>
      ))}
    </ScrollView>
  );
}

export async function loadTafsirLesefortschritt(): Promise<Lesefortschritt | null> {
  const raw = await AsyncStorage.getItem(LESEFORTSCHRITT_STORAGE_KEY);
  return parseLesefortschritt(raw);
}

const styles = StyleSheet.create({
  content: { gap: Spacing.two, paddingBottom: Spacing.six },
  block: { gap: Spacing.two },
  loader: { marginTop: Spacing.two },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'space-between' },
  navBtn: { flexGrow: 1, padding: Spacing.two },
  navSpacer: { flex: 1 },
  quranLink: { padding: Spacing.two },
});
