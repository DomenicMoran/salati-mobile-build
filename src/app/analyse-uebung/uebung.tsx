// Analyse-Übung — Durchführung: EIN Wort im Fokus (WortFokusKarte), am Ende
// die Auswertung (ErgebnisAnsicht). Params kommen aus analyse-uebung/index.tsx.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useVerseMorphologie } from '@/features/quran/morphologieHooks';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { ErgebnisAnsicht } from '@/features/quran/uebung/ErgebnisAnsicht';
import { useAnalyseUebungFortschritt } from '@/features/quran/uebung/fortschritt';
import {
  baueSchritte,
  satzrolleOptionen,
  trefferquote,
  werteAus,
  type Antwort,
  type Ergebnis,
  type Schwierigkeitsgrad,
} from '@/features/quran/uebung/modell';
import { WortFokusKarte } from '@/features/quran/uebung/WortFokusKarte';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

export default function AnalyseUebungScreen() {
  const { surah: surahParam, ayah: ayahParam, stufe: stufeParam } = useLocalSearchParams<{
    surah: string;
    ayah: string;
    stufe: string;
  }>();
  const { t, locale } = useTranslation();
  const surahNumber = Number(surahParam) || 1;
  const ayahNumber = Number(ayahParam) || 1;
  const stufe = (Number(stufeParam) || 1) as Schwierigkeitsgrad;

  const { verse, isLoading, isError } = useVerseMorphologie(surahNumber, ayahNumber, true);
  const quranFont = useQuranFont();
  const { record } = useAnalyseUebungFortschritt();

  const schritte = useMemo(() => (verse ? baueSchritte(verse, stufe) : []), [verse, stufe]);
  const satzrolleListe = useMemo(() => satzrolleOptionen(schritte), [schritte]);

  const [index, setIndex] = useState(0);
  const [antworten, setAntworten] = useState<Record<number, Antwort>>({});
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  const fillWidth = useSharedValue(0);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fillWidth.value}%` }));
  useEffect(() => {
    const pct = schritte.length > 0 ? (index / schritte.length) * 100 : 0;
    fillWidth.value = withTiming(pct, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [index, schritte.length, fillWidth]);

  const titel = `${surahNameTranslation(surahNumber, locale, String(surahNumber))} · ${ayahNumber}`;

  function starteNeu() {
    setIndex(0);
    setAntworten({});
    setAufgedeckt(false);
    setErgebnis(null);
  }

  function schrittWeiter() {
    const schritt = schritte[index];
    if (!schritt) return;
    if (index + 1 < schritte.length) {
      setIndex(index + 1);
      setAufgedeckt(false);
    } else {
      const auswertung = werteAus(schritte, antworten);
      setErgebnis(auswertung);
      record(surahNumber, ayahNumber, stufe, trefferquote(auswertung));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={titel} variant="modal" closeLabel="x" onBack={() => backOr('/analyse-uebung')} />

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}

        {!isLoading && isError && (
          <EmptyState
            icon="alert-circle-outline"
            title={t('common.error')}
            actionLabel={t('common.retry')}
            onAction={() => backOr('/analyse-uebung')}
          />
        )}

        {!isLoading && !isError && !verse && (
          <EmptyState icon="alert-circle-outline" title={t('common.error')} />
        )}

        {verse && schritte.length === 0 && (
          <EmptyState icon="information-circle-outline" title={t('analyseUebung.setup.keineWorteHinweis')} />
        )}

        {verse && schritte.length > 0 && !ergebnis && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedView type="backgroundElement" style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fillStyle]} />
            </ThemedView>
            <WortFokusKarte
              key={schritte[index].wort.word.position}
              schritt={schritte[index]}
              index={index + 1}
              gesamt={schritte.length}
              verseWords={verse}
              satzrolleOptionenListe={satzrolleListe}
              antwort={antworten[schritte[index].wort.word.position] ?? {}}
              onAntwortChange={(patch) =>
                setAntworten((prev) => ({
                  ...prev,
                  [schritte[index].wort.word.position]: { ...prev[schritte[index].wort.word.position], ...patch },
                }))
              }
              aufgedeckt={aufgedeckt}
              onAufdecken={() => setAufgedeckt(true)}
              onWeiter={schrittWeiter}
              istLetzter={index + 1 === schritte.length}
              quranFont={quranFont}
            />
          </ScrollView>
        )}

        {verse && ergebnis && (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="title" style={styles.ergebnisTitel}>
              {t('analyseUebung.ergebnis.title')}
            </ThemedText>
            <ErgebnisAnsicht
              ergebnis={ergebnis}
              surah={surahNumber}
              ayah={ayahNumber}
              quranFont={quranFont}
              onNocheinmal={starteNeu}
              onZurUebersicht={() => backOr('/analyse-uebung')}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  ergebnisTitel: { textAlign: 'center' },
});
