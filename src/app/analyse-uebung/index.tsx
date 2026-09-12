// Analyse-Übung — Einstieg: Sure/Vers wählen (oder Schnellstart-Vorschlag),
// Schwierigkeitsgrad einstellen, starten. Zeigt außerdem die zuletzt geübten
// Verse mit ihrer Trefferquote (features/quran/uebung/fortschritt.ts).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSurahList } from '@/features/quran/hooks';
import { SurahRangePicker } from '@/features/quran/SurahRangePicker';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { letzteVerse, useAnalyseUebungFortschritt } from '@/features/quran/uebung/fortschritt';
import type { Schwierigkeitsgrad } from '@/features/quran/uebung/modell';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

const SCHNELLSTART: { surah: number; ayah: number }[] = [
  { surah: 1, ayah: 1 },
  { surah: 112, ayah: 1 },
  { surah: 113, ayah: 1 },
  { surah: 114, ayah: 1 },
  { surah: 2, ayah: 1 },
];

const STUFEN: Schwierigkeitsgrad[] = [1, 2, 3];

export default function AnalyseUebungIndex() {
  const { t, locale } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const surahs = useSurahList();
  const { state: fortschrittState } = useAnalyseUebungFortschritt();

  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);
  const [stufe, setStufe] = useState<Schwierigkeitsgrad>(1);
  const [surahPickerOffen, setSurahPickerOffen] = useState(false);

  const surahMeta = surahs.data?.find((s) => s.number === surah);
  const anzahlAyahs = surahMeta?.numberOfAyahs ?? 1;
  const surahName = surahMeta ? surahNameTranslation(surah, locale, surahMeta.englishNameTranslation) : String(surah);

  const letzte = useMemo(() => letzteVerse(fortschrittState, 5), [fortschrittState]);

  function waehleVers(neuerSurah: number, neuerAyah: number) {
    setSurah(neuerSurah);
    setAyah(neuerAyah);
  }

  function versSchritt(delta: number) {
    setAyah((a) => Math.min(anzahlAyahs, Math.max(1, a + delta)));
  }

  function zufaelligerVers() {
    setAyah(1 + Math.floor(Math.random() * anzahlAyahs));
  }

  function starten() {
    router.push({
      pathname: '/analyse-uebung/uebung',
      params: { surah: String(surah), ayah: String(ayah), stufe: String(stufe) },
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('analyseUebung.title')} />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('analyseUebung.intro')}
          </ThemedText>

          <View style={styles.block}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('analyseUebung.setup.schnellstart').toUpperCase()}
            </ThemedText>
            <View style={[styles.chipRow, rtl && styles.chipRowRtl]}>
              {SCHNELLSTART.map((vorschlag) => {
                const meta = surahs.data?.find((s) => s.number === vorschlag.surah);
                const label = meta ? surahNameTranslation(vorschlag.surah, locale, meta.englishNameTranslation) : String(vorschlag.surah);
                const aktiv = surah === vorschlag.surah && ayah === vorschlag.ayah;
                return (
                  <Pressable
                    key={`${vorschlag.surah}:${vorschlag.ayah}`}
                    onPress={() => waehleVers(vorschlag.surah, vorschlag.ayah)}
                    style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                    <ThemedView type={aktiv ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                      <ThemedText type="small" themeColor={aktiv ? 'accent' : 'text'}>
                        {label}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.block}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('analyseUebung.setup.title').toUpperCase()}
            </ThemedText>
            <PressableCard onPress={() => setSurahPickerOffen(true)} type="backgroundElement" style={styles.row}>
              <ThemedText type="default">{t('analyseUebung.setup.sureWaehlen')}</ThemedText>
              <ThemedText type="default" themeColor="accent">
                {surahName}
              </ThemedText>
            </PressableCard>

            <View style={[styles.versZeile, rtl && styles.versZeileRtl]}>
              <Pressable onPress={() => versSchritt(-1)} hitSlop={8} disabled={ayah <= 1}>
                <IconSymbol
                  name={rtl ? 'chevron-forward-circle-outline' : 'chevron-back-circle-outline'}
                  size={30}
                  color={ayah <= 1 ? colors.textSecondary : colors.accent}
                />
              </Pressable>
              <ThemedText type="default" style={styles.versLabel}>
                {t('analyseUebung.setup.versWaehlen')} {ayah} / {anzahlAyahs}
              </ThemedText>
              <Pressable onPress={() => versSchritt(1)} hitSlop={8} disabled={ayah >= anzahlAyahs}>
                <IconSymbol
                  name={rtl ? 'chevron-back-circle-outline' : 'chevron-forward-circle-outline'}
                  size={30}
                  color={ayah >= anzahlAyahs ? colors.textSecondary : colors.accent}
                />
              </Pressable>
            </View>

            <PressableCard onPress={zufaelligerVers} type="backgroundElement" style={styles.zufallButton}>
              <ThemedText type="small" themeColor="accent">
                {t('analyseUebung.setup.zufaelligerVers')}
              </ThemedText>
            </PressableCard>
          </View>

          <View style={styles.block}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('analyseUebung.schwierigkeit.title').toUpperCase()}
            </ThemedText>
            {STUFEN.map((s) => {
              const aktiv = stufe === s;
              return (
                <PressableCard
                  key={s}
                  onPress={() => setStufe(s)}
                  type={aktiv ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.stufeRow}>
                  <ThemedText type="smallBold" themeColor={aktiv ? 'accent' : 'text'}>
                    {t(`analyseUebung.schwierigkeit.stufe${s}Label`)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`analyseUebung.schwierigkeit.stufe${s}Beschreibung`)}
                  </ThemedText>
                </PressableCard>
              );
            })}
          </View>

          <PressableCard onPress={starten} type="backgroundSelected" style={styles.startButton}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('analyseUebung.start')}
            </ThemedText>
          </PressableCard>

          {letzte.length > 0 && (
            <View style={styles.block}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('analyseUebung.zuletztGeuebt.title').toUpperCase()}
              </ThemedText>
              {letzte.map(({ surah: s, ayah: a, eintrag }) => {
                const meta = surahs.data?.find((m) => m.number === s);
                const label = meta ? surahNameTranslation(s, locale, meta.englishNameTranslation) : String(s);
                return (
                  <PressableCard
                    key={`${s}:${a}`}
                    onPress={() => waehleVers(s, a)}
                    type="backgroundElement"
                    style={styles.row}>
                    <ThemedText type="default">
                      {label} · {a}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('analyseUebung.zuletztGeuebt.eintrag').replace(
                        '{score}',
                        String(Math.round(eintrag.letzteTrefferquote * 100)),
                      )}
                    </ThemedText>
                  </PressableCard>
                );
              })}
            </View>
          )}
        </ScrollView>

        <SurahRangePicker
          visible={surahPickerOffen}
          title={t('analyseUebung.setup.sureWaehlen')}
          surahs={surahs.data ?? []}
          selected={surah}
          onSelect={(n) => {
            setSurah(n);
            setAyah(1);
          }}
          onClose={() => setSurahPickerOffen(false)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  block: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipRowRtl: { flexDirection: 'row-reverse' },
  chip: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
  versZeile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  versZeileRtl: { flexDirection: 'row-reverse' },
  versLabel: { minWidth: 140, textAlign: 'center' },
  zufallButton: { alignItems: 'center', padding: Spacing.two, borderRadius: Spacing.three },
  stufeRow: { padding: Spacing.three, borderRadius: Spacing.three, gap: 2 },
  startButton: { alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
  pressableWeb: { cursor: 'pointer' },
});
