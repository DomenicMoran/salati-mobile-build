import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PressableCard } from '@/components/ui/pressable-card';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { booksForLocale, fetchAudiobookIndex } from '@/features/audiobooks/data';
import { AUDIOBOOK_HUB_TRACKS } from '@/features/audiobooks/tracks';
import {
  LESEFORTSCHRITT_STORAGE_KEY,
  parseLesefortschritt,
  serializeLesefortschritt,
  type Lesefortschritt,
} from '@/features/bibliothek/lesefortschritt';
import { fetchHandoutIndex } from '@/features/handouts/data';
import { handoutsForLocale } from '@/features/media/content-language';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const TRACK_LABEL_KEYS = Object.fromEntries(AUDIOBOOK_HUB_TRACKS.map((eintrag) => [eintrag.id, eintrag.labelKey]));
const TAFSIR_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/tafsir/de-rassoul';
const RASSOUL_CREDIT = 'Abu-r-Rida Muhammad Ibn Ahmad Ibn Rassoul (IB Verlag Islamische Bibliothek)';
const HADEETH_CREDIT = 'HadeethEnc.com';

interface TafsirBlock {
  from: number;
  to: number;
  text: string;
}

/**
 * Bücher, die weitergegeben werden dürfen: die eigenen Hörbuch-PDFs,
 * die Lernunterlagen und der vom Autor freigegebene Tafsir.
 * Der Kommentartext bleibt unverändert und deutsch.
 */
export default function BibliothekScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [tafsirOffen, setTafsirOffen] = useState(false);
  const [sure, setSure] = useState<number | null>(null);
  const [bloecke, setBloecke] = useState<TafsirBlock[] | null>(null);
  const [textFehler, setTextFehler] = useState(false);
  const [gespeichert, setGespeichert] = useState<Lesefortschritt | null>(null);
  const [scrollZielBlock, setScrollZielBlock] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const blockOffsetsRef = useRef<number[]>([]);
  const zuletztGespeicherterBlock = useRef<number | null>(null);

  const index = useQuery({
    queryKey: ['audiobooks', 'index'],
    queryFn: fetchAudiobookIndex,
    staleTime: 60 * 60 * 1000,
  });
  const handouts = useQuery({
    queryKey: ['handouts', 'index'],
    queryFn: fetchHandoutIndex,
    staleTime: 60 * 60 * 1000,
  });

  const buecher = index.data ? booksForLocale(index.data.entries, locale, TRACK_LABEL_KEYS) : [];
  const unterlagen = handoutsForLocale(handouts.data?.handouts ?? [], locale);

  useEffect(() => {
    void AsyncStorage.getItem(LESEFORTSCHRITT_STORAGE_KEY).then((raw) => {
      setGespeichert(parseLesefortschritt(raw));
    });
  }, []);

  const speichereFortschritt = useCallback((wert: Lesefortschritt) => {
    setGespeichert(wert);
    void AsyncStorage.setItem(LESEFORTSCHRITT_STORAGE_KEY, serializeLesefortschritt(wert)).catch(() => {});
  }, []);

  const oeffneSure = useCallback(
    (nummer: number, block = 0) => {
      setSure(nummer);
      setBloecke(null);
      setTextFehler(false);
      setScrollZielBlock(block);
      blockOffsetsRef.current = [];
      zuletztGespeicherterBlock.current = null;
      speichereFortschritt({ surah: nummer, block });
      void fetch(`${TAFSIR_BASE}/${nummer}.json`)
        .then((antwort) => {
          if (!antwort.ok) throw new Error(String(antwort.status));
          return antwort.json() as Promise<{ blocks?: TafsirBlock[] }>;
        })
        .then((daten) => setBloecke(daten.blocks ?? []))
        .catch(() => setTextFehler(true));
    },
    [speichereFortschritt],
  );

  const scrollZuBlock = useCallback((blockIndex: number) => {
    const y = blockOffsetsRef.current[blockIndex];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.two), animated: false });
      zuletztGespeicherterBlock.current = blockIndex;
      setScrollZielBlock(null);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (sure === null || scrollZielBlock === null || !bloecke?.length) return;
    const indexBlock = Math.min(scrollZielBlock, bloecke.length - 1);
    if (scrollZuBlock(indexBlock)) return;
    const handle = requestAnimationFrame(() => {
      scrollZuBlock(indexBlock);
    });
    return () => cancelAnimationFrame(handle);
  }, [bloecke, scrollZielBlock, sure, scrollZuBlock]);

  const onScrollLeser = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (sure === null || !bloecke?.length) return;
      const y = event.nativeEvent.contentOffset.y;
      let sichtbarerBlock = 0;
      for (let i = 0; i < blockOffsetsRef.current.length; i += 1) {
        const offset = blockOffsetsRef.current[i];
        if (typeof offset === 'number' && offset <= y + Spacing.four) {
          sichtbarerBlock = i;
        }
      }
      if (sichtbarerBlock === zuletztGespeicherterBlock.current) return;
      zuletztGespeicherterBlock.current = sichtbarerBlock;
      speichereFortschritt({ surah: sure, block: sichtbarerBlock });
    },
    [bloecke, speichereFortschritt, sure],
  );

  const weiterSureName =
    gespeichert != null
      ? surahNameTranslation(gespeichert.surah, locale, `Sure ${gespeichert.surah}`)
      : '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={sure ? surahNameTranslation(sure, locale, `Sure ${sure}`) : t('bibliothek.title')}
          onBack={() => {
            if (sure) {
              setSure(null);
              setScrollZielBlock(null);
              blockOffsetsRef.current = [];
              zuletztGespeicherterBlock.current = null;
            } else if (tafsirOffen) setTafsirOffen(false);
            else backOr('/media' as Href);
          }}
        />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          scrollEventThrottle={32}
          onScroll={sure ? onScrollLeser : undefined}>
          {sure ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {RASSOUL_CREDIT}
              </ThemedText>
              {textFehler ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('bibliothek.loadError')}
                </ThemedText>
              ) : null}
              {!bloecke && !textFehler ? <ThemedActivityIndicator style={styles.loader} /> : null}
              {bloecke?.map((block, blockIndex) => (
                <View
                  key={`${block.from}-${block.to}`}
                  style={styles.block}
                  onLayout={(event) => {
                    blockOffsetsRef.current[blockIndex] = event.nativeEvent.layout.y;
                    if (scrollZielBlock != null) {
                      const ziel = Math.min(scrollZielBlock, bloecke.length - 1);
                      if (blockIndex === ziel) scrollZuBlock(ziel);
                    }
                  }}>
                  <ThemedText type="smallBold">
                    {block.from === block.to ? String(block.from) : `${block.from}–${block.to}`}
                  </ThemedText>
                  <ThemedText type="default">{block.text}</ThemedText>
                </View>
              ))}
            </>
          ) : (
            <>
              {gespeichert ? (
                <PressableCard
                  onPress={() => oeffneSure(gespeichert.surah, gespeichert.block)}
                  style={styles.row}>
                  <ThemedText type="default" style={{ color: colors.accent }}>
                    {t('bibliothek.continueReading')}
                  </ThemedText>
                  <ThemedText type="default">{weiterSureName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('bibliothek.savedPlace')}
                  </ThemedText>
                </PressableCard>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {t('bibliothek.subtitle')}
              </ThemedText>
              <PressableCard onPress={() => router.push('/quran' as Href)} style={styles.row}>
                <ThemedText type="default">{t('bibliothek.quran')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('bibliothek.quranNote')}
                </ThemedText>
              </PressableCard>
              <PressableCard onPress={() => router.push('/hadith' as Href)} style={styles.row}>
                <ThemedText type="default">{t('bibliothek.hadith')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {HADEETH_CREDIT}. {t('bibliothek.hadithNote')}
                </ThemedText>
              </PressableCard>
              <PressableCard onPress={() => router.push('/audiobooks' as Href)} style={styles.row}>
                <ThemedText type="default">{t('bibliothek.audioVideo')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('audiobooks.subtitle')}
                </ThemedText>
              </PressableCard>
              {index.isPending ? <ThemedActivityIndicator style={styles.loader} /> : null}
              {buecher.map((buch) => (
                <PressableCard
                  key={buch.track}
                  onPress={() => void Linking.openURL(buch.pdf_url).catch(() => {})}
                  style={styles.row}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(buch.trackLabelKey)}
                  </ThemedText>
                  <ThemedText type="default">{t('audiobooks.bookOpen')}</ThemedText>
                </PressableCard>
              ))}
              {!index.isPending && buecher.length === 0 ? (
                <EmptyState icon="document-text" title={t('audiobooks.booksEmpty')} />
              ) : null}
              {tafsirOffen ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {RASSOUL_CREDIT}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('bibliothek.rassoulGerman')}
                  </ThemedText>
                  {Array.from({ length: 114 }, (_, indexNummer) => indexNummer + 1).map((nummer) => (
                    <PressableCard key={nummer} onPress={() => oeffneSure(nummer, 0)} style={styles.row}>
                      <ThemedText type="default">
                        {nummer}. {surahNameTranslation(nummer, locale, `Sure ${nummer}`)}
                      </ThemedText>
                    </PressableCard>
                  ))}
                </>
              ) : (
                <PressableCard onPress={() => setTafsirOffen(true)} style={styles.row}>
                  <ThemedText type="default">{t('bibliothek.rassoul')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {RASSOUL_CREDIT}
                  </ThemedText>
                </PressableCard>
              )}
              {tafsirOffen || unterlagen.length === 0 ? null : (
                <>
                  <ThemedText type="smallBold">{t('bibliothek.handouts')}</ThemedText>
                  {unterlagen.map((eintrag) => (
                    <PressableCard
                      key={eintrag.id}
                      onPress={() => void Linking.openURL(eintrag.pdf_url).catch(() => {})}
                      style={styles.row}>
                      <ThemedText type="default">{eintrag.title}</ThemedText>
                    </PressableCard>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
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
  row: { padding: Spacing.three },
  block: { gap: Spacing.two },
  loader: { marginTop: Spacing.three },
});
