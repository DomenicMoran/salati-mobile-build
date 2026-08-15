import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { PRACTICE_MODES, type PracticeModeId } from '@/features/practice/modes';
import { loadMistakes } from '@/features/practice/mistakes';
import { usePracticeStats } from '@/features/practice/stats';
import { usePracticeStreak } from '@/features/practice-streak/streak';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Modi mit reinem Emoji-Icon bekommen ein echtes Ionicon; Modi, deren "Icon"
// eigentlich arabischer Content ist (Buchstabe/Form/Harakat), behalten die
// Glyphe als Text, da sie den Quiz-Typ selbst zeigt statt ihn zu dekorieren.
const MODE_ICONS: Partial<Record<PracticeModeId, IconName>> = {
  connections: 'link',
  words: 'book',
  rules: 'list',
  knowledge: 'library',
  quran: 'reader',
  sahaba: 'people-circle',
  akhlaq: 'heart',
  nikah: 'home',
  dialects: 'globe-outline',
  mix: 'shuffle',
};

export default function QuizHubScreen() {
  const { stats } = usePracticeStats();
  const { streak, jokerActive } = usePracticeStreak();
  // Anzahl gesammelter Fehler (Fehler-Wiederholungs-Karte nur zeigen, wenn >0)
  const [mistakeCount, setMistakeCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadMistakes().then((list) => {
        if (!cancelled) setMistakeCount(list.length);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );
  const { t } = useTranslation();
  const { settings } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // "Hören & auswählen" ist strukturell audio-first (kein Text zeigt die
  // Antwort vor dem Abspielen) - bei exerciseStyle 'reading' ("kann/will
  // gerade nicht hören", z. B. in der Bahn) wird die Kachel ausgeblendet
  // statt eine Text-Variante zu bauen, die eigentlich nur den bereits
  // vorhandenen 'words'-Übungsmodus (Wort lesen -> Umschrift wählen)
  // duplizieren würde (siehe listening.ts Header-Kommentar).
  const showListenGame = settings.exerciseStyle !== 'reading';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('practice.title')} subtitle={t('practice.subtitle')} />
        <FlatList
          data={PRACTICE_MODES}
          ListHeaderComponent={
            <View>
              {streak > 0 && (
                <ThemedText type="smallBold" themeColor="accent" style={styles.streakRow}>
                  🔥 {streak} {t('practice.streakDays')}
                  {jokerActive ? ` · 🛡️ ${t('practice.streakJokerUsed')}` : ''}
                </ThemedText>
              )}

              <PressableCard onPress={() => router.push('/quiz/duel')} type="backgroundSelected" style={styles.duelCard}>
                <IconSymbol name="people" size={22} color={colors.accent} />
                <View style={styles.duelText}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('duel.title')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('duel.subtitle')}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>

              {mistakeCount > 0 && (
                <PressableCard onPress={() => router.push('/quiz/mistakes')} style={styles.duelCard}>
                  <IconSymbol name="refresh-circle" size={22} color={colors.accent} />
                  <View style={styles.duelText}>
                    <ThemedText type="smallBold">{t('practice.mistakes.title')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('practice.mistakes.desc')} · {mistakeCount}
                    </ThemedText>
                  </View>
                  <DisclosureChevron size={18} color={colors.textSecondary} />
                </PressableCard>
              )}

              <View style={styles.gamesRow}>
                <View style={styles.gameItem}>
                <PressableCard onPress={() => router.push('/quiz/puzzle')} style={styles.gameCard}>
                  <IconSymbol name="extension-puzzle" size={20} color={colors.accent} />
                  <ThemedText type="smallBold">{t('practice.puzzle.title')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.gameDesc}>
                    {t('practice.puzzle.desc')}
                  </ThemedText>
                  {stats.puzzle && stats.puzzle.bestTotal > 0 && (
                    <ThemedText type="small" themeColor="accent">
                      🏆 {stats.puzzle.bestScore}/{stats.puzzle.bestTotal}
                    </ThemedText>
                  )}
                </PressableCard>
                </View>
                {showListenGame && (
                <View style={styles.gameItem}>
                <PressableCard onPress={() => router.push('/quiz/listen')} style={styles.gameCard}>
                  <IconSymbol name="ear" size={20} color={colors.accent} />
                  <ThemedText type="smallBold">{t('practice.listen.title')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.gameDesc}>
                    {t('practice.listen.desc')}
                  </ThemedText>
                  {stats.listening && stats.listening.bestTotal > 0 && (
                    <ThemedText type="small" themeColor="accent">
                      🏆 {stats.listening.bestScore}/{stats.listening.bestTotal}
                    </ThemedText>
                  )}
                </PressableCard>
                </View>
                )}
                <View style={styles.gameItem}>
                <PressableCard onPress={() => router.push('/quiz/matching')} style={styles.gameCard}>
                  <IconSymbol name="git-compare" size={20} color={colors.accent} />
                  <ThemedText type="smallBold">{t('practice.matchingGame.title')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.gameDesc}>
                    {t('practice.matchingGame.desc')}
                  </ThemedText>
                  {stats.matching && stats.matching.bestTotal > 0 && (
                    <ThemedText type="small" themeColor="accent">
                      🏆 {stats.matching.bestScore}/{stats.matching.bestTotal}
                    </ThemedText>
                  )}
                </PressableCard>
                </View>
              </View>
            </View>
          }
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const s = stats[item.id];
            const icon = MODE_ICONS[item.id];
            return (
              <AnimatedListItem index={index}>
                <PressableCard
                  onPress={() => router.push({ pathname: '/quiz/[mode]', params: { mode: item.id } })}
                  style={styles.row}>
                  <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                    {icon ? (
                      <IconSymbol name={icon} size={18} color={colors.accent} />
                    ) : (
                      <ThemedText type="default">{item.icon}</ThemedText>
                    )}
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{t(`practice.modes.${item.id}.title`)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`practice.modes.${item.id}.desc`)}
                    </ThemedText>
                  </View>
                  {s && s.bestTotal > 0 && (
                    <View style={styles.trophyRow}>
                      <IconSymbol name="trophy" size={14} color={colors.accent} />
                      <ThemedText type="smallBold" themeColor="accent">
                        {s.bestScore}/{s.bestTotal}
                      </ThemedText>
                    </View>
                  )}
                </PressableCard>
              </AnimatedListItem>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  duelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  duelText: { flex: 1, gap: 2 },
  gamesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  // Flex-Item-Props MÜSSEN auf einen Wrapper-View: PressableCard legt sein
  // style auf den inneren View, der <button> selbst würde sonst nie strecken.
  // 104 statt 150: so passen alle drei Spiel-Kacheln auf Phone-Breite in EINE
  // Reihe - mit 150 brachen sie zu 2+1 um und die dritte Kachel streckte sich
  // allein über die volle Breite (Audit 2026-07-19 B7).
  gameItem: { flexBasis: 104, minWidth: 104, flexGrow: 1 },
  gameCard: { alignItems: 'center', gap: Spacing.one, padding: Spacing.three, flexGrow: 1 },
  gameDesc: { textAlign: 'center' },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  streakRow: { textAlign: 'center', marginTop: Spacing.two, marginBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  rowText: { flex: 1, gap: Spacing.half },
  trophyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
